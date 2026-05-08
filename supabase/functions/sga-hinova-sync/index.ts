// deno-lint-ignore-file no-explicit-any
/**
 * sga-hinova-sync — Orquestrador de cadastro Associado + Veículo + Fotos no SGA Hinova.
 *
 * REGRA ÚNICA E GERAL DE ENVIO PARA O SGA:
 *   1. Autenticar (token de usuário)
 *   2. Buscar associado por CPF (GET /associado/buscar/{cpf}/cpf)
 *      → existe? reusa codigo_associado e a lista veiculos[] retornada
 *      → não? POST /associado/cadastrar e captura codigo_associado
 *   3. Buscar veículo por placa (GET /veiculo/consultar/placa/{placa}) e/ou chassi
 *      → existe e é do mesmo associado? reusa codigo_veiculo
 *      → existe mas é de OUTRO associado? falha permanente (conflito)
 *      → não existe? POST /veiculo/cadastrar vinculado ao codigo_associado
 *   4. Cadastrar fotos (POST /veiculo/foto/cadastrar) em lotes de até 50
 *   5. Persistir codigo_hinova local e marcar fila como concluída
 *
 * Compat: contrato de entrada/saída idêntico à versão anterior — chamadores não mudam.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getHinovaCreds,
  autenticarHinova,
  buscarAssociadoComVeiculosPorCpf,
  buscarVeiculoPorPlaca,
  buscarVeiculoPorChassi,
  cadastrarAssociadoHinova,
  cadastrarVeiculoHinova,
  alterarSituacaoAssociadoHinova,
  cadastrarFotosVeiculoHinova,
  HinovaTransientError,
  HinovaNotFoundError,
  type HinovaSession,
} from '../_shared/hinova-client.ts';
import {
  buildAssociadoPayload,
  buildVeiculoPayload,
  buildFotosPayload,
  chunk,
  cleanAlphaNum,
  cleanDigits,
  isPlacaPlaceholder,
  type AssociadoCtx,
  type VeiculoCtx,
  type DocumentoEntrada,
} from '../_shared/hinova-payloads.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  veiculo_id: string;
  associado_id: string;
  status_sga_destino?: 'pendente' | 'ativo';
  usuario_id?: string | null;
  usuario_nome?: string | null;
  etapa_origem?: string | null;
  motivo_decisao?: string | null;
  bypass_guard_base_antiga?: boolean;
  force_resync_media?: boolean;
  action?: 'test_connection';
}

const STALE_LOCK_MS = 5 * 60 * 1000;
const QUEUE_BACKOFF_MS = 10 * 60 * 1000;
const MAX_TENTATIVAS = 10;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // ---- Helpers locais ----
  async function logSync(
    veiculo_id: string | null,
    associado_id: string | null,
    action: string,
    status: 'success' | 'error' | 'info' | 'warning' | 'skipped',
    request_payload: any,
    response_payload: any,
    error_message: string | null = null,
  ) {
    try {
      await supabase.from('sga_sync_logs').insert({
        veiculo_id, associado_id, action, status,
        request_payload, response_payload, error_message,
        duracao_ms: Date.now() - startTime,
      });
    } catch (e) {
      console.error('[logSync]', e);
    }
  }

  async function upsertQueue(
    veiculo_id: string,
    associado_id: string,
    etapa: string,
    erro: string,
    codigo_associado_hinova: number | null = null,
    codigo_veiculo_hinova: number | null = null,
  ) {
    try {
      const { data: existing } = await supabase
        .from('sga_sync_queue')
        .select('id, tentativas')
        .eq('veiculo_id', veiculo_id)
        .eq('associado_id', associado_id)
        .maybeSingle();
      const tentativas = (existing?.tentativas || 0) + 1;
      const proximo = new Date(Date.now() + QUEUE_BACKOFF_MS).toISOString();
      const base = {
        status: tentativas >= MAX_TENTATIVAS ? 'falha_permanente' : 'pendente',
        tentativas,
        ultima_tentativa_em: new Date().toISOString(),
        proximo_reenvio_em: proximo,
        erro_ultimo: erro,
        etapa_parou: etapa,
        ...(codigo_associado_hinova && { codigo_associado_hinova }),
        ...(codigo_veiculo_hinova && { codigo_veiculo_hinova }),
      };
      if (existing) {
        await supabase.from('sga_sync_queue').update(base).eq('id', existing.id);
      } else {
        await supabase.from('sga_sync_queue').insert({
          veiculo_id, associado_id, origem: 'automatico',
          ...base,
        });
      }
    } catch (e) {
      console.error('[upsertQueue]', e);
    }
  }

  async function markQueueDone(veiculo_id: string, associado_id: string) {
    try {
      await supabase.from('sga_sync_queue')
        .update({ status: 'concluido', ultima_tentativa_em: new Date().toISOString() })
        .eq('veiculo_id', veiculo_id).eq('associado_id', associado_id);
    } catch (e) {
      console.error('[markQueueDone]', e);
    }
  }

  async function markQueueFalhaPermanente(veiculo_id: string, associado_id: string, motivo: string) {
    try {
      await supabase.from('sga_sync_queue')
        .update({ status: 'falha_permanente', erro_ultimo: motivo, ultima_tentativa_em: new Date().toISOString() })
        .eq('veiculo_id', veiculo_id).eq('associado_id', associado_id);
    } catch (e) {
      console.error('[markQueueFalhaPermanente]', e);
    }
  }

  async function setStatusSga(veiculo_id: string, status: string) {
    try { await supabase.from('veiculos').update({ status_sga: status }).eq('id', veiculo_id); }
    catch (e) { console.error('[setStatusSga]', e); }
  }

  // ---- Carregamento de credenciais e códigos da conta ----
  let codigoConta = Number.parseInt(Deno.env.get('HINOVA_CODIGO_CONTA') || '', 10);
  let codigoRegional = Number.parseInt(Deno.env.get('HINOVA_CODIGO_REGIONAL') || '', 10);
  let codigoCooperativa = Number.parseInt(Deno.env.get('HINOVA_CODIGO_COOPERATIVA') || '', 10);
  let codigoVoluntarioPadrao = Number.parseInt(Deno.env.get('HINOVA_CODIGO_VOLUNTARIO') || '', 10);
  let codigoSituacaoPendente = Number.parseInt(Deno.env.get('HINOVA_CODIGO_SITUACAO_PENDENTE') || '', 10);
  let codigoSituacaoAtivo = Number.parseInt(Deno.env.get('HINOVA_CODIGO_SITUACAO_ATIVO') || '', 10);
  let codigoTipoCobrancaPadrao: number | undefined;
  let codigoComoConheceuPadrao: number | undefined;
  let codigoProfissaoPadrao: number | undefined;

  try {
    const { data } = await supabase
      .from('integracoes_credenciais')
      .select('credenciais_encrypted, iv, configurado')
      .eq('integracao', 'hinova')
      .single();
    if (data?.configurado) {
      // Decrypt mínimo para extrair códigos auxiliares (se ENV não tiver)
      const enc = new TextEncoder();
      const km = await crypto.subtle.importKey('raw', enc.encode(supabaseServiceKey), { name: 'PBKDF2' }, false, ['deriveKey']);
      const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: enc.encode('integracoes_credenciais_salt'), iterations: 100000, hash: 'SHA-256' },
        km, { name: 'AES-GCM', length: 256 }, false, ['decrypt'],
      );
      const ct = Uint8Array.from(atob(data.credenciais_encrypted), c => c.charCodeAt(0));
      const iv = Uint8Array.from(atob(data.iv), c => c.charCodeAt(0));
      const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
      const cred = JSON.parse(new TextDecoder().decode(dec));
      if (!Number.isFinite(codigoConta)) codigoConta = Number.parseInt(cred.codigo_conta || '', 10);
      if (!Number.isFinite(codigoRegional)) codigoRegional = Number.parseInt(cred.codigo_regional || '', 10);
      if (!Number.isFinite(codigoCooperativa)) codigoCooperativa = Number.parseInt(cred.codigo_cooperativa || '', 10);
      if (!Number.isFinite(codigoVoluntarioPadrao)) codigoVoluntarioPadrao = Number.parseInt(cred.codigo_voluntario || '', 10);
      if (!Number.isFinite(codigoSituacaoPendente)) codigoSituacaoPendente = Number.parseInt(cred.codigo_situacao_pendente || '', 10);
      if (!Number.isFinite(codigoSituacaoAtivo)) codigoSituacaoAtivo = Number.parseInt(cred.codigo_situacao_ativo || '', 10);
      const tcr = Number.parseInt(cred.codigo_tipo_cobranca_recorrente_padrao || '', 10);
      if (Number.isFinite(tcr)) codigoTipoCobrancaPadrao = tcr;
      const cc = Number.parseInt(cred.codigo_como_conheceu_padrao || '', 10);
      if (Number.isFinite(cc)) codigoComoConheceuPadrao = cc;
      const cp = Number.parseInt(cred.codigo_profissao_padrao || '', 10);
      if (Number.isFinite(cp)) codigoProfissaoPadrao = cp;
    }
  } catch (e) {
    console.warn('[sga-hinova-sync] erro ao ler integracoes_credenciais:', e);
  }

  // codigo_conta é OPCIONAL no Hinova: só é exigido quando a regional tem >1 conta bancária.
  // Se vazio, omitimos do payload e o SGA usa a conta default.
  if (!Number.isFinite(codigoConta) || codigoConta <= 0) {
    codigoConta = NaN; // sinaliza "não enviar"
    console.warn('[sga-hinova-sync] codigo_conta não configurado — usando conta default da regional.');
  }

  // ---- Fallback hardcoded para situação do veículo no SGA ----
  // Códigos confirmados via GET /listar/situacao/todos do Hinova:
  //   1 = ATIVO, 3 = PENDENTE, 11 = EXCLUIDO, 12 = CANCELAMENTO
  // Sem esse fallback, omitimos `codigo_situacao` no payload de cadastro e o
  // Hinova aplica ATIVO por default — quebrando a regra "veículo entra como pendente".
  // ENV/credencial continuam tendo prioridade; só caímos nos defaults quando ausentes.
  if (!Number.isFinite(codigoSituacaoPendente) || codigoSituacaoPendente <= 0) {
    console.warn('[sga-hinova-sync] HINOVA_CODIGO_SITUACAO_PENDENTE ausente — usando default 3 (PENDENTE).');
    codigoSituacaoPendente = 3;
  }
  if (!Number.isFinite(codigoSituacaoAtivo) || codigoSituacaoAtivo <= 0) {
    console.warn('[sga-hinova-sync] HINOVA_CODIGO_SITUACAO_ATIVO ausente — usando default 1 (ATIVO).');
    codigoSituacaoAtivo = 1;
  }

  let req_body: SyncRequest;
  try { req_body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ success: false, error: 'JSON inválido' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // ---- Modo teste de conexão ----
  if (req_body.action === 'test_connection') {
    try {
      const creds = await getHinovaCreds(supabase);
      if (!creds) throw new Error('Credenciais não configuradas');
      const session = await autenticarHinova(creds);
      if (!session) throw new Error('Falha na autenticação');
      return new Response(JSON.stringify({ success: true, mensagem: 'Conexão OK' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (e: any) {
      return new Response(JSON.stringify({ success: false, error: String(e?.message || e) }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  const { veiculo_id, associado_id } = req_body;
  if (!veiculo_id || !associado_id) {
    return new Response(JSON.stringify({ success: false, error: 'veiculo_id e associado_id obrigatórios' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  let statusDestino: 'pendente' | 'ativo' = req_body.status_sga_destino === 'ativo' ? 'ativo' : 'pendente';

  // Downgrade ativo → pendente se cobertura R/F sem cobertura_total
  if (statusDestino === 'ativo') {
    const { data: vRule } = await supabase.from('veiculos')
      .select('cobertura_roubo_furto, cobertura_total').eq('id', veiculo_id).maybeSingle();
    if (vRule && vRule.cobertura_roubo_furto === true && vRule.cobertura_total !== true) {
      console.warn(`[sga] Downgrade ativo→pendente: veiculo ${veiculo_id} R/F sem cobertura_total.`);
      statusDestino = 'pendente';
    }
  }

  // ---- Auditoria da decisão ----
  try {
    let nomeAud = req_body.usuario_nome || 'Sistema';
    if (req_body.usuario_id && !req_body.usuario_nome) {
      const { data: p } = await supabase.from('profiles').select('nome, email').eq('id', req_body.usuario_id).maybeSingle();
      nomeAud = p?.nome || p?.email || 'Sistema';
    }
    await supabase.from('logs_auditoria').insert({
      usuario_id: req_body.usuario_id || null, usuario_nome: nomeAud,
      acao: 'decisao_sga', modulo: 'diretoria', tabela: 'sga_sync_logs',
      registro_id: veiculo_id,
      descricao: `Regra decidiu enviar para o SGA como ${statusDestino}`,
      dados_novos: {
        etapa: req_body.etapa_origem || 'sga-hinova-sync',
        motivo: req_body.motivo_decisao || `Envio ${statusDestino}`,
        status_sga_destino: statusDestino, veiculo_id, associado_id,
      },
    });
  } catch (e) { console.error('[auditoria]', e); }

  // ---- Guard de idempotência + lock ----
  const { data: vCheck } = await supabase.from('veiculos')
    .select('sincronizado_hinova, codigo_hinova, status_sga')
    .eq('id', veiculo_id).single();

  if (!req_body.force_resync_media && vCheck?.sincronizado_hinova && vCheck?.codigo_hinova
      && (statusDestino !== 'ativo' || vCheck?.status_sga === 'ativado_sga')) {
    await logSync(veiculo_id, associado_id, 'idempotency_guard', 'skipped',
      { status_sga_destino: statusDestino }, { codigo_hinova: vCheck.codigo_hinova });
    await markQueueDone(veiculo_id, associado_id);
    return new Response(JSON.stringify({ success: true, data: { already_synced: true, codigo_veiculo_hinova: vCheck.codigo_hinova } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (vCheck?.status_sga === 'sincronizando') {
    const { data: lastLog } = await supabase.from('sga_sync_logs')
      .select('created_at').eq('veiculo_id', veiculo_id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    const lockAge = lastLog?.created_at ? Date.now() - new Date(lastLog.created_at).getTime() : Infinity;
    if (lockAge < STALE_LOCK_MS) {
      await logSync(veiculo_id, associado_id, 'idempotency_guard', 'skipped', { lockAge }, null);
      return new Response(JSON.stringify({ success: true, data: { already_in_progress: true } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    await logSync(veiculo_id, associado_id, 'stale_lock_recovery', 'info', { lockAge }, null);
  }

  await setStatusSga(veiculo_id, 'sincronizando');

  // ============================================================
  // BACKGROUND SYNC
  // ============================================================
  const doSync = async () => {
    const _vid = veiculo_id;
    const _aid = associado_id;
    let codigoAssociadoHinova: number | null = null;
    let codigoVeiculoHinova: number | null = null;

    try {
      // 1. Carregar associado, veículo, contrato
      const { data: associado, error: errA } = await supabase
        .from('associados').select('*').eq('id', _aid).single();
      if (errA || !associado) {
        await logSync(_vid, _aid, 'buscar_associado_local', 'error', null, null, 'Associado não encontrado no banco');
        await setStatusSga(_vid, 'erro_sincronizacao');
        await upsertQueue(_vid, _aid, 'associado', 'Associado não encontrado no banco');
        return;
      }
      codigoAssociadoHinova = associado.codigo_hinova ?? null;

      // Guard base antiga
      // Regra: associado vindo de 'api_externa' NÃO pode ser cadastrado novamente no SGA
      // (evita duplicidade). PORÉM, se ele já tem codigo_hinova preenchido, significa
      // que o associado já existe no SGA e estamos apenas ADICIONANDO uma nova placa
      // a ele — esse caso é seguro, pois o fluxo abaixo reaproveita o codigo_associado
      // existente e só cadastra o veículo novo. Por isso fazemos bypass automático.
      if (associado.origem_cadastro === 'api_externa') {
        if (associado.codigo_hinova) {
          await logSync(_vid, _aid, 'guard_base_antiga_auto_bypass', 'info',
            { codigo_hinova_reutilizado: associado.codigo_hinova,
              motivo: 'Associado já existe no SGA (codigo_hinova preenchido). Cadastrando apenas o novo veículo.' },
            null);
        } else if (req_body.bypass_guard_base_antiga) {
          await logSync(_vid, _aid, 'guard_base_antiga_bypass_manual', 'info',
            { motivo: 'Bypass manual solicitado via flag' }, null);
        } else {
          const msg = `Associado base antiga sem codigo_hinova. Envio bloqueado para evitar duplicidade — preencha o codigo_hinova ou use bypass_guard_base_antiga=true para forçar.`;
          await logSync(_vid, _aid, 'guard_base_antiga', 'error', null, null, msg);
          await setStatusSga(_vid, 'erro_sincronizacao');
          return;
        }
      }

      const { data: veiculo, error: errV } = await supabase
        .from('veiculos').select('*').eq('id', _vid).single();
      if (errV || !veiculo) {
        await logSync(_vid, _aid, 'buscar_veiculo_local', 'error', null, null, 'Veículo não encontrado');
        await setStatusSga(_vid, 'erro_sincronizacao');
        await upsertQueue(_vid, _aid, 'veiculo', 'Veículo não encontrado no banco');
        return;
      }

      // Validações mínimas — a Hinova exige placa e chassi.
      // RENAVAM é dispensado para 0KM (placa começando com "0KM" ou
      // aguardando_placa_definitiva=true) — o documento ainda não foi emitido.
      // Placeholder "0000000" é tratado como vazio para evitar rejeição da Hinova.
      const placaUpper = String(veiculo.placa || '').toUpperCase();
      const isZeroKm = placaUpper.startsWith('0KM') || veiculo.aguardando_placa_definitiva === true;
      const renavamLimpo = String(veiculo.renavam || '').replace(/\D/g, '');
      const renavamValido = renavamLimpo && !/^0+$/.test(renavamLimpo);
      if (!renavamValido && veiculo.renavam) {
        // limpa placeholder no banco para não vazar para a Hinova
        await supabase.from('veiculos').update({ renavam: null }).eq('id', _vid);
        veiculo.renavam = null;
      }

      const obrigatorios: Array<{ k: string; v: any; label: string }> = [
        { k: 'placa', v: veiculo.placa, label: 'PLACA' },
        { k: 'chassi', v: veiculo.chassi, label: 'CHASSI' },
      ];
      if (!isZeroKm) {
        obrigatorios.push({ k: 'renavam', v: veiculo.renavam, label: 'RENAVAM' });
      }
      for (const c of obrigatorios) {
        if (!c.v || String(c.v).trim() === '') {
          const msg = `${c.label} é obrigatório para sincronização com SGA.`;
          await logSync(_vid, _aid, 'validar_veiculo', 'error', null, null, msg);
          await setStatusSga(_vid, 'erro_sincronizacao');
          await upsertQueue(_vid, _aid, 'veiculo', msg, codigoAssociadoHinova);
          return;
        }
      }

      // Pré-flight: se faltar combustível OU codigo_fipe, tentar enriquecer
      // automaticamente via fipe-lookup (marca + modelo + ano).
      if (!veiculo.combustivel || !veiculo.codigo_fipe || !Number(veiculo.valor_fipe)) {
        try {
          const tipoFipePre = /MOTO/i.test(veiculo.marca || '') || /CG |FAN|HONDA.*16|YBR|YAMAHA/i.test(`${veiculo.marca} ${veiculo.modelo}`)
            ? 'motos' : 'carros';
          const url = new URL(`${Deno.env.get('SUPABASE_URL')}/functions/v1/fipe-lookup`);
          url.searchParams.set('action', 'buscar-por-nome');
          url.searchParams.set('tipo', tipoFipePre);
          url.searchParams.set('marca', String(veiculo.marca || '').trim());
          url.searchParams.set('modelo', String(veiculo.modelo || '').trim());
          if (veiculo.ano_modelo) url.searchParams.set('ano', String(veiculo.ano_modelo));
          const resp = await fetch(url.toString(), {
            headers: {
              Authorization: `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
              apikey: Deno.env.get('SUPABASE_ANON_KEY') || '',
            },
          });
          const json = await resp.json().catch(() => null);
          if (json?.success && json?.found) {
            const upd: any = {};
            if (!veiculo.codigo_fipe && json.data?.codigoFipe) upd.codigo_fipe = String(json.data.codigoFipe).trim();
            if (!Number(veiculo.valor_fipe) && json.data?.valorNumerico) upd.valor_fipe = Number(json.data.valorNumerico);
            if (!veiculo.combustivel && json.data?.combustivel) upd.combustivel = String(json.data.combustivel).trim();
            if (Object.keys(upd).length > 0) {
              await supabase.from('veiculos').update(upd).eq('id', _vid);
              Object.assign(veiculo, upd);
              await logSync(_vid, _aid, 'fipe_auto_lookup_preflight', 'success',
                { marca: veiculo.marca, modelo: veiculo.modelo }, upd);
              // Recarregar para pegar codigo_sga_combustivel preenchido pela trigger
              const { data: vRefetch } = await supabase.from('veiculos').select('*').eq('id', _vid).single();
              if (vRefetch) Object.assign(veiculo, vRefetch);
            }
          }
        } catch (e: any) {
          await logSync(_vid, _aid, 'fipe_auto_lookup_preflight', 'error',
            { marca: veiculo.marca, modelo: veiculo.modelo }, null, e?.message || String(e));
        }
      }

      // Pré-flight: combustível precisa ter código SGA equivalente
      // (1=Flex, 2=Gasolina, 3=Etanol, 4=Diesel, 5=Bio-gás, 6=Tetra-fuel)
      // O campo veiculos.codigo_sga_combustivel é preenchido automaticamente por trigger.
      if (!veiculo.codigo_sga_combustivel || !Number.isFinite(Number(veiculo.codigo_sga_combustivel))) {
        const msg = veiculo.combustivel
          ? `Combustível "${veiculo.combustivel}" não tem código SGA equivalente. SGA aceita: Flex, Gasolina, Etanol, Diesel, Bio-gás, Tetra-fuel.`
          : 'Combustível ausente — Hinova exige codigo_combustivel. Edite o veículo e preencha o combustível antes de reprocessar.';
        await logSync(_vid, _aid, 'validar_combustivel_sga', 'error',
          { combustivel: veiculo.combustivel, codigo_sga_combustivel: veiculo.codigo_sga_combustivel }, null, msg);
        await setStatusSga(_vid, 'erro_sincronizacao');
        await upsertQueue(_vid, _aid, 'veiculo', msg, codigoAssociadoHinova);
        return;
      }

      // 2. Contrato (vendedor + plano + valores)
      const contratoSel = 'numero, vendedor_id, veiculo_categoria, cotacao_id, plano_id, valor_mensal, valor_adesao, cobertura_fipe';
      let contrato: any = null;
      const { data: cByVeic } = await supabase.from('contratos').select(contratoSel)
        .eq('veiculo_id', _vid).order('created_at', { ascending: false }).limit(1).maybeSingle();
      contrato = cByVeic;
      if (!contrato) {
        const { data: cByAssoc } = await supabase.from('contratos').select(contratoSel)
          .eq('associado_id', _aid).order('created_at', { ascending: false }).limit(1).maybeSingle();
        contrato = cByAssoc;
      }

      // Vendedor obrigatório
      let codigoVoluntario = codigoVoluntarioPadrao;
      if (contrato?.vendedor_id) {
        const { data: vend } = await supabase.from('profiles')
          .select('codigo_sga_voluntario, nome').eq('id', contrato.vendedor_id).single();
        if (vend?.codigo_sga_voluntario) {
          codigoVoluntario = Number.parseInt(vend.codigo_sga_voluntario, 10);
        } else {
          const msg = `Vendedor ${vend?.nome || contrato.vendedor_id} não possui codigo_sga_voluntario.`;
          await logSync(_vid, _aid, 'resolver_vendedor', 'error',
            { vendedor_id: contrato.vendedor_id }, null, msg);
          await setStatusSga(_vid, 'erro_sincronizacao');
          await upsertQueue(_vid, _aid, 'vendedor_sem_codigo_sga', msg, codigoAssociadoHinova);
          return;
        }
      } else {
        const msg = 'Contrato sem vendedor_id — não é possível identificar consultor SGA.';
        await logSync(_vid, _aid, 'resolver_vendedor', 'error', { _vid, _aid }, null, msg);
        await setStatusSga(_vid, 'erro_sincronizacao');
        await upsertQueue(_vid, _aid, 'contrato_sem_vendedor', msg, codigoAssociadoHinova);
        return;
      }
      if (!Number.isFinite(codigoVoluntario) || codigoVoluntario <= 0) {
        const msg = 'codigo_voluntario do vendedor inválido.';
        await logSync(_vid, _aid, 'resolver_vendedor', 'error', { vendedor_id: contrato.vendedor_id }, null, msg);
        await setStatusSga(_vid, 'erro_sincronizacao');
        await upsertQueue(_vid, _aid, 'vendedor_sem_codigo_sga', msg, codigoAssociadoHinova);
        return;
      }

      // Plano → resolve o GRUPO de produto no Hinova.
      // No SGA não existe "plano" — existe `codigo_grupo_produto` (campo oficial
      // do /veiculo/cadastrar). O grupo já contém TODAS as coberturas e benefícios
      // cadastrados no painel Hinova, então NÃO enviamos array `produtos[]`
      // nem lemos `coberturas.codigo_sga` / `benefits.codigo_sga`.
      // A coluna `planos.codigo_sga_plano` (nome legado) guarda esse código de grupo.
      let codigoGrupoProduto: number | undefined;
      let valorMensalidade: number | undefined;
      let valorAdesao: number | undefined;
      if (contrato?.plano_id) {
        const { data: planoRow } = await supabase.from('planos')
          .select('id, nome, codigo_sga_plano, valor_adesao').eq('id', contrato.plano_id).maybeSingle();
        const cg = planoRow?.codigo_sga_plano ? Number.parseInt(planoRow.codigo_sga_plano, 10) : NaN;
        if (Number.isFinite(cg) && cg > 0) {
          codigoGrupoProduto = cg;
          valorMensalidade = contrato.valor_mensal != null ? Number(contrato.valor_mensal) : undefined;
          valorAdesao = contrato.valor_adesao != null ? Number(contrato.valor_adesao)
            : (planoRow?.valor_adesao != null ? Number(planoRow.valor_adesao) : undefined);
        } else {
          // NÃO bloqueia o envio: cadastra associado/veículo/fotos normalmente,
          // apenas sem vincular o grupo de produto. Fica registrado um aviso
          // (warning) na fila para que a equipe vincule o grupo manualmente
          // no SGA depois (ou preencha o código e reprocesse só essa parte).
          const motivo = `Plano '${planoRow?.nome ?? contrato.plano_id}' sem código de grupo SGA. Veículo será enviado SEM vínculo de grupo — vincule manualmente no Hinova ou preencha o código e reprocesse.`;
          await logSync(_vid, _aid, 'resolver_grupo_sga', 'warning',
            { plano_id: contrato.plano_id, plano_nome: planoRow?.nome, codigo_sga_plano: planoRow?.codigo_sga_plano ?? null },
            null, motivo);
          await upsertQueue(_vid, _aid, 'plano_sem_codigo_grupo_sga_aviso', motivo, codigoAssociadoHinova);
          // Segue o fluxo sem codigoGrupoProduto/valorMensalidade/valorAdesao.
        }
      }

      // 3. Mapeamentos (cor, combustível, tipo, foto)
      const { data: mapeamentos } = await supabase.from('hinova_mapeamentos').select('*').eq('ativo', true);
      const getMap = (tipo: string, codigoLocal: string | null | undefined): number | null => {
        if (!codigoLocal) return null;
        const m = mapeamentos?.find((x: any) =>
          x.tipo === tipo && String(x.codigo_local).toLowerCase() === codigoLocal.toLowerCase());
        return m?.codigo_hinova ? Number(m.codigo_hinova) : null;
      };

      const normalCombustivel = (() => {
        const c = (veiculo.combustivel || '').toUpperCase().trim();
        if (!c) return null;
        if (c.includes('/') && (c.includes('GASOLINA') || c.includes('ALCOOL') || c.includes('ÁLCOOL') || c.includes('ETANOL'))) {
          if (c.includes('GAS NATURAL') || c.includes('GNV')) return 'gnv';
          return 'flex';
        }
        if (c === 'FLEX' || c.includes('BICOMB')) return 'flex';
        if (c === 'GASOLINA') return 'gasolina';
        if (c === 'ETANOL' || c === 'ÁLCOOL' || c === 'ALCOOL') return 'etanol';
        if (c === 'DIESEL') return 'diesel';
        if (c === 'GNV' || c.includes('GAS NATURAL') || c.includes('GÁS NATURAL')) return 'gnv';
        if (c.includes('ELÉTRICO') || c.includes('ELETRICO')) return 'eletrico';
        if (c.includes('HÍBRIDO') || c.includes('HIBRIDO')) return 'hibrido';
        return c.toLowerCase();
      })();

      const inferTipoVeiculo = (cat: string | null): number => {
        const c = (cat || '').toUpperCase().trim();
        if (c.includes('MOTO')) return 2;
        if (c.includes('CAMINH') || c.includes('TRUCK')) return 3;
        if (c.includes('VAN') || c.includes('UTILIT')) return 4;
        if (c.includes('ÔNIBUS') || c.includes('ONIBUS')) return 5;
        if (c.includes('REBOQUE')) return 6;
        return 1;
      };
      const tipoVeiculo = getMap('tipo_veiculo', contrato?.veiculo_categoria?.toLowerCase()) ?? inferTipoVeiculo(contrato?.veiculo_categoria);

      // 4. Autenticar (sessão fresca para esta execução)
      const creds = await getHinovaCreds(supabase);
      if (!creds) {
        await logSync(_vid, _aid, 'autenticar', 'error', null, null, 'Credenciais não configuradas');
        await setStatusSga(_vid, 'erro_sincronizacao');
        await upsertQueue(_vid, _aid, 'auth', 'Credenciais Hinova não configuradas');
        return;
      }
      let session: HinovaSession;
      try {
        const s = await autenticarHinova(creds);
        if (!s) throw new Error('autenticarHinova retornou null');
        session = s;
        await logSync(_vid, _aid, 'autenticar', 'success', { usuario: creds.usuario }, { ok: true });
      } catch (e: any) {
        await logSync(_vid, _aid, 'autenticar', 'error', null, null, String(e?.message || e));
        await setStatusSga(_vid, 'erro_sincronizacao');
        await upsertQueue(_vid, _aid, 'auth', String(e?.message || e), codigoAssociadoHinova);
        return;
      }

      // ============================================================
      // 5. ASSOCIADO — buscar antes de cadastrar
      // ============================================================
      const cpfDigitos = cleanDigits(associado.cpf);
      const placaLimpa = cleanAlphaNum(veiculo.placa);
      const chassiLimpo = cleanAlphaNum(veiculo.chassi);

      let veiculosNoAssociado: Array<{ placa: string; codigo_veiculo: number }> = [];
      try {
        const r = await buscarAssociadoComVeiculosPorCpf(supabase, cpfDigitos);
        if (r.codigo_associado) {
          codigoAssociadoHinova = r.codigo_associado;
          veiculosNoAssociado = r.veiculos || [];
          await logSync(_vid, _aid, 'buscar_associado', 'success',
            { cpf: '***' }, { codigo_associado: codigoAssociadoHinova, qtd_veiculos: veiculosNoAssociado.length });
          await supabase.from('associados').update({
            codigo_hinova: codigoAssociadoHinova,
            sincronizado_hinova: true,
            sincronizado_hinova_em: new Date().toISOString(),
          }).eq('id', _aid);
        }
      } catch (e: any) {
        if (e instanceof HinovaNotFoundError) {
          await logSync(_vid, _aid, 'buscar_associado', 'info', { cpf: '***' }, null, 'Associado não existe no Hinova — será cadastrado');
        } else {
          // transitório — propagar para fila
          await logSync(_vid, _aid, 'buscar_associado', 'error', { cpf: '***' }, null, String(e?.message || e));
          await setStatusSga(_vid, 'erro_sincronizacao');
          await upsertQueue(_vid, _aid, 'associado', `Erro busca associado: ${e?.message || e}`, codigoAssociadoHinova);
          return;
        }
      }

      // 5.b — cadastrar se não existe
      if (!codigoAssociadoHinova) {
        // Pre-flight: Hinova exige CEP de 8 dígitos. Se vier com 7 (zero à esquerda perdido),
        // tenta auto-padding. Se ainda assim inválido, aborta com mensagem clara.
        const cepRaw = String(associado.cep || '').replace(/\D/g, '');
        let cepCorrigido = cepRaw;
        if (cepRaw.length === 7) cepCorrigido = '0' + cepRaw;
        if (cepCorrigido.length !== 8) {
          const motivo = `CEP inválido no cadastro do associado (valor atual: "${associado.cep || 'vazio'}"). Hinova exige 8 dígitos. Edite o cadastro e corrija o CEP antes de reprocessar.`;
          await logSync(_vid, _aid, 'validar_associado', 'error', { cep: associado.cep }, null, motivo);
          await setStatusSga(_vid, 'erro_sincronizacao');
          await upsertQueue(_vid, _aid, 'associado', motivo, codigoAssociadoHinova);
          return;
        }
        // Aplica zero-padding em memória (não persiste — apenas para envio)
        if (cepCorrigido !== cepRaw) {
          (associado as any).cep = cepCorrigido;
        }
        // Validar campos mínimos de endereço
        const camposEnd: Array<[string, any]> = [
          ['logradouro', associado.logradouro],
          ['cidade', associado.cidade],
          ['bairro', associado.bairro],
          ['uf', associado.uf],
        ];
        const faltando = camposEnd.filter(([_, v]) => !String(v || '').trim()).map(([k]) => k);
        if (faltando.length) {
          const motivo = `Endereço incompleto: faltando ${faltando.join(', ')}. Edite o cadastro do associado antes de reprocessar.`;
          await logSync(_vid, _aid, 'validar_associado', 'error', { faltando }, null, motivo);
          await setStatusSga(_vid, 'erro_sincronizacao');
          await upsertQueue(_vid, _aid, 'associado', motivo, codigoAssociadoHinova);
          return;
        }

        const ctxA: AssociadoCtx = {
          codigo_conta: codigoConta,
          codigo_regional: Number.isFinite(codigoRegional) ? codigoRegional : undefined,
          codigo_cooperativa: Number.isFinite(codigoCooperativa) ? codigoCooperativa : undefined,
          codigo_voluntario: codigoVoluntario,
          codigo_tipo_cobranca_recorrente: codigoTipoCobrancaPadrao,
          codigo_como_conheceu: codigoComoConheceuPadrao,
          codigo_profissao: codigoProfissaoPadrao,
          data_contrato_iso: associado.created_at,
        };
        const payloadA = buildAssociadoPayload(associado, ctxA);
        try {
          const res = await cadastrarAssociadoHinova(supabase, payloadA);
          await logSync(_vid, _aid, 'cadastrar_associado', res.ok ? 'success' : 'error',
            { ...payloadA, cpf: '***' }, res.raw,
            res.ok ? null : (res.mensagem || res.errors.join('; ') || `HTTP ${res.status}`));
          if (!res.ok || !res.codigo) {
            const erroDetalhe = res.errors.length ? res.errors.join('; ') : (res.mensagem || `HTTP ${res.status}`);
            await setStatusSga(_vid, 'erro_sincronizacao');
            await upsertQueue(_vid, _aid, 'associado', `Falha cadastro associado: ${erroDetalhe}`, codigoAssociadoHinova);
            return;
          }
          codigoAssociadoHinova = res.codigo;
          await supabase.from('associados').update({
            codigo_hinova: codigoAssociadoHinova,
            sincronizado_hinova: true,
            sincronizado_hinova_em: new Date().toISOString(),
          }).eq('id', _aid);

          // Forçar PENDENTE no SGA — Hinova aplica ATIVO por default da regional, mas
          // a ativação completa do associado é manual no painel SGA.
          if (Number.isFinite(codigoSituacaoPendente) && codigoSituacaoPendente > 0) {
            try {
              const rs = await alterarSituacaoAssociadoHinova(
                supabase, codigoAssociadoHinova!, codigoSituacaoPendente,
              );
              await logSync(_vid, _aid, 'alterar_situacao_associado',
                rs.ok ? 'success' : 'warning',
                { codigo_associado: codigoAssociadoHinova, codigo_situacao: codigoSituacaoPendente },
                rs.raw,
                rs.ok ? null : (rs.mensagem || rs.errors.join('; ') || `HTTP ${rs.status}`));
            } catch (e: any) {
              await logSync(_vid, _aid, 'alterar_situacao_associado', 'warning',
                { codigo_associado: codigoAssociadoHinova, codigo_situacao: codigoSituacaoPendente },
                null, String(e?.message || e));
            }
          }
        } catch (e: any) {
          await logSync(_vid, _aid, 'cadastrar_associado', 'error', { cpf: '***' }, null, String(e?.message || e));
          await setStatusSga(_vid, 'erro_sincronizacao');
          await upsertQueue(_vid, _aid, 'associado', `Erro rede/transitório: ${e?.message || e}`, codigoAssociadoHinova);
          return;
        }
      }

      // ============================================================
      // 6. VEÍCULO — buscar antes de cadastrar
      // ============================================================
      // 6.a Reaproveitar lista do associado
      if (placaLimpa) {
        const v = veiculosNoAssociado.find(x => x.placa === placaLimpa);
        if (v) {
          codigoVeiculoHinova = v.codigo_veiculo;
          await logSync(_vid, _aid, 'reusar_veiculo_do_associado', 'info',
            { placa: placaLimpa }, { codigo_veiculo: codigoVeiculoHinova });
        }
      }

      // 6.b Buscar por placa/chassi globalmente (detecta conflito com OUTRO associado)
      if (!codigoVeiculoHinova && placaLimpa && !isPlacaPlaceholder(veiculo.placa)) {
        try {
          // Passa supabase (não session) para que hinovaFetch reautentique automaticamente
          // se o token cacheado tiver sido invalidado por reautenticações concorrentes.
          const r = await buscarVeiculoPorPlaca(supabase, placaLimpa);
          if (r.found?.codigo_veiculo) {
            const codAssocRem = Number(r.found.codigo_associado || r.found.codigo_associado_pf || 0);
            if (codAssocRem && codAssocRem !== codigoAssociadoHinova) {
              const msg = `Placa ${placaLimpa} já cadastrada no Hinova para outro associado (codigo_associado=${codAssocRem}).`;
              await logSync(_vid, _aid, 'conflito_placa', 'error',
                { placa: placaLimpa }, { codigo_associado_remoto: codAssocRem, codigo_veiculo: r.found.codigo_veiculo }, msg);
              await setStatusSga(_vid, 'erro_sincronizacao');
              await markQueueFalhaPermanente(_vid, _aid, msg);
              return;
            }
            codigoVeiculoHinova = Number(r.found.codigo_veiculo);
            await logSync(_vid, _aid, 'buscar_veiculo_placa', 'success',
              { placa: placaLimpa }, { codigo_veiculo: codigoVeiculoHinova });
          }
        } catch (e: any) {
          if (!(e instanceof HinovaNotFoundError)) {
            await logSync(_vid, _aid, 'buscar_veiculo_placa', 'error', { placa: placaLimpa }, null, String(e?.message || e));
            await setStatusSga(_vid, 'erro_sincronizacao');
            await upsertQueue(_vid, _aid, 'veiculo', `Erro busca veículo placa: ${e?.message || e}`, codigoAssociadoHinova);
            return;
          }
        }
      }

      // 6.c Buscar por chassi (placeholder 0KM ou placa não encontrada)
      if (!codigoVeiculoHinova && chassiLimpo.length === 17) {
        try {
          const r = await buscarVeiculoPorChassi(supabase, chassiLimpo);
          if (r.found?.codigo_veiculo) {
            const codAssocRem = Number(r.found.codigo_associado || 0);
            if (codAssocRem && codAssocRem !== codigoAssociadoHinova) {
              const msg = `Chassi ${chassiLimpo} já cadastrado no Hinova para outro associado (codigo_associado=${codAssocRem}).`;
              await logSync(_vid, _aid, 'conflito_chassi', 'error',
                { chassi: chassiLimpo }, { codigo_associado_remoto: codAssocRem }, msg);
              await setStatusSga(_vid, 'erro_sincronizacao');
              await markQueueFalhaPermanente(_vid, _aid, msg);
              return;
            }
            codigoVeiculoHinova = Number(r.found.codigo_veiculo);
            await logSync(_vid, _aid, 'buscar_veiculo_chassi', 'success',
              { chassi: chassiLimpo }, { codigo_veiculo: codigoVeiculoHinova });
          }
        } catch (e: any) {
          if (!(e instanceof HinovaNotFoundError)) {
            console.warn('[buscar_veiculo_chassi]', e);
          }
        }
      }

      // Marca se o veículo já existia no Hinova antes desta execução
      const veiculoJaExistiaNoHinova = !!codigoVeiculoHinova;

      // 6.d Cadastrar se não existe
      if (!codigoVeiculoHinova) {
        // Pre-flight: Hinova exige codigo_fipe OU codigo_modelo. Hoje só temos
        // mapeamento via FIPE — se vier vazio, tentamos buscar automaticamente
        // via fipe-lookup (marca + modelo + ano) antes de abortar.
        let codigoFipeLimpo = String(veiculo.codigo_fipe || '').trim();
        let valorFipeAuto = Number(veiculo.valor_fipe) || 0;
        if (!codigoFipeLimpo) {
          const tipoFipe = tipoVeiculo === 2 ? 'motos'
            : (tipoVeiculo === 3 ? 'caminhoes' : 'carros');
          try {
            const url = new URL(`${Deno.env.get('SUPABASE_URL')}/functions/v1/fipe-lookup`);
            url.searchParams.set('action', 'buscar-por-nome');
            url.searchParams.set('tipo', tipoFipe);
            url.searchParams.set('marca', String(veiculo.marca || '').trim());
            url.searchParams.set('modelo', String(veiculo.modelo || '').trim());
            if (veiculo.ano_modelo || veiculo.ano) {
              url.searchParams.set('ano', String(veiculo.ano_modelo || veiculo.ano));
            }
            const resp = await fetch(url.toString(), {
              headers: {
                Authorization: `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
                apikey: Deno.env.get('SUPABASE_ANON_KEY') || '',
              },
            });
            const json = await resp.json().catch(() => null);
            if (json?.success && json?.found && json?.data?.codigoFipe) {
              codigoFipeLimpo = String(json.data.codigoFipe).trim();
              if (json.data.valorNumerico && !valorFipeAuto) {
                valorFipeAuto = Number(json.data.valorNumerico);
              }
              await supabase.from('veiculos').update({
                codigo_fipe: codigoFipeLimpo,
                ...(json.data.valorNumerico && !Number(veiculo.valor_fipe)
                  ? { valor_fipe: Number(json.data.valorNumerico) }
                  : {}),
              }).eq('id', _vid);
              await logSync(_vid, _aid, 'fipe_auto_lookup', 'success',
                { marca: veiculo.marca, modelo: veiculo.modelo, ano: veiculo.ano_modelo || veiculo.ano },
                { codigo_fipe: codigoFipeLimpo, valor: json.data.valorNumerico });
            } else {
              await logSync(_vid, _aid, 'fipe_auto_lookup', 'error',
                { marca: veiculo.marca, modelo: veiculo.modelo, ano: veiculo.ano_modelo || veiculo.ano },
                json, json?.error || 'FIPE não encontrada');
            }
          } catch (e: any) {
            await logSync(_vid, _aid, 'fipe_auto_lookup', 'error',
              { marca: veiculo.marca, modelo: veiculo.modelo }, null, e?.message || String(e));
          }
        }
        if (!codigoFipeLimpo) {
          const motivo = 'codigo_fipe ausente no cadastro do veículo e busca automática FIPE (marca/modelo/ano) não retornou resultado. Edite o veículo e preencha o código FIPE manualmente antes de reprocessar.';
          await logSync(_vid, _aid, 'cadastrar_veiculo', 'error',
            { veiculo_id: _vid, placa: veiculo.placa, marca: veiculo.marca, modelo: veiculo.modelo }, null, motivo);
          await setStatusSga(_vid, 'erro_sincronizacao');
          await upsertQueue(_vid, _aid, 'veiculo', motivo, codigoAssociadoHinova);
          return;
        }

        // Veículo entra SEMPRE como PENDENTE — promoção para ATIVO é manual no painel SGA.
        const codSituacao = codigoSituacaoPendente;

        // Categoria do veículo (Táxi/Leilão/Placa Vermelha/Ex-Táxi) — opcional, vai se houver mapeamento.
        let categoriaLocal: string | null = null;
        if (veiculo.flag_taxi_ativo) categoriaLocal = 'taxi';
        else if (veiculo.flag_leilao) categoriaLocal = 'leilao';
        else if (veiculo.flag_placa_vermelha) categoriaLocal = 'placa_vermelha';
        else if (veiculo.flag_ex_taxi) categoriaLocal = 'ex_taxi';
        const codigoCategoriaVeiculo = categoriaLocal
          ? (getMap('categoria_veiculo', categoriaLocal) ?? undefined)
          : undefined;

        // Valor protegido (R$) e % FIPE protegido (deságio do contrato)
        const valorFipeProtegido = veiculo.valor_fipe_protegido != null && Number(veiculo.valor_fipe_protegido) > 0
          ? Number(veiculo.valor_fipe_protegido)
          : undefined;
        const porcentagemFipeProtegido = contrato?.cobertura_fipe != null && Number(contrato.cobertura_fipe) > 0
          ? Number(contrato.cobertura_fipe)
          : undefined;

        // Observação rastreável (ajuda a auditoria do SGA)
        const observacao = `Cadastro via Pratic Connect — contrato ${contrato?.numero ?? _vid}`;

        const ctxV: VeiculoCtx = {
          codigo_associado: codigoAssociadoHinova!,
          codigo_conta: codigoConta,
          codigo_voluntario: codigoVoluntario,
          codigo_situacao: Number.isFinite(codSituacao) && codSituacao > 0 ? codSituacao : undefined,
          codigo_cooperativa: Number.isFinite(codigoCooperativa) ? codigoCooperativa : undefined,
          codigo_grupo_produto: codigoGrupoProduto,
          codigo_categoria_veiculo: codigoCategoriaVeiculo,
          valor_mensalidade: valorMensalidade,
          valor_adesao: valorAdesao,
          valor_fipe_protegido: valorFipeProtegido,
          porcentagem_fipe_protegido: porcentagemFipeProtegido,
          observacao,
          tipo_veiculo: tipoVeiculo,
          codigo_combustivel: (veiculo.codigo_sga_combustivel != null ? Number(veiculo.codigo_sga_combustivel) : null) ?? getMap('combustivel', normalCombustivel),
          codigo_cor: (veiculo.codigo_sga_cor != null ? Number(veiculo.codigo_sga_cor) : null)
            ?? getMap('cor', veiculo.cor)
            ?? 10, // fallback final: "Não especificado" (cor não bloqueia envio)
          data_contrato_iso: associado.created_at,
        };
        const payloadV = buildVeiculoPayload(veiculo, codigoFipeLimpo, Number(veiculo.valor_fipe) || valorFipeAuto || 0, ctxV);

        try {
          const res = await cadastrarVeiculoHinova(supabase, payloadV);
          // Mensagem amigável: priorizamos `errors` (detalhe técnico do Hinova)
          // sobre `mensagem` (que costuma ser apenas "Não aceitável" / "Bad Request").
          const detalhe = res.errors.length > 0
            ? res.errors.join('; ')
            : (res.mensagem || `HTTP ${res.status}`);
          await logSync(_vid, _aid, 'cadastrar_veiculo', res.ok ? 'success' : 'error',
            payloadV, res.raw, res.ok ? null : detalhe);
          if (!res.ok || !res.codigo) {
            const allErr = [...res.errors, res.mensagem || ''].join(' ').toLowerCase();
            // Se Hinova diz que o associado não está cadastrado → invalidar e requeue
            const isAssocInvalido = allErr.includes('associado') &&
              (allErr.includes('não está cadastrado') || allErr.includes('nao esta cadastrado')
               || allErr.includes('não encontrado') || allErr.includes('nao encontrado') || allErr.includes('not found'));
            if (isAssocInvalido && codigoAssociadoHinova) {
              await supabase.from('associados').update({
                codigo_hinova: null, sincronizado_hinova: false, sincronizado_hinova_em: null,
              }).eq('id', _aid);
              await logSync(_vid, _aid, 'invalidar_codigo_associado', 'info',
                { codigo_invalidado: codigoAssociadoHinova }, res.raw, 'Associado inválido no Hinova — recadastrar');
              await setStatusSga(_vid, 'erro_sincronizacao');
              await upsertQueue(_vid, _aid, 'associado', 'codigo_associado inválido no Hinova — resetando');
              return;
            }
            await setStatusSga(_vid, 'erro_sincronizacao');
            await upsertQueue(_vid, _aid, 'veiculo', `Falha cadastro veículo: ${detalhe}`, codigoAssociadoHinova);
            return;
          }
          codigoVeiculoHinova = res.codigo;
        } catch (e: any) {
          await logSync(_vid, _aid, 'cadastrar_veiculo', 'error', payloadV, null, String(e?.message || e));
          await setStatusSga(_vid, 'erro_sincronizacao');
          await upsertQueue(_vid, _aid, 'veiculo', `Erro rede/transitório: ${e?.message || e}`,
            codigoAssociadoHinova);
          return;
        }
      }

      // 6.e Veículo entra/permanece como PENDENTE no SGA. Promoção para ATIVO é manual
      // no painel SGA — sistema NUNCA envia situação ATIVO (nem na ativação completa).
      if (statusDestino === 'ativo' && veiculoJaExistiaNoHinova && codigoVeiculoHinova) {
        await logSync(_vid, _aid, 'promover_situacao_veiculo', 'info',
          { codigo_veiculo: codigoVeiculoHinova },
          null,
          'Promoção para ATIVO não é feita automaticamente — operação deve ativar manualmente no painel SGA.');
      }

      // Persistir veículo
      await supabase.from('veiculos').update({
        codigo_hinova: codigoVeiculoHinova,
        sincronizado_hinova: true,
        sincronizado_hinova_em: new Date().toISOString(),
        status_sga: statusDestino === 'ativo' ? 'ativado_sga' : 'pendente_sga',
      }).eq('id', _vid);

      // ============================================================
      // 7. FOTOS — em lotes de 50
      // ============================================================
      const { data: docs } = await supabase.from('documentos')
        .select('id, tipo, nome_arquivo, arquivo_url, status')
        .or(`associado_id.eq.${_aid},veiculo_id.eq.${_vid}`)
        .in('status', ['aprovado', 'em_analise', 'pendente']);

      const { data: docsContrato } = contrato?.cotacao_id
        ? await supabase.from('contratos_documentos')
            .select('id, tipo, arquivo_nome, arquivo_url, status')
            .eq('cotacao_id', contrato.cotacao_id)
            .in('status', ['aprovado', 'em_analise', 'pendente'])
        : { data: [] as any[] };

      // Selfie / foto pessoal do associado (avatar_url) — enviada como CNH (sem código próprio na Hinova)
      const { data: associadoFoto } = await supabase.from('associados')
        .select('avatar_url')
        .eq('id', _aid)
        .maybeSingle();

      const documentosEntrada: DocumentoEntrada[] = [
        ...((docs || []) as any[]).map(d => ({
          id: d.id, tipo: d.tipo, nome_arquivo: d.nome_arquivo, arquivo_url: d.arquivo_url,
        })),
        ...((docsContrato || []) as any[]).map(d => ({
          id: d.id, tipo: d.tipo, nome_arquivo: d.arquivo_nome, arquivo_url: d.arquivo_url,
        })),
      ];
      if (associadoFoto?.avatar_url) {
        documentosEntrada.push({
          id: `avatar-${_aid}`,
          tipo: 'foto_associado',
          nome_arquivo: `avatar_${_aid}.jpg`,
          arquivo_url: associadoFoto.avatar_url,
        });
      }

      // Fotos da vistoria do veículo (chassi, motor, frente, traseira, laterais, painel etc.)
      // Inclui 'em_analise' porque o monitoramento aprova a INSTALAÇÃO (que dispara este sync)
      // ANTES de a vistoria mudar para 'aprovada' — sem isso, fotos seriam sempre descartadas.
      // Estados explicitamente proibidos: 'reprovada' / 'cancelada'.
      const { data: vistoriasVeic } = await supabase.from('vistorias')
        .select('id')
        .eq('veiculo_id', _vid)
        .in('status', ['concluida', 'aprovada', 'em_analise', 'aprovada_ressalvas']);

      if (vistoriasVeic && vistoriasVeic.length > 0) {
        const vistoriaIds = vistoriasVeic.map((v: any) => v.id);
        const { data: vistoriaFotos } = await supabase.from('vistoria_fotos')
          .select('id, tipo, arquivo_url, vistoria_id')
          .in('vistoria_id', vistoriaIds);

        for (const vf of (vistoriaFotos || []) as any[]) {
          if (!vf.arquivo_url) continue;
          documentosEntrada.push({
            id: `vist-${vf.id}`,
            tipo: vf.tipo,
            nome_arquivo: `vistoria_${vf.tipo}_${vf.id}.jpg`,
            arquivo_url: vf.arquivo_url,
          });
        }
      }

      const { fotos, descartadasSemLink, descartadasSemTipo, descartadasVideo } = buildFotosPayload(
        documentosEntrada,
        (tipo) => getMap('tipo_foto', tipo),
      );

      // Breakdown por tipo (para diagnóstico no modal de detalhes da Fila SGA)
      const porTipo: Record<string, number> = {};
      for (const f of fotos) {
        const k = String(f.codigo_tipo);
        porTipo[k] = (porTipo[k] || 0) + 1;
      }

      if (descartadasSemLink.length || descartadasSemTipo.length || descartadasVideo.length) {
        await logSync(_vid, _aid, 'enviar_fotos_descarte', 'info', {
          qtd_total: documentosEntrada.length,
          qtd_validas: fotos.length,
          descartadas_sem_link: descartadasSemLink,
          descartadas_sem_mapeamento: descartadasSemTipo,
          descartadas_video: descartadasVideo, // Hinova não aceita vídeo — sempre filtrado
        }, null);
      }

      let fotosEnviadas = 0;
      let fotosComErro = 0;
      if (fotos.length > 0 && codigoVeiculoHinova) {
        for (const lote of chunk(fotos, 50)) {
          try {
            const r = await cadastrarFotosVeiculoHinova(supabase, codigoVeiculoHinova, lote);
            await logSync(_vid, _aid, 'enviar_fotos', r.ok ? 'success' : 'error',
              { codigo_veiculo: codigoVeiculoHinova, qtd: lote.length }, r.raw,
              r.ok ? null : (r.mensagem || r.errors.join('; ')));
            if (r.ok) fotosEnviadas += lote.length;
            else fotosComErro += lote.length;
          } catch (e: any) {
            await logSync(_vid, _aid, 'enviar_fotos', 'error',
              { codigo_veiculo: codigoVeiculoHinova, qtd: lote.length }, null, String(e?.message || e));
            fotosComErro += lote.length;
          }
        }
      }

      if (fotosComErro > 0 && fotosEnviadas === 0) {
        await upsertQueue(_vid, _aid, 'fotos', `Erro ao enviar ${fotosComErro} fotos`,
          codigoAssociadoHinova, codigoVeiculoHinova);
      } else {
        await markQueueDone(_vid, _aid);
      }

      await logSync(_vid, _aid, 'sync_completo', 'success', null, {
        codigo_associado_hinova: codigoAssociadoHinova,
        codigo_veiculo_hinova: codigoVeiculoHinova,
        status_sga_destino: statusDestino,
        fotos_enviadas: fotosEnviadas,
        fotos_com_erro: fotosComErro,
        fotos_por_codigo_tipo: porTipo,
      });
      console.log(`[sga-hinova-sync] OK veiculo=${_vid} cod_assoc=${codigoAssociadoHinova} cod_veic=${codigoVeiculoHinova}`);

    } catch (bgErr: any) {
      console.error('[sga-hinova-sync] background error:', bgErr);
      try {
        await setStatusSga(_vid, 'erro_sincronizacao');
        await upsertQueue(_vid, _aid, 'background',
          bgErr instanceof Error ? bgErr.message : String(bgErr), codigoAssociadoHinova, codigoVeiculoHinova);
        await logSync(_vid, _aid, 'sync_background_error', 'error', null, null,
          bgErr instanceof Error ? bgErr.message : String(bgErr));
      } catch (_) { /* ignore */ }
    }
  };

  // @ts-ignore: EdgeRuntime disponível em Supabase Edge Functions
  EdgeRuntime.waitUntil(doSync());

  return new Response(JSON.stringify({ success: true, status: 'processing', step: 'sync_started' }),
    { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});

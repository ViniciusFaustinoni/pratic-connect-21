// Cria uma nova solicitação de Troca de Titularidade + cotação base vinculada
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { sendMetaTemplate } from '../_shared/send-meta-template.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NovoTitularDados {
  nome: string;
  cpf?: string; // opcional — capturado depois via OCR da CNH no link público
  email?: string;
  telefone?: string;
}

interface RequestBody {
  associado_antigo_id: string;
  veiculo_id?: string;
  veiculo_placa?: string; // fallback quando o UUID local está desatualizado
  novo_titular: NovoTitularDados;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: RequestBody = await req.json();
    const { associado_antigo_id, veiculo_id, veiculo_placa, novo_titular } = body;

    if (!associado_antigo_id || (!veiculo_id && !veiculo_placa) || !novo_titular?.nome) {
      return new Response(JSON.stringify({ error: 'Dados incompletos' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // CPF do novo titular é capturado depois via OCR da CNH no link público —
    // normaliza para string vazia para não quebrar consumidores downstream.
    if (novo_titular) {
      novo_titular.cpf = (novo_titular.cpf || '').replace(/\D/g, '');
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Buscar veículo: prioriza UUID; fallback por placa+associado (resolve cache stale do front).
    const colunas = 'id, marca, modelo, ano_modelo, ano_fabricacao, placa, combustivel, cor, codigo_fipe, valor_fipe, associado_id';
    let veiculo: any = null;
    let veiculoErr: any = null;
    if (veiculo_id) {
      const r = await admin.from('veiculos').select(colunas).eq('id', veiculo_id).maybeSingle();
      veiculo = r.data; veiculoErr = r.error;
    }
    if (!veiculo && veiculo_placa) {
      const placaUp = veiculo_placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const r = await admin
        .from('veiculos')
        .select(colunas)
        .eq('associado_id', associado_antigo_id)
        .ilike('placa', placaUp)
        .maybeSingle();
      veiculo = r.data; veiculoErr = r.error || veiculoErr;
    }
    if (!veiculo) {
      console.error('[criar-solicitacao-troca] veículo não localizado', { veiculo_id, veiculo_placa, associado_antigo_id, dbError: veiculoErr });
      return new Response(
        JSON.stringify({ error: 'Veículo não encontrado para o titular informado. Atualize a página e tente novamente.', debug: veiculoErr?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Enriquecimento de dados do veículo: cor, combustível, FIPE, ano, etc.
    // Roda em paralelo plate-lookup (dados oficiais por placa) + fipe-lookup
    // (valor FIPE atualizado). Nunca sobrescreve campos já preenchidos.
    // Falhas não bloqueiam a criação.
    const faltaAlgo =
      !veiculo.cor || !veiculo.combustivel ||
      !veiculo.valor_fipe || Number(veiculo.valor_fipe) <= 0 || !veiculo.codigo_fipe ||
      !veiculo.ano_modelo || !veiculo.ano_fabricacao;

    if (faltaAlgo) {
      try {
        // Deduz tipo (carros/motos/caminhoes) a partir de marcas_modelos
        let tipo = 'carros';
        if (veiculo.marca && veiculo.modelo) {
          try {
            const { data: mm } = await admin
              .from('marcas_modelos')
              .select('tipo_veiculo')
              .ilike('marca', String(veiculo.marca))
              .ilike('modelo', String(veiculo.modelo))
              .limit(1)
              .maybeSingle();
            const tv = String((mm as any)?.tipo_veiculo || '').toLowerCase();
            if (tv.includes('moto')) tipo = 'motos';
            else if (tv.includes('caminh')) tipo = 'caminhoes';
          } catch (_) { /* default carros */ }
        }

        const ano = String(veiculo.ano_modelo || veiculo.ano_fabricacao || '');
        const placaUp = String(veiculo.placa || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

        // 1) plate-lookup (em paralelo com fipe-lookup)
        const ctrlA = new AbortController();
        const tA = setTimeout(() => ctrlA.abort(), 8000);
        const platePromise = placaUp
          ? fetch(`${SUPABASE_URL}/functions/v1/plate-lookup`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
              body: JSON.stringify({ placa: placaUp }),
              signal: ctrlA.signal,
            }).finally(() => clearTimeout(tA)).catch((e) => { console.warn('[criar-solicitacao-troca] plate-lookup err:', (e as Error).message); return null; })
          : Promise.resolve(null);

        const ctrlB = new AbortController();
        const tB = setTimeout(() => ctrlB.abort(), 8000);
        const params = new URLSearchParams({ action: 'buscar-por-nome', tipo });
        if (veiculo.marca) params.set('marca', String(veiculo.marca));
        if (veiculo.modelo) params.set('modelo', String(veiculo.modelo));
        if (ano) params.set('ano', ano);
        const fipePromise = (veiculo.marca && veiculo.modelo)
          ? fetch(`${SUPABASE_URL}/functions/v1/fipe-lookup?${params}`, {
              headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY },
              signal: ctrlB.signal,
            }).finally(() => clearTimeout(tB)).catch((e) => { console.warn('[criar-solicitacao-troca] fipe-lookup err:', (e as Error).message); return null; })
          : Promise.resolve(null);

        const [plateResp, fipeResp] = await Promise.all([platePromise, fipePromise]);

        const updates: Record<string, any> = {};

        // plate-lookup: cor, combustível, ano, FIPE secundária
        if (plateResp && plateResp.ok) {
          try {
            const j: any = await plateResp.json();
            const vd = j?.vehicleData || {};
            const fd = j?.fipeData || null;
            if (!veiculo.cor && vd.cor) updates.cor = String(vd.cor).trim();
            if (!veiculo.combustivel && vd.combustivel) updates.combustivel = String(vd.combustivel).trim();
            if (!veiculo.ano_modelo && vd.ano_modelo) updates.ano_modelo = Number(vd.ano_modelo) || null;
            if (!veiculo.ano_fabricacao && vd.ano_fabricacao) updates.ano_fabricacao = Number(vd.ano_fabricacao) || null;
            if (fd && (!veiculo.valor_fipe || Number(veiculo.valor_fipe) <= 0)) {
              const valorNum = Number(String(fd.valor || '').replace(/[^\d,]/g, '').replace(',', '.'));
              if (valorNum > 0) updates.valor_fipe = valorNum;
              if (!veiculo.codigo_fipe && fd.codigo) updates.codigo_fipe = fd.codigo;
            }
          } catch (e) { console.warn('[criar-solicitacao-troca] parse plate-lookup falhou:', (e as Error).message); }
        }

        // fipe-lookup: valor FIPE primário (se ainda em falta)
        if (fipeResp && fipeResp.ok) {
          try {
            const j: any = await fipeResp.json();
            const valor = Number(j?.data?.valorNumerico) || 0;
            const codigo = j?.data?.codigoFipe || null;
            const valorFipeAtual = updates.valor_fipe ?? veiculo.valor_fipe;
            if (valor > 0 && (!valorFipeAtual || Number(valorFipeAtual) <= 0)) {
              updates.valor_fipe = valor;
            }
            if (codigo && !(updates.codigo_fipe || veiculo.codigo_fipe)) {
              updates.codigo_fipe = codigo;
            }
          } catch (e) { console.warn('[criar-solicitacao-troca] parse fipe-lookup falhou:', (e as Error).message); }
        }

        if (Object.keys(updates).length > 0) {
          await admin.from('veiculos').update(updates).eq('id', veiculo.id);
          Object.assign(veiculo, updates);
          console.log('[criar-solicitacao-troca] veículo enriquecido:', updates);
        }
      } catch (e) {
        console.warn('[criar-solicitacao-troca] erro no enriquecimento (ignorado):', (e as Error).message);
      }
    }

    // SEGURANÇA: garante que a placa pertence ao titular antigo informado.
    // Bloqueia bypass de UI / chamadas diretas à edge com combinação CPF + placa não-vinculada.
    if (veiculo.associado_id !== associado_antigo_id) {
      return new Response(
        JSON.stringify({ error: 'A placa informada não pertence ao titular antigo.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Guard: bloqueia se já existe outra troca em andamento para a mesma placa.
    // Retorna detalhes da solicitação bloqueante para o operador poder cancelá-la
    // pela UI sem precisar consultar o banco.
    if (veiculo.placa) {
      const placaNorm = String(veiculo.placa).toUpperCase().replace(/[^A-Z0-9]/g, '');
      const { data: bloqueantes } = await admin
        .from('solicitacoes_troca_titularidade')
        .select('id, status, created_at, novo_titular_dados, veiculo_id')
        .in('status', ['cotacao_em_andamento','aguardando_cadastro','aguardando_monitoramento','aguardando_vistoria','liberada_para_assinatura'])
        .order('created_at', { ascending: false });

      const conflito = (bloqueantes || []).find((s: any) => {
        // checa via veículo (mesmo id) — placa pode ter normalização diferente
        return s.veiculo_id === veiculo.id;
      });

      if (conflito) {
        const nomeBloq = (conflito.novo_titular_dados as any)?.nome || 'titular não informado';
        return new Response(
          JSON.stringify({
            error: `Já existe uma solicitação de troca em andamento para a placa ${veiculo.placa} (status: ${conflito.status}, novo titular: ${nomeBloq}, criada em ${new Date(conflito.created_at).toLocaleString('pt-BR')}). Cancele a solicitação anterior antes de criar uma nova.`,
            code: 'TROCA_EM_ANDAMENTO',
            solicitacao_bloqueante: {
              id: conflito.id,
              status: conflito.status,
              created_at: conflito.created_at,
              nome_novo_titular: nomeBloq,
            },
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // criado_por referencia profiles.id (não auth.users.id)
    const { data: profileRow } = await admin
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    const criadoPorProfileId = profileRow?.id ?? null;

    // Criar solicitação SEM cotação vinculada.
    // A cotação é criada manualmente pelo operador (botão "Realizar Cotação"
    // no modal de detalhes), apenas APÓS o titular antigo assinar o termo de
    // cancelamento. Edge dedicada: criar-cotacao-troca-titularidade.
    const { data: solicitacao, error: solErr } = await admin
      .from('solicitacoes_troca_titularidade')
      .insert({
        associado_antigo_id,
        veiculo_id: veiculo.id,
        cotacao_id: null,
        novo_titular_dados: novo_titular,
        status: 'cotacao_em_andamento',
        criado_por: criadoPorProfileId,
      })
      .select('id, token_publico')
      .single();
    if (solErr) throw solErr;

    // ── WhatsApp: notificar associado antigo da solicitação criada ──
    // Template: troca_titularidade_solicitada (2 vars: nome, veiculo)
    try {
      const { data: assocAntigo } = await admin
        .from('associados')
        .select('nome, telefone')
        .eq('id', associado_antigo_id)
        .maybeSingle();
      if (assocAntigo?.telefone) {
        const veicLabel = `${veiculo.marca || ''} ${veiculo.modelo || ''} (${veiculo.placa || ''})`.trim();
        await sendMetaTemplate({
          supabase: admin,
          telefone: assocAntigo.telefone,
          templateName: 'troca_titularidade_solicitada',
          templateParams: [String(assocAntigo.nome || 'Associado').split(' ')[0], veicLabel],
          referenciaTipo: 'troca_titularidade',
          referenciaId: solicitacao.id,
          tag: '[criar-solicitacao-troca]',
        });
      }
    } catch (waErr) {
      console.warn('[criar-solicitacao-troca] envio troca_titularidade_solicitada falhou (não bloqueante):', waErr);
    }

    // Disparo automático do termo de cancelamento — FIRE-AND-FORGET.
    // Antes era awaitado e estourava o timeout de 25s do cliente quando
    // Autentique/WhatsApp ficavam lentos. Agora o envio acontece em background
    // via EdgeRuntime.waitUntil (com fallback) e o cliente recebe 'agendado'.
    const dispararTermo = (async () => {
      try {
        const resp = await admin.functions.invoke('enviar-termo-cancelamento-troca', {
          body: { solicitacao_id: solicitacao.id },
        });
        if (resp.error) throw resp.error;
        if ((resp.data as any)?.error) throw new Error((resp.data as any).error);
      } catch (envErr) {
        console.error('[criar-solicitacao-troca] envio automático do termo falhou (background):',
          envErr instanceof Error ? envErr.message : envErr);
      }
    })();
    try {
      // @ts-ignore — EdgeRuntime existe em runtime Supabase Functions
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(dispararTermo);
      }
    } catch { /* ignore */ }

    return new Response(
      JSON.stringify({
        success: true,
        solicitacao_id: solicitacao.id,
        cotacao_id: null,
        cotacao_token: null,
        solicitacao_token: solicitacao.token_publico,
        termo_enviado_automaticamente: 'agendado',
        termo_envio_erro: null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[criar-solicitacao-troca]', e);
    const msg = e instanceof Error ? e.message : 'erro';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

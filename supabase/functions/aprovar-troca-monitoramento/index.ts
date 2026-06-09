// Aprovação do Monitoramento: aprova direto, solicita vistoria (com modalidade)
// ou agenda manutenção de rastreador antes da aprovação final.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { sendMetaTemplate } from '../_shared/send-meta-template.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Acao = 'aprovar' | 'solicitar_vistoria' | 'agendar_manutencao' | 'solicitar_retirada';
type TipoVistoriaTroca = 'somente_fotos' | 'fotos_com_rastreador';
type TipoVistoriaRetirada = 'retirada' | 'enxuta' | 'completa';

interface EnderecoBody {
  logradouro: string;
  numero?: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface Body {
  solicitacao_id: string;
  acao: Acao;
  observacao?: string | null;
  // solicitar_vistoria
  tipo_vistoria_troca?: TipoVistoriaTroca;
  // NOVO: dados para materializar o serviço de vistoria que o Monitoramento
  // está pedindo (data/período/endereço). Obrigatório no fluxo atual — sem
  // ele o serviço não aparece em Atribuição Manual.
  vistoria?: {
    data_agendada: string;        // YYYY-MM-DD
    periodo: 'manha' | 'tarde';
    endereco: EnderecoBody;
  };
  // agendar_manutencao
  manutencao?: {
    rastreador_id: string;
    data_agendada: string;        // YYYY-MM-DD
    periodo: 'manha' | 'tarde';
    motivo?: string;
    endereco: EnderecoBody;
  };
  // solicitar_retirada — cria 2 servicos (retirada_rastreador + vistoria do tipo escolhido)
  retirada?: {
    rastreador_id: string;
    tipo_vistoria: TipoVistoriaRetirada;
    data_agendada: string;        // YYYY-MM-DD
    periodo: 'manha' | 'tarde';
    justificativa: string;        // >=10 chars
    endereco: EnderecoBody;
  };
}



Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    const { solicitacao_id, acao, observacao } = body;
    if (!solicitacao_id || !['aprovar', 'solicitar_vistoria', 'agendar_manutencao', 'solicitar_retirada'].includes(acao)) {
      return new Response(JSON.stringify({ error: 'parâmetros inválidos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (acao === 'solicitar_vistoria' && !['somente_fotos', 'fotos_com_rastreador'].includes(String(body.tipo_vistoria_troca))) {
      return new Response(JSON.stringify({ error: 'tipo_vistoria_troca inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (acao === 'solicitar_vistoria') {
      const v = body.vistoria;
      if (!v?.data_agendada || !v?.periodo
          || !['manha', 'tarde'].includes(v.periodo)
          || !v?.endereco?.logradouro || !v?.endereco?.cep
          || !v?.endereco?.bairro || !v?.endereco?.cidade || !v?.endereco?.uf) {
        return new Response(JSON.stringify({ error: 'dados de vistoria incompletos (data, período, endereço)' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (acao === 'agendar_manutencao' && (!body.manutencao?.rastreador_id || !body.manutencao?.data_agendada || !body.manutencao?.periodo)) {
      return new Response(JSON.stringify({ error: 'dados de manutenção incompletos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (acao === 'solicitar_retirada') {
      const r = body.retirada;
      if (!r?.rastreador_id || !r?.data_agendada || !r?.periodo
          || !['retirada', 'enxuta', 'completa'].includes(String(r?.tipo_vistoria))
          || !r?.justificativa || r.justificativa.trim().length < 10
          || !r?.endereco?.logradouro || !r?.endereco?.cep) {
        return new Response(JSON.stringify({ error: 'dados de retirada incompletos' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }


    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader }}});
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    const profileId = profile?.id || null;

    const { data: solicitacao, error: getErr } = await admin
      .from('solicitacoes_troca_titularidade')
      .select('id, veiculo_id, associado_antigo_id, novo_associado_id, novo_titular_dados, cotacao_id, status')
      .eq('id', solicitacao_id)
      .maybeSingle();
    if (getErr || !solicitacao) throw new Error('Solicitação não encontrada');
    if (solicitacao.status === 'expirada') {
      throw new Error('Solicitação expirada — não é mais possível agir.');
    }
    if (acao === 'solicitar_vistoria' && solicitacao.status !== 'aguardando_monitoramento') {
      throw new Error('Solicitação não está aguardando monitoramento');
    }
    if (acao === 'agendar_manutencao' && solicitacao.status !== 'aguardando_monitoramento') {
      throw new Error('Manutenção só pode ser agendada com a solicitação em aguardando monitoramento');
    }
    if (acao === 'solicitar_retirada' && solicitacao.status !== 'aguardando_monitoramento') {
      throw new Error('Retirada só pode ser solicitada com a solicitação em aguardando monitoramento');
    }

    if (acao === 'aprovar' && !['aguardando_monitoramento', 'aguardando_vistoria', 'aguardando_manutencao'].includes(solicitacao.status as string)) {
      throw new Error(`Solicitação no status "${solicitacao.status}" não pode ser aprovada`);
    }

    const baseUpdate = {
      aprovado_monitoramento_por: profileId,
      aprovado_monitoramento_em: new Date().toISOString(),
      observacao_monitoramento: observacao || null,
    };

    // ── helper de notificação ─────────────────────────────────────────────
    const notificarTroca = async (templateName: string, params: string[]) => {
      try {
        const novoTit = (solicitacao.novo_titular_dados || {}) as any;
        const [{ data: assoc }] = await Promise.all([
          solicitacao.associado_antigo_id
            ? admin.from('associados').select('nome, telefone').eq('id', solicitacao.associado_antigo_id).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        if (assoc?.telefone) {
          await sendMetaTemplate({
            supabase: admin,
            telefone: assoc.telefone,
            templateName,
            templateParams: params,
            referenciaTipo: 'troca_titularidade',
            referenciaId: solicitacao_id,
            tag: '[aprovar-troca-monitoramento:antigo]',
          });
        }
        if (novoTit?.telefone) {
          await sendMetaTemplate({
            supabase: admin,
            telefone: novoTit.telefone,
            templateName,
            templateParams: params,
            referenciaTipo: 'troca_titularidade',
            referenciaId: solicitacao_id,
            tag: '[aprovar-troca-monitoramento:novo]',
          });
        }
      } catch (waErr) {
        console.warn('[aprovar-troca-monitoramento] whatsapp falhou (não bloqueante):', waErr);
      }
    };

    if (acao === 'aprovar') {
      // Marca a aprovação do monitoramento (sem mudar status ainda — só efetiva
      // depois que a edge `efetivar-troca-titularidade` confirmar sucesso).
      const { error } = await admin
        .from('solicitacoes_troca_titularidade')
        .update(baseUpdate)
        .eq('id', solicitacao_id);
      if (error) throw error;

      // Helper: reverter aprovação + marcar falha + enfileirar retry SGA.
      // Mantém a solicitação visível em "Pendentes do Monitoramento" para o
      // operador reprocessar a partir da UI corrigida.
      const reverterEMarcar = async (code: string, errMsg: string, etapa?: string) => {
        await admin
          .from('solicitacoes_troca_titularidade')
          .update({
            aprovado_monitoramento_por: null,
            aprovado_monitoramento_em: null,
            sga_status: 'falha',
            observacao_monitoramento:
              `${observacao ? observacao + ' | ' : ''}[${code}] ${etapa ? `etapa=${etapa} ` : ''}${(errMsg || '').slice(0, 400)}`,
          })
          .eq('id', solicitacao_id);
        try {
          await admin.from('sga_sync_queue').insert({
            veiculo_id: solicitacao.veiculo_id,
            associado_id: solicitacao.novo_associado_id || solicitacao.associado_antigo_id,
            status: 'pendente',
            origem: 'troca_titularidade_efetivar',
            etapa_parou: etapa || code,
            erro_ultimo: errMsg?.slice(0, 1000) || null,
            proximo_reenvio_em: new Date(Date.now() + 60_000).toISOString(),
          });
        } catch (qErr) {
          console.warn('[aprovar-troca-monitoramento] falha ao enfileirar sga_sync_queue:', qErr);
        }
      };

      // Ativação do contrato do novo titular — propaga erro (sem ela o contrato
      // nasce 'assinado' e o veículo nunca promove).
      if (solicitacao.novo_associado_id) {
        let contratoNovoId: string | null = null;
        if (solicitacao.cotacao_id) {
          const { data: contratoNovo } = await admin
            .from('contratos')
            .select('id')
            .eq('cotacao_id', solicitacao.cotacao_id)
            .eq('associado_id', solicitacao.novo_associado_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          contratoNovoId = contratoNovo?.id || null;
        }
        try {
          const ativResp = await fetch(`${SUPABASE_URL}/functions/v1/ativar-associado`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              associado_id: solicitacao.novo_associado_id,
              contrato_id: contratoNovoId,
              cotacao_id: solicitacao.cotacao_id,
              source: 'edge:aprovar-troca-monitoramento',
              actor_id: profileId,
              allowed_from: ['assinado', 'aguardando_instalacao', 'pendente'],
              metadata: { solicitacao_troca_id: solicitacao_id },
            }),
          });
          const ativJson = await ativResp.json().catch(() => ({}));
          // ativar-associado retorna { success } ou { error }
          const ativOk = ativResp.ok && (ativJson?.success !== false) && !ativJson?.error;
          if (!ativOk) {
            const errMsg = ativJson?.error || ativJson?.message || `HTTP ${ativResp.status}`;
            await reverterEMarcar('falha_ativar_novo_titular', errMsg, 'ativar-associado');
            return new Response(JSON.stringify({
              success: false,
              code: 'falha_ativar_novo_titular',
              error: errMsg,
            }), {
              status: 502,
              headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' },
            });
          }
        } catch (ativErr) {
          const msg = ativErr instanceof Error ? ativErr.message : String(ativErr);
          await reverterEMarcar('falha_ativar_novo_titular', msg, 'ativar-associado');
          return new Response(JSON.stringify({
            success: false,
            code: 'falha_ativar_novo_titular',
            error: msg,
          }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' },
          });
        }
      }

      // Efetivação (transferência de veículo + cancelamento contrato antigo + SGA).
      // A própria edge atualiza status='efetivada' em caso de sucesso.
      try {
        const efetivResp = await fetch(`${SUPABASE_URL}/functions/v1/efetivar-troca-titularidade`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ solicitacao_id, cenario_override: 'B' }),
        });
        const efetivJson = await efetivResp.json().catch(() => ({}));
        if (!efetivJson?.success) {
          const errMsg = efetivJson?.error || efetivJson?.message || `HTTP ${efetivResp.status}`;
          const etapa = efetivJson?.etapa_falha || null;
          console.error('[aprovar-troca-monitoramento] efetivar-troca falhou:', efetivJson);
          await reverterEMarcar('falha_efetivar_troca', errMsg, etapa);
          return new Response(JSON.stringify({
            success: false,
            code: 'falha_efetivar_troca',
            etapa_falha: etapa,
            error: errMsg,
          }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' },
          });
        }
      } catch (efetErr) {
        const msg = efetErr instanceof Error ? efetErr.message : String(efetErr);
        console.error('[aprovar-troca-monitoramento] erro ao efetivar troca:', msg);
        await reverterEMarcar('falha_efetivar_troca', msg);
        return new Response(JSON.stringify({
          success: false,
          code: 'falha_efetivar_troca',
          error: msg,
        }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' },
        });
      }
    } else if (acao === 'solicitar_vistoria') {
      // CANÔNICO: materializa um serviço de campo (vistoria_entrada) com o
      // endereço do novo titular para o Monitoramento atribuir/executar.
      // origem='troca_titularidade' é a exceção que dispensa cadastro_aprovado
      // na Atribuição Manual (ver memória gate-cadastro-monitoramento-universal).
      const tipo = body.tipo_vistoria_troca!;
      const v = body.vistoria!;
      const associadoServico = solicitacao.novo_associado_id || solicitacao.associado_antigo_id;

      const { data: servico, error: sErr } = await admin
        .from('servicos')
        .insert({
          tipo: 'vistoria_entrada',
          status: 'pendente',
          data_agendada: v.data_agendada,
          periodo: v.periodo,
          associado_id: associadoServico,
          veiculo_id: solicitacao.veiculo_id,
          local_vistoria: 'cliente',
          permite_encaixe: true,
          origem: 'troca_titularidade',
          observacoes: `[monitoramento_troca] Vistoria solicitada (${tipo === 'fotos_com_rastreador' ? 'fotos + instalação de rastreador' : 'somente fotos'}) para troca de titularidade ${solicitacao_id}.`,
          logradouro: v.endereco.logradouro,
          numero: v.endereco.numero || null,
          bairro: v.endereco.bairro,
          cidade: v.endereco.cidade,
          uf: v.endereco.uf,
          cep: v.endereco.cep,
          latitude: v.endereco.latitude || null,
          longitude: v.endereco.longitude || null,
        })
        .select('id')
        .single();
      if (sErr) throw sErr;

      const { error } = await admin
        .from('solicitacoes_troca_titularidade')
        .update({
          ...baseUpdate,
          status: 'aguardando_vistoria',
          tipo_vistoria_troca: tipo,
          instalar_rastreador: tipo === 'fotos_com_rastreador',
          servico_vistoria_id: servico.id,
        })
        .eq('id', solicitacao_id);
      if (error) {
        // rollback do serviço criado
        await admin.from('servicos').delete().eq('id', servico.id);
        throw error;
      }

      const tipoLabel = tipo === 'fotos_com_rastreador' ? 'Fotos + instalação de rastreador' : 'Somente fotos';
      await notificarTroca('troca_vistoria_agendada', [tipoLabel]);

    } else if (acao === 'agendar_manutencao') {
      // Cria serviço de campo (vistoria_manutencao) com endereço informado.
      const m = body.manutencao!;
      const { data: rast, error: rErr } = await admin
        .from('rastreadores')
        .select('id, codigo, veiculo_id')
        .eq('id', m.rastreador_id)
        .maybeSingle();
      if (rErr || !rast) throw new Error('Rastreador não encontrado');

      // Atualiza status do rastreador para manutenção (alinhado com useCriarManutencao)
      await admin
        .from('rastreadores')
        .update({ status: 'manutencao', updated_at: new Date().toISOString() })
        .eq('id', m.rastreador_id);

      await admin.from('estoque_movimentacoes').insert({
        tipo: 'alteracao_status',
        quantidade: 1,
        status_anterior: 'instalado',
        status_novo: 'manutencao',
        rastreador_id: m.rastreador_id,
        observacoes: m.motivo || 'Manutenção agendada na troca de titularidade',
      });

      const { data: servico, error: sErr } = await admin
        .from('servicos')
        .insert({
          tipo: 'vistoria_manutencao',
          status: 'pendente',
          data_agendada: m.data_agendada,
          periodo: m.periodo,
          rastreador_id: m.rastreador_id,
          veiculo_id: rast.veiculo_id || solicitacao.veiculo_id,
          associado_id: solicitacao.associado_antigo_id,
          local_vistoria: 'cliente',
          observacoes: m.motivo || `Manutenção solicitada pelo monitoramento (troca ${solicitacao_id})`,
          permite_encaixe: true,
          logradouro: m.endereco.logradouro,
          numero: m.endereco.numero || null,
          bairro: m.endereco.bairro,
          cidade: m.endereco.cidade,
          uf: m.endereco.uf,
          cep: m.endereco.cep,
          latitude: m.endereco.latitude || null,
          longitude: m.endereco.longitude || null,
        })
        .select('id')
        .single();
      if (sErr) throw sErr;

      const { error } = await admin
        .from('solicitacoes_troca_titularidade')
        .update({
          ...baseUpdate,
          status: 'aguardando_manutencao',
          tipo_vistoria_troca: 'manutencao',
          servico_manutencao_id: servico.id,
        })
        .eq('id', solicitacao_id);
      if (error) throw error;

      await notificarTroca('troca_manutencao_agendada', [
        new Date(m.data_agendada).toLocaleDateString('pt-BR'),
        m.periodo === 'manha' ? 'manhã' : 'tarde',
      ]);
    } else if (acao === 'solicitar_retirada') {
      // Materializa 2 serviços paralelos: retirada_rastreador + vistoria
      // acompanhante (tipo escolhido pelo Monitoramento). Solicitação fica
      // em aguardando_vistoria — Aprovar volta quando ambos terminarem.
      const r = body.retirada!;
      const { data: rast, error: rErr } = await admin
        .from('rastreadores')
        .select('id, codigo, veiculo_id')
        .eq('id', r.rastreador_id)
        .maybeSingle();
      if (rErr || !rast) throw new Error('Rastreador não encontrado');

      const veiculoIdAlvo = rast.veiculo_id || solicitacao.veiculo_id;
      const baseServico = {
        status: 'pendente' as const,
        data_agendada: r.data_agendada,
        periodo: r.periodo,
        veiculo_id: veiculoIdAlvo,
        associado_id: solicitacao.associado_antigo_id,
        local_vistoria: 'cliente',
        permite_encaixe: true,
        origem: 'troca_titularidade',
        logradouro: r.endereco.logradouro,
        numero: r.endereco.numero || null,
        bairro: r.endereco.bairro,
        cidade: r.endereco.cidade,
        uf: r.endereco.uf,
        cep: r.endereco.cep,
        latitude: r.endereco.latitude || null,
        longitude: r.endereco.longitude || null,
      };

      // 1) Serviço de retirada do rastreador
      const { data: servRetirada, error: srErr } = await admin
        .from('servicos')
        .insert({
          ...baseServico,
          tipo: 'retirada_rastreador',
          rastreador_id: r.rastreador_id,
          observacoes: `[monitoramento_retirada] ${r.justificativa}`,
        })
        .select('id')
        .single();
      if (srErr) throw srErr;

      // 2) Serviço de vistoria acompanhante (tipo escolhido)
      const vistoriaTipo = r.tipo_vistoria === 'retirada' ? 'vistoria_retirada' : 'vistoria_entrada';
      const modalidade =
        r.tipo_vistoria === 'enxuta' ? 'enxuta_pos_retirada'
        : r.tipo_vistoria === 'completa' ? 'completa_pos_retirada'
        : null;
      const { data: servVistoria, error: svErr } = await admin
        .from('servicos')
        .insert({
          ...baseServico,
          tipo: vistoriaTipo,
          modalidade,
          observacoes: `[monitoramento_retirada] Vistoria acompanhante (${r.tipo_vistoria}). ${r.justificativa}`,
        })
        .select('id')
        .single();
      if (svErr) {
        // rollback do irmão
        await admin.from('servicos').delete().eq('id', servRetirada.id);
        throw svErr;
      }

      // Log canônico em análises de relacionamento (não-bloqueante)
      try {
        await admin.from('analises_relacionamento').insert({
          tipo: 'monitoramento_solicitou_retirada',
          status: 'pendente',
          associado_id: solicitacao.associado_antigo_id,
          veiculo_id: veiculoIdAlvo,
          origem_tabela: 'solicitacoes_troca_titularidade',
          origem_id: solicitacao_id,
          justificativa: r.justificativa,
          metadata: {
            tipo_vistoria_escolhida: r.tipo_vistoria,
            servico_retirada_id: servRetirada.id,
            servico_vistoria_id: servVistoria.id,
            rastreador_id: r.rastreador_id,
            actor_profile_id: profileId,
          },
        });
      } catch (logErr) {
        console.warn('[aprovar-troca-monitoramento] analises_relacionamento falhou (não bloqueante):', logErr);
      }


      const { error: updErr } = await admin
        .from('solicitacoes_troca_titularidade')
        .update({
          ...baseUpdate,
          status: 'aguardando_vistoria',
          tipo_vistoria_troca: 'retirada',
          servico_manutencao_id: servRetirada.id,
          servico_vistoria_id: servVistoria.id,
        })
        .eq('id', solicitacao_id);
      if (updErr) throw updErr;
    }


    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

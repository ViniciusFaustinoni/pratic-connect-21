// Cancelamento manual de Troca de Titularidade (operador)
// - Idempotente: se já estiver em status terminal, retorna 200.
// - Limpa flag em_troca_titularidade do veículo.
// - Envia WhatsApp (best-effort) ao titular antigo.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { sendMetaTemplate } from '../_shared/send-meta-template.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TERMINAL = new Set([
  'efetivada', 'cancelada', 'expirada', 'reprovada_cadastro', 'reprovada_monitoramento',
]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { solicitacao_id, motivo } = await req.json();
    if (!solicitacao_id) {
      return new Response(JSON.stringify({ error: 'solicitacao_id obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: sol, error: solErr } = await admin
      .from('solicitacoes_troca_titularidade')
      .select('id, status, associado_antigo_id, veiculo_id, cotacao_id, termo_cancelamento_autentique_id')
      .eq('id', solicitacao_id)
      .maybeSingle();
    if (solErr) throw solErr;
    if (!sol) {
      return new Response(JSON.stringify({ error: 'Solicitação não encontrada' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (TERMINAL.has(sol.status)) {
      return new Response(JSON.stringify({ success: true, already_terminal: true, status: sol.status }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const motivoFinal = (motivo && String(motivo).trim()) || 'Cancelada manualmente pelo operador';

    // FK reprovado_por -> profiles.id (NÃO auth.users.id). Resolver profile do usuário.
    const { data: prof } = await admin
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    const reprovadoPor = prof?.id ?? null;

    // Etapa 1: cancelar a solicitação. Cascateia para o contrato derivado
    // via trigger trg_troca_cancelada_cancela_contrato_orfao.
    let etapaAtual = 'update_solicitacao';
    const lancarComEtapa = (err: unknown): never => {
      const se = (err ?? {}) as { message?: string; details?: string; hint?: string; code?: string };
      const wrap = new Error(
        `[etapa=${etapaAtual}] ${se.message || se.details || 'erro desconhecido'}`,
      );
      (wrap as unknown as Record<string, unknown>).code = se.code ?? null;
      (wrap as unknown as Record<string, unknown>).details = se.details ?? null;
      (wrap as unknown as Record<string, unknown>).hint = se.hint ?? null;
      (wrap as unknown as Record<string, unknown>).etapa = etapaAtual;
      throw wrap;
    };

    try {
      const { error: updErr } = await admin
        .from('solicitacoes_troca_titularidade')
        .update({
          status: 'cancelada',
          motivo_reprovacao: motivoFinal,
          reprovado_por: reprovadoPor,
          reprovado_em: new Date().toISOString(),
        })
        .eq('id', solicitacao_id);
      if (updErr) lancarComEtapa(updErr);
    } catch (e) { lancarComEtapa(e); }

    // Etapa 2: limpar flags da troca no veículo (best-effort)
    etapaAtual = 'limpar_veiculo';
    if (sol.veiculo_id) {
      try {
        await admin
          .from('veiculos')
          .update({
            em_troca_titularidade: false,
            troca_titularidade_id: null,
            troca_titularidade_iniciada_em: null,
          })
          .eq('id', sol.veiculo_id);
      } catch (vErr) {
        console.warn('[cancelar-troca] limpar flags veículo falhou:', vErr);
      }
    }

    // Etapa 2.1: religar cobertura SOMENTE se a suspensão foi causada pela própria troca
    etapaAtual = 'religar_cobertura';
    if (sol.veiculo_id) {
      try {
        const { data: veicSusp } = await admin
          .from('veiculos')
          .select('cobertura_suspensa, cobertura_suspensa_motivo')
          .eq('id', sol.veiculo_id)
          .maybeSingle();
        if (veicSusp?.cobertura_suspensa && veicSusp?.cobertura_suspensa_motivo === 'troca_titularidade_em_andamento') {
          const { error: relErr } = await admin
            .from('veiculos')
            .update({
              cobertura_suspensa: false,
              cobertura_suspensa_em: null,
              cobertura_suspensa_motivo: null,
            })
            .eq('id', sol.veiculo_id);
          if (relErr) console.warn('[cancelar-troca] religar cobertura falhou:', relErr);
          else console.log('[cancelar-troca] cobertura religada (motivo=troca_titularidade_em_andamento)');
        } else {
          console.log('[cancelar-troca] religação ignorada (motivo=', veicSusp?.cobertura_suspensa_motivo, ', suspensa=', veicSusp?.cobertura_suspensa, ')');
        }
      } catch (relEx) {
        console.warn('[cancelar-troca] religar cobertura exception:', relEx);
      }
    }

    // Etapa 2.2: revogar termo no Autentique (best-effort)
    etapaAtual = 'revogar_termo';
    if (sol.termo_cancelamento_autentique_id) {
      try {
        const { error: cancelErr } = await admin.functions.invoke('autentique-cancel', {
          body: { documentId: sol.termo_cancelamento_autentique_id },
        });
        if (cancelErr) console.warn('[cancelar-troca] revogar termo Autentique falhou:', cancelErr);
        else console.log('[cancelar-troca] termo Autentique revogado:', sol.termo_cancelamento_autentique_id);
      } catch (acEx) {
        console.warn('[cancelar-troca] revogar termo Autentique exception:', acEx);
      }
    }

    // Etapa 3: cancelar a cotação derivada e invalidar o link público.
    etapaAtual = 'cancelar_cotacao';
    if (sol.cotacao_id) {
      try {
        const novoToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
        const { error: cotErr } = await admin
          .from('cotacoes')
          .update({
            status: 'cancelada',
            status_contratacao: 'cancelada',
            cancelada_em: new Date().toISOString(),
            cancelada_por: reprovadoPor,
            motivo_cancelamento: `Troca de titularidade cancelada: ${motivoFinal}`,
            token_publico: novoToken,
          })
          .eq('id', sol.cotacao_id)
          .eq('origem_troca_titularidade', true);
        if (cotErr) console.warn('[cancelar-troca] cancelar cotação derivada falhou:', cotErr);
      } catch (cErr) {
        console.warn('[cancelar-troca] cancelar cotação derivada exception:', cErr);
      }
    }

    // Etapa 4: cancelar contrato derivado (caso novo titular já tenha assinado).
    etapaAtual = 'cancelar_contrato';
    try {
      const { error: ctrErr } = await admin
        .from('contratos')
        .update({
          status: 'cancelado',
          data_cancelamento: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('origem_troca_titularidade_id', solicitacao_id)
        .not('status', 'in', '(cancelado,ativo)');
      if (ctrErr) console.warn('[cancelar-troca] cancelar contrato derivado falhou:', ctrErr);
    } catch (ctrEx) {
      console.warn('[cancelar-troca] cancelar contrato derivado exception:', ctrEx);
    }

    // WhatsApp ao titular antigo (best-effort)
    try {
      if (sol.associado_antigo_id) {
        const [{ data: assoc }, { data: veic }] = await Promise.all([
          admin.from('associados').select('nome, telefone').eq('id', sol.associado_antigo_id).maybeSingle(),
          sol.veiculo_id
            ? admin.from('veiculos').select('marca, modelo, placa').eq('id', sol.veiculo_id).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        if (assoc?.telefone) {
          const veicLabel = veic ? `${veic.marca || ''} ${veic.modelo || ''} (${veic.placa || ''})`.trim() : 'veículo';
          await sendMetaTemplate({
            supabase: admin,
            telefone: assoc.telefone,
            templateName: 'troca_titularidade_reprovada_v2',
            templateParams: [
              String(assoc.nome || 'Associado').split(' ')[0],
              veicLabel,
              String(motivoFinal).substring(0, 200),
            ],
            referenciaTipo: 'troca_titularidade',
            referenciaId: solicitacao_id,
            tag: '[cancelar-troca]',
          });
        }
      }
    } catch (waErr) {
      console.warn('[cancelar-troca] envio whatsapp falhou (não bloqueante):', waErr);
    }

    return new Response(JSON.stringify({ success: true, status: 'cancelada' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[cancelar-troca]', e);
    // PostgrestError / objetos do supabase-js NÃO são instâncias de Error —
    // o catch precisa extrair .message/.details/.code manualmente, senão o
    // front recebe só "erro" (caso 1779495932139).
    const anyErr = e as { message?: string; details?: string; hint?: string; code?: string } | null;
    const msg =
      (e instanceof Error && e.message) ||
      anyErr?.message ||
      anyErr?.details ||
      anyErr?.hint ||
      'erro desconhecido';
    return new Response(
      JSON.stringify({
        error: msg,
        etapa: (anyErr as { etapa?: string } | null)?.etapa ?? null,
        code: anyErr?.code ?? null,
        details: anyErr?.details ?? null,
        hint: anyErr?.hint ?? null,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

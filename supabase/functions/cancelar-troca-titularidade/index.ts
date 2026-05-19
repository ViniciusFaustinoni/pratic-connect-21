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
      .select('id, status, associado_antigo_id, veiculo_id')
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

    const { error: updErr } = await admin
      .from('solicitacoes_troca_titularidade')
      .update({
        status: 'cancelada',
        motivo_reprovacao: motivoFinal,
        reprovado_por: user.id,
        reprovado_em: new Date().toISOString(),
      })
      .eq('id', solicitacao_id);
    if (updErr) throw updErr;

    // Limpa flag em_troca_titularidade do veículo (best-effort)
    if (sol.veiculo_id) {
      try {
        await admin
          .from('veiculos')
          .update({ em_troca_titularidade: false })
          .eq('id', sol.veiculo_id);
      } catch (vErr) {
        console.warn('[cancelar-troca] limpar em_troca_titularidade falhou:', vErr);
      }
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
    const msg = e instanceof Error ? e.message : 'erro';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

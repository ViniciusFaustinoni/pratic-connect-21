// Aprovação MANUAL da etapa de Cadastro — fallback legado.
// FLUXO PADRÃO: o cadastro é AUTO-APROVADO em `vincular-cotacao-troca`
// no momento em que a cotação é vinculada (porque o termo de cancelamento
// já foi assinado). Esta função existe apenas para itens legados que
// ficaram presos em `aguardando_cadastro` antes da mudança.
//
// Antes de aprovar:
//   1) trava se termo de cancelamento não foi assinado
//   2) regrava snapshot de análise prévia do novo titular (base local + SGA) — idempotente
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { runPosCadastroBackgroundFireAndForget } from '../_shared/troca-pos-cadastro-bg.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { solicitacao_id, observacao } = await req.json();
    if (!solicitacao_id) {
      return new Response(JSON.stringify({ error: 'solicitacao_id obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

    // 1) Carregar solicitação
    const { data: sol, error: solErr } = await admin
      .from('solicitacoes_troca_titularidade')
      .select('id, status, termo_cancelamento_assinado_em, associado_antigo_id, novo_titular_dados, cotacao_id, veiculo_id, criado_por')
      .eq('id', solicitacao_id)
      .maybeSingle();
    if (solErr) throw solErr;
    if (!sol) {
      return new Response(JSON.stringify({ error: 'Solicitação não encontrada' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2) Trava: assinatura do termo
    if (!sol.termo_cancelamento_assinado_em) {
      return new Response(
        JSON.stringify({ error: 'Aprovação bloqueada: o titular antigo ainda não assinou o termo de cancelamento no Autentique.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // (Removido) Trava por débito do antigo: a troca não exige mais adimplência.

    // 4) Resolver profile.id do aprovador
    const { data: prof } = await admin
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    const aprovadorId = prof?.id ?? null;

    // 5) COMMIT PRIMEIRO: avançar status com CAS (idempotente)
    // NOVO FLUXO: cadastro aprovado → liberada_para_assinatura DIRETO.
    // O Monitoramento só vê o caso depois que o novo titular concluir a vistoria
    // (trigger fn_troca_promover_monitoramento_pos_vistoria promove para
    // `aguardando_monitoramento` ao detectar vistoria em_analise/concluida).
    const { data: updated, error: updErr } = await admin
      .from('solicitacoes_troca_titularidade')
      .update({
        status: 'liberada_para_assinatura',
        aprovado_cadastro_por: aprovadorId,
        aprovado_cadastro_em: new Date().toISOString(),
        observacao_cadastro: observacao || null,
      })
      .eq('id', solicitacao_id)
      .eq('status', 'aguardando_cadastro')
      .select('id');

    if (updErr) {
      console.error('[aprovar-troca-cadastro] update error:', updErr);
      throw new Error(updErr.message || 'Falha ao atualizar solicitação');
    }

    if (!updated || updated.length === 0) {
      return new Response(
        JSON.stringify({ success: true, already_advanced: true, status: 'liberada_para_assinatura' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 6) Trabalho pesado em background (snapshot SGA + atribuição vendedor + WhatsApp)
    runPosCadastroBackgroundFireAndForget(admin, {
      id: sol.id,
      cotacao_id: sol.cotacao_id,
      veiculo_id: sol.veiculo_id,
      criado_por: sol.criado_por,
      novo_titular_dados: (sol.novo_titular_dados as any) || null,
    });

    return new Response(
      JSON.stringify({ success: true, status: 'liberada_para_assinatura' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    console.error('[aprovar-troca-cadastro] FATAL:', e, JSON.stringify(e));
    const msg = (e && (e.message || e.error_description || e.hint || e.details)) || (typeof e === 'string' ? e : 'erro');
    return new Response(JSON.stringify({ error: msg, raw: typeof e === 'object' ? e : null }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

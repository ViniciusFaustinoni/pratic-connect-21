// Aprovação MANUAL da etapa de Cadastro na Troca de Titularidade.
// REGRA MESTRA: o Cadastro NUNCA é auto-aprovado — segue exatamente o
// mesmo princípio da cotação comum. `vincular-cotacao-troca` apenas
// vincula a cotação à solicitação e mantém o status `aguardando_cadastro`.
// Esta função é o único caminho para promover a solicitação para
// `aguardando_monitoramento`, validando termo de cancelamento assinado,
// situação financeira do antigo titular no SGA e autovistoria do novo
// titular concluída.
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
      .select('id, status, termo_cancelamento_assinado_em, autovistoria_concluida_em, associado_antigo_id, novo_titular_dados, cotacao_id, veiculo_id, criado_por')
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

    // 2b) GATE: Situação Financeira (SGA) — exige check liberador ≤ 24h
    {
      const dia = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: ultimo } = await admin
        .from('sga_situacao_check')
        .select('id, tem_debito, bypass, origem_resultado, verificado_em')
        .eq('solicitacao_troca_id', solicitacao_id)
        .gte('verificado_em', dia)
        .order('verificado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      const liberador = ultimo && (
        !ultimo.tem_debito ||
        ultimo.bypass === true ||
        ultimo.origem_resultado === 'transitorio' ||
        ultimo.origem_resultado === 'associado_inexistente_sga'
      );
      if (!liberador) {
        return new Response(
          JSON.stringify({
            error: 'inadimplencia_sga_pendente',
            message: 'Consulte a situação financeira do titular antigo no SGA antes de aprovar.',
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // 3) Trava: autovistoria do novo titular precisa estar concluída
    if (!sol.autovistoria_concluida_em) {
      return new Response(
        JSON.stringify({
          error: 'Aprovação bloqueada: o novo titular ainda não concluiu a autovistoria pelo link público. Cadastro só pode aprovar após as fotos e documentos ficarem prontos.',
          code: 'AUTOVISTORIA_PENDENTE',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 4) Resolver profile.id do aprovador
    const { data: prof } = await admin
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    const aprovadorId = prof?.id ?? null;

    // 5) COMMIT PRIMEIRO: avançar status com CAS (idempotente)
    // FLUXO ATUAL: Cadastro aprova → aguardando_monitoramento.
    // O Monitoramento então decide: aprovar (libera_para_assinatura), pedir
    // vistoria adicional (aguardando_vistoria) ou agendar manutenção de
    // rastreador (aguardando_manutencao).
    const { data: updated, error: updErr } = await admin
      .from('solicitacoes_troca_titularidade')
      .update({
        status: 'aguardando_monitoramento',
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
        JSON.stringify({ success: true, already_advanced: true, status: 'aguardando_monitoramento' }),
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
      JSON.stringify({ success: true, status: 'aguardando_monitoramento' }),
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

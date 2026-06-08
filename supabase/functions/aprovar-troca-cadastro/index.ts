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
    const { solicitacao_id, observacao, bypass_janela, bypass_justificativa, bypass_nome_autorizador } = await req.json();
    if (!solicitacao_id) {
      return new Response(JSON.stringify({ error: 'solicitacao_id obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const wantsBypass = bypass_janela === true;
    const justificativa = typeof bypass_justificativa === 'string' ? bypass_justificativa.trim() : '';
    const nomeAutorizador = typeof bypass_nome_autorizador === 'string' ? bypass_nome_autorizador.trim() : '';
    if (wantsBypass) {
      if (nomeAutorizador.length < 3) {
        return new Response(JSON.stringify({
          error: 'Nome do autorizador obrigatório (mínimo 3 caracteres).',
          code: 'BYPASS_AUTORIZADOR_OBRIGATORIO',
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (justificativa.length < 20) {
        return new Response(JSON.stringify({
          error: 'Justificativa obrigatória (mínimo 20 caracteres) para aprovar fora da janela.',
          code: 'BYPASS_JUSTIFICATIVA_OBRIGATORIA',
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

    // 2a) GATE: novo titular ainda não concluiu o link público.
    // Régua canônica: a fila do Cadastro só recebe a troca quando a cotação
    // canônica atingir `aguardando_aprovacao_cadastro` (trigger
    // trg_troca_promove_cadastro_via_cotacao promove o status para
    // 'aguardando_cadastro'). Se ainda está em 'cotacao_em_andamento', o
    // novo titular não terminou Docs/Contrato/Vistoria.
    if (sol.status === 'cotacao_em_andamento') {
      return new Response(
        JSON.stringify({
          error: 'link_publico_incompleto',
          message: 'Novo titular ainda não concluiu o link público (documentos, contrato e vistoria).',
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // (Removido) Trava por débito do antigo: a troca não exige mais adimplência.
    // (Removido) Gate SGA `sga_situacao_check`: era resquício da política antiga
    // e bloqueava a aprovação mesmo após o pivot ("basta que o titular antigo
    // exista no sistema e tenha assinado o termo" — ver tutorial
    // aprovacao-troca-titularidade-cadastro). Monitoramento decide o resto.


    // 3) Trava: autovistoria do novo titular OU janela mesmo-dia
    // Janela mesmo-dia: até 23:59:59.999 BRT (UTC-3) do dia em que o termo
    // de cancelamento foi assinado, a autovistoria é DISPENSADA — a proteção
    // do titular antigo é estendida ao novo. Passou da janela, o cron
    // `cron-expirar-trocas-titularidade` deve cancelar; aqui devolvemos erro.
    const dispensaAutovistoriaPorJanela = (() => {
      if (!sol.termo_cancelamento_assinado_em) return false;
      const a = new Date(sol.termo_cancelamento_assinado_em);
      // Fim do dia BRT em UTC = 02:59:59.999 do dia seguinte UTC
      const fimDiaBRTemUTC = new Date(Date.UTC(
        a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate(),
        26, 59, 59, 999
      ));
      return new Date() <= fimDiaBRTemUTC;
    })();

    if (!sol.autovistoria_concluida_em && !dispensaAutovistoriaPorJanela && !wantsBypass) {
      return new Response(
        JSON.stringify({
          error: 'Aprovação bloqueada: passou da janela de mesmo-dia (até 23:59:59 BRT do dia da assinatura do termo). Diretor pode aprovar fora da janela com justificativa.',
          code: 'JANELA_TROCA_EXPIRADA',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 3b) Bypass diretor: valida role + grava auditoria.
    if (wantsBypass) {
      const { data: roles } = await admin
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      const isDiretor = (roles || []).some((r: any) => r.role === 'diretor');
      if (!isDiretor) {
        return new Response(JSON.stringify({
          error: 'Apenas perfil Diretor pode aprovar troca fora da janela de mesmo-dia.',
          code: 'BYPASS_NEGADO_ROLE',
        }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      try {
        await admin.from('logs_auditoria').insert([{
          usuario_id: user.id,
          usuario_nome: user.email || 'diretor',
          acao: 'aprovar',
          modulo: 'cotacoes',
          descricao: `[TROCA_BYPASS_JANELA] Solicitação ${solicitacao_id} aprovada fora da janela mesmo-dia. Justificativa: ${justificativa}`,
          tabela: 'solicitacoes_troca_titularidade',
          registro_id: solicitacao_id,
          dados_novos: {
            bypass_janela: true,
            justificativa,
            termo_assinado_em: sol.termo_cancelamento_assinado_em,
            cotacao_id: sol.cotacao_id,
            veiculo_id: sol.veiculo_id,
          },
        }]);
      } catch (auditErr) {
        console.error('[aprovar-troca-cadastro] falha ao gravar auditoria de bypass:', auditErr);
      }
      console.log('[aprovar-troca-cadastro] BYPASS_JANELA aplicado', { solicitacao_id, user_id: user.id });
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
      // Propagação canônica: UPDATE crítico na solicitação de troca não pode ser
      // engolido como 500/200. Retorna 502 + Retry-After para que o cliente
      // (front + supervisores) entendam que vale insistir.
      return new Response(
        JSON.stringify({
          success: false,
          error: 'falha_aprovar_troca_cadastro',
          code: 'falha_aprovar_troca_cadastro',
          detail: updErr.message || 'Falha ao atualizar solicitação de troca',
          hint: 'A aprovação não foi persistida. Tente novamente em 1 minuto; se persistir, abrir incidente.',
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' },
        },
      );
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

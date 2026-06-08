// Converte uma Troca de Titularidade pendente em uma cotação normal:
// cancela a solicitação, a cotação derivada, o contrato derivado e libera o
// veículo (flags `em_troca_titularidade`). Reaproveita `cancelar-troca-titularidade`
// internamente e adiciona registro auditado (logs_auditoria +
// analises_relacionamento + contratos.bypass_aplicado) com nome do autorizador,
// justificativa e operador.
//
// Decisão tomada pelo perfil Cadastro (sem gate de Diretor). Exige:
//   - nome_autorizador (≥3)
//   - justificativa (≥20)
//   - confirmação de responsabilidade (validada no front: checkbox)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { solicitacao_id, nome_autorizador, justificativa } = await req.json();
    if (!solicitacao_id) {
      return new Response(JSON.stringify({ error: 'solicitacao_id obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const nomeAutorizador = typeof nome_autorizador === 'string' ? nome_autorizador.trim() : '';
    const just = typeof justificativa === 'string' ? justificativa.trim() : '';
    if (nomeAutorizador.length < 3) {
      return new Response(JSON.stringify({
        error: 'Nome do autorizador obrigatório (mínimo 3 caracteres).',
        code: 'AUTORIZADOR_OBRIGATORIO',
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (just.length < 20) {
      return new Response(JSON.stringify({
        error: 'Justificativa obrigatória (mínimo 20 caracteres).',
        code: 'JUSTIFICATIVA_OBRIGATORIA',
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

    // Carrega solicitação para contexto (associado/veículo/cotação) ANTES da cancellation.
    const { data: sol } = await admin
      .from('solicitacoes_troca_titularidade')
      .select('id, status, associado_antigo_id, veiculo_id, cotacao_id, termo_cancelamento_assinado_em')
      .eq('id', solicitacao_id)
      .maybeSingle();
    if (!sol) {
      return new Response(JSON.stringify({ error: 'Solicitação não encontrada' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve operador (profile.nome quando disponível)
    let operadorNome: string | null = null;
    try {
      const { data: prof } = await admin
        .from('profiles').select('nome').eq('user_id', user.id).maybeSingle();
      operadorNome = (prof as any)?.nome || user.email || 'cadastro';
    } catch (_) {
      operadorNome = user.email || 'cadastro';
    }

    // Captura contrato derivado ANTES do cancelamento para gravar bypass_aplicado.
    let contratoTrocaId: string | null = null;
    let contratoBypassAtual: any[] = [];
    if (sol.cotacao_id) {
      const { data: ctr } = await admin
        .from('contratos')
        .select('id, bypass_aplicado')
        .eq('cotacao_id', sol.cotacao_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      contratoTrocaId = (ctr as any)?.id || null;
      contratoBypassAtual = Array.isArray((ctr as any)?.bypass_aplicado) ? (ctr as any).bypass_aplicado : [];
    }

    // 1) Invoca cancelar-troca-titularidade (idempotente).
    const cancelUrl = `${SUPABASE_URL}/functions/v1/cancelar-troca-titularidade`;
    const motivoFinal = `Convertida em cotação normal pelo Cadastro. Autorizado por: ${nomeAutorizador}. Justificativa: ${just}`;
    const cancelResp = await fetch(cancelUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({ solicitacao_id, motivo: motivoFinal }),
    });
    const cancelJson: any = await cancelResp.json().catch(() => ({}));
    if (!cancelResp.ok && !cancelJson?.already_terminal) {
      return new Response(JSON.stringify({
        success: false,
        error: cancelJson?.error || 'Falha ao cancelar troca de titularidade.',
        etapa: cancelJson?.etapa || null,
      }), { status: cancelResp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const aplicadoEm = new Date().toISOString();

    // 2) logs_auditoria (vigia universal)
    try {
      await admin.from('logs_auditoria').insert([{
        usuario_id: user.id,
        usuario_nome: operadorNome || user.email || 'cadastro',
        acao: 'cancelar',
        modulo: 'cotacoes',
        descricao: `[TROCA_CONVERTIDA_EM_COTACAO] Solicitação ${solicitacao_id} convertida em cotação normal. Autorizado por: ${nomeAutorizador}. Justificativa: ${just}`,
        tabela: 'solicitacoes_troca_titularidade',
        registro_id: solicitacao_id,
        dados_novos: {
          conversao_cotacao_normal: true,
          nome_autorizador: nomeAutorizador,
          justificativa: just,
          operador_user_id: user.id,
          operador_nome: operadorNome,
          cotacao_id: sol.cotacao_id,
          veiculo_id: sol.veiculo_id,
          aplicado_em: aplicadoEm,
        },
      }]);
    } catch (auditErr) {
      console.error('[converter-troca] falha ao gravar auditoria:', auditErr);
    }

    // 3) contratos.bypass_aplicado (mantém visibilidade no histórico do contrato cancelado)
    if (contratoTrocaId) {
      try {
        contratoBypassAtual.push({
          codigo: 'TROCA_CONVERTIDA_EM_COTACAO',
          nome_autorizador: nomeAutorizador,
          justificativa: just,
          operador_user_id: user.id,
          operador_nome: operadorNome,
          aplicado_em: aplicadoEm,
          solicitacao_troca_id: solicitacao_id,
        });
        await admin
          .from('contratos')
          .update({ bypass_aplicado: contratoBypassAtual })
          .eq('id', contratoTrocaId);
      } catch (cErr) {
        console.error('[converter-troca] falha ao gravar bypass_aplicado:', cErr);
      }
    }

    // 4) analises_relacionamento
    try {
      await admin.rpc('fn_criar_analise_relacionamento', {
        _tipo: 'outro',
        _origem_tabela: 'contratos.troca_convertida',
        _origem_id: solicitacao_id,
        _associado_id: sol.associado_antigo_id || null,
        _veiculo_id: sol.veiculo_id || null,
        _contrato_id: null,
        _termo_url: null,
        _termo_assinado_em: sol.termo_cancelamento_assinado_em,
        _metadata: {
          subtipo: 'troca_convertida_cotacao',
          codigo: 'TROCA_CONVERTIDA_EM_COTACAO',
          nome_autorizador: nomeAutorizador,
          justificativa: just,
          operador_user_id: user.id,
          operador_nome: operadorNome,
          cotacao_id: sol.cotacao_id,
          aplicado_em: aplicadoEm,
        },
      });
    } catch (aErr) {
      console.error('[converter-troca] falha ao criar analise_relacionamento:', aErr);
    }

    return new Response(JSON.stringify({
      success: true,
      status: 'cancelada',
      conversao: 'cotacao_normal',
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('[converter-troca-em-cotacao-normal] FATAL:', e);
    return new Response(JSON.stringify({
      error: e?.message || 'erro desconhecido',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

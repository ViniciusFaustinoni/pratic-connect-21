// Vincula uma cotação recém-criada (pelo CotacaoFormDialog padrão) a uma
// solicitação de Troca de Titularidade E AUTO-APROVA o Cadastro quando o
// termo de cancelamento já está assinado pelo titular antigo.
//
// Substitui o caminho antigo `criar-cotacao-troca-titularidade` que pré-criava rascunho.
//
// AUTH: Pública (verify_jwt=false). A segurança vem da validação cruzada:
// `cotacao.dados_extras.solicitacao_troca_id` precisa bater com `solicitacao_id`.
// Isso permite o self-heal do link público (anon) quando a vinculação inicial falha.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { runPosCadastroBackgroundFireAndForget } from '../_shared/troca-pos-cadastro-bg.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Body {
  solicitacao_id: string;
  cotacao_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const body: Body = await req.json();
    const { solicitacao_id, cotacao_id } = body || ({} as Body);
    if (!solicitacao_id || !cotacao_id) {
      return new Response(JSON.stringify({ error: 'solicitacao_id e cotacao_id são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: sol, error: solErr } = await admin
      .from('solicitacoes_troca_titularidade')
      .select('id, status, cotacao_id, veiculo_id, criado_por, novo_titular_dados, termo_cancelamento_assinado_em')
      .eq('id', solicitacao_id)
      .maybeSingle();
    if (solErr) throw solErr;
    if (!sol) {
      return new Response(JSON.stringify({ error: 'Solicitação não encontrada' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!sol.termo_cancelamento_assinado_em) {
      return new Response(JSON.stringify({
        error: 'Termo de cancelamento ainda não foi assinado pelo titular antigo.',
        code: 'TERMO_NAO_ASSINADO',
      }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Idempotente: se já está vinculada à mesma cotação, ok
    if (sol.cotacao_id && sol.cotacao_id === cotacao_id) {
      return new Response(JSON.stringify({ success: true, already_linked: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (sol.cotacao_id && sol.cotacao_id !== cotacao_id) {
      return new Response(JSON.stringify({
        error: 'Solicitação já possui outra cotação vinculada.',
        code: 'JA_VINCULADA',
        cotacao_id_existente: sol.cotacao_id,
      }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Validar cotação + cross-check via dados_extras (segurança da chamada anon)
    const { data: cot, error: cotErr } = await admin
      .from('cotacoes')
      .select('id, status, veiculo_placa, tipo_entrada, dados_extras')
      .eq('id', cotacao_id)
      .maybeSingle();
    if (cotErr) throw cotErr;
    if (!cot) {
      return new Response(JSON.stringify({ error: 'Cotação não encontrada' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const dadosExtras = (cot as any).dados_extras || {};
    const solicIdNoExtras = dadosExtras.solicitacao_troca_id as string | undefined;
    if (cot.tipo_entrada !== 'troca_titularidade' || solicIdNoExtras !== solicitacao_id) {
      return new Response(JSON.stringify({
        error: 'Cotação não corresponde a esta solicitação de troca.',
        code: 'COTACAO_NAO_PERTENCE',
      }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // AUTO-APROVA o Cadastro: termo já está assinado, então não há motivo
    // para um operador clicar "Aprovar". Avança direto para liberada_para_assinatura.
    const { error: updErr } = await admin
      .from('solicitacoes_troca_titularidade')
      .update({
        cotacao_id,
        status: 'liberada_para_assinatura',
        aprovado_cadastro_em: new Date().toISOString(),
        aprovado_cadastro_por: null, // auto
        observacao_cadastro: 'Auto-aprovado: termo de cancelamento assinado',
        updated_at: new Date().toISOString(),
      })
      .eq('id', solicitacao_id);
    if (updErr) throw updErr;

    // Trabalho pesado em background (snapshot SGA + atribuição vendedor + WhatsApp)
    runPosCadastroBackgroundFireAndForget(admin, {
      id: sol.id,
      cotacao_id,
      veiculo_id: sol.veiculo_id,
      criado_por: sol.criado_por,
      novo_titular_dados: (sol.novo_titular_dados as any) || null,
    });

    return new Response(JSON.stringify({
      success: true,
      cotacao_id,
      status: 'liberada_para_assinatura',
      cadastro_auto_aprovado: true,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[vincular-cotacao-troca]', e);
    const msg = e instanceof Error ? e.message : 'erro';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

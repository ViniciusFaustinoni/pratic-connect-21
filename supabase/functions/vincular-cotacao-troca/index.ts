// Vincula uma cotação recém-criada (pelo CotacaoFormDialog padrão) a uma
// solicitação de Troca de Titularidade. Substitui o caminho antigo
// `criar-cotacao-troca-titularidade` que pré-criava rascunho.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

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
      .select('id, status, cotacao_id, veiculo_id, termo_cancelamento_assinado_em')
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

    // Validar cotação
    const { data: cot, error: cotErr } = await admin
      .from('cotacoes')
      .select('id, status, veiculo_placa')
      .eq('id', cotacao_id)
      .maybeSingle();
    if (cotErr) throw cotErr;
    if (!cot) {
      return new Response(JSON.stringify({ error: 'Cotação não encontrada' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Atualiza vínculo + status para "cotacao_em_andamento"
    const { error: updErr } = await admin
      .from('solicitacoes_troca_titularidade')
      .update({
        cotacao_id,
        status: 'cotacao_em_andamento',
        updated_at: new Date().toISOString(),
      })
      .eq('id', solicitacao_id);
    if (updErr) throw updErr;

    return new Response(JSON.stringify({ success: true, cotacao_id }), {
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

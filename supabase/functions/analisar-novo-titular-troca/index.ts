// Análise prévia do novo titular numa solicitação de troca de titularidade.
// Roda ANTES da decisão do Cadastro: consulta base local + SGA Hinova (via
// sga-buscar-associado-completo) e grava snapshot em
// solicitacoes_troca_titularidade.analise_previa_resultado.
//
// Cache: se houver snapshot < 10min e !force, retorna do cache (do_cache=true).
// Permissões: apenas usuários autenticados internos (cadastro/monitoramento/diretor/admin).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CACHE_MS = 10 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { solicitacao_id, force } = await req.json();
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

    // 1) Carrega solicitação
    const { data: sol, error: solErr } = await admin
      .from('solicitacoes_troca_titularidade')
      .select('id, novo_titular_dados, analise_previa_resultado, analise_previa_em')
      .eq('id', solicitacao_id)
      .maybeSingle();
    if (solErr) throw solErr;
    if (!sol) {
      return new Response(JSON.stringify({ error: 'Solicitação não encontrada' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2) Cache
    if (!force && sol.analise_previa_resultado && sol.analise_previa_em) {
      const idade = Date.now() - new Date(sol.analise_previa_em).getTime();
      if (idade < CACHE_MS) {
        return new Response(JSON.stringify({
          do_cache: true,
          gerado_em: sol.analise_previa_em,
          ...sol.analise_previa_resultado,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const novo = (sol.novo_titular_dados || {}) as { nome?: string; cpf?: string };
    const cpfLimpo = (novo.cpf || '').replace(/\D/g, '');

    const resultado: Record<string, unknown> = { gerado_em: new Date().toISOString() };

    if (cpfLimpo.length !== 11) {
      resultado.base_local = { erro: 'CPF do novo titular inválido/ausente' };
      resultado.sga = { encontrado: false, erro: 'CPF inválido/ausente' };
    } else {
      // 3a) Base local
      try {
        const { data: assocLocal } = await admin
          .from('associados')
          .select('id, nome, cpf, email, telefone, status, created_at')
          .eq('cpf', cpfLimpo)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        resultado.base_local = assocLocal
          ? { encontrado: true, associado: assocLocal }
          : { encontrado: false };
      } catch (e) {
        resultado.base_local = { erro: e instanceof Error ? e.message : 'falha base local' };
      }

      // 3b) SGA
      try {
        const { data: sgaResp, error: sgaErr } = await admin.functions.invoke(
          'sga-buscar-associado-completo',
          { body: { cpf: cpfLimpo } },
        );
        if (sgaErr) throw sgaErr;
        resultado.sga = sgaResp ?? { encontrado: false };
      } catch (e) {
        resultado.sga = {
          encontrado: false,
          erro_transitorio: true,
          motivo: e instanceof Error ? e.message : 'falha SGA',
        };
      }
    }

    // 4) Persistir snapshot
    await admin
      .from('solicitacoes_troca_titularidade')
      .update({
        analise_previa_resultado: resultado,
        analise_previa_em: new Date().toISOString(),
      })
      .eq('id', solicitacao_id);

    return new Response(JSON.stringify({
      do_cache: false,
      ...resultado,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('[analisar-novo-titular-troca] erro:', e?.message, e?.stack);
    return new Response(JSON.stringify({ error: e?.message || 'erro' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

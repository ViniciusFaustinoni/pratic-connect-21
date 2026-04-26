// Lista catálogo da Hinova (produtos/planos e benefícios) — somente leitura.
// Reaproveita getHinovaSession para autenticação.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getHinovaSession, hinovaFetch, HinovaTransientError } from '../_shared/hinova-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Cache simples em memória (TTL 5 min) por chave (tipo + situacao)
const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; data: unknown }>();

function readCache(key: string) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.data;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const url = new URL(req.url);
  const tipo = (url.searchParams.get('tipo') ?? 'produtos').toLowerCase();
  const situacao = (url.searchParams.get('situacao') ?? 'ativo').toLowerCase();
  const force = url.searchParams.get('refresh') === '1';

  if (!['produtos', 'beneficios'].includes(tipo)) {
    return new Response(JSON.stringify({ error: 'tipo deve ser "produtos" ou "beneficios"' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (tipo === 'beneficios' && !['ativo', 'inativo', 'todos'].includes(situacao)) {
    return new Response(JSON.stringify({ error: 'situacao deve ser ativo|inativo|todos' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const cacheKey = `${tipo}:${situacao}`;
  if (!force) {
    const cached = readCache(cacheKey);
    if (cached) {
      return new Response(JSON.stringify({ cached: true, tipo, situacao, data: cached }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    // Resolve apiUrl primeiro (sem depender de cache de sessão)
    const baseSession = await getHinovaSession(supabase);
    if (!baseSession) throw new Error('Não foi possível autenticar no SGA Hinova');

    let endpoint = '';
    if (tipo === 'produtos') {
      endpoint = `${baseSession.apiUrl}/listar/produto/`;
    } else {
      endpoint = `${baseSession.apiUrl}/listar/beneficio-por-situacao/${situacao}`;
    }

    // Usa hinovaFetch para reautenticar automaticamente em 401/403
    const { response: resp, bodyText: text } = await hinovaFetch(
      supabase,
      (token) => ({
        url: endpoint,
        init: {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      }),
      `sga-listar-catalogo/${tipo}`,
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    if (!resp.ok) {
      // 406 + "Não foram encontrados" → tratamos como lista vazia (não é erro real)
      const bodyStr = JSON.stringify(parsed).toLowerCase();
      const isEmpty =
        resp.status === 406 &&
        (bodyStr.includes('não foram encontrados') || bodyStr.includes('nao foram encontrados'));
      if (isEmpty) {
        cache.set(cacheKey, { at: Date.now(), data: [] });
        return new Response(
          JSON.stringify({ cached: false, tipo, situacao, endpoint, data: [], empty: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({
          error: `Hinova retornou HTTP ${resp.status}`,
          endpoint,
          body: parsed,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    cache.set(cacheKey, { at: Date.now(), data: parsed });

    return new Response(
      JSON.stringify({ cached: false, tipo, situacao, endpoint, data: parsed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Descoberta ad-hoc: tenta vários endpoints candidatos da API Hinova
// para localizar a lista de planos cadastrados na conta.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getHinovaSession } from '../_shared/hinova-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CANDIDATES: Array<{ method: 'GET' | 'POST'; path: string; body?: any }> = [
  { method: 'GET', path: '/listar/plano/ativo' },
  { method: 'GET', path: '/listar/plano-protecao/ativo' },
  { method: 'GET', path: '/listar/tipo-plano/ativo' },
  { method: 'GET', path: '/listar/planos' },
  { method: 'GET', path: '/listar/planos/ativo' },
  { method: 'GET', path: '/plano/listar' },
  { method: 'GET', path: '/plano/listar/ativo' },
  { method: 'GET', path: '/listar/servico/ativo' },
  { method: 'GET', path: '/listar/tipo-servico/ativo' },
  { method: 'GET', path: '/listar/produto/ativo' },
  { method: 'GET', path: '/listar/produtos/ativo' },
  { method: 'GET', path: '/listar/cobertura/ativo' },
  { method: 'GET', path: '/listar/tipo-veiculo/ativo' },
  { method: 'GET', path: '/listar/conta/ativo' },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const session = await getHinovaSession(supabase, { noCache: true });
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.tokenUsuario}`,
    };

    const results: any[] = [];

    for (const c of CANDIDATES) {
      const url = `${session.apiUrl}${c.path}`;
      try {
        const r = await fetch(url, {
          method: c.method,
          headers,
          body: c.method === 'POST' ? JSON.stringify(c.body || {}) : undefined,
        });
        const txt = await r.text();
        let parsed: any = null;
        try { parsed = JSON.parse(txt); } catch { /* keep null */ }
        const itemCount = Array.isArray(parsed)
          ? parsed.length
          : Array.isArray(parsed?.data) ? parsed.data.length
          : Array.isArray(parsed?.dados) ? parsed.dados.length
          : null;
        results.push({
          path: c.path,
          method: c.method,
          status: r.status,
          contentType: r.headers.get('content-type'),
          itemCount,
          sample: txt.slice(0, 1500),
          parsedKeys: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? Object.keys(parsed) : null,
          firstItem: Array.isArray(parsed) ? parsed[0]
            : Array.isArray(parsed?.data) ? parsed.data[0]
            : Array.isArray(parsed?.dados) ? parsed.dados[0]
            : null,
        });
      } catch (e: any) {
        results.push({ path: c.path, method: c.method, error: String(e?.message || e) });
      }
    }

    return new Response(
      JSON.stringify({ apiUrl: session.apiUrl, tested: CANDIDATES.length, results }, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

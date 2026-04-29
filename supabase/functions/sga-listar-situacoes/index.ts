import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hinovaFetch, getHinovaCreds } from '../_shared/hinova-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const creds = await getHinovaCreds(supabase);
    if (!creds) throw new Error('Credenciais Hinova não configuradas');
    const apiUrl = creds.apiUrl;

    const { response, bodyText } = await hinovaFetch(
      supabase,
      (token) => ({
        url: `${apiUrl}/listar/situacao/todos`,
        init: {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      }),
      'listar_situacoes',
    );

    let parsed: unknown = bodyText;
    try { parsed = JSON.parse(bodyText); } catch { /* keep raw */ }

    return new Response(
      JSON.stringify({ http_status: response.status, body: parsed }, null, 2),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hinovaFetch } from '../_shared/hinova-client.ts';

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

    const { response, bodyText } = await hinovaFetch(
      supabase,
      'listar/situacao/todos',
      { method: 'GET' },
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

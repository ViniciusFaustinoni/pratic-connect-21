import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[integracoes-verificar-secrets] Verificando secrets configurados...');

    // Verificar existência dos secrets (apenas true/false, nunca expor valores)
    const status = {
      asaas: {
        configurado: !!(Deno.env.get('ASAAS_API_KEY')?.length),
        ambiente: Deno.env.get('ASAAS_API_KEY')?.startsWith('$aact_') ? 'production' : 'sandbox'
      },
      autentique: {
        configurado: !!(Deno.env.get('AUTENTIQUE_API_KEY')?.length)
      },
      email: {
        configurado: !!(Deno.env.get('RESEND_API_KEY')?.length)
      },
      whatsapp: {
        api_configurada: !!(Deno.env.get('EVOLUTION_API_KEY')?.length),
        url_configurada: !!(Deno.env.get('EVOLUTION_API_URL')?.length)
      },
      openai: {
        configurado: !!(Deno.env.get('OPENAI_API_KEY')?.length)
      }
    };

    console.log('[integracoes-verificar-secrets] Status:', JSON.stringify(status, null, 2));

    return new Response(
      JSON.stringify({ success: true, status }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('[integracoes-verificar-secrets] Erro:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

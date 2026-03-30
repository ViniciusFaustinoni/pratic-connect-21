import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar ASAAS via banco de dados (fonte primária) + fallback ENV
    let asaasStatus = { configurado: false, ambiente: 'desconhecido', fonte: 'nenhum' };
    try {
      const { getAsaasConfig } = await import("../_shared/asaas-config.ts");
      const asaasConfig = await getAsaasConfig(supabase);
      if (asaasConfig) {
        asaasStatus = { configurado: true, ambiente: asaasConfig.ambiente, fonte: 'banco_ou_env' };
      }
    } catch (e) {
      console.warn('[integracoes-verificar-secrets] Erro ao verificar ASAAS:', e);
      // Fallback para ENV direto
      const envKey = Deno.env.get('ASAAS_API_KEY');
      if (envKey) {
        asaasStatus = { configurado: true, ambiente: envKey.includes('_hmlg_') ? 'sandbox' : 'production', fonte: 'env' };
      }
    }

    // Verificar existência dos demais secrets (apenas true/false, nunca expor valores)
    const status = {
      asaas: asaasStatus,
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
      },
      hinova: {
        configurado: !!(Deno.env.get('HINOVA_TOKEN')?.length)
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verificar secrets sem expor valores
    const softruckPublicKey = Deno.env.get('SOFTRUCK_PUBLIC_KEY');
    const softruckUsername = Deno.env.get('SOFTRUCK_USERNAME');
    const softruckPassword = Deno.env.get('SOFTRUCK_PASSWORD');
    const redeVeiculosToken = Deno.env.get('REDE_VEICULOS_TOKEN');

    const status = {
      softruck: {
        public_key: !!softruckPublicKey && softruckPublicKey.length > 0,
        username: !!softruckUsername && softruckUsername.length > 0,
        password: !!softruckPassword && softruckPassword.length > 0,
        completo: false,
      },
      rede_veiculos: {
        token: !!redeVeiculosToken && redeVeiculosToken.length > 0,
        completo: false,
      }
    };

    // Verificar se está completo
    status.softruck.completo = status.softruck.public_key && 
                                status.softruck.username && 
                                status.softruck.password;
    
    status.rede_veiculos.completo = status.rede_veiculos.token;

    return new Response(
      JSON.stringify({
        success: true,
        status,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao verificar secrets:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

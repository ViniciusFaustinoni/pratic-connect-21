import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// Simple hash function using SubtleCrypto
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get API key from header
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      console.log('Missing API key');
      return new Response(
        JSON.stringify({ error: 'API key is required', code: 'MISSING_API_KEY' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Hash the API key and validate
    const keyHash = await hashApiKey(apiKey);
    console.log('Validating API key with prefix:', apiKey.substring(0, 12));

    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from('api_keys')
      .select('id, ativa, expires_at')
      .eq('key_hash', keyHash)
      .single();

    if (apiKeyError || !apiKeyData) {
      console.log('Invalid API key:', apiKeyError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid API key', code: 'INVALID_API_KEY' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!apiKeyData.ativa) {
      console.log('API key is inactive');
      return new Response(
        JSON.stringify({ error: 'API key is inactive', code: 'INACTIVE_API_KEY' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (apiKeyData.expires_at && new Date(apiKeyData.expires_at) < new Date()) {
      console.log('API key has expired');
      return new Response(
        JSON.stringify({ error: 'API key has expired', code: 'EXPIRED_API_KEY' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update last_used_at
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', apiKeyData.id);

    // Parse request body
    const body = await req.json();
    console.log('Received lead data:', JSON.stringify(body));

    // Validate required fields
    if (!body.nome || !body.telefone) {
      return new Response(
        JSON.stringify({ error: 'nome and telefone are required fields', code: 'MISSING_FIELDS' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate fonte_codigo if provided
    let fonteId: string | null = null;
    let vendedorPadraoId: string | null = null;
    let etapaInicial: string = 'novo';

    if (body.fonte_codigo) {
      const { data: fonteData, error: fonteError } = await supabase
        .from('lead_fontes')
        .select('id, vendedor_padrao_id, etapa_inicial, ativa')
        .eq('codigo', body.fonte_codigo)
        .single();

      if (fonteError || !fonteData) {
        console.log('Invalid fonte_codigo:', body.fonte_codigo);
        return new Response(
          JSON.stringify({ error: `Invalid fonte_codigo: ${body.fonte_codigo}`, code: 'INVALID_FONTE' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!fonteData.ativa) {
        return new Response(
          JSON.stringify({ error: 'Lead source is inactive', code: 'INACTIVE_FONTE' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      fonteId = fonteData.id;
      vendedorPadraoId = fonteData.vendedor_padrao_id;
      etapaInicial = fonteData.etapa_inicial || 'novo';
    }

    // Create lead data - vendedor_id será preenchido pelo trigger se null
    const leadData = {
      nome: body.nome,
      telefone: body.telefone,
      email: body.email || null,
      cpf: body.cpf || null,
      veiculo_marca: body.veiculo?.marca || null,
      veiculo_modelo: body.veiculo?.modelo || null,
      veiculo_ano: body.veiculo?.ano || null,
      veiculo_placa: body.veiculo?.placa || null,
      veiculo_fipe: body.veiculo?.valor_fipe || null,
      observacoes: body.observacoes || null,
      origem: 'api',
      etapa: etapaInicial,
      vendedor_id: vendedorPadraoId, // Se null, o trigger distribuir_lead_round_robin será acionado
      fonte_id: fonteId,
    };

    console.log('Creating lead:', JSON.stringify(leadData));

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert(leadData)
      .select()
      .single();

    if (leadError) {
      console.error('Error creating lead:', leadError);
      return new Response(
        JSON.stringify({ error: 'Failed to create lead', details: leadError.message, code: 'CREATE_FAILED' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update lead count on fonte
    if (fonteId) {
      const { data: currentFonte } = await supabase
        .from('lead_fontes')
        .select('total_leads')
        .eq('id', fonteId)
        .single();
      
      if (currentFonte) {
        await supabase
          .from('lead_fontes')
          .update({ total_leads: (currentFonte.total_leads || 0) + 1 })
          .eq('id', fonteId);
      }
    }

    // Buscar vendedor atribuído (pode ter sido pelo trigger)
    const { data: leadAtualizado } = await supabase
      .from('leads')
      .select('vendedor_id')
      .eq('id', lead.id)
      .single();

    const vendedorAtribuido = leadAtualizado?.vendedor_id || null;

    console.log('Lead created successfully:', lead.id, 'Vendedor:', vendedorAtribuido);

    return new Response(
      JSON.stringify({
        success: true,
        lead_id: lead.id,
        vendedor_id: vendedorAtribuido,
        distribuido_automaticamente: !vendedorPadraoId && vendedorAtribuido !== null,
        message: 'Lead created successfully'
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

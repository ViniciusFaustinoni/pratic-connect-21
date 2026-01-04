import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AUTENTIQUE_API_URL = 'https://api.autentique.com.br/v2/graphql';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AUTENTIQUE_API_KEY = Deno.env.get('AUTENTIQUE_API_KEY');
    if (!AUTENTIQUE_API_KEY) {
      throw new Error('AUTENTIQUE_API_KEY não configurada');
    }

    const { documentId } = await req.json();

    if (!documentId) {
      throw new Error('documentId é obrigatório');
    }

    console.log(`Reenviando email para documento: ${documentId}`);

    // GraphQL mutation para reenviar email
    const mutation = `
      mutation {
        resendDocument(id: "${documentId}") {
          id
          name
        }
      }
    `;

    const response = await fetch(AUTENTIQUE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTENTIQUE_API_KEY}`,
      },
      body: JSON.stringify({ query: mutation }),
    });

    const result = await response.json();

    if (result.errors) {
      console.error('Erro Autentique:', result.errors);
      throw new Error(result.errors[0]?.message || 'Erro ao reenviar email');
    }

    console.log('Email reenviado com sucesso:', result.data);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email reenviado com sucesso',
        document: result.data?.resendDocument,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro ao reenviar email:', errorMessage);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

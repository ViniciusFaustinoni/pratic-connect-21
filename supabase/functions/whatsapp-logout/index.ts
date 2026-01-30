import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { instancia_id } = await req.json();

    // Buscar instância
    const { data: instancia, error } = await supabase
      .from('whatsapp_instancias')
      .select('*')
      .eq(instancia_id ? 'id' : 'principal', instancia_id || true)
      .single();

    if (error || !instancia) {
      throw new Error('Instância não encontrada');
    }

    const apiKey = Deno.env.get('EVOLUTION_API_KEY');
    if (!apiKey) {
      throw new Error('EVOLUTION_API_KEY não configurada');
    }

    // PRIORIZAR URL do secret sobre a URL do banco
    const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
    const apiUrl = evolutionUrl || instancia.api_url;
    if (!apiUrl) {
      throw new Error('URL da Evolution API não configurada');
    }

    // Desconectar na Evolution API
    const response = await fetch(
      `${apiUrl}/instance/logout/${instancia.instance_name}`,
      {
        method: 'DELETE',
        headers: { 'apikey': apiKey }
      }
    );

    // Mesmo se falhar na API, atualizar localmente
    const data = response.ok ? await response.json() : null;

    // Atualizar status no banco
    await supabase
      .from('whatsapp_instancias')
      .update({
        status: 'disconnected',
        telefone: null,
        nome_perfil: null,
        foto_perfil: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', instancia.id);

    // Log
    await supabase
      .from('whatsapp_logs')
      .insert({
        instancia_id: instancia.id,
        tipo: 'logout',
        evento: 'logout',
        resposta: data,
        erro: response.ok ? null : `Status ${response.status}`,
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'WhatsApp desconectado com sucesso' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao desconectar:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})

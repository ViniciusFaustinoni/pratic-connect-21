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
      .eq('ativa', true)
      .single();

    if (error || !instancia) {
      throw new Error('Instância não encontrada');
    }

    const apiKey = Deno.env.get('EVOLUTION_API_KEY');
    if (!apiKey) {
      throw new Error('EVOLUTION_API_KEY não configurada');
    }

    console.log('[whatsapp-delete-instance] Deletando instância:', instancia.instance_name);

    // Primeiro, verificar se a instância existe na Evolution API
    const checkResponse = await fetch(
      `${instancia.api_url}/instance/fetchInstances`,
      {
        method: 'GET',
        headers: { 'apikey': apiKey }
      }
    );

    let instanceExists = false;
    if (checkResponse.ok) {
      const instances = await checkResponse.json();
      instanceExists = Array.isArray(instances) && 
        instances.some((i: { name?: string }) => i.name === instancia.instance_name);
    }

    // Se existe, deletar da Evolution API
    if (instanceExists) {
      const deleteResponse = await fetch(
        `${instancia.api_url}/instance/delete/${instancia.instance_name}`,
        {
          method: 'DELETE',
          headers: { 'apikey': apiKey }
        }
      );

      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        console.error('[whatsapp-delete-instance] Erro ao deletar:', errorText);
        throw new Error('Erro ao deletar instância na Evolution API');
      }

      console.log('[whatsapp-delete-instance] Instância deletada da Evolution API');
    } else {
      console.log('[whatsapp-delete-instance] Instância não existe na Evolution API, apenas limpando dados locais');
    }

    // Limpar dados locais
    const { error: updateError } = await supabase
      .from('whatsapp_instancias')
      .update({
        status: 'disconnected',
        telefone: null,
        webhook_url: null,
        webhook_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', instancia.id);

    if (updateError) {
      console.error('[whatsapp-delete-instance] Erro ao atualizar banco:', updateError);
      throw new Error('Erro ao atualizar dados locais');
    }

    // Registrar log
    await supabase
      .from('whatsapp_logs')
      .insert({
        instancia_id: instancia.id,
        tipo: 'instance_delete',
        evento: 'delete',
        resposta: { 
          instanceName: instancia.instance_name,
          existedInEvolution: instanceExists,
          deletedAt: new Date().toISOString()
        },
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Instância deletada com sucesso',
        existedInEvolution: instanceExists,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[whatsapp-delete-instance] Erro:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})

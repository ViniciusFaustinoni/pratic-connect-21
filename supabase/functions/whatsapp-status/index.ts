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
    // Validar autenticação
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: claims, error: authError } = await supabaseAuth.auth.getUser(token)
    if (authError || !claims?.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { instancia_id } = await req.json();

    // Buscar instância (principal se não informada)
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

    // Verificar status da conexão
    const response = await fetch(
      `${instancia.api_url}/instance/connectionState/${instancia.instance_name}`,
      {
        method: 'GET',
        headers: { 'apikey': apiKey }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro Evolution API:', response.status, errorText);
      
      // Se a instância não existe, retornar desconectado
      if (response.status === 404) {
        return new Response(
          JSON.stringify({
            success: true,
            instancia: {
              id: instancia.id,
              nome: instancia.nome,
              instance_name: instancia.instance_name,
            },
            status: 'disconnected',
            connected: false,
            telefone: null,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`Erro na Evolution API: ${response.status}`);
    }

    const data = await response.json();

    // Mapear estado da Evolution para nosso status
    const statusMap: Record<string, string> = {
      'open': 'open',
      'close': 'disconnected',
      'connecting': 'connecting',
    };

    const novoStatus = statusMap[data.instance?.state] || data.instance?.state || 'disconnected';

    // Atualizar status no banco
    await supabase
      .from('whatsapp_instancias')
      .update({
        status: novoStatus,
        ultima_conexao: novoStatus === 'open' ? new Date().toISOString() : instancia.ultima_conexao,
        updated_at: new Date().toISOString(),
      })
      .eq('id', instancia.id);

    // Registrar log
    await supabase
      .from('whatsapp_logs')
      .insert({
        instancia_id: instancia.id,
        tipo: 'status_check',
        evento: 'connectionState',
        resposta: data,
      });

    return new Response(
      JSON.stringify({
        success: true,
        instancia: {
          id: instancia.id,
          nome: instancia.nome,
          instance_name: instancia.instance_name,
        },
        status: novoStatus,
        connected: novoStatus === 'open',
        telefone: instancia.telefone,
        raw: data,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao verificar status:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})

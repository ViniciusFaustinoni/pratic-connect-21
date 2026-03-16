import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getConfiguracaoNumero } from "../_shared/config-helper.ts";

/**
 * Edge Function: verificar-instalacao-completa
 * 
 * Job assíncrono para verificar instalações recentes que ainda não
 * receberam primeira posição GPS.
 * 
 * Pode ser agendado via cron para rodar a cada hora.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RastreadorPendente {
  id: string;
  imei: string;
  plataforma_device_id: string;
  plataforma_veiculo_id: string;
  veiculo_id: string;
  updated_at: string;
}

// Chamar softruck-api edge function
async function callSoftruckApi(
  supabaseUrl: string,
  supabaseKey: string,
  operation: string,
  data: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const response = await fetch(`${supabaseUrl}/functions/v1/softruck-api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ operation, data }),
  });

  return await response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('[Verificar Instalação] Iniciando verificação de instalações pendentes...');

    // Buscar rastreadores instalados sem comunicação (prazo dinâmico)
    const prazoSemSinal = await getConfiguracaoNumero(supabase, 'prazo_rastreador_sem_sinal_horas', 4);
    const vinteQuatroHorasAtras = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const semSinalAtras = new Date(Date.now() - prazoSemSinal * 60 * 60 * 1000).toISOString();

    const { data: rastreadores, error } = await supabase
      .from('rastreadores')
      .select('id, imei, plataforma_device_id, plataforma_veiculo_id, veiculo_id, updated_at')
      .eq('status', 'instalado')
      .eq('plataforma', 'softruck')
      .is('ultima_comunicacao', null)
      .gte('updated_at', vinteQuatroHorasAtras)
      .returns<RastreadorPendente[]>();

    if (error) {
      throw new Error(`Erro ao buscar rastreadores: ${error.message}`);
    }

    if (!rastreadores || rastreadores.length === 0) {
      console.log('[Verificar Instalação] Nenhum rastreador pendente encontrado');
      return new Response(
        JSON.stringify({ success: true, verificados: 0, alertas: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Verificar Instalação] ${rastreadores.length} rastreadores pendentes encontrados`);

    let verificados = 0;
    let posicaoRecebida = 0;
    let alertasGerados = 0;

    for (const rastreador of rastreadores) {
      try {
        verificados++;
        console.log(`[Verificar Instalação] Verificando ${rastreador.imei}...`);

        // Tentar buscar posição na API
        const trackingResult = await callSoftruckApi(
          supabaseUrl,
          supabaseAnonKey,
          'tracking',
          { 
            veiculoId: rastreador.plataforma_veiculo_id, 
            deviceId: rastreador.plataforma_device_id 
          }
        );

        if (trackingResult.success && trackingResult.data) {
          const trackingData = trackingResult.data as { 
            latitude?: number; 
            longitude?: number;
            speed?: number;
            ignition?: boolean;
            last_gps_time?: string;
          };

          if (trackingData.latitude && trackingData.longitude) {
            // Atualizar rastreador com posição
            await supabase
              .from('rastreadores')
              .update({
                ultima_comunicacao: trackingData.last_gps_time || new Date().toISOString(),
                ultima_posicao_lat: trackingData.latitude,
                ultima_posicao_lng: trackingData.longitude,
                ultima_velocidade: trackingData.speed || 0,
                ultima_ignicao: trackingData.ignition || false,
              })
              .eq('id', rastreador.id);

            posicaoRecebida++;
            console.log(`[Verificar Instalação] ${rastreador.imei} - posição recebida!`);
            continue;
          }
        }

        // Se passou mais de 4h sem comunicação, gerar alerta
        const instaladoEm = new Date(rastreador.updated_at);
        if (instaladoEm < new Date(quatroHorasAtras)) {
          console.log(`[Verificar Instalação] ${rastreador.imei} - gerando alerta (>4h sem comunicação)`);

          // Criar alerta
          await supabase
            .from('rastreador_alertas')
            .insert({
              rastreador_id: rastreador.id,
              veiculo_id: rastreador.veiculo_id,
              tipo: 'sem_comunicacao',
              severidade: 'alta',
              titulo: 'Rastreador sem comunicação após instalação',
              descricao: `O rastreador ${rastreador.imei} foi instalado há mais de 4 horas e ainda não comunicou. Verificar instalação física.`,
              status: 'aberto',
            });

          alertasGerados++;
        }

      } catch (err) {
        console.error(`[Verificar Instalação] Erro ao verificar ${rastreador.imei}:`, err);
      }
    }

    console.log(`[Verificar Instalação] Concluído: ${verificados} verificados, ${posicaoRecebida} com posição, ${alertasGerados} alertas`);

    return new Response(
      JSON.stringify({
        success: true,
        verificados,
        posicao_recebida: posicaoRecebida,
        alertas_gerados: alertasGerados,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Verificar Instalação] Erro:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

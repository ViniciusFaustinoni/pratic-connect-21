import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  imei: string;
  veiculoId: string;
  associadoId: string;
  associadoEmail?: string;
}

interface SoftruckVehicle {
  id: string;
  attributes?: {
    plate?: string;
    vin?: string;
  };
}

interface SoftruckDevice {
  id: string;
  attributes?: {
    imei?: string;
    name?: string;
  };
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

  const result = await response.json();
  return result;
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
    const body = await req.json() as RequestBody;
    const { imei, veiculoId, associadoId, associadoEmail } = body;

    console.log('[Softruck Ativar] Iniciando ativação:', { imei, veiculoId, associadoId });

    // ===== 1. Buscar rastreador local pelo IMEI =====
    const { data: rastreador, error: rastreadorError } = await supabase
      .from('rastreadores')
      .select('id, codigo, numero_serie, plataforma, status, plataforma_device_id, chip_iccid')
      .eq('imei', imei)
      .maybeSingle();

    if (rastreadorError) {
      throw new Error(`Erro ao buscar rastreador: ${rastreadorError.message}`);
    }

    if (!rastreador) {
      throw new Error(`Rastreador com IMEI ${imei} não encontrado no sistema`);
    }

    if (rastreador.plataforma !== 'softruck') {
      throw new Error(`Rastreador ${imei} não é da plataforma Softruck (plataforma: ${rastreador.plataforma})`);
    }

    // Aceitar status 'estoque' (novo) ou 'instalado' (já vinculado localmente pelo vistoriador)
    if (rastreador.status !== 'estoque' && rastreador.status !== 'instalado') {
      throw new Error(`Rastreador ${imei} não está disponível (status: ${rastreador.status})`);
    }
    
    const jaInstalado = rastreador.status === 'instalado';
    console.log('[Softruck Ativar] Status do rastreador:', rastreador.status, jaInstalado ? '(já vinculado localmente)' : '');

    console.log('[Softruck Ativar] Rastreador encontrado:', rastreador.id);

    // ===== 2. Buscar veículo local =====
    const { data: veiculo, error: veiculoError } = await supabase
      .from('veiculos')
      .select('id, placa, chassi, marca, modelo, ano_modelo, cor, combustivel, softruck_vehicle_id')
      .eq('id', veiculoId)
      .single();

    if (veiculoError || !veiculo) {
      throw new Error(`Veículo não encontrado: ${veiculoError?.message || 'ID inválido'}`);
    }

    console.log('[Softruck Ativar] Veículo encontrado:', veiculo.placa);

    let softruckVehicleId = veiculo.softruck_vehicle_id;
    let softruckDeviceId = rastreador.plataforma_device_id;

    // ===== 3. Verificar/criar veículo na Softruck =====
    if (!softruckVehicleId) {
      console.log('[Softruck Ativar] Buscando veículo na Softruck por placa...');
      
      // Buscar veículo por placa
      const buscarVeiculoResult = await callSoftruckApi(
        supabaseUrl,
        supabaseAnonKey,
        'buscar-veiculo-placa',
        { placa: veiculo.placa }
      );

      if (buscarVeiculoResult.success && buscarVeiculoResult.data) {
        const veiculos = (buscarVeiculoResult.data as { data?: SoftruckVehicle[] })?.data || [];
        if (veiculos.length > 0) {
          softruckVehicleId = veiculos[0].id;
          console.log('[Softruck Ativar] Veículo encontrado na Softruck:', softruckVehicleId);
        }
      }

      // Se não encontrou, criar veículo
      if (!softruckVehicleId) {
        console.log('[Softruck Ativar] Criando veículo na Softruck...');
        
        const criarVeiculoResult = await callSoftruckApi(
          supabaseUrl,
          supabaseAnonKey,
          'criar-veiculo',
          {
            placa: veiculo.placa,
            chassi: veiculo.chassi,
            marca: veiculo.marca,
            modelo: veiculo.modelo,
            ano: veiculo.ano_modelo?.toString(),
            cor: veiculo.cor,
            tipo: mapVehicleType(veiculo.combustivel),
          }
        );

        if (!criarVeiculoResult.success) {
          // Verificar se é erro de duplicidade
          if (criarVeiculoResult.error?.includes('Already Exists')) {
            // Tentar buscar novamente
            const retryBuscar = await callSoftruckApi(
              supabaseUrl,
              supabaseAnonKey,
              'buscar-veiculo-placa',
              { placa: veiculo.placa }
            );
            
            const veiculos = (retryBuscar.data as { data?: SoftruckVehicle[] })?.data || [];
            if (veiculos.length > 0) {
              softruckVehicleId = veiculos[0].id;
            }
          }
          
          if (!softruckVehicleId) {
            throw new Error(`Erro ao criar veículo na Softruck: ${criarVeiculoResult.error}`);
          }
        } else {
          const responseData = criarVeiculoResult.data as { data?: SoftruckVehicle[] };
          softruckVehicleId = responseData?.data?.[0]?.id;
        }

        console.log('[Softruck Ativar] Veículo criado na Softruck:', softruckVehicleId);
      }

      // Atualizar veículo local com ID Softruck
      if (softruckVehicleId) {
        await supabase
          .from('veiculos')
          .update({ softruck_vehicle_id: softruckVehicleId })
          .eq('id', veiculoId);
      }
    }

    // ===== 4. Verificar/buscar dispositivo na Softruck =====
    if (!softruckDeviceId) {
      console.log('[Softruck Ativar] Buscando device na Softruck por IMEI...');
      
      const buscarDeviceResult = await callSoftruckApi(
        supabaseUrl,
        supabaseAnonKey,
        'buscar-device-imei',
        { imei }
      );

      if (buscarDeviceResult.success && buscarDeviceResult.data) {
        const devices = (buscarDeviceResult.data as { data?: SoftruckDevice[] })?.data || [];
        if (devices.length > 0) {
          softruckDeviceId = devices[0].id;
          console.log('[Softruck Ativar] Device encontrado na Softruck:', softruckDeviceId);
        }
      }

      // Se não encontrou, erro - device deve estar pré-cadastrado
      if (!softruckDeviceId) {
        throw new Error(`Dispositivo com IMEI ${imei} não encontrado na plataforma Softruck. O dispositivo deve estar cadastrado na Softruck antes de ser ativado.`);
      }
    }

    // ===== 5. Vincular dispositivo ao veículo na Softruck =====
    console.log('[Softruck Ativar] Vinculando device ao veículo...');
    
    const vincularResult = await callSoftruckApi(
      supabaseUrl,
      supabaseAnonKey,
      'vincular-device-veiculo',
      {
        deviceId: softruckDeviceId,
        veiculoId: softruckVehicleId,
      }
    );

    if (!vincularResult.success) {
      console.warn('[Softruck Ativar] Aviso ao vincular:', vincularResult.error);
      // Continuar mesmo com erro (pode já estar vinculado)
    }

    // ===== 6. Ativar dispositivo na Softruck =====
    console.log('[Softruck Ativar] Ativando device na Softruck...');
    
    const ativarResult = await callSoftruckApi(
      supabaseUrl,
      supabaseAnonKey,
      'ativar-device',
      { deviceId: softruckDeviceId }
    );

    if (!ativarResult.success) {
      console.warn('[Softruck Ativar] Aviso ao ativar:', ativarResult.error);
      // Continuar mesmo com erro (pode já estar ativo)
    }

    // ===== 7. Atualizar rastreador local com IDs da plataforma =====
    console.log('[Softruck Ativar] Atualizando rastreador local com IDs Softruck...');
    
    // Só atualizar campos de vínculo se não estiver já instalado
    const updateData: Record<string, unknown> = {
      plataforma_device_id: softruckDeviceId,
      plataforma_veiculo_id: softruckVehicleId,
      updated_at: new Date().toISOString(),
    };
    
    // Se ainda não estava instalado, atualizar também vínculo
    if (rastreador.status !== 'instalado') {
      updateData.veiculo_id = veiculoId;
      updateData.associado_id = associadoId;
      updateData.associado_email = associadoEmail;
      updateData.status = 'instalado';
    }
    
    const { error: updateError } = await supabase
      .from('rastreadores')
      .update(updateData)
      .eq('id', rastreador.id);

    if (updateError) {
      throw new Error(`Erro ao atualizar rastreador: ${updateError.message}`);
    }

    // ===== 7.5. Atualizar status do associado para 'ativo' =====
    console.log('[Softruck Ativar] Atualizando status do associado para ativo...');
    
    const { error: updateAssociadoError } = await supabase
      .from('associados')
      .update({
        status: 'ativo',
        data_ativacao: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', associadoId);

    if (updateAssociadoError) {
      console.error('[Softruck Ativar] Erro ao ativar associado:', updateAssociadoError);
    } else {
      console.log('[Softruck Ativar] Associado ativado com sucesso');
    }

    // ===== 7.6. Liberar cobertura total no veículo =====
    console.log('[Softruck Ativar] Liberando cobertura total do veículo...');
    
    const { error: updateVeiculoError } = await supabase
      .from('veiculos')
      .update({
        cobertura_total: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', veiculoId);

    if (updateVeiculoError) {
      console.error('[Softruck Ativar] Erro ao liberar cobertura:', updateVeiculoError);
    } else {
      console.log('[Softruck Ativar] Cobertura total liberada');
    }

    // ===== 8. Chamar ativar-associado para criar acesso do cliente =====
    console.log('[Softruck Ativar] Ativando associado...');
    
    try {
      const ativarAssociadoResponse = await fetch(`${supabaseUrl}/functions/v1/ativar-associado`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          veiculo_id: veiculoId,
          rastreador_id: rastreador.id,
          associado_id: associadoId,
        }),
      });

      const ativarAssociadoResult = await ativarAssociadoResponse.json();
      console.log('[Softruck Ativar] Resultado ativar-associado:', ativarAssociadoResult);
    } catch (ativarError) {
      console.warn('[Softruck Ativar] Erro ao ativar associado (não crítico):', ativarError);
    }

    // ===== 9. Registrar log de sucesso =====
    await supabase
      .from('rastreadores_api_logs')
      .insert({
        rastreador_id: rastreador.id,
        plataforma: 'softruck',
        operacao: 'ativar_dispositivo',
        request: { imei, veiculoId, associadoId },
        response: { 
          softruckVehicleId, 
          softruckDeviceId,
          success: true 
        },
        status: 'sucesso',
      });

    console.log('[Softruck Ativar] Ativação concluída com sucesso!');

    return new Response(
      JSON.stringify({
        success: true,
        rastreador_id: rastreador.id,
        softruck_device_id: softruckDeviceId,
        softruck_vehicle_id: softruckVehicleId,
        message: 'Dispositivo ativado com sucesso na Softruck',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Softruck Ativar] Erro:', error);

    // Tentar registrar log de erro
    try {
      const body = await req.clone().json() as Partial<RequestBody>;
      await supabase
        .from('rastreadores_api_logs')
        .insert({
          plataforma: 'softruck',
          operacao: 'ativar_dispositivo',
          request: body,
          response: { error: error instanceof Error ? error.message : 'Erro desconhecido' },
          status: 'erro',
          erro_mensagem: error instanceof Error ? error.message : 'Erro desconhecido',
        });
    } catch {
      // Ignorar erro de log
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Mapear tipo de veículo local para Softruck
function mapVehicleType(combustivel: string | null): string {
  const mapping: Record<string, string> = {
    'gasolina': 'carro',
    'etanol': 'carro',
    'flex': 'carro',
    'diesel': 'caminhao',
    'eletrico': 'carro',
    'hibrido': 'carro',
    'gnv': 'carro',
  };
  
  return mapping[combustivel?.toLowerCase() || ''] || 'carro';
}

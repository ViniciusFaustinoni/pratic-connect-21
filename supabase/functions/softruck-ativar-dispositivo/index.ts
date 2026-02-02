import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Interface para request body
 * Suporta dados de chip opcionais para criar chip na Softruck
 */
interface RequestBody {
  imei: string;
  veiculoId: string;
  associadoId: string;
  associadoEmail?: string;
  // Dados de chip opcionais (podem vir do request ou do rastreador)
  chipSerial?: string;      // ICCID do chip
  chipNumber?: string;      // Número de telefone do chip
  chipOperadora?: string;   // Operadora (Vivo, Claro, Tim)
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

interface SoftruckChip {
  id: string;
  attributes?: {
    serial?: string;
    number?: string;
  };
}

// Status de integração possíveis
type IntegrationStatus = 
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED_AUTH'
  | 'FAILED_VEHICLE'
  | 'FAILED_CHIP'
  | 'FAILED_DEVICE'
  | 'FAILED_ASSOCIATION'
  | 'CREATED_BUT_NOT_ACTIVATED';

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

// Atualizar status de integração no rastreador
async function updateIntegrationStatus(
  supabase: any,
  rastreadorId: string | null,
  status: IntegrationStatus,
  _errorMessage?: string,
  payloadSent?: unknown,
  responseRaw?: unknown
) {
  if (!rastreadorId) {
    console.warn('[Softruck Ativar] rastreadorId não disponível para atualizar status');
    return;
  }
  
  try {
    await supabase
      .from('rastreadores')
      .update({
        softruck_integration_status: status,
        softruck_last_attempt_at: new Date().toISOString(),
        softruck_payload_sent: payloadSent || null,
        softruck_response_raw: responseRaw || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rastreadorId);
    
    console.log(`[Softruck Ativar] Status de integração atualizado: ${status}`);
  } catch (err) {
    console.error('[Softruck Ativar] Erro ao atualizar status de integração:', err);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let rastreadorId: string | null = null;
  let payloadSent: Record<string, unknown> = {};

  try {
    const body = await req.json() as RequestBody;
    const { imei, veiculoId, associadoId, associadoEmail, chipSerial, chipNumber, chipOperadora } = body;
    
    payloadSent = { imei, veiculoId, associadoId, associadoEmail };

    console.log('[Softruck Ativar] ===== INICIANDO ATIVAÇÃO COMPLETA =====');
    console.log('[Softruck Ativar] Dados recebidos:', { imei, veiculoId, associadoId });

    // ===== VALIDAÇÕES INICIAIS =====
    if (!imei) {
      throw new Error('IMEI é obrigatório');
    }
    if (!veiculoId) {
      throw new Error('veiculoId é obrigatório');
    }

    // ===== 1. Buscar rastreador local pelo IMEI =====
    console.log('[Softruck Ativar] [1/9] Buscando rastreador local...');
    
    const { data: rastreador, error: rastreadorError } = await supabase
      .from('rastreadores')
      .select('id, codigo, numero_serie, plataforma, status, plataforma_device_id, chip_iccid, chip_number, plataforma_veiculo_id, softruck_chip_id')
      .eq('imei', imei)
      .maybeSingle();

    if (rastreadorError) {
      throw new Error(`Erro ao buscar rastreador: ${rastreadorError.message}`);
    }

    if (!rastreador) {
      throw new Error(`Rastreador com IMEI ${imei} não encontrado no sistema`);
    }

    rastreadorId = rastreador.id;

    // Atualizar status para PENDING
    await updateIntegrationStatus(supabase, rastreadorId, 'PENDING', undefined, payloadSent);

    if (rastreador.plataforma !== 'softruck') {
      console.log(`[Softruck Ativar] Rastreador ${imei} não é Softruck (plataforma: ${rastreador.plataforma}). Pulando integração.`);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Rastreador não é Softruck - integração não aplicável',
          plataforma: rastreador.plataforma,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Aceitar status 'estoque' (novo) ou 'instalado' (já vinculado localmente)
    if (rastreador.status !== 'estoque' && rastreador.status !== 'instalado') {
      throw new Error(`Rastreador ${imei} não está disponível (status: ${rastreador.status})`);
    }
    
    // CORREÇÃO: Verificar se já foi ativado na Softruck para evitar duplicidade
    if (rastreador.plataforma_device_id) {
      console.log('[Softruck Ativar] Rastreador já possui device na Softruck:', rastreador.plataforma_device_id);
      // Retornar sucesso - já está ativado
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Rastreador já está ativado na Softruck',
          softruck_device_id: rastreador.plataforma_device_id,
          softruck_vehicle_id: rastreador.plataforma_veiculo_id,
          already_activated: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const jaInstalado = rastreador.status === 'instalado';
    console.log('[Softruck Ativar] Status do rastreador:', rastreador.status, jaInstalado ? '(já vinculado localmente)' : '');

    // ===== 2. Buscar veículo local =====
    console.log('[Softruck Ativar] [2/9] Buscando veículo local...');
    
    const { data: veiculo, error: veiculoError } = await supabase
      .from('veiculos')
      .select('id, placa, chassi, marca, modelo, ano_modelo, cor, combustivel, softruck_vehicle_id')
      .eq('id', veiculoId)
      .single();

    if (veiculoError || !veiculo) {
      await updateIntegrationStatus(supabase, rastreadorId, 'FAILED_VEHICLE', `Veículo não encontrado: ${veiculoError?.message || 'ID inválido'}`, payloadSent);
      throw new Error(`Veículo não encontrado: ${veiculoError?.message || 'ID inválido'}`);
    }

    if (!veiculo.placa) {
      await updateIntegrationStatus(supabase, rastreadorId, 'FAILED_VEHICLE', 'Veículo sem placa cadastrada', payloadSent);
      throw new Error('Veículo sem placa cadastrada');
    }

    console.log('[Softruck Ativar] Veículo encontrado:', veiculo.placa);

    let softruckVehicleId = veiculo.softruck_vehicle_id || rastreador.plataforma_veiculo_id;
    let softruckDeviceId = rastreador.plataforma_device_id;
    let softruckChipId = rastreador.softruck_chip_id;

    // ===== 3. Garantir veículo na Softruck (buscar ou criar) =====
    console.log('[Softruck Ativar] [3/9] Garantindo veículo na Softruck...');
    
    if (!softruckVehicleId) {
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
            await updateIntegrationStatus(supabase, rastreadorId, 'FAILED_VEHICLE', criarVeiculoResult.error, payloadSent, criarVeiculoResult);
            throw new Error(`Erro ao criar veículo na Softruck: ${criarVeiculoResult.error}`);
          }
        } else {
          const responseData = criarVeiculoResult.data as { data?: SoftruckVehicle[] };
          softruckVehicleId = responseData?.data?.[0]?.id;
          console.log('[Softruck Ativar] Veículo criado na Softruck:', softruckVehicleId);
        }
      }

      // Atualizar veículo local com ID Softruck
      if (softruckVehicleId) {
        await supabase
          .from('veiculos')
          .update({ softruck_vehicle_id: softruckVehicleId })
          .eq('id', veiculoId);
      }
    } else {
      console.log('[Softruck Ativar] Veículo já existe na Softruck:', softruckVehicleId);
    }

    // ===== 4. Garantir chip na Softruck (se houver dados) =====
    console.log('[Softruck Ativar] [4/9] Verificando chip...');
    
    // Usar dados do request ou do rastreador
    const chipSerialFinal = chipSerial || rastreador.chip_iccid;
    const chipNumberFinal = chipNumber || rastreador.chip_number;
    
    if (chipSerialFinal && chipNumberFinal && !softruckChipId) {
      console.log('[Softruck Ativar] Buscando chip na Softruck por serial:', chipSerialFinal);
      
      // Buscar por serial
      const buscarChipResult = await callSoftruckApi(
        supabaseUrl,
        supabaseAnonKey,
        'buscar-chip',
        { serial: chipSerialFinal }
      );

      if (buscarChipResult.success && buscarChipResult.data) {
        const chips = (buscarChipResult.data as { data?: SoftruckChip[] })?.data || [];
        if (chips.length > 0) {
          softruckChipId = chips[0].id;
          console.log('[Softruck Ativar] Chip encontrado na Softruck:', softruckChipId);
        }
      }

      // Se não encontrou, criar chip
      if (!softruckChipId) {
        console.log('[Softruck Ativar] Criando chip na Softruck...');
        
        const criarChipResult = await callSoftruckApi(
          supabaseUrl,
          supabaseAnonKey,
          'criar-chip',
          {
            serial: chipSerialFinal,
            numero: chipNumberFinal,
            operadora: chipOperadora || 'Softruck',
            provedor: chipOperadora || 'Softruck',
          }
        );

        if (criarChipResult.success && criarChipResult.data) {
          const responseData = criarChipResult.data as { data?: SoftruckChip[] };
          softruckChipId = responseData?.data?.[0]?.id;
          console.log('[Softruck Ativar] Chip criado na Softruck:', softruckChipId);
        } else if (criarChipResult.error?.includes('Already Exists')) {
          // Buscar novamente
          const retryBuscar = await callSoftruckApi(
            supabaseUrl,
            supabaseAnonKey,
            'buscar-chip',
            { serial: chipSerialFinal }
          );
          const chips = (retryBuscar.data as { data?: SoftruckChip[] })?.data || [];
          if (chips.length > 0) {
            softruckChipId = chips[0].id;
          }
        } else {
          console.warn('[Softruck Ativar] Erro ao criar chip (não crítico):', criarChipResult.error);
          // Não bloquear - chip é opcional
        }
      }
    } else if (softruckChipId) {
      console.log('[Softruck Ativar] Chip já existe na Softruck:', softruckChipId);
    } else {
      console.log('[Softruck Ativar] Dados de chip não informados, pulando...');
    }

    // ===== 5. Garantir dispositivo na Softruck (buscar ou criar) =====
    console.log('[Softruck Ativar] [5/9] Garantindo dispositivo na Softruck...');
    
    if (!softruckDeviceId) {
      // Buscar device por IMEI
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

      // NOVO: Se não encontrou, CRIAR o device
      if (!softruckDeviceId) {
        console.log('[Softruck Ativar] Criando device na Softruck...');
        
        const deviceName = `${veiculo.placa} - ${veiculo.modelo || 'Veículo'}`.substring(0, 21);
        
        const criarDeviceResult = await callSoftruckApi(
          supabaseUrl,
          supabaseAnonKey,
          'criar-device',
          {
            imei,
            nome: deviceName,
            veiculoId: softruckVehicleId,
            chipId: softruckChipId, // Vincular chip se existir
          }
        );

        if (!criarDeviceResult.success) {
          // Verificar se é erro de duplicidade
          if (criarDeviceResult.error?.includes('Already Exists')) {
            // Tentar buscar novamente
            const retryBuscar = await callSoftruckApi(
              supabaseUrl,
              supabaseAnonKey,
              'buscar-device-imei',
              { imei }
            );
            const devices = (retryBuscar.data as { data?: SoftruckDevice[] })?.data || [];
            if (devices.length > 0) {
              softruckDeviceId = devices[0].id;
              console.log('[Softruck Ativar] Device encontrado após retry:', softruckDeviceId);
            }
          }
          
          if (!softruckDeviceId) {
            await updateIntegrationStatus(supabase, rastreadorId, 'FAILED_DEVICE', criarDeviceResult.error, payloadSent, criarDeviceResult);
            throw new Error(`Erro ao criar device na Softruck: ${criarDeviceResult.error}`);
          }
        } else {
          const responseData = criarDeviceResult.data as { data?: SoftruckDevice[] };
          softruckDeviceId = responseData?.data?.[0]?.id;
          console.log('[Softruck Ativar] Device criado na Softruck:', softruckDeviceId);
        }
      }
    } else {
      console.log('[Softruck Ativar] Device já existe na Softruck:', softruckDeviceId);
    }

    // ===== 6. Associar dispositivo ao veículo (is_main_device: true) =====
    console.log('[Softruck Ativar] [6/9] Associando device ao veículo via POST formal...');
    
    const associarResult = await callSoftruckApi(
      supabaseUrl,
      supabaseAnonKey,
      'associar-device-veiculo',
      {
        deviceId: softruckDeviceId,
        vehicleId: softruckVehicleId,
        isPrincipal: true,
      }
    );

    if (!associarResult.success) {
      console.warn('[Softruck Ativar] Aviso ao associar:', associarResult.error);
      
      if (associarResult.error?.includes('Already Exists') || 
          associarResult.error?.includes('already associated') ||
          associarResult.error?.includes('Already Has Main Device')) {
        console.log('[Softruck Ativar] Device já associado, continuando...');
      } else {
        // Tentar fallback com vincular-device-veiculo (PATCH)
        console.log('[Softruck Ativar] Tentando fallback com PATCH...');
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
          console.warn('[Softruck Ativar] Fallback também falhou:', vincularResult.error);
          // Não bloquear - continuar com ativação
        }
      }
    } else {
      console.log('[Softruck Ativar] Device associado com sucesso via POST formal');
    }

    // ===== 7. Ativar dispositivo na Softruck =====
    console.log('[Softruck Ativar] [7/9] Ativando device na Softruck...');
    
    const ativarDeviceResult = await callSoftruckApi(
      supabaseUrl,
      supabaseAnonKey,
      'ativar-device',
      { deviceId: softruckDeviceId }
    );

    if (!ativarDeviceResult.success) {
      console.warn('[Softruck Ativar] Aviso ao ativar device:', ativarDeviceResult.error);
      // Continuar - device pode já estar ativo
    } else {
      console.log('[Softruck Ativar] Device ativado com sucesso');
    }

    // ===== 8. Ativar veículo na Softruck (opcional) =====
    console.log('[Softruck Ativar] [8/9] Ativando veículo na Softruck...');
    
    const ativarVeiculoResult = await callSoftruckApi(
      supabaseUrl,
      supabaseAnonKey,
      'ativar-veiculo',
      { veiculoId: softruckVehicleId }
    );

    if (!ativarVeiculoResult.success) {
      console.warn('[Softruck Ativar] Aviso ao ativar veículo:', ativarVeiculoResult.error);
      // Não bloquear - veículo pode já estar ativo
    } else {
      console.log('[Softruck Ativar] Veículo ativado com sucesso');
    }

    // ===== 8.5. Verificar primeira posição (polling curto) =====
    console.log('[Softruck Ativar] Verificando primeira posição GPS...');
    
    let primeiraPos = null;
    const MAX_TENTATIVAS = 3;
    const INTERVALO_MS = 10000; // 10 segundos
    
    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
      console.log(`[Softruck Ativar] Tentativa ${tentativa}/${MAX_TENTATIVAS} de buscar posição...`);
      
      const trackingResult = await callSoftruckApi(
        supabaseUrl,
        supabaseAnonKey,
        'tracking',
        { veiculoId: softruckVehicleId, deviceId: softruckDeviceId }
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
          primeiraPos = {
            latitude: trackingData.latitude,
            longitude: trackingData.longitude,
            velocidade: trackingData.speed || 0,
            ignicao: trackingData.ignition || false,
            data_posicao: trackingData.last_gps_time || new Date().toISOString(),
          };
          console.log('[Softruck Ativar] Primeira posição recebida!', primeiraPos);
          break;
        }
      }
      
      if (tentativa < MAX_TENTATIVAS) {
        console.log(`[Softruck Ativar] Aguardando ${INTERVALO_MS/1000}s antes da próxima tentativa...`);
        await new Promise(r => setTimeout(r, INTERVALO_MS));
      }
    }
    
    // ===== 9. Atualizar rastreador local com todos os IDs e status =====
    console.log('[Softruck Ativar] [9/9] Atualizando rastreador local...');
    
    const responseRaw = {
      softruckVehicleId,
      softruckDeviceId,
      softruckChipId,
      primeiraPos,
    };
    
    const updateData: Record<string, unknown> = {
      plataforma_device_id: softruckDeviceId,
      plataforma_veiculo_id: softruckVehicleId,
      softruck_chip_id: softruckChipId || null,
      softruck_integration_status: 'SUCCESS',
      softruck_last_attempt_at: new Date().toISOString(),
      softruck_payload_sent: payloadSent,
      softruck_response_raw: responseRaw,
      updated_at: new Date().toISOString(),
    };
    
    // Se recebeu posição, atualizar também
    if (primeiraPos) {
      updateData.ultima_comunicacao = primeiraPos.data_posicao;
      updateData.ultima_posicao_lat = primeiraPos.latitude;
      updateData.ultima_posicao_lng = primeiraPos.longitude;
      updateData.ultima_velocidade = primeiraPos.velocidade;
      updateData.ultima_ignicao = primeiraPos.ignicao;
    }
    
    // Se ainda não estava instalado, atualizar vínculo
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

    // ===== 10. NOTA: Ativação do associado e liberação de cobertura =====
    // CORREÇÃO: Removida atualização redundante de associados.status e veiculos.cobertura_total
    // Essas atualizações devem ser feitas pelo chamador (hook/componente) para evitar duplicidade
    // A edge function softruck-ativar-dispositivo deve focar APENAS na integração com Softruck
    console.log('[Softruck Ativar] NOTA: Ativação de status/cobertura delegada ao chamador');

    // ===== 11. Chamar ativar-associado para criar acesso do cliente =====
    // CORREÇÃO: Usando service key ao invés de anon key para garantir autenticação
    console.log('[Softruck Ativar] Ativando associado (criando acesso)...');
    
    try {
      const ativarAssociadoResponse = await fetch(`${supabaseUrl}/functions/v1/ativar-associado`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
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

    // ===== 13. Registrar log de sucesso =====
    await supabase
      .from('rastreadores_api_logs')
      .insert({
        rastreador_id: rastreador.id,
        plataforma: 'softruck',
        operacao: 'ativar_dispositivo_completo',
        request: payloadSent,
        response: responseRaw,
        status: 'sucesso',
      });

    console.log('[Softruck Ativar] ===== ATIVAÇÃO CONCLUÍDA COM SUCESSO! =====');

    return new Response(
      JSON.stringify({
        success: true,
        rastreador_id: rastreador.id,
        softruck_device_id: softruckDeviceId,
        softruck_vehicle_id: softruckVehicleId,
        softruck_chip_id: softruckChipId,
        primeira_posicao: primeiraPos,
        message: 'Dispositivo ativado com sucesso na Softruck',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Softruck Ativar] Erro:', error);

    // Atualizar status de integração se temos o ID do rastreador
    if (rastreadorId) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      let status: IntegrationStatus = 'FAILED_DEVICE';
      
      if (errorMessage.includes('autenticação') || errorMessage.includes('auth')) {
        status = 'FAILED_AUTH';
      } else if (errorMessage.includes('veículo') || errorMessage.includes('vehicle')) {
        status = 'FAILED_VEHICLE';
      } else if (errorMessage.includes('chip')) {
        status = 'FAILED_CHIP';
      } else if (errorMessage.includes('associar') || errorMessage.includes('association')) {
        status = 'FAILED_ASSOCIATION';
      }
      
      await updateIntegrationStatus(supabase, rastreadorId, status, errorMessage, payloadSent);
    }

    // Tentar registrar log de erro
    try {
      await supabase
        .from('rastreadores_api_logs')
        .insert({
          rastreador_id: rastreadorId,
          plataforma: 'softruck',
          operacao: 'ativar_dispositivo_completo',
          request: payloadSent,
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

// Mapear tipo de veículo local para Softruck (valores em inglês)
function mapVehicleType(combustivel: string | null): string {
  const mapping: Record<string, string> = {
    'gasolina': 'car',
    'etanol': 'car',
    'flex': 'car',
    'diesel': 'truck',
    'eletrico': 'car',
    'hibrido': 'car',
    'gnv': 'car',
    'carro': 'car',
    'caminhao': 'truck',
    'caminhão': 'truck',
    'moto': 'motorcycle',
    'motocicleta': 'motorcycle',
  };
  
  return mapping[combustivel?.toLowerCase() || ''] || 'car';
}

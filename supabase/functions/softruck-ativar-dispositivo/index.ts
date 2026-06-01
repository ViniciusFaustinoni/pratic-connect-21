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
  | 'FAILED_USER'
  | 'CREATED_BUT_NOT_ACTIVATED';

// Envelope cru padronizado retornado por callSoftruckApi — preserva contexto
// suficiente para investigação posterior (operação, HTTP status, body parseado).
interface SoftruckRawEnvelope {
  operation: string;
  http_status: number | null;
  body: unknown;
}

interface CallSoftruckResult {
  success: boolean;
  data?: unknown;
  error?: string;
  raw: SoftruckRawEnvelope;
}

// Tenta extrair o JSON cru da mensagem de erro produzida por softruck-api
// (formato canônico: "Softruck API error: <status> - <jsonBody>").
function parseUpstreamErrorBody(errorMsg: string | undefined): { http_status: number | null; body: unknown } {
  if (!errorMsg) return { http_status: null, body: null };
  const m = errorMsg.match(/Softruck API error:\s*(\d+)\s*-\s*([\s\S]+)$/);
  if (!m) return { http_status: null, body: errorMsg };
  const status = Number(m[1]);
  const raw = m[2];
  try {
    return { http_status: status, body: JSON.parse(raw) };
  } catch {
    return { http_status: status, body: raw };
  }
}

// Chamar softruck-api edge function — agora retorna `raw` com operation+status+body
// para que qualquer falha grave seja gravada em `rastreadores.softruck_response_raw`
// com contexto suficiente para investigar sem reabrir os logs da Softruck.
async function callSoftruckApi(
  supabaseUrl: string,
  supabaseKey: string,
  operation: string,
  data: Record<string, unknown>
): Promise<CallSoftruckResult> {
  let httpStatus: number | null = null;
  let parsed: { success?: boolean; data?: unknown; error?: string; operation?: string } = {};
  let bodyText = '';
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/softruck-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ operation, data }),
    });
    httpStatus = response.status;
    bodyText = await response.text();
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      parsed = { success: false, error: `Resposta não-JSON de softruck-api: ${bodyText.slice(0, 500)}` };
    }
  } catch (netErr) {
    const msg = netErr instanceof Error ? netErr.message : String(netErr);
    return {
      success: false,
      error: `falha_rede_softruck_api:${msg}`,
      raw: { operation, http_status: null, body: { kind: 'fetch_error', message: msg } },
    };
  }

  // Quando upstream falhou, o body útil está embutido em `parsed.error` ("Softruck API error: 400 - {...}")
  if (!parsed.success) {
    const upstream = parseUpstreamErrorBody(parsed.error);
    return {
      success: false,
      data: parsed.data,
      error: parsed.error,
      raw: {
        operation,
        http_status: upstream.http_status ?? httpStatus,
        body: upstream.body ?? parsed,
      },
    };
  }

  return {
    success: true,
    data: parsed.data,
    raw: { operation, http_status: httpStatus, body: parsed.data },
  };
}

// Atualizar status de integração no rastreador (e incrementa softruck_tentativas quando NÃO é SUCCESS)
// O `responseRaw` é SEMPRE envelopado como {operation, ts, raw} para que toda falha
// seja diagnosticável sem reabrir logs externos.
async function updateIntegrationStatus(
  supabase: any,
  rastreadorId: string | null,
  status: IntegrationStatus,
  _errorMessage?: string,
  payloadSent?: unknown,
  responseRaw?: unknown,
  operation?: string
) {
  if (!rastreadorId) {
    console.warn('[Softruck Ativar] rastreadorId não disponível para atualizar status');
    return;
  }

  try {
    // Envelopar SEMPRE como {operation, ts, raw} — formato canônico desta rodada.
    let envelope: Record<string, unknown> | null = null;
    if (responseRaw !== undefined && responseRaw !== null) {
      const r = responseRaw as Record<string, unknown>;
      // Se já é um SoftruckRawEnvelope (vindo de callSoftruckApi.raw), use-o como `raw`.
      const isRawEnvelope = r && typeof r === 'object' && 'operation' in r && 'body' in r;
      // Se é um CallSoftruckResult inteiro, extrai o `.raw` interno.
      const isCallResult = r && typeof r === 'object' && 'raw' in r && (r as any).raw && typeof (r as any).raw === 'object' && 'body' in ((r as any).raw as object);
      const rawPayload = isRawEnvelope ? r : (isCallResult ? (r as any).raw : r);
      envelope = {
        operation: operation || (rawPayload as any)?.operation || 'unknown',
        ts: new Date().toISOString(),
        raw: rawPayload,
      };
      if (_errorMessage) envelope.error_message = _errorMessage;
    } else if (operation || _errorMessage) {
      envelope = {
        operation: operation || 'unknown',
        ts: new Date().toISOString(),
        raw: { kind: 'no_upstream_response', message: _errorMessage || null },
      };
    }

    const update: Record<string, unknown> = {
      softruck_integration_status: status,
      softruck_last_attempt_at: new Date().toISOString(),
      softruck_payload_sent: payloadSent || null,
      softruck_response_raw: envelope,
      updated_at: new Date().toISOString(),
    };

    if (status !== 'SUCCESS') {
      // Incrementar tentativas via expressão segura (read + write)
      const { data: cur } = await supabase
        .from('rastreadores')
        .select('softruck_tentativas')
        .eq('id', rastreadorId)
        .maybeSingle();
      update.softruck_tentativas = (cur?.softruck_tentativas ?? 0) + 1;
    }

    await supabase.from('rastreadores').update(update).eq('id', rastreadorId);

    console.log(`[Softruck Ativar] Status de integração atualizado: ${status} (op=${operation || 'n/a'})`);
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
      .select('id, codigo, numero_serie, plataforma, status, plataforma_device_id, chip_iccid, chip_number, plataforma_veiculo_id, softruck_chip_id, local_instalacao, descricao_instalacao')
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
    await updateIntegrationStatus(supabase, rastreadorId, 'PENDING', undefined, payloadSent, { kind: 'preflight', stage: 'init' }, 'preflight');

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
    
    // CORREÇÃO (canônica — caso LTC8G02): só considerar "já ativado" quando
    // (1) ambos IDs preenchidos, (2) status = SUCCESS e
    // (3) plataforma_device_id NÃO for igual ao IMEI (placeholder otimista de outros fluxos).
    // Formato real Softruck é alfa-numérico tipo "qekgzQoqPJwdAr8"; quando o campo
    // contém só dígitos e bate com o IMEI, é placeholder e a ativação precisa rodar.
    const deviceIdLocal = rastreador.plataforma_device_id || '';
    const isPlaceholderDeviceId = !!deviceIdLocal && /^\d{14,17}$/.test(deviceIdLocal) && deviceIdLocal === imei;
    if (isPlaceholderDeviceId) {
      console.warn('[Softruck Ativar] plataforma_device_id é placeholder (= IMEI). Resetando e reativando.');
      await supabase
        .from('rastreadores')
        .update({ plataforma_device_id: null, id_plataforma: null })
        .eq('id', rastreador.id);
      rastreador.plataforma_device_id = null;
    } else if (
      rastreador.plataforma_device_id &&
      rastreador.plataforma_veiculo_id &&
      rastreador.softruck_integration_status === 'SUCCESS'
    ) {
      console.log('[Softruck Ativar] Rastreador já totalmente ativado na Softruck:', {
        device: rastreador.plataforma_device_id,
        veiculo: rastreador.plataforma_veiculo_id,
      });
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
    } else if (rastreador.plataforma_device_id) {
      console.log('[Softruck Ativar] Device já existe na Softruck mas integração incompleta. Continuando ativação...', {
        device: rastreador.plataforma_device_id,
        status: rastreador.softruck_integration_status,
      });
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
      const msg = `Veículo não encontrado: ${veiculoError?.message || 'ID inválido'}`;
      await updateIntegrationStatus(supabase, rastreadorId, 'FAILED_VEHICLE', msg, payloadSent, { kind: 'preflight-veiculo-local', veiculoId, error: veiculoError?.message ?? null }, 'preflight-veiculo-local');
      throw new Error(msg);
    }

    if (!veiculo.placa && !veiculo.chassi) {
      await updateIntegrationStatus(supabase, rastreadorId, 'FAILED_VEHICLE', 'Veículo sem placa e sem chassi cadastrados', payloadSent, { kind: 'preflight-veiculo-local', veiculoId, motivo: 'sem_placa_e_sem_chassi' }, 'preflight-veiculo-local');
      throw new Error('Veículo sem placa e sem chassi cadastrados');
    }
    // 0KM: se não houver placa real (ou placeholder "0KM*"), usa o chassi como plate na Softruck.
    const placaLimpa = (veiculo.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const isZeroKm = !placaLimpa || /^0KM/i.test(placaLimpa);
    if (isZeroKm && veiculo.chassi) {
      console.log('[Softruck Ativar] Veículo 0KM — usando chassi como placa na Softruck');
      veiculo.placa = veiculo.chassi.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 16);
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
            descricao: rastreador.local_instalacao || rastreador.descricao_instalacao || undefined,
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
            await updateIntegrationStatus(supabase, rastreadorId, 'FAILED_VEHICLE', criarVeiculoResult.error, payloadSent, criarVeiculoResult.raw, 'criar-veiculo');
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
            await updateIntegrationStatus(supabase, rastreadorId, 'FAILED_DEVICE', criarDeviceResult.error, payloadSent, criarDeviceResult.raw, 'criar-device');
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

    // ===== 6.1 Garantir USUÁRIO Softruck do associado =====
    console.log('[Softruck Ativar] [6.1] Garantindo usuário Softruck do associado...');
    let softruckUserId: string | null = null;
    try {
      if (!associadoId) {
        console.log('[Softruck Ativar] Sem associadoId — pulando criação de usuário.');
      } else {
        const { data: assoc, error: assocErr } = await supabase
          .from('associados')
          .select('id, nome, email, cpf, telefone, softruck_user_id')
          .eq('id', associadoId)
          .maybeSingle();

        if (assocErr) {
          console.warn('[Softruck Ativar] Erro ao buscar associado:', assocErr.message);
        } else if (!assoc) {
          console.warn('[Softruck Ativar] Associado não encontrado:', associadoId);
        } else {
          softruckUserId = assoc.softruck_user_id || null;

          // Tentar buscar por CPF se não tiver ID salvo
          if (!softruckUserId && assoc.cpf) {
            const buscaCpf = await callSoftruckApi(supabaseUrl, supabaseAnonKey, 'buscar-usuario', { cpf: assoc.cpf });
            const lista = (buscaCpf?.data as { data?: Array<{ id: string }> })?.data || [];
            if (lista.length > 0) softruckUserId = lista[0].id;
          }
          // Fallback por email
          if (!softruckUserId && (assoc.email || associadoEmail)) {
            const emailBusca = assoc.email || associadoEmail!;
            const buscaEmail = await callSoftruckApi(supabaseUrl, supabaseAnonKey, 'buscar-usuario', { email: emailBusca });
            const lista = (buscaEmail?.data as { data?: Array<{ id: string }> })?.data || [];
            if (lista.length > 0) softruckUserId = lista[0].id;
          }

          // Criar se ainda não existe
          if (!softruckUserId) {
            const cpfDigits = (assoc.cpf || '').replace(/\D/g, '');
            const emailFinal = assoc.email || associadoEmail || `assoc_${associadoId.slice(0, 8)}@praticcar.org`;
            const usernameBase = cpfDigits || emailFinal.split('@')[0] || `assoc_${associadoId.slice(0, 8)}`;

            // Resolver roleId padrão (REGULAR) — Softruck exige relationships.roles
            let defaultRoleId = Deno.env.get('SOFTRUCK_DEFAULT_USER_ROLE_ID') || '';
            if (!defaultRoleId) {
              try {
                const rolesRes = await callSoftruckApi(supabaseUrl, supabaseAnonKey, 'listar-roles', {});
                const rolesArr = (rolesRes?.data as { data?: Array<{ id: string; attributes?: { name?: string } }> })?.data || [];
                const regular = rolesArr.find(r => r.attributes?.name === 'REGULAR') || rolesArr.find(r => r.attributes?.name === 'PROVIDER');
                defaultRoleId = regular?.id || '';
                console.log('[Softruck Ativar] roleId resolvido:', defaultRoleId);
              } catch (e) {
                console.warn('[Softruck Ativar] Falha ao listar roles, usando fallback hardcoded:', e);
              }
            }
            // Fallback final hardcoded — id de REGULAR no enterprise atual
            if (!defaultRoleId) defaultRoleId = 'rkov8pZ58Q93KgV';

            const criarUserResult = await callSoftruckApi(
              supabaseUrl,
              supabaseAnonKey,
              'criar-usuario',
              {
                username: usernameBase,
                email: emailFinal,
                nome: assoc.nome || `Associado ${associadoId.slice(0, 8)}`,
                telefone: assoc.telefone || undefined,
                cpf: cpfDigits || undefined,
                roleId: defaultRoleId,
              }
            );

            if (criarUserResult.success) {
              const respData = criarUserResult.data as { data?: Array<{ id: string }> | { id: string } };
              const arr = Array.isArray(respData?.data) ? respData.data : (respData?.data ? [respData.data] : []);
              softruckUserId = arr[0]?.id || null;
              console.log('[Softruck Ativar] Usuário criado na Softruck:', softruckUserId);
            } else if (criarUserResult.error?.includes('Already Exists') || criarUserResult.error?.includes('already exists')) {
              // Re-buscar
              const retry = await callSoftruckApi(supabaseUrl, supabaseAnonKey, 'buscar-usuario',
                cpfDigits ? { cpf: cpfDigits } : { email: emailFinal });
              const lista = (retry?.data as { data?: Array<{ id: string }> })?.data || [];
              if (lista.length > 0) softruckUserId = lista[0].id;
            } else {
              console.warn('[Softruck Ativar] Falha ao criar usuário Softruck (não bloqueante):', criarUserResult.error);
            }
          }

          // Persistir ID localmente
          if (softruckUserId && softruckUserId !== assoc.softruck_user_id) {
            await supabase
              .from('associados')
              .update({ softruck_user_id: softruckUserId })
              .eq('id', associadoId);
          }
        }
      }
    } catch (userErr) {
      console.warn('[Softruck Ativar] Erro inesperado ao garantir usuário Softruck (não bloqueante):', userErr);
    }

    // ===== 6.2 Associar usuário ao veículo na Softruck =====
    if (softruckUserId && softruckVehicleId) {
      console.log('[Softruck Ativar] [6.2] Associando usuário ao veículo na Softruck...');
      try {
        const assocUserResult = await callSoftruckApi(
          supabaseUrl,
          supabaseAnonKey,
          'associar-usuario-veiculo',
          { userId: softruckUserId, vehicleId: softruckVehicleId }
        );
        if (!assocUserResult.success) {
          if (assocUserResult.error?.includes('Already Exists') || assocUserResult.error?.includes('already')) {
            console.log('[Softruck Ativar] Usuário já associado ao veículo, ok.');
          } else {
            console.warn('[Softruck Ativar] Falha ao associar usuário-veículo (não bloqueante):', assocUserResult.error);
          }
        } else {
          console.log('[Softruck Ativar] Usuário associado ao veículo com sucesso');
        }
      } catch (e) {
        console.warn('[Softruck Ativar] Erro ao associar usuário-veículo:', e);
      }
    } else {
      console.log('[Softruck Ativar] Sem softruckUserId ou softruckVehicleId — pulando associação usuário↔veículo');
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

    // ===== 8.4. READ-BACK CANÔNICO ANTES DE GRAVAR SUCCESS =====
    // Confirma na Softruck que o device existe E está vinculado ao mesmo vehicle
    // que criamos/atualizamos localmente. Se algo divergir, grava PENDING para
    // o cron-softruck-reconciliar-pending reprocessar — eliminando casos como
    // LTC8G02 em que o sistema marcava SUCCESS sem o vínculo real existir lá.
    //
    // AUTO-CORREÇÃO: quando o read-back detectar vehicle_divergente (device
    // existe mas aponta pra outro veículo), tenta corrigir automaticamente via
    // o mesmo helper usado pela edge softruck-corrigir-vinculo: desvincula do
    // errado, vincula ao correto, re-readback. Só atua em vehicle_divergente —
    // demais motivos seguem como PENDING (sem desvincular nada).
    let readbackOk = false;
    let readbackReason: string | null = null;
    let readbackRemote: unknown = null;
    let correcaoAuto: unknown = null;

    async function doReadback(): Promise<void> {
      readbackOk = false;
      readbackReason = null;
      const readbackResp = await callSoftruckApi(
        supabaseUrl, supabaseAnonKey, 'buscar-device-imei', { imei }
      );
      if (!readbackResp.success) {
        readbackReason = `softruck_api_falhou:${readbackResp.error || 'sem_detalhe'}`;
        return;
      }
      const remoteList = (readbackResp.data as { data?: Array<Record<string, any>> })?.data || [];
      const remoteDevice = remoteList[0] || null;
      readbackRemote = remoteDevice;
      const remoteVehicleId =
        remoteDevice?.relationships?.vehicle?.data?.id
        || remoteDevice?.relationships?.vehicle?.id
        || null;
      if (!remoteDevice) {
        readbackReason = 'device_ausente_na_softruck';
      } else if (!remoteVehicleId) {
        readbackReason = 'device_sem_vehicle_associado';
      } else if (remoteVehicleId !== softruckVehicleId) {
        readbackReason = `vehicle_divergente:remoto=${remoteVehicleId}/local=${softruckVehicleId}`;
      } else {
        readbackOk = true;
      }
    }

    try {
      await doReadback();

      // Auto-correção em vehicle_divergente
      if (!readbackOk && readbackReason?.startsWith('vehicle_divergente:') && softruckDeviceId && softruckVehicleId) {
        console.warn('[Softruck Ativar] [8.4] vehicle_divergente detectado — tentando auto-correção...');
        const { buildCallSoftruckApi, corrigirVinculoSoftruck } = await import('../_shared/softruck-corrigir.ts');
        const callSoftruck = buildCallSoftruckApi(supabaseUrl, supabaseAnonKey);
        const correcao = await corrigirVinculoSoftruck(callSoftruck, {
          imei,
          remoteDeviceId: softruckDeviceId,
          softruckVehicleIdAlvo: softruckVehicleId,
        });
        correcaoAuto = correcao;
        if (correcao.ok) {
          readbackOk = true;
          readbackReason = null;
          console.log('[Softruck Ativar] [8.4] Auto-correção bem-sucedida — vínculo agora correto.');
        } else {
          readbackReason = `vehicle_divergente_correcao_falhou:${correcao.motivoFalha || 'sem_detalhe'}`;
          console.error('[Softruck Ativar] [8.4] Auto-correção falhou:', correcao.motivoFalha);
        }
      }
    } catch (rbErr) {
      readbackReason = `readback_exception:${(rbErr as Error)?.message || 'erro'}`;
    }

    if (!readbackOk) {
      console.warn(`[Softruck Ativar] [8.4] Read-back falhou: ${readbackReason}`);
    } else {
      console.log('[Softruck Ativar] [8.4] Read-back confirmado — vínculo real existe na Softruck');
    }

    // ===== 8.5. UPDATE FINAL CANÔNICO ANTES DE QUALQUER POLLING =====
    // CRÍTICO: gravar IDs + status (SUCCESS ou PENDING conforme read-back)
    // ANTES do GPS. Se o runtime cair durante o polling, o registro não fica fantasma
    // (casos RUM0H01 / QPW4H53). Polling de GPS vai para fila assíncrona,
    // mas SOMENTE quando o read-back confirmou o vínculo.
    {
      const statusFinal: IntegrationStatus = readbackOk ? 'SUCCESS' : 'PENDING';
      const responseRawBase: Record<string, unknown> = {
        softruckVehicleId,
        softruckDeviceId,
        softruckChipId,
        softruckUserId,
        gps_polling: readbackOk ? 'pendente_async' : 'bloqueado_aguardando_readback',
      };
      if (!readbackOk) {
        responseRawBase.readback_failed = true;
        responseRawBase.readback_reason = readbackReason;
        responseRawBase.readback_remote = readbackRemote;
      }
      if (correcaoAuto) {
        responseRawBase.correcao_auto = correcaoAuto;
      }

      const updEarly: Record<string, unknown> = {
        plataforma_device_id: softruckDeviceId,
        plataforma_veiculo_id: softruckVehicleId,
        softruck_chip_id: softruckChipId || null,
        softruck_integration_status: statusFinal,
        softruck_last_attempt_at: new Date().toISOString(),
        softruck_payload_sent: payloadSent,
        softruck_response_raw: responseRawBase,
        updated_at: new Date().toISOString(),
      };
      if (rastreador.status !== 'instalado') {
        updEarly.veiculo_id = veiculoId;
        updEarly.associado_id = associadoId;
        updEarly.associado_email = associadoEmail;
        updEarly.status = 'instalado';
      }
      // Quando read-back falhar, zerar tentativas para que o cron retome imediatamente.
      if (!readbackOk) {
        updEarly.softruck_tentativas = 0;
      }

      const { error: upEarlyErr } = await supabase.from('rastreadores').update(updEarly).eq('id', rastreador.id);
      if (upEarlyErr) throw new Error(`UPDATE final rastreador: ${upEarlyErr.message}`);
      if (softruckVehicleId) {
        await supabase.from('veiculos').update({ softruck_vehicle_id: softruckVehicleId }).eq('id', veiculoId);
      }
      // Enfileirar polling GPS assíncrono — APENAS se read-back confirmou. Falha não bloqueia.
      if (readbackOk) {
        try {
          await supabase.from('softruck_gps_poll_queue').insert({
            rastreador_id: rastreador.id,
            softruck_device_id: softruckDeviceId,
            softruck_vehicle_id: softruckVehicleId,
            status: 'pending',
            next_run_at: new Date().toISOString(),
          });
        } catch (qErr) {
          console.warn('[Softruck Ativar] falha enfileirar gps poll:', qErr);
        }
      } else {
        console.warn('[Softruck Ativar] GPS poll NÃO enfileirado — registro ficou PENDING aguardando reconciliação');
      }
    }

    // ===== 8.6/9. REMOVIDOS =====
    // O UPDATE canônico do rastreador (e do veiculos.softruck_vehicle_id) já foi feito
    // no passo 8.5 ANTES de qualquer tentativa de GPS. Polling de posição é 100%
    // responsabilidade do worker assíncrono `cron-softruck-gps-poll` consumindo
    // `softruck_gps_poll_queue` (já enfileirado no 8.5). Isso elimina os casos
    // QPW4H53 / RUM0H01 em que travamento no GPS deixava o registro local incompleto.
    const primeiraPos = null;
    const responseRaw = {
      softruckVehicleId,
      softruckDeviceId,
      softruckChipId,
      softruckUserId,
      gps_polling: 'async',
    };


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

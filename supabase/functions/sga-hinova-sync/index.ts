import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  veiculo_id: string;
  associado_id: string;
}

interface HinovaAuthResponse {
  mensagem: string;
  token_usuario?: string;
}

interface HinovaAssociadoResponse {
  mensagem: string;
  codigo_associado?: number;
}

interface HinovaVeiculoResponse {
  mensagem: string;
  codigo_veiculo?: number;
}

// Helper para formatar data para dd/mm/yyyy
function formatDateBR(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Helper para limpar CPF (apenas números)
function cleanCPF(cpf: string | null): string {
  if (!cpf) return '';
  return cpf.replace(/\D/g, '');
}

// Helper para limpar telefone (apenas números)
function cleanPhoneDigits(phone: string | null): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

// Helper para formatar CPF com pontuação
function formatCPF(cpf: string | null): string {
  if (!cpf) return '';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return clean;
  return `${clean.slice(0,3)}.${clean.slice(3,6)}.${clean.slice(6,9)}-${clean.slice(9)}`;
}

// Helper para extrair código de associado de múltiplos formatos de payload
function extractCodigoAssociado(payload: any): number | null {
  if (!payload) return null;

  const candidates = [
    payload?.codigo_associado,
    payload?.codigo,
    payload?.data?.codigo_associado,
    payload?.data?.codigo,
    payload?.associado?.codigo_associado,
    payload?.associado?.codigo,
    payload?.resultado?.codigo_associado,
    payload?.resultado?.codigo,
    Array.isArray(payload) ? payload[0]?.codigo_associado : null,
    Array.isArray(payload) ? payload[0]?.codigo : null,
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

// Helper para formatar telefone
function formatPhone(phone: string | null): string {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }
  return phone;
}

// Retry com backoff exponencial
async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      lastError = error as Error;
      const delay = Math.pow(2, i) * 1000;
      console.log(`[Retry ${i + 1}/${maxRetries}] Aguardando ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Helper para parse seguro de JSON
async function safeJsonParse<T>(response: Response, context: string): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const textResponse = await response.text();
  
  console.log(`[SGA Sync] ${context} - Status: ${response.status}, Content-Type: ${contentType}`);
  
  if (!contentType.includes('application/json')) {
    console.error(`[SGA Sync] ${context} - Resposta não-JSON recebida:`, textResponse.substring(0, 300));
    
    if (textResponse.trim().startsWith('<!') || textResponse.includes('<html')) {
      throw new Error(`API Hinova retornou HTML ao invés de JSON. Isso geralmente indica: erro de servidor, redirecionamento de autenticação ou rate limiting. Status: ${response.status}`);
    }
    
    if (textResponse.toLowerCase().includes('erro') || textResponse.toLowerCase().includes('error')) {
      throw new Error(`Erro da API Hinova: ${textResponse.substring(0, 200)}`);
    }
    
    throw new Error(`Resposta inesperada da API Hinova (${contentType}): ${textResponse.substring(0, 200)}`);
  }
  
  try {
    return JSON.parse(textResponse) as T;
  } catch (parseError) {
    console.error(`[SGA Sync] ${context} - Erro ao parsear JSON:`, textResponse.substring(0, 300));
    throw new Error(`Resposta inválida da API Hinova - não é JSON válido: ${textResponse.substring(0, 100)}`);
  }
}

// Helper para upsert na fila de reenvio
async function upsertSyncQueue(
  supabase: any,
  veiculoId: string,
  associadoId: string,
  etapaParou: string,
  erroMsg: string,
  codigoAssociadoHinova: number | null = null,
  codigoVeiculoHinova: number | null = null,
  origem: string = 'automatico'
) {
  try {
    // Check if exists
    const { data: existing } = await supabase
      .from('sga_sync_queue')
      .select('id, tentativas')
      .eq('veiculo_id', veiculoId)
      .eq('associado_id', associadoId)
      .maybeSingle();

    const tentativas = (existing?.tentativas || 0) + 1;
    const proximoReenvio = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    if (existing) {
      await supabase
        .from('sga_sync_queue')
        .update({
          status: tentativas >= 10 ? 'falha_permanente' : 'pendente',
          tentativas,
          ultima_tentativa_em: new Date().toISOString(),
          proximo_reenvio_em: proximoReenvio,
          erro_ultimo: erroMsg,
          etapa_parou: etapaParou,
          ...(codigoAssociadoHinova && { codigo_associado_hinova: codigoAssociadoHinova }),
          ...(codigoVeiculoHinova && { codigo_veiculo_hinova: codigoVeiculoHinova }),
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('sga_sync_queue')
        .insert({
          veiculo_id: veiculoId,
          associado_id: associadoId,
          status: 'pendente',
          tentativas: 1,
          ultima_tentativa_em: new Date().toISOString(),
          proximo_reenvio_em: proximoReenvio,
          erro_ultimo: erroMsg,
          etapa_parou: etapaParou,
          codigo_associado_hinova: codigoAssociadoHinova,
          codigo_veiculo_hinova: codigoVeiculoHinova,
          origem,
        });
    }
    console.log(`[SGA Sync] Fila de reenvio atualizada: etapa=${etapaParou}, tentativas=${tentativas}`);
  } catch (e) {
    console.error('[SGA Sync] Erro ao gravar na fila de reenvio:', e);
  }
}

// Helper para marcar fila como concluída
async function markQueueCompleted(supabase: any, veiculoId: string, associadoId: string) {
  try {
    await supabase
      .from('sga_sync_queue')
      .update({ status: 'concluido', ultima_tentativa_em: new Date().toISOString() })
      .eq('veiculo_id', veiculoId)
      .eq('associado_id', associadoId);
  } catch (e) {
    console.error('[SGA Sync] Erro ao marcar fila como concluída:', e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Helper para descriptografar credenciais do banco
  async function getCredenciaisBanco(integracao: string): Promise<Record<string, string> | null> {
    try {
      const { data, error } = await supabase
        .from('integracoes_credenciais')
        .select('credenciais_encrypted, iv, configurado')
        .eq('integracao', integracao)
        .single();

      if (error || !data || !data.configurado) return null;

      const encoder = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw', encoder.encode(supabaseServiceKey), { name: 'PBKDF2' }, false, ['deriveKey']
      );
      const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: encoder.encode('integracoes_credenciais_salt'), iterations: 100000, hash: 'SHA-256' },
        keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
      );
      
      const encrypted = Uint8Array.from(atob(data.credenciais_encrypted), c => c.charCodeAt(0));
      const iv = Uint8Array.from(atob(data.iv), c => c.charCodeAt(0));
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
      
      return JSON.parse(new TextDecoder().decode(decrypted));
    } catch (e) {
      console.error('[getCredenciaisBanco] Erro:', e);
      return null;
    }
  }

  // Hinova credentials
  let hinovaApiUrl = Deno.env.get('HINOVA_API_URL') || 'https://api.hinova.com.br/api/sga/v2';
  let hinovaToken = Deno.env.get('HINOVA_TOKEN');
  let hinovaUsuario = Deno.env.get('HINOVA_USUARIO');
  let hinovaSenha = Deno.env.get('HINOVA_SENHA');
  let hinovaCodigoConta = Deno.env.get('HINOVA_CODIGO_CONTA') || '';
  let hinovaCodigoRegional = Deno.env.get('HINOVA_CODIGO_REGIONAL');
  let hinovaCodigoCooperativa = Deno.env.get('HINOVA_CODIGO_COOPERATIVA');
  let hinovaCodigoVoluntario = Deno.env.get('HINOVA_CODIGO_VOLUNTARIO');
  let codigoContaOrigem: 'env' | 'database' | 'historico' | 'fallback' = hinovaCodigoConta ? 'env' : 'fallback';

  if (!hinovaToken || !hinovaUsuario || !hinovaSenha || !hinovaCodigoConta) {
    console.log('[SGA Sync] Credenciais incompletas em ENV, buscando do banco...');
    const credBanco = await getCredenciaisBanco('hinova');
    if (credBanco) {
      hinovaToken = credBanco.token || hinovaToken;
      hinovaUsuario = credBanco.usuario || hinovaUsuario;
      hinovaSenha = credBanco.senha || hinovaSenha;
      if (credBanco.codigo_conta) {
        hinovaCodigoConta = String(credBanco.codigo_conta);
        codigoContaOrigem = 'database';
      }
      hinovaCodigoRegional = credBanco.codigo_regional || hinovaCodigoRegional;
      hinovaCodigoCooperativa = credBanco.codigo_cooperativa || hinovaCodigoCooperativa;
      hinovaCodigoVoluntario = credBanco.codigo_voluntario || hinovaCodigoVoluntario;
      if (credBanco.api_url) hinovaApiUrl = credBanco.api_url;
      console.log('[SGA Sync] Credenciais carregadas do banco');
    }
  }

  if (!hinovaCodigoConta) {
    try {
      const { data: logsCodigoConta } = await supabase
        .from('sga_sync_logs')
        .select('request_payload, created_at')
        .eq('action', 'cadastrar_associado')
        .eq('status', 'success')
        .not('request_payload', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);

      if (logsCodigoConta) {
        for (const log of logsCodigoConta) {
          const payload = (log.request_payload || {}) as Record<string, unknown>;
          const candidato = Number(payload?.codigo_conta);
          if (Number.isFinite(candidato) && candidato > 0) {
            hinovaCodigoConta = String(candidato);
            codigoContaOrigem = 'historico';
            console.log(`[SGA Sync] codigo_conta inferido do histórico: ${hinovaCodigoConta}`);
            break;
          }
        }
      }
    } catch (e) {
      console.log('[SGA Sync] Falha ao inferir codigo_conta por histórico:', e);
    }
  }

  const codigoContaResolvido = Number.parseInt(hinovaCodigoConta || '', 10);
  const codigoContaValido = Number.isFinite(codigoContaResolvido) && codigoContaResolvido > 0;

  console.log(`[SGA Sync] codigo_conta origem=${codigoContaOrigem}, valor=${codigoContaValido ? codigoContaResolvido : 'inválido'}`);

  console.log('[SGA Sync] Token Bearer carregado:', hinovaToken ? `${hinovaToken.slice(0, 10)}...` : 'VAZIO');

  // Helper para registrar log
  async function logSync(
    veiculoId: string | null,
    associadoId: string | null,
    action: string,
    status: string,
    requestPayload: any,
    responsePayload: any,
    errorMessage: string | null = null
  ) {
    try {
      await supabase.from('sga_sync_logs').insert({
        veiculo_id: veiculoId,
        associado_id: associadoId,
        action,
        status,
        request_payload: requestPayload,
        response_payload: responsePayload,
        error_message: errorMessage,
        duracao_ms: Date.now() - startTime,
      });
    } catch (e) {
      console.error('[Log] Erro ao registrar log:', e);
    }
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${hinovaToken}`,
  };

  try {
    if (!hinovaToken || !hinovaUsuario || !hinovaSenha) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Credenciais do Hinova não configuradas. Configure em Configurações > Integrações ou via Supabase Secrets.',
          step: 'config'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!codigoContaValido) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'codigo_conta do Hinova inválido ou ausente. Configure HINOVA_CODIGO_CONTA (ou integre em credenciais) e tente novamente.',
          step: 'config'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
      );
    }

    const requestBody = await req.json();
    const { veiculo_id, associado_id, action } = requestBody as SyncRequest & { action?: string };

    // ========================================
    // MODO TESTE DE CONEXÃO
    // ========================================
    if (action === 'test_connection') {
      console.log('[SGA Sync] Modo teste de conexão...');
      
      const authPayload = { usuario: hinovaUsuario, senha: hinovaSenha };
      const authResponse = await fetchWithRetry(
        `${hinovaApiUrl}/usuario/autenticar`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${hinovaToken}`
          },
          body: JSON.stringify(authPayload)
        }
      );

      const authData: HinovaAuthResponse = await safeJsonParse<HinovaAuthResponse>(authResponse, 'test_connection');
      
      if (!authResponse.ok || !authData.token_usuario) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Falha na autenticação: ${authData.mensagem || 'Credenciais inválidas'}`,
            step: 'test_connection'
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          mensagem: 'Conexão estabelecida com sucesso!',
          step: 'test_connection'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================
    // MODO SINCRONIZAÇÃO COMPLETA
    // ========================================
    if (!veiculo_id || !associado_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'veiculo_id e associado_id são obrigatórios para sincronização',
          step: 'validation'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SGA Sync] Iniciando sincronização - Veículo: ${veiculo_id}, Associado: ${associado_id}`);

    await supabase
      .from('veiculos')
      .update({ status_sga: 'sincronizando' })
      .eq('id', veiculo_id);

    // ========================================
    // PASSO 1: Buscar dados do associado
    // ========================================
    const { data: associado, error: associadoError } = await supabase
      .from('associados')
      .select('*')
      .eq('id', associado_id)
      .single();

    if (associadoError || !associado) {
      await logSync(veiculo_id, associado_id, 'buscar_associado', 'error', null, null, 'Associado não encontrado');
      await supabase.from('veiculos').update({ status_sga: 'erro_sincronizacao' }).eq('id', veiculo_id);
      await upsertSyncQueue(supabase, veiculo_id, associado_id, 'associado', 'Associado não encontrado no banco');
      return new Response(
        JSON.stringify({ success: false, error: 'Associado não encontrado', step: 'associado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================
    // PASSO 2: Buscar dados do veículo
    // ========================================
    const { data: veiculo, error: veiculoError } = await supabase
      .from('veiculos')
      .select('*')
      .eq('id', veiculo_id)
      .single();

    if (veiculoError || !veiculo) {
      await logSync(veiculo_id, associado_id, 'buscar_veiculo', 'error', null, null, 'Veículo não encontrado');
      await supabase.from('veiculos').update({ status_sga: 'erro_sincronizacao' }).eq('id', veiculo_id);
      await upsertSyncQueue(supabase, veiculo_id, associado_id, 'associado', 'Veículo não encontrado no banco');
      return new Response(
        JSON.stringify({ success: false, error: 'Veículo não encontrado', step: 'veiculo' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================
    // PASSO 3: Buscar mapeamentos
    // ========================================
    const { data: mapeamentos } = await supabase
      .from('hinova_mapeamentos')
      .select('*')
      .eq('ativo', true);

    const getMapeamento = (tipo: string, codigoLocal: string | null): number | null => {
      if (!codigoLocal) return null;
      const map = mapeamentos?.find(
        m => m.tipo === tipo && m.codigo_local.toLowerCase() === codigoLocal.toLowerCase()
      );
      return map?.codigo_hinova || null;
    };

    const normalizarCombustivel = (combustivel: string | null): string | null => {
      if (!combustivel) return null;
      const c = combustivel.toUpperCase().trim();
      if (c.includes('/') && (c.includes('GASOLINA') || c.includes('ALCOOL') || c.includes('ÁLCOOL') || c.includes('ETANOL'))) {
        if (c.includes('GAS NATURAL') || c.includes('GNV')) return 'gnv';
        return 'flex';
      }
      if (c === 'FLEX' || c === 'BICOMBUSTÍVEL' || c === 'BICOMBUSTIVEL') return 'flex';
      if (c === 'GASOLINA') return 'gasolina';
      if (c === 'ETANOL' || c === 'ÁLCOOL' || c === 'ALCOOL') return 'etanol';
      if (c === 'DIESEL') return 'diesel';
      if (c === 'GNV' || c === 'GAS NATURAL' || c === 'GÁS NATURAL') return 'gnv';
      if (c === 'ELÉTRICO' || c === 'ELETRICO') return 'eletrico';
      if (c === 'HÍBRIDO' || c === 'HIBRIDO') return 'hibrido';
      return combustivel.toLowerCase();
    };

    const inferirTipoVeiculo = (categoria: string | null, marca?: string | null, modelo?: string | null): number => {
      if (categoria) {
        const cat = categoria.toUpperCase().trim();
        if (cat.includes('MOTO') || cat.includes('MOTOCICLETA')) return 2;
        if (cat.includes('CAMINHÃO') || cat.includes('CAMINHAO') || cat.includes('TRUCK')) return 3;
        if (cat.includes('VAN') || cat.includes('UTILITÁRIO') || cat.includes('UTILITARIO')) return 4;
        if (cat.includes('ÔNIBUS') || cat.includes('ONIBUS')) return 5;
        if (cat.includes('REBOQUE') || cat.includes('SEMI-REBOQUE')) return 6;
      }
      
      const MOTO_KEYWORDS = ['nxr', 'bros', 'cg ', 'cg-', 'cb ', 'cb-', 'cbr', 'pcx', 'biz', 'pop', 
        'titan', 'fan', 'xre', 'lander', 'tenere', 'ténéré', 'crosser', 'fazer', 'ybr', 'neo',
        'burgman', 'intruder', 'factor', 'scooter', 'lead', 'sahara', 'transalp', 'africa twin',
        'xtz', 'xt ', 'xj6', 'mt-', 'mt ', 'nmax', 'fluo', 'next', 'crypton', 'yes',
        'gsx', 'v-strom', 'vstrom', 'dl ', 'boulevard', 'hayabusa', 'ninja', 'versys', 'z900', 'z800', 'z750',
        'duke', 'adventure', 'rc ', 'apache', 'speed', 'street', 'bonneville', 'tiger',
        'sportster', 'iron', 'fat bob', 'softail', 'electra', 'road king',
        'riva', 'kansas', 'mirage', 'horizon', 'jet', 'citicom', 'citycom'];
      if (modelo && MOTO_KEYWORDS.some(kw => modelo.toLowerCase().includes(kw))) return 2;
      
      const MARCAS_MOTO = ['YAMAHA', 'SUZUKI', 'KAWASAKI', 'HARLEY', 'TRIUMPH', 
        'DUCATI', 'KTM', 'DAFRA', 'SHINERAY', 'KASINSKI', 'ROYAL ENFIELD', 'BMW MOTORRAD',
        'BAJAJ', 'BENELLI', 'MV AGUSTA', 'HUSQVARNA', 'INDIAN'];
      if (marca && MARCAS_MOTO.some(m => marca.toUpperCase().includes(m))) return 2;
      
      if (marca?.toUpperCase().includes('HONDA') && modelo) {
        const HONDA_CARROS = ['civic', 'fit', 'city', 'hr-v', 'hrv', 'cr-v', 'crv', 'accord', 'wr-v', 'wrv', 'zr-v'];
        const isHondaCarro = HONDA_CARROS.some(c => modelo.toLowerCase().includes(c));
        if (!isHondaCarro) return 2;
      }
      
      return 1;
    };

    // ========================================
    // PASSO 3.5: Buscar código voluntário do vendedor
    // ========================================
    console.log('[SGA Sync] Buscando código voluntário do vendedor...');
    
    // Priorizar contrato pelo veiculo_id (determinístico), fallback por associado_id
    let contrato: { vendedor_id: string | null; veiculo_categoria: string | null } | null = null;
    
    const { data: contratoByVeiculo } = await supabase
      .from('contratos')
      .select('vendedor_id, veiculo_categoria')
      .eq('veiculo_id', veiculo_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (contratoByVeiculo) {
      contrato = contratoByVeiculo;
      console.log(`[SGA Sync] Contrato encontrado por veiculo_id: ${veiculo_id}`);
    } else {
      const { data: contratoByAssociado } = await supabase
        .from('contratos')
        .select('vendedor_id, veiculo_categoria')
        .eq('associado_id', associado_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      contrato = contratoByAssociado;
      console.log(`[SGA Sync] Contrato fallback por associado_id: ${associado_id}`);
    }
    
    if (contrato?.vendedor_id) {
      console.log(`[SGA Sync] Vendedor do contrato: ${contrato.vendedor_id}`);
      
      const { data: vendedor } = await supabase
        .from('profiles')
        .select('codigo_sga_voluntario, nome')
        .eq('id', contrato.vendedor_id)
        .single();
      
      if (vendedor?.codigo_sga_voluntario) {
        hinovaCodigoVoluntario = vendedor.codigo_sga_voluntario;
        console.log(`[SGA Sync] Usando código voluntário do vendedor ${vendedor.nome}: ${hinovaCodigoVoluntario}`);
      } else {
        console.log(`[SGA Sync] Vendedor ${vendedor?.nome || 'desconhecido'} não possui código SGA configurado`);
      }
    }

    if (!hinovaCodigoVoluntario) {
      const { data: qualquerVendedor } = await supabase
        .from('profiles')
        .select('codigo_sga_voluntario, nome')
        .not('codigo_sga_voluntario', 'is', null)
        .limit(1)
        .maybeSingle();

      if (qualquerVendedor?.codigo_sga_voluntario) {
        hinovaCodigoVoluntario = qualquerVendedor.codigo_sga_voluntario;
        console.log(`[SGA Sync] Fallback: usando código voluntário de ${qualquerVendedor.nome}: ${hinovaCodigoVoluntario}`);
      }
    }

    // ========================================
    // PASSO 4: Autenticar na API Hinova
    // ========================================
    console.log('[SGA Sync] Autenticando na API Hinova...');
    
    const authPayload = { usuario: hinovaUsuario, senha: hinovaSenha };

    const authResponse = await fetchWithRetry(
      `${hinovaApiUrl}/usuario/autenticar`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${hinovaToken}`
        },
        body: JSON.stringify(authPayload)
      }
    );

    const authData: HinovaAuthResponse = await safeJsonParse<HinovaAuthResponse>(authResponse, 'autenticar');
    
    await logSync(veiculo_id, associado_id, 'autenticar', authResponse.ok ? 'success' : 'error', 
      { usuario: hinovaUsuario }, authData, authResponse.ok ? null : authData.mensagem);

    if (!authResponse.ok || !authData.token_usuario) {
      await supabase.from('veiculos').update({ status_sga: 'erro_sincronizacao' }).eq('id', veiculo_id);
      await upsertSyncQueue(supabase, veiculo_id, associado_id, 'associado', `Falha na autenticação: ${authData.mensagem}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Falha na autenticação Hinova: ${authData.mensagem}`,
          step: 'autenticar',
          details: authData
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenUsuario = authData.token_usuario;
    console.log('[SGA Sync] Autenticação bem-sucedida');

    const operationHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenUsuario}`,
    };

    // ========================================
    // PASSO 4.5: Consulta backup por CPF (antes de cadastrar)
    // Verifica se o associado já existe no Hinova
    // ========================================
    let codigoAssociadoHinova = associado.codigo_hinova;

    if (!codigoAssociadoHinova) {
      console.log('[SGA Sync] Verificando se associado já existe no Hinova via busca por CPF...');
      const cpfLimpo = cleanCPF(associado.cpf);
      try {
        // Tentar múltiplos formatos de busca por CPF
        const cpfLimpo = cleanCPF(associado.cpf);
        const cpfFormatado = formatCPF(associado.cpf);
        
        const tentativas = [
          { label: 'GET buscar/cpf limpo', url: `${hinovaApiUrl}/associado/buscar/${cpfLimpo}/cpf`, method: 'GET' as const },
          { label: 'GET buscar/cpf formatado', url: `${hinovaApiUrl}/associado/buscar/${encodeURIComponent(cpfFormatado)}/cpf`, method: 'GET' as const },
          { label: 'GET consultar/cpf', url: `${hinovaApiUrl}/associado/consultar/cpf/${cpfLimpo}`, method: 'GET' as const },
          { label: 'GET associado/cpf', url: `${hinovaApiUrl}/associado/${cpfLimpo}`, method: 'GET' as const },
          { label: 'POST consultar', url: `${hinovaApiUrl}/associado/consultar`, method: 'POST' as const, body: JSON.stringify({ cpf: cpfLimpo }) },
          { label: 'POST buscar', url: `${hinovaApiUrl}/associado/buscar`, method: 'POST' as const, body: JSON.stringify({ cpf: cpfLimpo }) },
          { label: 'POST pesquisar', url: `${hinovaApiUrl}/associado/pesquisar`, method: 'POST' as const, body: JSON.stringify({ cpf: cpfLimpo }) },
        ];

        for (const tentativa of tentativas) {
          try {
            console.log(`[SGA Sync] Busca backup: ${tentativa.label}...`);
            const buscaResp = await fetchWithRetry(
              tentativa.url,
              { method: tentativa.method, headers: operationHeaders, ...(tentativa.body && { body: tentativa.body }) },
              1 // single attempt for search endpoints
            );
            
            // SEMPRE ler o body, independente do content-type
            const contentType = buscaResp.headers.get('content-type') || '';
            const buscaText = await buscaResp.text();
            console.log(`[SGA Sync] ${tentativa.label} - Status: ${buscaResp.status}, CT: ${contentType}, Body: ${buscaText.substring(0, 500)}`);
            
            // Gravar diagnóstico em sga_sync_logs para cada tentativa
            await logSync(veiculo_id, associado_id, 'busca_cpf_diagnostico', 
              buscaResp.ok ? 'success' : 'info',
              { metodo: tentativa.label, url: tentativa.url },
              { status: buscaResp.status, content_type: contentType, body_preview: buscaText.substring(0, 500) },
              buscaResp.ok ? null : `Status ${buscaResp.status}`
            );

            // Tentar parsear como JSON mesmo se content-type não indica
            try {
              const buscaData = JSON.parse(buscaText);
              
              // Extrair código de formatos possíveis
              const codigo = extractCodigoAssociado(buscaData);
              
              if (codigo) {
                codigoAssociadoHinova = parseInt(String(codigo));
                console.log(`[SGA Sync] Associado já existe no Hinova! Código: ${codigoAssociadoHinova} (via ${tentativa.label})`);
                
                await supabase.from('associados').update({ 
                  codigo_hinova: codigoAssociadoHinova,
                  sincronizado_hinova: true,
                  sincronizado_hinova_em: new Date().toISOString()
                }).eq('id', associado_id);

                await logSync(veiculo_id, associado_id, 'busca_backup_cpf', 'success', 
                  { cpf: '***', metodo: tentativa.label }, { codigo_associado: codigoAssociadoHinova }, null);

                // Check if vehicle already linked
                const veiculos = buscaData.veiculos || buscaData?.data?.veiculos || [];
                if (Array.isArray(veiculos)) {
                  const veiculoExistente = veiculos.find(
                    (v: any) => v.placa === veiculo.placa
                  );
                  if (veiculoExistente?.codigo_veiculo) {
                    console.log(`[SGA Sync] Veículo também já existe no Hinova! Código: ${veiculoExistente.codigo_veiculo}`);
                    
                    await supabase.from('veiculos').update({ 
                      codigo_hinova: parseInt(veiculoExistente.codigo_veiculo),
                      sincronizado_hinova: true,
                      sincronizado_hinova_em: new Date().toISOString(),
                      status_sga: 'ativado_sga'
                    }).eq('id', veiculo_id);

                    await markQueueCompleted(supabase, veiculo_id, associado_id);

                    return new Response(
                      JSON.stringify({
                        success: true,
                        data: {
                          codigo_associado_hinova: codigoAssociadoHinova,
                          codigo_veiculo_hinova: parseInt(veiculoExistente.codigo_veiculo),
                          recuperado_via: tentativa.label
                        }
                      }),
                      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                  }
                }
                
                break; // Found the code, exit tentativas loop
              }
            } catch (_parseErr) {
              console.log(`[SGA Sync] ${tentativa.label}: body não é JSON válido`);
            }
          } catch (e) {
            console.log(`[SGA Sync] ${tentativa.label} falhou:`, e);
            await logSync(veiculo_id, associado_id, 'busca_cpf_diagnostico', 'error',
              { metodo: tentativa.label }, null, e instanceof Error ? e.message : 'Erro de rede');
          }
        }
        
        if (!codigoAssociadoHinova) {
          console.log('[SGA Sync] Nenhuma busca por CPF retornou código, prosseguindo com cadastro');
        }
      } catch (e) {
        console.log('[SGA Sync] Busca backup por CPF falhou (não bloqueia):', e);
      }
    }

    // ========================================
    // PASSO 5: Cadastrar associado (se não encontrado via backup)
    // ========================================
    if (!codigoAssociadoHinova) {
      console.log('[SGA Sync] Cadastrando associado no Hinova...');
      
      const associadoPayload = {
        nome: associado.nome,
        cpf: cleanCPF(associado.cpf),
        rg: associado.rg || '',
        data_nascimento: formatDateBR(associado.data_nascimento),
        email: associado.email || '',
        telefone: formatPhone(associado.telefone),
        celular: formatPhone(associado.whatsapp || associado.telefone),
        cep: associado.cep?.replace(/\D/g, '') || '',
        logradouro: associado.logradouro || '',
        numero: associado.numero || 'S/N',
        complemento: associado.complemento || '',
        bairro: associado.bairro || '',
        cidade: associado.cidade || '',
        estado: associado.uf || '',
        sexo: associado.sexo?.toUpperCase() === 'FEMININO' ? 'F' : 'M',
        dia_vencimento: associado.dia_vencimento || 10,
        codigo_conta: parseInt(hinovaCodigoConta) || 1,
        ...(hinovaCodigoRegional && { codigo_regional: parseInt(hinovaCodigoRegional) }),
        ...(hinovaCodigoCooperativa && { codigo_cooperativa: parseInt(hinovaCodigoCooperativa) }),
        ...(hinovaCodigoVoluntario && { codigo_voluntario: parseInt(hinovaCodigoVoluntario) }),
      };
      console.log(`[SGA Sync] Payload associado: codigo_conta=${parseInt(hinovaCodigoConta) || 1}`);

      const associadoResponse = await fetchWithRetry(
        `${hinovaApiUrl}/associado/cadastrar`,
        {
          method: 'POST',
          headers: operationHeaders,
          body: JSON.stringify(associadoPayload)
        }
      );

      const associadoData: HinovaAssociadoResponse = await safeJsonParse<HinovaAssociadoResponse>(associadoResponse, 'cadastrar_associado');
      
      await logSync(veiculo_id, associado_id, 'cadastrar_associado', associadoResponse.ok ? 'success' : 'error',
        { ...associadoPayload, cpf: '***' }, associadoData, associadoResponse.ok ? null : associadoData.mensagem);

      if (!associadoResponse.ok) {
        console.log(`[SGA Sync] Resposta cadastrar_associado (${associadoResponse.status}):`, JSON.stringify(associadoData));
        const errorMessages = (associadoData as any).error || [];
        const isTokenBearerError = 
          (associadoData.mensagem?.toLowerCase().includes('token de acesso') ||
           associadoData.mensagem?.toLowerCase().includes('acesso não autorizado') ||
           errorMessages.some((e: string) => 
             e.toLowerCase().includes('login') || 
             e.toLowerCase().includes('senha') ||
             e.toLowerCase().includes('autorizado')
           ));

        if (isTokenBearerError && tokenUsuario) {
          await supabase.from('veiculos').update({ status_sga: 'erro_sincronizacao' }).eq('id', veiculo_id);
          await upsertSyncQueue(supabase, veiculo_id, associado_id, 'associado', 'Token Bearer expirado');
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Token Bearer da API Hinova inválido ou expirado.',
              step: 'associado',
              action_required: 'update_bearer_token',
              details: associadoData
            }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // CPF duplicado
        const isCpfDuplicado = 
          (associadoData.mensagem?.toLowerCase().includes('cpf') && 
           associadoData.mensagem?.toLowerCase().includes('exist')) ||
          errorMessages.some((e: string) => 
            e.toLowerCase().includes('cpf') && e.toLowerCase().includes('exist')
          );
        
        if (isCpfDuplicado) {
          console.log('[SGA Sync] CPF já existe no Hinova, buscando código...');

          let codigoExistente: number | null = extractCodigoAssociado(associadoData);

          if (codigoExistente) {
            console.log(`[SGA Sync] Código retornado no próprio erro de cadastro: ${codigoExistente}`);
          }

          // Estratégia 1: Logs anteriores do mesmo associado_id
          if (!codigoExistente) {
            try {
              const { data: logAnterior } = await supabase
                .from('sga_sync_logs')
                .select('response_payload')
                .eq('associado_id', associado_id)
                .eq('action', 'cadastrar_associado')
                .eq('status', 'success')
                .not('response_payload', 'is', null)
                .order('created_at', { ascending: false })
                .limit(10);

              if (logAnterior) {
                for (const log of logAnterior) {
                  const codigo = extractCodigoAssociado(log.response_payload);
                  if (codigo) {
                    codigoExistente = codigo;
                    console.log(`[SGA Sync] Código recuperado via logs do próprio associado: ${codigoExistente}`);
                    break;
                  }
                }
              }
            } catch (e) {
              console.log('[SGA Sync] Erro logs anteriores:', e);
            }
          }

          // Estratégia 2: Logs históricos por identidade (nome/email/telefone)
          if (!codigoExistente) {
            try {
              const { data: logsIdentidade } = await supabase
                .from('sga_sync_logs')
                .select('request_payload, response_payload, created_at')
                .eq('action', 'cadastrar_associado')
                .eq('status', 'success')
                .not('response_payload', 'is', null)
                .order('created_at', { ascending: false })
                .limit(200);

              const nomeAtual = (associado.nome || '').trim().toLowerCase();
              const emailAtual = (associado.email || '').trim().toLowerCase();
              const cpfAtual = cleanCPF(associado.cpf);
              const telefoneAtual = cleanPhoneDigits(associado.whatsapp || associado.telefone);

              if (logsIdentidade) {
                for (const log of logsIdentidade) {
                  const reqPayload = (log.request_payload || {}) as Record<string, unknown>;
                  const codigo = extractCodigoAssociado(log.response_payload);
                  if (!codigo) continue;

                  const nomeLog = String(reqPayload?.nome || '').trim().toLowerCase();
                  const emailLog = String(reqPayload?.email || '').trim().toLowerCase();
                  const cpfLog = cleanCPF(reqPayload?.cpf ? String(reqPayload.cpf) : null);
                  const telefoneLog = cleanPhoneDigits(
                    reqPayload?.celular ? String(reqPayload.celular) : (reqPayload?.telefone ? String(reqPayload.telefone) : null)
                  );

                  const cpfMatch = cpfLog.length === 11 && cpfAtual.length === 11 && cpfLog === cpfAtual;
                  const nomeMatch = !!nomeAtual && !!nomeLog && nomeLog === nomeAtual;
                  const emailMatch = !!emailAtual && !!emailLog && emailLog === emailAtual;
                  const telefoneMatch = !!telefoneAtual && !!telefoneLog && telefoneLog === telefoneAtual;

                  if (cpfMatch || (nomeMatch && emailMatch) || (nomeMatch && telefoneMatch)) {
                    codigoExistente = codigo;
                    console.log(`[SGA Sync] Código recuperado via logs de identidade: ${codigoExistente}`);
                    await logSync(
                      veiculo_id,
                      associado_id,
                      'recovery_cpf_diagnostico',
                      'success',
                      { metodo: 'logs_identidade', created_at_origem: log.created_at },
                      { codigo_associado: codigoExistente },
                      null
                    );
                    break;
                  }
                }
              }
            } catch (e) {
              console.log('[SGA Sync] Erro ao buscar código por logs de identidade:', e);
            }
          }

          // Estratégia 3: Busca por CPF com logging completo (diagnóstico)
          if (!codigoExistente) {
            const cpfLimpoRecovery = cleanCPF(associado.cpf);
            const cpfFormatadoRecovery = formatCPF(associado.cpf);

            const recoveryTentativas = [
              { label: 'Recovery GET buscar/cpf limpo', url: `${hinovaApiUrl}/associado/buscar/${cpfLimpoRecovery}/cpf`, method: 'GET' as const },
              { label: 'Recovery GET buscar/cpf formatado', url: `${hinovaApiUrl}/associado/buscar/${encodeURIComponent(cpfFormatadoRecovery)}/cpf`, method: 'GET' as const },
              { label: 'Recovery GET consultar/cpf', url: `${hinovaApiUrl}/associado/consultar/cpf/${cpfLimpoRecovery}`, method: 'GET' as const },
              { label: 'Recovery GET associado/cpf', url: `${hinovaApiUrl}/associado/${cpfLimpoRecovery}`, method: 'GET' as const },
              { label: 'Recovery POST consultar', url: `${hinovaApiUrl}/associado/consultar`, method: 'POST' as const, body: JSON.stringify({ cpf: cpfLimpoRecovery }) },
              { label: 'Recovery POST buscar', url: `${hinovaApiUrl}/associado/buscar`, method: 'POST' as const, body: JSON.stringify({ cpf: cpfLimpoRecovery }) },
              { label: 'Recovery POST pesquisar', url: `${hinovaApiUrl}/associado/pesquisar`, method: 'POST' as const, body: JSON.stringify({ cpf: cpfLimpoRecovery }) },
            ];

            const codigoContaNum = parseInt(hinovaCodigoConta || '', 10);
            if (Number.isFinite(codigoContaNum) && codigoContaNum > 0) {
              recoveryTentativas.push(
                {
                  label: 'Recovery GET buscar/cpf limpo + codigo_conta',
                  url: `${hinovaApiUrl}/associado/buscar/${cpfLimpoRecovery}/cpf?codigo_conta=${codigoContaNum}`,
                  method: 'GET' as const,
                },
                {
                  label: 'Recovery GET buscar/cpf formatado + codigo_conta',
                  url: `${hinovaApiUrl}/associado/buscar/${encodeURIComponent(cpfFormatadoRecovery)}/cpf?codigo_conta=${codigoContaNum}`,
                  method: 'GET' as const,
                }
              );
            }

            for (const t of recoveryTentativas) {
              if (codigoExistente) break;
              try {
                console.log(`[SGA Sync] ${t.label}...`);
                const resp = await fetchWithRetry(
                  t.url,
                  { method: t.method, headers: operationHeaders, ...(t.body && { body: t.body }) },
                  1
                );
                const ct = resp.headers.get('content-type') || '';
                const text = await resp.text();
                console.log(`[SGA Sync] ${t.label} - Status: ${resp.status}, CT: ${ct}, Body: ${text.substring(0, 500)}`);

                await logSync(
                  veiculo_id,
                  associado_id,
                  'recovery_cpf_diagnostico',
                  resp.ok ? 'success' : 'info',
                  { metodo: t.label, url: t.url },
                  { status: resp.status, content_type: ct, body_preview: text.substring(0, 500) },
                  resp.ok ? null : `Status ${resp.status}`
                );

                try {
                  const parsed = JSON.parse(text);
                  const codigo = extractCodigoAssociado(parsed);
                  if (codigo) {
                    codigoExistente = codigo;
                    console.log(`[SGA Sync] Recovery encontrou código ${codigoExistente} via ${t.label}`);
                  }
                } catch (_) {
                  // body não é JSON
                }
              } catch (e) {
                console.log(`[SGA Sync] ${t.label} falhou:`, e);
                await logSync(
                  veiculo_id,
                  associado_id,
                  'recovery_cpf_diagnostico',
                  'error',
                  { metodo: t.label },
                  null,
                  e instanceof Error ? e.message : 'Erro de rede'
                );
              }
            }
          }

          // Estratégia 4: Banco local
          if (!codigoExistente) {
            const { data: associadoLocal } = await supabase
              .from('associados')
              .select('codigo_hinova')
              .eq('cpf', associado.cpf)
              .not('codigo_hinova', 'is', null)
              .limit(1)
              .maybeSingle();

            if (associadoLocal?.codigo_hinova) {
              codigoExistente = associadoLocal.codigo_hinova;
              console.log(`[SGA Sync] Código recuperado do banco local: ${codigoExistente}`);
            }
          }

          if (codigoExistente) {
            await supabase.from('associados').update({
              codigo_hinova: codigoExistente,
              sincronizado_hinova: true,
              sincronizado_hinova_em: new Date().toISOString()
            }).eq('id', associado_id);

            codigoAssociadoHinova = codigoExistente;
            console.log(`[SGA Sync] Código existente recuperado: ${codigoAssociadoHinova}`);
          } else {
            await supabase.from('veiculos').update({ status_sga: 'erro_sincronizacao' }).eq('id', veiculo_id);
            await upsertSyncQueue(supabase, veiculo_id, associado_id, 'associado', 'CPF duplicado - não foi possível recuperar código');
            return new Response(
              JSON.stringify({
                success: false,
                error: 'CPF já cadastrado no Hinova mas não foi possível recuperar o código automaticamente.',
                step: 'associado',
                action_required: 'preencher_codigo_hinova_manual',
                details: {
                  cadastro: associadoData,
                  instrucoes: 'Preencha associados.codigo_hinova manualmente para este CPF e reprocessar a fila.'
                }
              }),
              { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          // Erro genérico
          await supabase.from('veiculos').update({ status_sga: 'erro_sincronizacao' }).eq('id', veiculo_id);
          await upsertSyncQueue(supabase, veiculo_id, associado_id, 'associado', `Falha cadastro: ${associadoData.mensagem}`);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Falha ao cadastrar associado: ${associadoData.mensagem}`,
              step: 'associado',
              details: associadoData
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        codigoAssociadoHinova = associadoData.codigo_associado;
        console.log(`[SGA Sync] Associado cadastrado - Código: ${codigoAssociadoHinova}`);

        await supabase.from('associados').update({ 
          codigo_hinova: codigoAssociadoHinova,
          sincronizado_hinova: true,
          sincronizado_hinova_em: new Date().toISOString()
        }).eq('id', associado_id);
      }
    } else {
      console.log(`[SGA Sync] Associado já sincronizado - Código: ${codigoAssociadoHinova}`);
    }

    // ========================================
    // PASSO 6: Validar e cadastrar veículo
    // ========================================
    console.log('[SGA Sync] Validando campos obrigatórios do veículo...');

    const camposObrigatorios: { campo: string; valor: string | null | undefined; label: string }[] = [
      { campo: 'placa', valor: veiculo.placa, label: 'PLACA' },
      { campo: 'renavam', valor: veiculo.renavam, label: 'RENAVAM' },
      { campo: 'chassi', valor: veiculo.chassi, label: 'CHASSI' },
    ];

    for (const { campo, valor, label } of camposObrigatorios) {
      if (!valor || valor.trim() === '') {
        const msg = `${label} é obrigatório para sincronização com SGA.`;
        await logSync(veiculo_id, associado_id, 'validar_veiculo', 'error', null, null, `${label} não informado`);
        await supabase.from('veiculos').update({ status_sga: 'erro_sincronizacao' }).eq('id', veiculo_id);
        await upsertSyncQueue(supabase, veiculo_id, associado_id, 'veiculo', `${label} não informado`, codigoAssociadoHinova);
        return new Response(
          JSON.stringify({ 
            success: false, error: msg,
            step: 'validacao_veiculo', campo_faltante: campo
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!hinovaCodigoVoluntario) {
      hinovaCodigoVoluntario = '1';
      console.warn('[SGA Sync] Código voluntário não configurado, usando padrão (1).');
    }

    const combustivelNormalizado = normalizarCombustivel(veiculo.combustivel);
    const tipoVeiculoInferido = inferirTipoVeiculo(contrato?.veiculo_categoria, veiculo.marca, veiculo.modelo);

    const veiculoPayload = {
      codigo_associado: codigoAssociadoHinova,
      placa: veiculo.placa || '',
      chassi: veiculo.chassi.trim(),
      renavam: veiculo.renavam.trim(),
      ano_fabricacao: veiculo.ano_fabricacao || veiculo.ano_modelo,
      ano_modelo: veiculo.ano_modelo,
      codigo_fipe: veiculo.codigo_fipe || '',
      valor_fipe: veiculo.valor_fipe || 0,
      kilometragem: 0,
      numero_motor: '',
      dia_vencimento: associado.dia_vencimento || 10,
      codigo_conta: parseInt(hinovaCodigoConta) || 1,
      codigo_cor: getMapeamento('cor', veiculo.cor),
      codigo_combustivel: getMapeamento('combustivel', combustivelNormalizado),
      codigo_tipo_veiculo: getMapeamento('tipo_veiculo', contrato?.veiculo_categoria?.toLowerCase()) || tipoVeiculoInferido,
      codigo_voluntario: parseInt(hinovaCodigoVoluntario),
      ...(hinovaCodigoCooperativa && { codigo_cooperativa: parseInt(hinovaCodigoCooperativa) }),
    };

    const veiculoResponse = await fetchWithRetry(
      `${hinovaApiUrl}/veiculo/cadastrar`,
      { method: 'POST', headers: operationHeaders, body: JSON.stringify(veiculoPayload) }
    );

    const veiculoData: HinovaVeiculoResponse = await safeJsonParse<HinovaVeiculoResponse>(veiculoResponse, 'cadastrar_veiculo');
    
    await logSync(veiculo_id, associado_id, 'cadastrar_veiculo', veiculoResponse.ok ? 'success' : 'error',
      veiculoPayload, veiculoData, veiculoResponse.ok ? null : veiculoData.mensagem);

    let codigoVeiculoHinova = veiculoData.codigo_veiculo;

    if (!veiculoResponse.ok) {
      console.log(`[SGA Sync] Resposta cadastrar_veiculo (${veiculoResponse.status}):`, JSON.stringify(veiculoData));
      const statusCode = veiculoResponse.status;
      const mensagem = veiculoData.mensagem?.toLowerCase() || '';
      const errorMessages: string[] = (veiculoData as any).error || [];
      
      // Check if this is a validation error (not a duplicate)
      const isValidationError = errorMessages.some((e: string) => 
        e.toLowerCase().includes('parâmetros inválidos') || 
        e.toLowerCase().includes('parametros invalidos') ||
        e.toLowerCase().includes('verifique o campo')
      );
      
      const isDuplicate = !isValidationError && (
        statusCode === 406 || mensagem.includes('já cadastrad') || mensagem.includes('duplicad') || mensagem.includes('existe')
      );
      
      if (isDuplicate) {
        console.log('[SGA Sync] Placa já cadastrada, tentando buscar código...');
        
        let codigoVeiculoExistente: number | null = null;

        // Estratégia 1: GET /veiculo/consultar/placa/{placa}
        try {
          const buscaResponse = await fetchWithRetry(
            `${hinovaApiUrl}/veiculo/consultar/placa/${veiculo.placa}`,
            { method: 'GET', headers: operationHeaders }
          );
          if (buscaResponse.ok) {
            const buscaData = await safeJsonParse<any>(buscaResponse, 'buscar_veiculo_placa');
            codigoVeiculoExistente = buscaData.codigo_veiculo || buscaData.codigo || 
              (buscaData.data && (Array.isArray(buscaData.data) ? buscaData.data[0]?.codigo_veiculo : buscaData.data.codigo_veiculo));
          }
        } catch (e) { console.log('[SGA Sync] Busca placa falhou:', e); }

        // Estratégia 2: Busca backup - veículos do associado
        if (!codigoVeiculoExistente && codigoAssociadoHinova) {
          try {
            const cpfLimpoVeiculo = cleanCPF(associado.cpf);
            let buscaResponse = await fetchWithRetry(
              `${hinovaApiUrl}/associado/buscar/${cpfLimpoVeiculo}/cpf`,
              { method: 'GET', headers: operationHeaders }
            );
            // Fallback: tentar com CPF formatado
            if (!buscaResponse.ok) {
              const cpfFormatadoVeiculo = formatCPF(associado.cpf);
              buscaResponse = await fetchWithRetry(
                `${hinovaApiUrl}/associado/buscar/${encodeURIComponent(cpfFormatadoVeiculo)}/cpf`,
                { method: 'GET', headers: operationHeaders }
              );
            }
            if (buscaResponse.ok) {
              const buscaData = await safeJsonParse<any>(buscaResponse, 'buscar_veiculo_via_associado');
              if (buscaData?.veiculos && Array.isArray(buscaData.veiculos)) {
                const veiculoEncontrado = buscaData.veiculos.find((v: any) => v.placa === veiculo.placa);
                if (veiculoEncontrado?.codigo_veiculo) {
                  codigoVeiculoExistente = parseInt(veiculoEncontrado.codigo_veiculo);
                }
              }
            }
          } catch (e) { console.log('[SGA Sync] Busca veículo via associado falhou:', e); }
        }

        // Estratégia 3: Logs anteriores
        if (!codigoVeiculoExistente) {
          try {
            const { data: logAnterior } = await supabase
              .from('sga_sync_logs')
              .select('response_payload')
              .eq('veiculo_id', veiculo_id)
              .eq('action', 'cadastrar_veiculo')
              .eq('status', 'success')
              .not('response_payload', 'is', null)
              .order('created_at', { ascending: false })
              .limit(5);
            
            if (logAnterior) {
              for (const log of logAnterior) {
                const resp = log.response_payload as any;
                if (resp?.codigo_veiculo) {
                  codigoVeiculoExistente = resp.codigo_veiculo;
                  break;
                }
              }
            }
          } catch (e) { console.log('[SGA Sync] Logs anteriores falhou:', e); }
        }

        // Estratégia 4: Banco local
        if (!codigoVeiculoExistente) {
          const { data: veiculoLocal } = await supabase
            .from('veiculos')
            .select('codigo_hinova')
            .eq('placa', veiculo.placa)
            .not('codigo_hinova', 'is', null)
            .limit(1)
            .maybeSingle();
          
          if (veiculoLocal?.codigo_hinova) {
            codigoVeiculoExistente = veiculoLocal.codigo_hinova;
          }
        }

        if (codigoVeiculoExistente) {
          codigoVeiculoHinova = codigoVeiculoExistente;
          console.log(`[SGA Sync] Código veículo recuperado: ${codigoVeiculoHinova}`);
        } else {
          // Preservar estado parcial
          if (codigoAssociadoHinova) {
            await supabase.from('associados').update({ 
              codigo_hinova: codigoAssociadoHinova,
              sincronizado_hinova: true,
              sincronizado_hinova_em: new Date().toISOString()
            }).eq('id', associado_id);
          }
          
          await supabase.from('veiculos').update({ status_sga: 'erro_sincronizacao' }).eq('id', veiculo_id);
          await upsertSyncQueue(supabase, veiculo_id, associado_id, 'veiculo', 'Placa duplicada - código não recuperado', codigoAssociadoHinova);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Placa já cadastrada no Hinova. Código não recuperado automaticamente.',
              step: 'veiculo',
              codigo_associado_hinova: codigoAssociadoHinova,
              details: veiculoData
            }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        // Erro genérico no veículo - preservar estado parcial do associado
        if (codigoAssociadoHinova) {
          await supabase.from('associados').update({ 
            codigo_hinova: codigoAssociadoHinova,
            sincronizado_hinova: true,
            sincronizado_hinova_em: new Date().toISOString()
          }).eq('id', associado_id);
        }
        await supabase.from('veiculos').update({ status_sga: 'erro_sincronizacao' }).eq('id', veiculo_id);
        await upsertSyncQueue(supabase, veiculo_id, associado_id, 'veiculo', `Falha cadastro veículo: ${veiculoData.mensagem}`, codigoAssociadoHinova);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Falha ao cadastrar veículo: ${veiculoData.mensagem}`,
            step: 'veiculo',
            details: veiculoData
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`[SGA Sync] Veículo processado - Código: ${codigoVeiculoHinova}`);

    // Atualizar veículo no banco
    await supabase.from('veiculos').update({ 
      codigo_hinova: codigoVeiculoHinova,
      sincronizado_hinova: true,
      sincronizado_hinova_em: new Date().toISOString(),
      status_sga: 'ativado_sga'
    }).eq('id', veiculo_id);

    // ========================================
    // PASSO 7: Buscar e enviar fotos
    // ========================================
    let fotosEnviadas = 0;
    const fotosComErro: string[] = [];

    const { data: documentos } = await supabase
      .from('documentos')
      .select('*')
      .or(`associado_id.eq.${associado_id},veiculo_id.eq.${veiculo_id}`)
      .eq('status', 'aprovado');

    if (documentos && documentos.length > 0 && codigoVeiculoHinova) {
      console.log(`[SGA Sync] Enviando ${documentos.length} documentos/fotos...`);

      const batchSize = 50;
      for (let i = 0; i < documentos.length; i += batchSize) {
        const batch = documentos.slice(i, i + batchSize);
        
        const fotos = batch.map(doc => {
          const tipoFoto = getMapeamento('tipo_foto', doc.tipo) || 1;
          return {
            nome_arquivo: doc.nome_arquivo || `documento_${doc.id}.jpg`,
            codigo_tipo: tipoFoto,
            link: doc.url_arquivo || doc.arquivo_url
          };
        }).filter(f => f.link);

        if (fotos.length === 0) continue;

        try {
          const fotosResponse = await fetchWithRetry(
            `${hinovaApiUrl}/veiculo/foto/cadastrar`,
            {
              method: 'POST',
              headers: operationHeaders,
              body: JSON.stringify({
                codigo_veiculo: codigoVeiculoHinova,
                foto: fotos
              })
            }
          );

          const fotosData = await safeJsonParse<any>(fotosResponse, 'enviar_fotos');
          
          await logSync(veiculo_id, associado_id, 'enviar_fotos', fotosResponse.ok ? 'success' : 'error',
            { codigo_veiculo: codigoVeiculoHinova, qtd_fotos: fotos.length }, fotosData, 
            fotosResponse.ok ? null : fotosData.mensagem);

          if (fotosResponse.ok) {
            fotosEnviadas += fotos.length;
          } else {
            fotosComErro.push(...fotos.map(f => f.nome_arquivo));
          }
        } catch (e) {
          console.error('[SGA Sync] Erro ao enviar lote de fotos:', e);
          fotosComErro.push(...batch.map(d => d.nome_arquivo || d.id));
        }
      }
    }

    // Se houve erro nas fotos, gravar na fila para reenvio
    if (fotosComErro.length > 0 && fotosEnviadas === 0) {
      await upsertSyncQueue(supabase, veiculo_id, associado_id, 'fotos', 
        `Erro ao enviar ${fotosComErro.length} fotos`, codigoAssociadoHinova, codigoVeiculoHinova);
    } else {
      // Tudo OK - marcar fila como concluída
      await markQueueCompleted(supabase, veiculo_id, associado_id);
    }

    console.log(`[SGA Sync] Sincronização concluída! Fotos: ${fotosEnviadas}, Erros: ${fotosComErro.length}`);

    await logSync(veiculo_id, associado_id, 'sync_completo', 'success', null, {
      codigo_associado_hinova: codigoAssociadoHinova,
      codigo_veiculo_hinova: codigoVeiculoHinova,
      fotos_enviadas: fotosEnviadas,
      fotos_com_erro: fotosComErro.length
    }, null);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          codigo_associado_hinova: codigoAssociadoHinova,
          codigo_veiculo_hinova: codigoVeiculoHinova,
          fotos_enviadas: fotosEnviadas,
          fotos_com_erro: fotosComErro
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SGA Sync] Erro inesperado:', error);

    // Tentar gravar na fila mesmo em erro inesperado
    try {
      const body = await req.clone().json().catch(() => ({}));
      if (body.veiculo_id && body.associado_id) {
        await upsertSyncQueue(supabase, body.veiculo_id, body.associado_id, 'associado', 
          error instanceof Error ? error.message : 'Erro inesperado');
      }
    } catch (_) {}
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro interno',
        step: 'unknown'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

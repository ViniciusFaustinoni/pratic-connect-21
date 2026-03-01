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
      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      console.log(`[Retry ${i + 1}/${maxRetries}] Aguardando ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Helper para parse seguro de JSON - trata respostas não-JSON (HTML, texto de erro, etc.)
async function safeJsonParse<T>(response: Response, context: string): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const textResponse = await response.text();
  
  // Log para debug
  console.log(`[SGA Sync] ${context} - Status: ${response.status}, Content-Type: ${contentType}`);
  
  // Se não é JSON, tentar identificar o tipo de erro
  if (!contentType.includes('application/json')) {
    console.error(`[SGA Sync] ${context} - Resposta não-JSON recebida:`, textResponse.substring(0, 300));
    
    // Verificar se é HTML (página de erro, login, etc.)
    if (textResponse.trim().startsWith('<!') || textResponse.includes('<html')) {
      throw new Error(`API Hinova retornou HTML ao invés de JSON. Isso geralmente indica: erro de servidor, redirecionamento de autenticação ou rate limiting. Status: ${response.status}`);
    }
    
    // Verificar se é erro de conexão ou texto genérico
    if (textResponse.toLowerCase().includes('erro') || textResponse.toLowerCase().includes('error')) {
      throw new Error(`Erro da API Hinova: ${textResponse.substring(0, 200)}`);
    }
    
    throw new Error(`Resposta inesperada da API Hinova (${contentType}): ${textResponse.substring(0, 200)}`);
  }
  
  // Tentar fazer parse do JSON
  try {
    return JSON.parse(textResponse) as T;
  } catch (parseError) {
    console.error(`[SGA Sync] ${context} - Erro ao parsear JSON:`, textResponse.substring(0, 300));
    throw new Error(`Resposta inválida da API Hinova - não é JSON válido: ${textResponse.substring(0, 100)}`);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  // Supabase client
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

      // Derivar chave e descriptografar
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

  // Hinova credentials - primeiro tenta ENV, depois banco
  let hinovaApiUrl = Deno.env.get('HINOVA_API_URL') || 'https://api.hinova.com.br/api/sga/v2';
  let hinovaToken = Deno.env.get('HINOVA_TOKEN');
  let hinovaUsuario = Deno.env.get('HINOVA_USUARIO');
  let hinovaSenha = Deno.env.get('HINOVA_SENHA');
  let hinovaCodigoConta = Deno.env.get('HINOVA_CODIGO_CONTA') || '1';
  let hinovaCodigoRegional = Deno.env.get('HINOVA_CODIGO_REGIONAL');
  let hinovaCodigoCooperativa = Deno.env.get('HINOVA_CODIGO_COOPERATIVA');
  let hinovaCodigoVoluntario = Deno.env.get('HINOVA_CODIGO_VOLUNTARIO');

  // Se não tiver nas ENV, buscar do banco
  if (!hinovaToken || !hinovaUsuario || !hinovaSenha) {
    console.log('[SGA Sync] Credenciais não encontradas em ENV, buscando do banco...');
    const credBanco = await getCredenciaisBanco('hinova');
    if (credBanco) {
      hinovaToken = credBanco.token || hinovaToken;
      hinovaUsuario = credBanco.usuario || hinovaUsuario;
      hinovaSenha = credBanco.senha || hinovaSenha;
      hinovaCodigoConta = credBanco.codigo_conta || hinovaCodigoConta;
      hinovaCodigoRegional = credBanco.codigo_regional || hinovaCodigoRegional;
      hinovaCodigoCooperativa = credBanco.codigo_cooperativa || hinovaCodigoCooperativa;
      hinovaCodigoVoluntario = credBanco.codigo_voluntario || hinovaCodigoVoluntario;
      if (credBanco.api_url) hinovaApiUrl = credBanco.api_url;
      console.log('[SGA Sync] Credenciais carregadas do banco');
    }
  }

  // Log do token (apenas primeiros caracteres para debug)
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

  // Headers para autenticação (com Bearer token)
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${hinovaToken}`,
  };
  
  // NOTA: Todas as requisições usam authHeaders com Authorization: Bearer

  try {
    // Validar credenciais
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

    // Parse request body
    const requestBody = await req.json();
    const { veiculo_id, associado_id, action } = requestBody as SyncRequest & { action?: string };

    // ========================================
    // MODO TESTE DE CONEXÃO (apenas autenticação)
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

      console.log('[SGA Sync] Teste de conexão bem-sucedido!');
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

    // Atualizar status do veículo para sincronizando
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

    // ========================================
    // PASSO 3.5: Buscar código voluntário do vendedor responsável
    // Prioridade: código do vendedor > código global da integração
    // ========================================
    console.log('[SGA Sync] Buscando código voluntário do vendedor...');
    
    // Primeiro, buscar o contrato associado para encontrar o vendedor_id
    const { data: contrato } = await supabase
      .from('contratos')
      .select('vendedor_id')
      .eq('associado_id', associado_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (contrato?.vendedor_id) {
      console.log(`[SGA Sync] Vendedor do contrato: ${contrato.vendedor_id}`);
      
      // Buscar o código SGA do vendedor
      const { data: vendedor } = await supabase
        .from('profiles')
        .select('codigo_sga_voluntario, nome')
        .eq('id', contrato.vendedor_id)
        .single();
      
      if (vendedor?.codigo_sga_voluntario) {
        hinovaCodigoVoluntario = vendedor.codigo_sga_voluntario;
        console.log(`[SGA Sync] Usando código voluntário do vendedor ${vendedor.nome}: ${hinovaCodigoVoluntario}`);
      } else {
        console.log(`[SGA Sync] Vendedor ${vendedor?.nome || 'desconhecido'} não possui código SGA configurado, usando fallback global`);
      }
    } else {
      console.log('[SGA Sync] Contrato sem vendedor_id, usando código global da integração');
    }

    // NOVO: Fallback - buscar qualquer vendedor ativo com codigo configurado
    if (!hinovaCodigoVoluntario) {
      console.log('[SGA Sync] Código voluntário não encontrado no vendedor nem global, buscando fallback...');
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
    
    const authPayload = {
      usuario: hinovaUsuario,
      senha: hinovaSenha
    };

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

    // ========================================
    // HEADERS PARA OPERAÇÕES (usa token_usuario dinâmico)
    // Baseado no fluxo que funciona em hinova-integration
    // ========================================
    const operationHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenUsuario}`,
    };
    console.log('[SGA Sync] Headers de operação configurados com token_usuario');

    // ========================================
    // PASSO 5: Cadastrar ou buscar associado
    // ========================================
    let codigoAssociadoHinova = associado.codigo_hinova;

    if (!codigoAssociadoHinova) {
      console.log('[SGA Sync] Cadastrando associado no Hinova...');
      
      // Payload SEM credenciais - autenticação já está no header com token_usuario
      // NOTA: Removido codigo_conta pois a API retorna "O campo CONTA BANCÁRIA não está homologado"
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
        codigo_conta: 2, // Fixo = 2 (API) conforme orientação
        ...(hinovaCodigoRegional && { codigo_regional: parseInt(hinovaCodigoRegional) }),
        ...(hinovaCodigoCooperativa && { codigo_cooperativa: parseInt(hinovaCodigoCooperativa) }),
        ...(hinovaCodigoVoluntario && { codigo_voluntario: parseInt(hinovaCodigoVoluntario) }),
      };
      
      // ===== DEBUG - NOVO FLUXO COM token_usuario NO HEADER =====
      console.log('[SGA Sync] ===== DEBUG CADASTRO ASSOCIADO (FLUXO CORRIGIDO) =====');
      console.log('[SGA Sync] URL:', `${hinovaApiUrl}/associado/cadastrar`);
      console.log('[SGA Sync] Method: POST');
      console.log('[SGA Sync] Headers: Authorization: Bearer {token_usuario} (dinâmico)');
      console.log('[SGA Sync] token_usuario usado no header:', `${tokenUsuario.slice(0, 15)}... (${tokenUsuario.length} chars)`);
      console.log('[SGA Sync] Body keys (SEM credenciais):', Object.keys(associadoPayload));
      console.log('[SGA Sync] ============================================');

      const associadoResponse = await fetchWithRetry(
        `${hinovaApiUrl}/associado/cadastrar`,
        {
          method: 'POST',
          headers: operationHeaders,  // USA token_usuario NO HEADER
          body: JSON.stringify(associadoPayload)
        }
      );

      // ===== DEBUG RESPONSE =====
      console.log('[SGA Sync] ===== DEBUG RESPONSE CADASTRO =====');
      console.log('[SGA Sync] Status:', associadoResponse.status);
      console.log('[SGA Sync] Status Text:', associadoResponse.statusText);
      
      const associadoData: HinovaAssociadoResponse = await safeJsonParse<HinovaAssociadoResponse>(associadoResponse, 'cadastrar_associado');
      
      console.log('[SGA Sync] Response Body:', JSON.stringify(associadoData));
      console.log('[SGA Sync] =====================================');
      
      await logSync(veiculo_id, associado_id, 'cadastrar_associado', associadoResponse.ok ? 'success' : 'error',
        { ...associadoPayload, cpf: '***' }, associadoData, associadoResponse.ok ? null : associadoData.mensagem);

      if (!associadoResponse.ok) {
        // Verificar se é erro de Token Bearer inválido (a autenticação do usuário funcionou, então é o token da API)
        const errorMessages = (associadoData as any).error || [];
        const isTokenBearerError = 
          (associadoData.mensagem?.toLowerCase().includes('token de acesso') ||
           associadoData.mensagem?.toLowerCase().includes('acesso não autorizado') ||
           errorMessages.some((e: string) => 
             e.toLowerCase().includes('login') || 
             e.toLowerCase().includes('senha') ||
             e.toLowerCase().includes('autorizado')
           ));

        // Se a autenticação do usuário funcionou (temos token_usuario) mas o cadastro falhou com erro de login/senha,
        // o problema é o Token Bearer no header Authorization
        if (isTokenBearerError && tokenUsuario) {
          console.log('[SGA Sync] Erro de Token Bearer detectado - autenticação OK mas cadastro falhou');
          await supabase.from('veiculos').update({ status_sga: 'erro_sincronizacao' }).eq('id', veiculo_id);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Token Bearer da API Hinova inválido ou expirado. Gere um novo token no painel SGA Hinova e atualize em Configurações > Integrações.',
              step: 'associado',
              action_required: 'update_bearer_token',
              details: associadoData
            }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verificar se é erro de CPF duplicado - tentar buscar associado existente
        const isCpfDuplicado = 
          (associadoData.mensagem?.toLowerCase().includes('cpf') && 
           associadoData.mensagem?.toLowerCase().includes('exist')) ||
          errorMessages.some((e: string) => 
            e.toLowerCase().includes('cpf') && e.toLowerCase().includes('exist')
          );
        
        if (isCpfDuplicado) {
          console.log('[SGA Sync] CPF já existe no Hinova, buscando código do associado existente...');
          
          const buscaCpf = cleanCPF(associado.cpf);
          let codigoExistente: number | null = null;
          
          // ========================================
          // ESTRATÉGIA 1: Buscar código em logs anteriores de cadastro bem-sucedido
          // ========================================
          console.log('[SGA Sync] Estratégia 1: Buscando código em logs anteriores...');
          try {
            const { data: logAnterior } = await supabase
              .from('sga_sync_logs')
              .select('response_payload')
              .eq('action', 'cadastrar_associado')
              .eq('status', 'success')
              .not('response_payload', 'is', null)
              .order('created_at', { ascending: false })
              .limit(50);
            
            // Procurar log que tenha codigo_associado na resposta
            if (logAnterior && logAnterior.length > 0) {
              for (const log of logAnterior) {
                const respPayload = log.response_payload as any;
                if (respPayload?.codigo_associado) {
                  console.log(`[SGA Sync] Encontrado log com codigo_associado: ${respPayload.codigo_associado}`);
                  codigoExistente = respPayload.codigo_associado;
                  break;
                }
              }
            }
            
            if (codigoExistente) {
              console.log(`[SGA Sync] Código recuperado de log anterior: ${codigoExistente}`);
            }
          } catch (logError) {
            console.log('[SGA Sync] Erro ao buscar logs anteriores:', logError);
          }
          
          // ========================================
          // ESTRATÉGIA 2: Tentar endpoints alternativos da API Hinova
          // ========================================
          if (!codigoExistente) {
            console.log('[SGA Sync] Estratégia 2: Tentando endpoints alternativos da API...');
            
            // Endpoint 2a: POST /associado/consultar com body { cpf }
            try {
              console.log('[SGA Sync] Tentando POST /associado/consultar...');
              const buscaResponse1 = await fetchWithRetry(
                `${hinovaApiUrl}/associado/consultar`,
                {
                  method: 'POST',
                  headers: operationHeaders,
                  body: JSON.stringify({ cpf: buscaCpf })
                }
              );
              
              if (buscaResponse1.ok) {
                const buscaData1 = await safeJsonParse<any>(buscaResponse1, 'buscar_associado_post');
                console.log('[SGA Sync] Resposta POST /associado/consultar:', JSON.stringify(buscaData1));
                codigoExistente = buscaData1?.codigo_associado || buscaData1?.codigo || buscaData1?.data?.codigo_associado || null;
              }
            } catch (e) {
              console.log('[SGA Sync] POST /associado/consultar falhou:', e);
            }
            
            // Endpoint 2b: GET /associado?cpf=xxx (query param)
            if (!codigoExistente) {
              try {
                console.log('[SGA Sync] Tentando GET /associado?cpf=...');
                const buscaResponse2 = await fetchWithRetry(
                  `${hinovaApiUrl}/associado?cpf=${buscaCpf}`,
                  {
                    method: 'GET',
                    headers: operationHeaders,
                  }
                );
                
                if (buscaResponse2.ok) {
                  const buscaData2 = await safeJsonParse<any>(buscaResponse2, 'buscar_associado_query');
                  console.log('[SGA Sync] Resposta GET /associado?cpf=:', JSON.stringify(buscaData2));
                  codigoExistente = buscaData2?.codigo_associado || buscaData2?.codigo || buscaData2?.data?.codigo_associado || null;
                }
              } catch (e) {
                console.log('[SGA Sync] GET /associado?cpf= falhou:', e);
              }
            }
            
            // Endpoint 2c: GET /associados/cpf/{cpf} (rota alternativa)
            if (!codigoExistente) {
              try {
                console.log('[SGA Sync] Tentando GET /associados/cpf/...');
                const buscaResponse3 = await fetchWithRetry(
                  `${hinovaApiUrl}/associados/cpf/${buscaCpf}`,
                  {
                    method: 'GET',
                    headers: operationHeaders,
                  }
                );
                
                if (buscaResponse3.ok) {
                  const buscaData3 = await safeJsonParse<any>(buscaResponse3, 'buscar_associado_path');
                  console.log('[SGA Sync] Resposta GET /associados/cpf/:', JSON.stringify(buscaData3));
                  codigoExistente = buscaData3?.codigo_associado || buscaData3?.codigo || buscaData3?.data?.codigo_associado || null;
                }
              } catch (e) {
                console.log('[SGA Sync] GET /associados/cpf/ falhou:', e);
              }
            }
          }
          
          // ========================================
          // ESTRATÉGIA 3: Buscar diretamente no banco local se já foi sincronizado antes
          // ========================================
          if (!codigoExistente) {
            console.log('[SGA Sync] Estratégia 3: Buscando código no banco local pelo CPF...');
            const { data: associadoLocal } = await supabase
              .from('associados')
              .select('codigo_hinova')
              .eq('cpf', associado.cpf)
              .not('codigo_hinova', 'is', null)
              .limit(1)
              .single();
            
            if (associadoLocal?.codigo_hinova) {
              codigoExistente = associadoLocal.codigo_hinova;
              console.log(`[SGA Sync] Código encontrado no banco local: ${codigoExistente}`);
            }
          }
          
          // Verificar se conseguimos encontrar o código
          if (codigoExistente) {
            console.log(`[SGA Sync] Associado encontrado - Código: ${codigoExistente}`);
            
            // Atualizar o associado local com o código do Hinova
            await supabase
              .from('associados')
              .update({ 
                codigo_hinova: codigoExistente,
                sincronizado_hinova: true,
                sincronizado_hinova_em: new Date().toISOString()
              })
              .eq('id', associado_id);
            
            // Usar o código encontrado para continuar o fluxo
            codigoAssociadoHinova = codigoExistente;
            console.log(`[SGA Sync] Usando código existente: ${codigoAssociadoHinova}`);
            
            await logSync(veiculo_id, associado_id, 'recuperar_codigo_existente', 'success', 
              { cpf: '***', estrategia: 'fallback' }, { codigo_associado: codigoExistente }, null);
          } else {
            console.log('[SGA Sync] Não foi possível recuperar o código do associado por nenhuma estratégia');
            await supabase.from('veiculos').update({ status_sga: 'erro_sincronizacao' }).eq('id', veiculo_id);
            
            await logSync(veiculo_id, associado_id, 'recuperar_codigo_existente', 'error', 
              { cpf: '***' }, null, 'Não foi possível recuperar código do associado existente');
            
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'CPF já cadastrado no Hinova mas não foi possível recuperar o código automaticamente. Entre em contato com o suporte ou informe o código manualmente.',
                step: 'associado',
                details: { cadastro: associadoData }
              }),
              { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          // Erro genérico (não é CPF duplicado)
          await supabase.from('veiculos').update({ status_sga: 'erro_sincronizacao' }).eq('id', veiculo_id);
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
        // Sucesso no cadastro - extrair código
        codigoAssociadoHinova = associadoData.codigo_associado;
        console.log(`[SGA Sync] Associado cadastrado - Código Hinova: ${codigoAssociadoHinova}`);

        // Atualizar código no banco local
        await supabase
          .from('associados')
          .update({ 
            codigo_hinova: codigoAssociadoHinova,
            sincronizado_hinova: true,
            sincronizado_hinova_em: new Date().toISOString()
          })
          .eq('id', associado_id);
      }
    } else {
      console.log(`[SGA Sync] Associado já sincronizado - Código Hinova: ${codigoAssociadoHinova}`);
    }

    // ========================================
    // PASSO 6: Validar campos obrigatórios e cadastrar veículo
    // ========================================
    console.log('[SGA Sync] Validando campos obrigatórios do veículo...');

    // CORREÇÃO: Validar RENAVAM e CHASSI antes de enviar (campos obrigatórios na Hinova)
    if (!veiculo.renavam || veiculo.renavam.trim() === '') {
      await logSync(veiculo_id, associado_id, 'validar_veiculo', 'error', null, null, 'RENAVAM não informado');
      await supabase.from('veiculos').update({ status_sga: 'erro_sincronizacao' }).eq('id', veiculo_id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'RENAVAM é obrigatório para sincronização com SGA. Preencha o campo e tente novamente.',
          step: 'validacao_veiculo',
          campo_faltante: 'renavam'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!veiculo.chassi || veiculo.chassi.trim() === '') {
      await logSync(veiculo_id, associado_id, 'validar_veiculo', 'error', null, null, 'CHASSI não informado');
      await supabase.from('veiculos').update({ status_sga: 'erro_sincronizacao' }).eq('id', veiculo_id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'CHASSI é obrigatório para sincronização com SGA. Preencha o campo e tente novamente.',
          step: 'validacao_veiculo',
          campo_faltante: 'chassi'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // VALIDAÇÃO: Código Voluntário - usar padrão se não encontrado (não bloquear)
    if (!hinovaCodigoVoluntario) {
      hinovaCodigoVoluntario = '1';
      console.warn('[SGA Sync] AVISO: código voluntário não configurado em nenhum lugar. Usando valor padrão (1).');
      await logSync(veiculo_id, associado_id, 'validar_config', 'warning', null, null, 'Código Voluntário não configurado - usando padrão (1)');
    }

    console.log('[SGA Sync] Cadastrando veículo no Hinova...');
    console.log(`[SGA Sync] codigo_voluntario configurado: ${hinovaCodigoVoluntario}`);

    // Payload SEM credenciais - autenticação já está no header com token_usuario
    const veiculoPayload = {
      codigo_associado: codigoAssociadoHinova,
      placa: veiculo.placa || '',
      chassi: veiculo.chassi.trim(),
      renavam: veiculo.renavam.trim(),
      ano_fabricacao: veiculo.ano_fabricacao || veiculo.ano_modelo,
      ano_modelo: veiculo.ano_modelo,
      codigo_fipe: veiculo.codigo_fipe || '',
      valor_fipe: veiculo.valor_fipe || 0,
      kilometragem: veiculo.km || veiculo.quilometragem || 0,
      numero_motor: veiculo.numero_motor || '',
      dia_vencimento: associado.dia_vencimento || 10,
      codigo_conta: 2, // Fixo = 2 (API) conforme orientação
      codigo_cor: getMapeamento('cor', veiculo.cor),
      codigo_combustivel: getMapeamento('combustivel', veiculo.combustivel),
      codigo_tipo_veiculo: getMapeamento('tipo_veiculo', veiculo.tipo) || 1,
      codigo_voluntario: parseInt(hinovaCodigoVoluntario), // OBRIGATÓRIO
      ...(hinovaCodigoCooperativa && { codigo_cooperativa: parseInt(hinovaCodigoCooperativa) }),
    };

    const veiculoResponse = await fetchWithRetry(
      `${hinovaApiUrl}/veiculo/cadastrar`,
      {
        method: 'POST',
        headers: operationHeaders,  // USA token_usuario NO HEADER
        body: JSON.stringify(veiculoPayload)
      }
    );

    const veiculoData: HinovaVeiculoResponse = await safeJsonParse<HinovaVeiculoResponse>(veiculoResponse, 'cadastrar_veiculo');
    
    await logSync(veiculo_id, associado_id, 'cadastrar_veiculo', veiculoResponse.ok ? 'success' : 'error',
      veiculoPayload, veiculoData, veiculoResponse.ok ? null : veiculoData.mensagem);

    let codigoVeiculoHinova = veiculoData.codigo_veiculo;

    // CORREÇÃO: Tratar placa duplicada similar ao CPF
    if (!veiculoResponse.ok) {
      const statusCode = veiculoResponse.status;
      const mensagem = veiculoData.mensagem?.toLowerCase() || '';
      
      // Verificar se é erro de duplicidade (placa já existe)
      if (statusCode === 406 || mensagem.includes('já cadastrad') || mensagem.includes('duplicad') || mensagem.includes('existe')) {
        console.log('[SGA Sync] Placa já cadastrada no Hinova, tentando buscar código existente...');
        
        let codigoVeiculoExistente: number | null = null;

        // ESTRATÉGIA 1: GET /veiculo/consultar/placa/{placa}
        try {
          console.log('[SGA Sync] Estratégia 1: GET /veiculo/consultar/placa/...');
          const buscaResponse = await fetchWithRetry(
            `${hinovaApiUrl}/veiculo/consultar/placa/${veiculo.placa}`,
            { method: 'GET', headers: operationHeaders }
          );
          if (buscaResponse.ok) {
            const buscaData = await safeJsonParse<any>(buscaResponse, 'buscar_veiculo_placa');
            console.log('[SGA Sync] Resultado busca por placa:', JSON.stringify(buscaData));
            codigoVeiculoExistente = buscaData.codigo_veiculo || buscaData.codigo || 
                                     (buscaData.data && (Array.isArray(buscaData.data) ? buscaData.data[0]?.codigo_veiculo : buscaData.data.codigo_veiculo));
          } else {
            const errText = await buscaResponse.text();
            console.log(`[SGA Sync] Estratégia 1 falhou (${buscaResponse.status}):`, errText.substring(0, 200));
          }
        } catch (e) {
          console.log('[SGA Sync] Estratégia 1 erro:', e);
        }

        // ESTRATÉGIA 2: POST /veiculo/consultar com body { placa }
        if (!codigoVeiculoExistente) {
          try {
            console.log('[SGA Sync] Estratégia 2: POST /veiculo/consultar...');
            const buscaResponse2 = await fetchWithRetry(
              `${hinovaApiUrl}/veiculo/consultar`,
              { method: 'POST', headers: operationHeaders, body: JSON.stringify({ placa: veiculo.placa }) }
            );
            if (buscaResponse2.ok) {
              const buscaData2 = await safeJsonParse<any>(buscaResponse2, 'buscar_veiculo_post');
              console.log('[SGA Sync] Resultado POST consultar:', JSON.stringify(buscaData2));
              codigoVeiculoExistente = buscaData2.codigo_veiculo || buscaData2.codigo || 
                                       (buscaData2.data && (Array.isArray(buscaData2.data) ? buscaData2.data[0]?.codigo_veiculo : buscaData2.data.codigo_veiculo));
            }
          } catch (e) {
            console.log('[SGA Sync] Estratégia 2 falhou:', e);
          }
        }

        // ESTRATÉGIA 3: Buscar em logs anteriores de sincronização bem-sucedida
        if (!codigoVeiculoExistente) {
          console.log('[SGA Sync] Estratégia 3: Buscando código em logs anteriores...');
          try {
            const { data: logAnterior } = await supabase
              .from('sga_sync_logs')
              .select('response_payload')
              .eq('action', 'cadastrar_veiculo')
              .eq('status', 'success')
              .not('response_payload', 'is', null)
              .order('created_at', { ascending: false })
              .limit(50);
            
            if (logAnterior) {
              for (const log of logAnterior) {
                const resp = log.response_payload as any;
                if (resp?.codigo_veiculo) {
                  codigoVeiculoExistente = resp.codigo_veiculo;
                  console.log(`[SGA Sync] Código encontrado em log: ${codigoVeiculoExistente}`);
                  break;
                }
              }
            }
          } catch (e) {
            console.log('[SGA Sync] Estratégia 3 falhou:', e);
          }
        }

        // ESTRATÉGIA 4: Buscar no banco local por placa
        if (!codigoVeiculoExistente) {
          console.log('[SGA Sync] Estratégia 4: Buscando código no banco local pela placa...');
          const { data: veiculoLocal } = await supabase
            .from('veiculos')
            .select('codigo_hinova')
            .eq('placa', veiculo.placa)
            .not('codigo_hinova', 'is', null)
            .limit(1)
            .maybeSingle();
          
          if (veiculoLocal?.codigo_hinova) {
            codigoVeiculoExistente = veiculoLocal.codigo_hinova;
            console.log(`[SGA Sync] Código encontrado no banco local: ${codigoVeiculoExistente}`);
          }
        }

        // Resultado final
        if (codigoVeiculoExistente) {
          codigoVeiculoHinova = codigoVeiculoExistente;
          console.log(`[SGA Sync] Código do veículo existente recuperado: ${codigoVeiculoHinova}`);
          await logSync(veiculo_id, associado_id, 'buscar_veiculo_existente', 'success', 
            { placa: veiculo.placa }, { codigo_veiculo: codigoVeiculoExistente }, null);
        } else {
          console.log('[SGA Sync] Não foi possível recuperar o código do veículo por nenhuma estratégia');
          await supabase.from('veiculos').update({ status_sga: 'erro_sincronizacao' }).eq('id', veiculo_id);
          await logSync(veiculo_id, associado_id, 'buscar_veiculo_existente', 'error', 
            { placa: veiculo.placa }, veiculoData, 'Não foi possível recuperar código do veículo existente');
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Placa já cadastrada no Hinova. Não foi possível recuperar o código automaticamente. Verifique no painel Hinova o código do veículo.',
              step: 'veiculo',
              details: veiculoData
            }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        // Erro genérico (não é placa duplicada)
        await supabase.from('veiculos').update({ status_sga: 'erro_sincronizacao' }).eq('id', veiculo_id);
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

    console.log(`[SGA Sync] Veículo processado - Código Hinova: ${codigoVeiculoHinova}`);

    // Atualizar veículo no banco local
    await supabase
      .from('veiculos')
      .update({ 
        codigo_hinova: codigoVeiculoHinova,
        sincronizado_hinova: true,
        sincronizado_hinova_em: new Date().toISOString(),
        status_sga: 'ativado_sga'
      })
      .eq('id', veiculo_id);

    // ========================================
    // PASSO 7: Buscar e enviar fotos/documentos
    // ========================================
    let fotosEnviadas = 0;
    const fotosComErro: string[] = [];

    // Buscar documentos do associado e veículo
    const { data: documentos } = await supabase
      .from('documentos')
      .select('*')
      .or(`associado_id.eq.${associado_id},veiculo_id.eq.${veiculo_id}`)
      .eq('status', 'aprovado');

    if (documentos && documentos.length > 0 && codigoVeiculoHinova) {
      console.log(`[SGA Sync] Enviando ${documentos.length} documentos/fotos...`);

      // Processar em lotes de 50
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
          // Payload SEM credenciais - autenticação já está no header com token_usuario
          const fotosResponse = await fetchWithRetry(
            `${hinovaApiUrl}/veiculo/foto/cadastrar`,
            {
              method: 'POST',
              headers: operationHeaders,  // USA token_usuario NO HEADER
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

    console.log(`[SGA Sync] Sincronização concluída! Fotos enviadas: ${fotosEnviadas}, Com erro: ${fotosComErro.length}`);

    // Log final de sucesso
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

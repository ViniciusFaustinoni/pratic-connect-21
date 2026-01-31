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

      const authData: HinovaAuthResponse = await authResponse.json();
      
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

    const authData: HinovaAuthResponse = await authResponse.json();
    
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
    // PASSO 5: Cadastrar ou buscar associado
    // ========================================
    let codigoAssociadoHinova = associado.codigo_hinova;

    if (!codigoAssociadoHinova) {
      console.log('[SGA Sync] Cadastrando associado no Hinova...');
      
      // API Hinova v2: Authorization: Bearer no header + token_usuario no body (SEM usuario/senha)
      const associadoPayload = {
        token_usuario: tokenUsuario,
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
        codigo_conta: parseInt(hinovaCodigoConta),
        ...(hinovaCodigoRegional && { codigo_regional: parseInt(hinovaCodigoRegional) }),
        ...(hinovaCodigoCooperativa && { codigo_cooperativa: parseInt(hinovaCodigoCooperativa) }),
        ...(hinovaCodigoVoluntario && { codigo_voluntario: parseInt(hinovaCodigoVoluntario) }),
      };
      
      console.log('[SGA Sync] Payload associado:', JSON.stringify({ ...associadoPayload, token_usuario: '***' }));

      const associadoResponse = await fetchWithRetry(
        `${hinovaApiUrl}/associado/cadastrar`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(associadoPayload)
        }
      );

      const associadoData: HinovaAssociadoResponse = await associadoResponse.json();
      
      await logSync(veiculo_id, associado_id, 'cadastrar_associado', associadoResponse.ok ? 'success' : 'error',
        { ...associadoPayload, cpf: '***' }, associadoData, associadoResponse.ok ? null : associadoData.mensagem);

      if (!associadoResponse.ok) {
        // Verificar se é erro de CPF duplicado
        if (associadoData.mensagem?.toLowerCase().includes('cpf') && 
            associadoData.mensagem?.toLowerCase().includes('exist')) {
          console.log('[SGA Sync] CPF já existe no Hinova, tentando buscar código...');
          // Aqui idealmente buscaria o código existente via API de consulta
          // Por agora, retornar erro orientando verificação manual
          await supabase.from('veiculos').update({ status_sga: 'erro_sincronizacao' }).eq('id', veiculo_id);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'CPF já cadastrado no Hinova. Verifique o código do associado manualmente.',
              step: 'associado',
              details: associadoData
            }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

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
    } else {
      console.log(`[SGA Sync] Associado já sincronizado - Código Hinova: ${codigoAssociadoHinova}`);
    }

    // ========================================
    // PASSO 6: Cadastrar veículo
    // ========================================
    console.log('[SGA Sync] Cadastrando veículo no Hinova...');

    // Authorization: Bearer no header + token_usuario no body (SEM usuario/senha)
    const veiculoPayload = {
      token_usuario: tokenUsuario,
      codigo_associado: codigoAssociadoHinova,
      placa: veiculo.placa || '',
      chassi: veiculo.chassi || '',
      renavam: veiculo.renavam || '',
      ano_fabricacao: veiculo.ano_fabricacao || veiculo.ano_modelo,
      ano_modelo: veiculo.ano_modelo,
      codigo_fipe: veiculo.codigo_fipe || '',
      valor_fipe: veiculo.valor_fipe || 0,
      kilometragem: veiculo.km || veiculo.quilometragem || 0,
      numero_motor: veiculo.numero_motor || '',
      dia_vencimento: associado.dia_vencimento || 10,
      codigo_conta: parseInt(hinovaCodigoConta),
      codigo_cor: getMapeamento('cor', veiculo.cor),
      codigo_combustivel: getMapeamento('combustivel', veiculo.combustivel),
      codigo_tipo_veiculo: getMapeamento('tipo_veiculo', veiculo.tipo) || 1,
      ...(hinovaCodigoVoluntario && { codigo_voluntario: parseInt(hinovaCodigoVoluntario) }),
      ...(hinovaCodigoCooperativa && { codigo_cooperativa: parseInt(hinovaCodigoCooperativa) }),
    };

    const veiculoResponse = await fetchWithRetry(
      `${hinovaApiUrl}/veiculo/cadastrar`,
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(veiculoPayload)
      }
    );

    const veiculoData: HinovaVeiculoResponse = await veiculoResponse.json();
    
    await logSync(veiculo_id, associado_id, 'cadastrar_veiculo', veiculoResponse.ok ? 'success' : 'error',
      veiculoPayload, veiculoData, veiculoResponse.ok ? null : veiculoData.mensagem);

    if (!veiculoResponse.ok) {
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

    const codigoVeiculoHinova = veiculoData.codigo_veiculo;
    console.log(`[SGA Sync] Veículo cadastrado - Código Hinova: ${codigoVeiculoHinova}`);

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
          // Authorization: Bearer no header + token_usuario no body (SEM usuario/senha)
          const fotosResponse = await fetchWithRetry(
            `${hinovaApiUrl}/veiculo/foto/cadastrar`,
            {
              method: 'POST',
              headers: authHeaders,
              body: JSON.stringify({
                token_usuario: tokenUsuario,
                codigo_veiculo: codigoVeiculoHinova,
                foto: fotos
              })
            }
          );

          const fotosData = await fotosResponse.json();
          
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

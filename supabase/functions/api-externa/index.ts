import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function err(message: string, code: string, status = 400) {
  return json({ error: message, code }, status);
}

// Hash API key using SubtleCrypto (same as frontend)
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function validateApiKey(supabase: any, apiKeyHeader: string | null) {
  if (!apiKeyHeader) return null;

  const keyHash = await hashApiKey(apiKeyHeader);
  const { data } = await supabase
    .from('api_keys')
    .select('id, nome, ativa')
    .eq('key_hash', keyHash)
    .eq('ativa', true)
    .maybeSingle();

  if (!data) return null;

  // Update last_used_at
  await supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id);

  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Authenticate
  const apiKeyHeader = req.headers.get('x-api-key');
  const apiKeyRecord = await validateApiKey(supabase, apiKeyHeader);
  if (!apiKeyRecord) {
    return err('API Key inválida ou ausente', 'UNAUTHORIZED', 401);
  }

  // Parse route
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  // Path: /api-externa/resource or /api-externa/resource/id
  // After function name, pathParts will be like: ['api-externa', 'resource', 'id?']
  const fnIndex = pathParts.indexOf('api-externa');
  const resource = pathParts[fnIndex + 1] || '';
  const resourceId = pathParts[fnIndex + 2] || '';

  try {
    // ========== ASSOCIADOS ==========
    if (resource === 'associados') {
      if (req.method === 'POST') {
        const body = await req.json();
        const { nome, cpf, email, telefone } = body;
        if (!nome || !cpf || !email || !telefone) {
          return err('Campos obrigatórios: nome, cpf, email, telefone', 'MISSING_FIELDS');
        }

        // Check duplicate CPF
        const { data: existing } = await supabase.from('associados').select('id').eq('cpf', cpf.replace(/\D/g, '')).maybeSingle();
        if (existing) return err('CPF já cadastrado no sistema', 'DUPLICATE_CPF', 409);

        const insertData: any = {
          nome, cpf: cpf.replace(/\D/g, ''), email, telefone, status: 'em_analise',
        };
        const optionalFields = ['rg', 'data_nascimento', 'sexo', 'estado_civil', 'profissao', 'whatsapp',
          'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'plano_id', 'dia_vencimento'];
        for (const f of optionalFields) {
          if (body[f] !== undefined) insertData[f] = body[f];
        }

        const { data, error } = await supabase.from('associados').insert(insertData).select().single();
        if (error) return err(error.message, 'INSERT_ERROR');
        return json(data, 201);
      }

      if (req.method === 'GET' && resourceId) {
        const { data, error } = await supabase.from('associados').select('*').eq('id', resourceId).maybeSingle();
        if (error) return err(error.message, 'QUERY_ERROR');
        if (!data) return err('Associado não encontrado', 'NOT_FOUND', 404);
        return json(data);
      }
    }

    // ========== VEÍCULOS ==========
    if (resource === 'veiculos') {
      if (req.method === 'POST') {
        const body = await req.json();
        let { associado_id, associado_cpf, placa, marca, modelo, ano_fabricacao, ano_modelo } = body;

        if (!placa || !marca || !modelo || !ano_fabricacao || !ano_modelo) {
          return err('Campos obrigatórios: placa, marca, modelo, ano_fabricacao, ano_modelo', 'MISSING_FIELDS');
        }

        if (!associado_id && associado_cpf) {
          const { data: assoc } = await supabase.from('associados').select('id').eq('cpf', associado_cpf.replace(/\D/g, '')).maybeSingle();
          if (!assoc) return err('Associado não encontrado para o CPF informado', 'ASSOCIADO_NOT_FOUND', 404);
          associado_id = assoc.id;
        }
        if (!associado_id) return err('associado_id ou associado_cpf é obrigatório', 'MISSING_FIELDS');

        const insertData: any = { associado_id, placa: placa.toUpperCase(), marca, modelo, ano_fabricacao, ano_modelo, status: 'em_analise' };
        const optionalFields = ['chassi', 'renavam', 'cor', 'combustivel', 'valor_fipe', 'codigo_fipe',
          'uso_aplicativo', 'blindado', 'flag_leilao', 'flag_ex_taxi', 'flag_taxi_ativo', 'flag_placa_vermelha',
          'flag_chassi_remarcado', 'flag_avarias_vistoria', 'flag_ex_ressarcido'];
        for (const f of optionalFields) {
          if (body[f] !== undefined) insertData[f] = body[f];
        }

        const { data, error } = await supabase.from('veiculos').insert(insertData).select().single();
        if (error) return err(error.message, 'INSERT_ERROR');
        return json(data, 201);
      }

      if (req.method === 'GET' && resourceId) {
        const { data, error } = await supabase.from('veiculos').select('*').eq('id', resourceId).maybeSingle();
        if (error) return err(error.message, 'QUERY_ERROR');
        if (!data) return err('Veículo não encontrado', 'NOT_FOUND', 404);
        return json(data);
      }
    }

    // ========== PRESTADORES ==========
    if (resource === 'prestadores') {
      if (req.method === 'POST') {
        const body = await req.json();
        const { razao_social, telefone, cidade, estado } = body;
        if (!razao_social || !telefone || !cidade || !estado) {
          return err('Campos obrigatórios: razao_social, telefone, cidade, estado', 'MISSING_FIELDS');
        }

        const insertData: any = { razao_social, telefone, cidade, estado, status: 'ativo' };
        const optionalFields = ['nome_fantasia', 'cnpj', 'cpf', 'tipo_pessoa', 'whatsapp', 'email',
          'cep', 'logradouro', 'numero', 'bairro', 'raio_atendimento_km', 'cidades_atendidas',
          'tipos_servico', 'banco', 'agencia', 'conta', 'pix_tipo', 'pix_chave'];
        for (const f of optionalFields) {
          if (body[f] !== undefined) insertData[f] = body[f];
        }

        const { data, error } = await supabase.from('prestadores_assistencia').insert(insertData).select().single();
        if (error) return err(error.message, 'INSERT_ERROR');
        return json(data, 201);
      }
    }

    // ========== SINISTROS ==========
    if (resource === 'sinistros') {
      if (req.method === 'POST') {
        const body = await req.json();
        let { associado_id, associado_cpf, veiculo_id, veiculo_placa, tipo, data_ocorrencia, canal } = body;

        if (!tipo || !data_ocorrencia || !canal) {
          return err('Campos obrigatórios: tipo, data_ocorrencia, canal', 'MISSING_FIELDS');
        }

        if (!associado_id && associado_cpf) {
          const { data: assoc } = await supabase.from('associados').select('id').eq('cpf', associado_cpf.replace(/\D/g, '')).maybeSingle();
          if (!assoc) return err('Associado não encontrado', 'ASSOCIADO_NOT_FOUND', 404);
          associado_id = assoc.id;
        }
        if (!associado_id) return err('associado_id ou associado_cpf é obrigatório', 'MISSING_FIELDS');

        if (!veiculo_id && veiculo_placa) {
          const { data: veic } = await supabase.from('veiculos').select('id').eq('placa', veiculo_placa.toUpperCase()).eq('associado_id', associado_id).maybeSingle();
          if (!veic) return err('Veículo não encontrado para a placa informada', 'VEICULO_NOT_FOUND', 404);
          veiculo_id = veic.id;
        }
        if (!veiculo_id) return err('veiculo_id ou veiculo_placa é obrigatório', 'MISSING_FIELDS');

        // Generate protocolo
        const year = new Date().getFullYear();
        const { count } = await supabase.from('sinistros').select('id', { count: 'exact', head: true });
        const protocolo = `SIN-${year}-${String((count || 0) + 1).padStart(4, '0')}`;

        const insertData: any = { associado_id, veiculo_id, tipo, data_ocorrencia, canal, protocolo, status: 'aberto' };
        const optionalFields = ['descricao', 'local_descricao', 'cidade_ocorrencia', 'estado_ocorrencia',
          'bo_numero', 'condutor_nome', 'condutor_cnh', 'condutor_relacao', 'houve_vitima', 'necessita_reboque'];
        for (const f of optionalFields) {
          if (body[f] !== undefined) insertData[f] = body[f];
        }

        const { data, error } = await supabase.from('sinistros').insert(insertData).select().single();
        if (error) return err(error.message, 'INSERT_ERROR');
        return json(data, 201);
      }

      if (req.method === 'GET' && resourceId) {
        const { data, error } = await supabase.from('sinistros').select('*').eq('id', resourceId).maybeSingle();
        if (error) return err(error.message, 'QUERY_ERROR');
        if (!data) return err('Sinistro não encontrado', 'NOT_FOUND', 404);
        return json(data);
      }
    }

    // ========== FATURAS ==========
    if (resource === 'faturas') {
      if (req.method === 'POST') {
        const body = await req.json();
        let { associado_id, associado_cpf, valor, data_vencimento, tipo, descricao, forma_pagamento } = body;

        if (!valor || !data_vencimento || !tipo) {
          return err('Campos obrigatórios: valor, data_vencimento, tipo', 'MISSING_FIELDS');
        }

        if (!associado_id && associado_cpf) {
          const { data: assoc } = await supabase.from('associados').select('id, nome, cpf, email, telefone, cep, logradouro, numero, bairro, cidade, uf').eq('cpf', associado_cpf.replace(/\D/g, '')).maybeSingle();
          if (!assoc) return err('Associado não encontrado', 'ASSOCIADO_NOT_FOUND', 404);
          associado_id = assoc.id;
        }
        if (!associado_id) return err('associado_id ou associado_cpf é obrigatório', 'MISSING_FIELDS');

        // Get associado data for Asaas
        const { data: associado } = await supabase.from('associados').select('id, nome, cpf, email, telefone, cep, logradouro, numero, bairro, cidade, uf').eq('id', associado_id).single();
        if (!associado) return err('Associado não encontrado', 'ASSOCIADO_NOT_FOUND', 404);

        // Check/Create Asaas customer
        let { data: asaasCliente } = await supabase.from('asaas_clientes').select('asaas_id').eq('associado_id', associado_id).eq('ativo', true).maybeSingle();

        const asaasApiKey = Deno.env.get('ASAAS_API_KEY');
        const asaasBaseUrl = Deno.env.get('ASAAS_BASE_URL') || 'https://api.asaas.com/v3';

        if (!asaasCliente && asaasApiKey) {
          // Create customer in Asaas
          const customerPayload = {
            name: associado.nome,
            cpfCnpj: associado.cpf,
            email: associado.email,
            phone: associado.telefone,
            postalCode: associado.cep,
            address: associado.logradouro,
            addressNumber: associado.numero,
            province: associado.bairro,
            notificationDisabled: true,
          };

          const customerRes = await fetch(`${asaasBaseUrl}/customers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'access_token': asaasApiKey },
            body: JSON.stringify(customerPayload),
          });
          const customerData = await customerRes.json();

          if (customerData.id) {
            await supabase.from('asaas_clientes').insert({
              asaas_id: customerData.id,
              associado_id,
              nome: associado.nome,
              cpf_cnpj: associado.cpf,
              email: associado.email,
              telefone: associado.telefone,
              ativo: true,
            });
            asaasCliente = { asaas_id: customerData.id };
          }
        }

        // Create charge in Asaas
        let asaasCobranca = null;
        if (asaasCliente && asaasApiKey) {
          const chargePayload = {
            customer: asaasCliente.asaas_id,
            billingType: forma_pagamento || 'BOLETO',
            value: valor,
            dueDate: data_vencimento,
            description: descricao || `${tipo} - ${associado.nome}`,
            notificationEnabled: false,
          };

          const chargeRes = await fetch(`${asaasBaseUrl}/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'access_token': asaasApiKey },
            body: JSON.stringify(chargePayload),
          });
          asaasCobranca = await chargeRes.json();
        }

        // Insert local record
        const cobrancaData: any = {
          associado_id,
          valor,
          data_vencimento,
          data_emissao: new Date().toISOString().split('T')[0],
          tipo,
          status: 'PENDING',
          asaas_id: asaasCobranca?.id || `local_${Date.now()}`,
          asaas_cliente_id: asaasCliente?.asaas_id || null,
          boleto_url: asaasCobranca?.bankSlipUrl || null,
          pix_copia_cola: asaasCobranca?.pixTransaction?.payload || null,
        };

        const { data, error } = await supabase.from('asaas_cobrancas').insert(cobrancaData).select().single();
        if (error) return err(error.message, 'INSERT_ERROR');
        return json(data, 201);
      }

      if (req.method === 'GET' && resourceId) {
        const { data, error } = await supabase.from('asaas_cobrancas').select('*').eq('id', resourceId).maybeSingle();
        if (error) return err(error.message, 'QUERY_ERROR');
        if (!data) return err('Fatura não encontrada', 'NOT_FOUND', 404);
        return json(data);
      }
    }

    // ========== CHAMADOS ==========
    if (resource === 'chamados') {
      if (req.method === 'POST') {
        const body = await req.json();
        const { associado_id, tipo_servico, canal } = body;
        if (!associado_id || !tipo_servico || !canal) {
          return err('Campos obrigatórios: associado_id, tipo_servico, canal', 'MISSING_FIELDS');
        }

        // Generate protocolo
        const year = new Date().getFullYear();
        const { count } = await supabase.from('chamados_assistencia').select('id', { count: 'exact', head: true });
        const protocolo = `CH-${year}-${String((count || 0) + 1).padStart(4, '0')}`;

        const insertData: any = { associado_id, tipo_servico, canal, protocolo, status: 'aberto', data_abertura: new Date().toISOString() };
        const optionalFields = ['veiculo_id', 'descricao', 'origem_endereco', 'origem_cidade', 'origem_uf',
          'origem_cep', 'destino_endereco', 'destino_cidade', 'destino_uf', 'destino_cep'];
        for (const f of optionalFields) {
          if (body[f] !== undefined) insertData[f] = body[f];
        }

        const { data, error } = await supabase.from('chamados_assistencia').insert(insertData).select().single();
        if (error) return err(error.message, 'INSERT_ERROR');
        return json(data, 201);
      }
    }

    return err(`Endpoint não encontrado: ${req.method} /${resource}${resourceId ? '/' + resourceId : ''}`, 'NOT_FOUND', 404);

  } catch (e: any) {
    console.error('[api-externa]', e);
    return err(e.message || 'Erro interno', 'INTERNAL_ERROR', 500);
  }
});

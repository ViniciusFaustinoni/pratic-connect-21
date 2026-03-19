import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
// Chaves sandbox contêm '_hmlg_' (homologação)
const isSandbox = ASAAS_API_KEY?.includes('_hmlg_');
const ASAAS_BASE_URL = isSandbox
  ? 'https://sandbox.asaas.com/api/v3'
  : 'https://api.asaas.com/v3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface AsaasClienteRequest {
  action: 'criar' | 'buscar' | 'atualizar' | 'sincronizar';
  associado_id?: string;
  asaas_id?: string;
  dados?: {
    nome: string;
    cpfCnpj: string;
    email?: string;
    phone?: string;
    mobilePhone?: string;
    address?: string;
    addressNumber?: string;
    complement?: string;
    province?: string;
    postalCode?: string;
    city?: string;
    state?: string;
  };
}

async function asaasRequest(endpoint: string, method: string, body?: object) {
  const url = `${ASAAS_BASE_URL}${endpoint}`;
  console.log(`[asaas-clientes] ${method} ${url}`);
  
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY!,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error(`[asaas-clientes] Erro ASAAS:`, data);
    throw new Error(data.errors?.[0]?.description || `Erro ASAAS: ${response.status}`);
  }

  return data;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!ASAAS_API_KEY) {
      throw new Error('ASAAS_API_KEY não configurada');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { action, associado_id, asaas_id, dados }: AsaasClienteRequest = await req.json();

    console.log(`[asaas-clientes] Action: ${action}, Associado: ${associado_id}`);

    let result;

    switch (action) {
      case 'criar': {
        if (!dados) throw new Error('Dados do cliente são obrigatórios');
        
        // Verificar se já existe cliente para este associado
        if (associado_id) {
          const { data: existente } = await supabase
            .from('asaas_clientes')
            .select('asaas_id')
            .eq('associado_id', associado_id)
            .maybeSingle();
          
          if (existente?.asaas_id) {
            console.log(`[asaas-clientes] Cliente já existe: ${existente.asaas_id}`);
            return new Response(JSON.stringify({ 
              success: true, 
              asaas_id: existente.asaas_id,
              message: 'Cliente já cadastrado no ASAAS' 
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        // Criar cliente no ASAAS
        const asaasCliente = await asaasRequest('/customers', 'POST', {
          name: dados.nome,
          cpfCnpj: dados.cpfCnpj.replace(/\D/g, ''),
          email: dados.email,
          phone: dados.phone?.replace(/\D/g, ''),
          mobilePhone: dados.mobilePhone?.replace(/\D/g, ''),
          address: dados.address,
          addressNumber: dados.addressNumber,
          complement: dados.complement,
          province: dados.province,
          postalCode: dados.postalCode?.replace(/\D/g, ''),
          externalReference: associado_id,
          notificationDisabled: true,
        });

        console.log(`[asaas-clientes] Cliente criado: ${asaasCliente.id}`);

        // Salvar no banco
        if (associado_id) {
          const { error: insertError } = await supabase
            .from('asaas_clientes')
            .insert({
              asaas_id: asaasCliente.id,
              associado_id,
              nome: dados.nome,
              cpf_cnpj: dados.cpfCnpj,
              email: dados.email,
              telefone: dados.mobilePhone || dados.phone,
              cep: dados.postalCode,
              logradouro: dados.address,
              numero: dados.addressNumber,
              complemento: dados.complement,
              bairro: dados.province,
              cidade: dados.city,
              uf: dados.state,
              sincronizado_em: new Date().toISOString(),
            });

          if (insertError) {
            console.error(`[asaas-clientes] Erro ao salvar:`, insertError);
          }
        }

        result = { success: true, asaas_id: asaasCliente.id, cliente: asaasCliente };
        break;
      }

      case 'buscar': {
        if (asaas_id) {
          const asaasCliente = await asaasRequest(`/customers/${asaas_id}`, 'GET');
          result = { success: true, cliente: asaasCliente };
        } else if (associado_id) {
          const { data: cliente } = await supabase
            .from('asaas_clientes')
            .select('*')
            .eq('associado_id', associado_id)
            .maybeSingle();
          
          if (cliente?.asaas_id) {
            const asaasCliente = await asaasRequest(`/customers/${cliente.asaas_id}`, 'GET');
            result = { success: true, cliente: asaasCliente, local: cliente };
          } else {
            result = { success: false, message: 'Cliente não encontrado' };
          }
        } else {
          throw new Error('asaas_id ou associado_id é obrigatório');
        }
        break;
      }

      case 'atualizar': {
        if (!asaas_id || !dados) throw new Error('asaas_id e dados são obrigatórios');
        
        const asaasCliente = await asaasRequest(`/customers/${asaas_id}`, 'PUT', {
          name: dados.nome,
          email: dados.email,
          phone: dados.phone?.replace(/\D/g, ''),
          mobilePhone: dados.mobilePhone?.replace(/\D/g, ''),
          address: dados.address,
          addressNumber: dados.addressNumber,
          complement: dados.complement,
          province: dados.province,
          postalCode: dados.postalCode?.replace(/\D/g, ''),
        });

        // Atualizar no banco
        if (associado_id) {
          await supabase
            .from('asaas_clientes')
            .update({
              nome: dados.nome,
              email: dados.email,
              telefone: dados.mobilePhone || dados.phone,
              cep: dados.postalCode,
              logradouro: dados.address,
              numero: dados.addressNumber,
              complemento: dados.complement,
              bairro: dados.province,
              cidade: dados.city,
              uf: dados.state,
              sincronizado_em: new Date().toISOString(),
            })
            .eq('associado_id', associado_id);
        }

        result = { success: true, cliente: asaasCliente };
        break;
      }

      case 'sincronizar': {
        if (!associado_id) throw new Error('associado_id é obrigatório');

        // Buscar dados do associado
        const { data: associado, error: assocError } = await supabase
          .from('associados')
          .select('*')
          .eq('id', associado_id)
          .single();

        if (assocError || !associado) {
          throw new Error('Associado não encontrado');
        }

        // Verificar se já existe no ASAAS
        const { data: clienteExistente } = await supabase
          .from('asaas_clientes')
          .select('asaas_id')
          .eq('associado_id', associado_id)
          .maybeSingle();

        if (clienteExistente?.asaas_id) {
          // Atualizar cliente existente
          const asaasCliente = await asaasRequest(`/customers/${clienteExistente.asaas_id}`, 'PUT', {
            name: associado.nome,
            email: associado.email,
            mobilePhone: (associado.whatsapp || associado.telefone)?.replace(/\D/g, ''),
            address: associado.logradouro,
            addressNumber: associado.numero,
            complement: associado.complemento,
            province: associado.bairro,
            postalCode: associado.cep?.replace(/\D/g, ''),
          });

          await supabase
            .from('asaas_clientes')
            .update({ sincronizado_em: new Date().toISOString() })
            .eq('associado_id', associado_id);

          result = { success: true, asaas_id: clienteExistente.asaas_id, cliente: asaasCliente };
        } else {
          // Criar novo cliente
          const asaasCliente = await asaasRequest('/customers', 'POST', {
            name: associado.nome,
            cpfCnpj: associado.cpf.replace(/\D/g, ''),
            email: associado.email,
            mobilePhone: (associado.whatsapp || associado.telefone)?.replace(/\D/g, ''),
            address: associado.logradouro,
            addressNumber: associado.numero,
            complement: associado.complemento,
            province: associado.bairro,
            postalCode: associado.cep?.replace(/\D/g, ''),
            externalReference: associado_id,
          });

          await supabase
            .from('asaas_clientes')
            .insert({
              asaas_id: asaasCliente.id,
              associado_id,
              nome: associado.nome,
              cpf_cnpj: associado.cpf,
              email: associado.email,
              telefone: associado.whatsapp || associado.telefone,
              cep: associado.cep,
              logradouro: associado.logradouro,
              numero: associado.numero,
              complemento: associado.complemento,
              bairro: associado.bairro,
              cidade: associado.cidade,
              uf: associado.uf,
              sincronizado_em: new Date().toISOString(),
            });

          result = { success: true, asaas_id: asaasCliente.id, cliente: asaasCliente };
        }
        break;
      }

      default:
        throw new Error(`Ação não suportada: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[asaas-clientes] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

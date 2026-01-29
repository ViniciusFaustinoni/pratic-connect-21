import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  associadoId: string;
  camposAlterados: {
    nome?: string;
    email?: string;
    telefone?: string;
    whatsapp?: string;
    cep?: string;
    logradouro?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    complemento?: string;
    permissoes?: {
      acessoWeb?: boolean;
      pushNotifications?: boolean;
      alertaVelocidade?: boolean;
      alertaCercaVirtual?: boolean;
      alertaIgnicao?: boolean;
    };
  };
}

interface Associado {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  whatsapp: string | null;
}

interface Veiculo {
  id: string;
  placa: string;
  rede_veiculos_cliente_id: string | null;
  rede_veiculos_veiculo_id: string | null;
  associado_id: string;
}

interface Plataforma {
  id: string;
  plataforma: string;
  api_url_sandbox: string;
  api_url_producao: string;
  ambiente_atual: string;
}

interface AtualizarResponse {
  codigo: number;
  msg: string;
}

// Formatar CPF/CNPJ
function formatarCpfCnpj(cpf: string | null): string {
  if (!cpf) return '';
  return cpf.replace(/\D/g, '');
}

// Formatar telefone
function formatarTelefone(telefone: string | null): string {
  if (!telefone) return '';
  return telefone.replace(/\D/g, '');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json() as RequestBody;
    const { associadoId, camposAlterados } = body;

    console.log('[RedeVeiculos Atualizar] Iniciando atualização:', { associadoId, campos: Object.keys(camposAlterados) });

    if (!associadoId) {
      throw new Error('ID do associado é obrigatório');
    }

    if (!camposAlterados || Object.keys(camposAlterados).length === 0) {
      console.log('[RedeVeiculos Atualizar] Nenhum campo para atualizar');
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum campo para atualizar' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // ===== 1. Buscar associado =====
    const { data: associado, error: associadoError } = await supabase
      .from('associados')
      .select(`
        id,
        nome,
        cpf,
        telefone,
        email,
        cep,
        logradouro,
        numero,
        bairro,
        cidade,
        uf,
        whatsapp
      `)
      .eq('id', associadoId)
      .single();

    if (associadoError || !associado) {
      throw new Error(`Associado não encontrado: ${associadoError?.message || 'ID inválido'}`);
    }

    console.log('[RedeVeiculos Atualizar] Associado encontrado:', associado.nome);

    // ===== 2. Buscar veículos com vínculo na Rede Veículos =====
    const { data: veiculos, error: veiculosError } = await supabase
      .from('veiculos')
      .select(`
        id,
        placa,
        rede_veiculos_cliente_id,
        rede_veiculos_veiculo_id,
        associado_id
      `)
      .eq('associado_id', associadoId)
      .not('rede_veiculos_cliente_id', 'is', null);

    if (veiculosError) {
      console.warn('[RedeVeiculos Atualizar] Erro ao buscar veículos:', veiculosError);
    }

    // Verificar se há veículos vinculados à Rede Veículos
    const veiculosRedeVeiculos = (veiculos || []).filter(v => v.rede_veiculos_cliente_id);

    if (veiculosRedeVeiculos.length === 0) {
      console.log('[RedeVeiculos Atualizar] Associado não possui veículos vinculados à Rede Veículos');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Associado não possui veículos vinculados à Rede Veículos. Atualização local apenas.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`[RedeVeiculos Atualizar] ${veiculosRedeVeiculos.length} veículo(s) vinculado(s) à Rede Veículos`);

    // ===== 3. Buscar configuração da plataforma =====
    const { data: plataforma, error: plataformaError } = await supabase
      .from('rastreadores_config_plataformas')
      .select('*')
      .eq('plataforma', 'rede_veiculos')
      .single();

    if (plataformaError || !plataforma) {
      throw new Error('Configuração da plataforma Rede Veículos não encontrada');
    }

    // ===== 4. Obter token de autenticação =====
    const authResponse = await fetch(
      `${supabaseUrl}/functions/v1/rastreador-auth`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ plataforma_codigo: 'rede_veiculos' })
      }
    );

    const authData = await authResponse.json();
    if (!authData.success) {
      throw new Error('Falha na autenticação com Rede Veículos: ' + authData.error);
    }

    const token = authData.token;
    const baseUrl = plataforma.ambiente_atual === 'producao'
      ? plataforma.api_url_producao
      : plataforma.api_url_sandbox;

    console.log('[RedeVeiculos Atualizar] Autenticado, ambiente:', plataforma.ambiente_atual);

    // ===== 5. Montar payload com apenas os campos alterados =====
    const payload: Record<string, unknown> = {
      // CPF/CNPJ como identificador (obrigatório, imutável)
      cpfCnpj: formatarCpfCnpj(associado.cpf),
    };

    // Adicionar campos pessoais alterados
    if (camposAlterados.nome !== undefined) {
      payload.nome = camposAlterados.nome;
    }
    if (camposAlterados.email !== undefined) {
      payload.email = camposAlterados.email;
    }
    if (camposAlterados.telefone !== undefined) {
      payload.celular = formatarTelefone(camposAlterados.telefone);
    }
    if (camposAlterados.whatsapp !== undefined) {
      payload.celular = formatarTelefone(camposAlterados.whatsapp);
    }

    // Adicionar endereço se algum campo de endereço foi alterado
    const enderecoFields = ['cep', 'logradouro', 'numero', 'bairro', 'cidade', 'uf', 'complemento'];
    const temEnderecoAlterado = enderecoFields.some(field => camposAlterados[field as keyof typeof camposAlterados] !== undefined);
    
    if (temEnderecoAlterado) {
      payload.endereco = {
        cep: (camposAlterados.cep ?? associado.cep)?.replace(/\D/g, '') || '',
        logradouro: camposAlterados.logradouro ?? associado.logradouro ?? '',
        numero: camposAlterados.numero ?? associado.numero ?? 'S/N',
        bairro: camposAlterados.bairro ?? associado.bairro ?? '',
        cidade: camposAlterados.cidade ?? associado.cidade ?? '',
        uf: camposAlterados.uf ?? associado.uf ?? '',
      };
    }

    // Adicionar permissões se foram alteradas
    if (camposAlterados.permissoes) {
      payload.permissoes = camposAlterados.permissoes;
    }

    console.log('[RedeVeiculos Atualizar] Payload montado:', JSON.stringify(payload, null, 2));

    // ===== 6. Chamar API Rede Veículos - POST /atualizarDadosCliente =====
    const formData = new URLSearchParams();
    formData.append('json', JSON.stringify(payload));

    const apiResponse = await fetch(`${baseUrl}/atualizarDadosCliente/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    const responseText = await apiResponse.text();
    console.log('[RedeVeiculos Atualizar] Resposta API:', responseText);

    let apiResult: AtualizarResponse;
    try {
      apiResult = JSON.parse(responseText);
    } catch {
      throw new Error(`Resposta inválida da API: ${responseText}`);
    }

    // Verificar código de resposta (1 = sucesso)
    if (apiResult.codigo !== 1) {
      // Registrar log de erro
      await supabase.from('rastreadores_api_logs').insert({
        plataforma: 'rede_veiculos',
        operacao: 'atualizarDadosCliente',
        request: payload,
        response: apiResult,
        status: 'erro',
        erro_mensagem: apiResult.msg,
      });

      throw new Error(`Erro na API Rede Veículos: ${apiResult.msg} (código: ${apiResult.codigo})`);
    }

    console.log('[RedeVeiculos Atualizar] Atualização bem sucedida:', apiResult);

    // ===== 7. Registrar log de sucesso =====
    await supabase.from('rastreadores_api_logs').insert({
      plataforma: 'rede_veiculos',
      operacao: 'atualizarDadosCliente',
      request: payload,
      response: apiResult,
      status: 'sucesso',
    });

    // ===== 8. Atualizar campos de permissões nos veículos locais (se aplicável) =====
    if (camposAlterados.permissoes) {
      for (const veiculo of veiculosRedeVeiculos) {
        const updateVeiculo: Record<string, unknown> = {};
        
        if (camposAlterados.permissoes.alertaVelocidade !== undefined) {
          updateVeiculo.alerta_velocidade_ativo = camposAlterados.permissoes.alertaVelocidade;
        }
        if (camposAlterados.permissoes.alertaCercaVirtual !== undefined) {
          updateVeiculo.alerta_cerca_ativo = camposAlterados.permissoes.alertaCercaVirtual;
        }
        if (camposAlterados.permissoes.alertaIgnicao !== undefined) {
          updateVeiculo.alerta_ignicao_ativo = camposAlterados.permissoes.alertaIgnicao;
        }

        if (Object.keys(updateVeiculo).length > 0) {
          await supabase
            .from('veiculos')
            .update(updateVeiculo)
            .eq('id', veiculo.id);
        }
      }
    }

    console.log('[RedeVeiculos Atualizar] Processo concluído com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        campos_atualizados: Object.keys(camposAlterados),
        veiculos_afetados: veiculosRedeVeiculos.length,
        mensagem: 'Dados do cliente atualizados com sucesso na Rede Veículos',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[RedeVeiculos Atualizar] Erro:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

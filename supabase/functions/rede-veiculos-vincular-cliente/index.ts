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
  localInstalacao?: string;
  possuiBloqueio?: boolean;
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
}

interface Veiculo {
  id: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
  ano_modelo: number | null;
  cor: string | null;
  chassi: string | null;
  renavam: string | null;
  tipo: string | null;
  rede_veiculos_cliente_id: string | null;
  rede_veiculos_veiculo_id: string | null;
}

interface Rastreador {
  id: string;
  codigo: string;
  imei: string;
  numero_serie: string | null;
  plataforma: string;
  plataforma_device_id: string | null;
  status: string;
}

interface Plataforma {
  id: string;
  plataforma: string;
  api_url_sandbox: string;
  api_url_producao: string;
  ambiente_atual: string;
}

interface VincularResponse {
  codigo: number;
  msg: string;
  idCliente?: number;
  idVeiculo?: number;
  idEquipamento?: number;
}

// Mapear tipo de veículo para código da API
function mapTipoVeiculo(tipo: string | null): string {
  const tipoUpper = (tipo || 'carro').toLowerCase();
  switch (tipoUpper) {
    case 'moto':
    case 'motocicleta':
      return 'moto';
    case 'caminhao':
    case 'caminhão':
      return 'caminhao';
    case 'van':
      return 'van';
    case 'onibus':
    case 'ônibus':
      return 'onibus';
    default:
      return 'carro';
  }
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
    const { imei, veiculoId, associadoId, localInstalacao = 'painel', possuiBloqueio = false } = body;

    console.log('[RedeVeiculos Vincular] Iniciando vinculação:', { imei, veiculoId, associadoId });

    // ===== 1. Buscar rastreador local pelo IMEI =====
    const { data: rastreador, error: rastreadorError } = await supabase
      .from('rastreadores')
      .select(`
        id, 
        codigo, 
        imei, 
        numero_serie, 
        plataforma, 
        plataforma_device_id, 
        status
      `)
      .eq('imei', imei)
      .maybeSingle();

    if (rastreadorError) {
      throw new Error(`Erro ao buscar rastreador: ${rastreadorError.message}`);
    }

    if (!rastreador) {
      throw new Error(`Rastreador com IMEI ${imei} não encontrado no sistema`);
    }

    if (rastreador.plataforma !== 'rede_veiculos') {
      throw new Error(`Rastreador ${imei} não é da plataforma Rede Veículos (plataforma: ${rastreador.plataforma})`);
    }

    // Aceitar status 'estoque' (novo) ou 'instalado' (já vinculado localmente)
    if (rastreador.status !== 'estoque' && rastreador.status !== 'instalado') {
      throw new Error(`Rastreador ${imei} não está disponível (status: ${rastreador.status})`);
    }

    console.log('[RedeVeiculos Vincular] Rastreador encontrado:', rastreador.id);

    // ===== 2. Buscar veículo local =====
    const { data: veiculo, error: veiculoError } = await supabase
      .from('veiculos')
      .select(`
        id, 
        placa, 
        marca, 
        modelo, 
        ano_modelo, 
        cor, 
        chassi, 
        renavam, 
        tipo,
        rede_veiculos_cliente_id,
        rede_veiculos_veiculo_id
      `)
      .eq('id', veiculoId)
      .single();

    if (veiculoError || !veiculo) {
      throw new Error(`Veículo não encontrado: ${veiculoError?.message || 'ID inválido'}`);
    }

    console.log('[RedeVeiculos Vincular] Veículo encontrado:', veiculo.placa);

    // ===== 3. Buscar associado local =====
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
        uf
      `)
      .eq('id', associadoId)
      .single();

    if (associadoError || !associado) {
      throw new Error(`Associado não encontrado: ${associadoError?.message || 'ID inválido'}`);
    }

    console.log('[RedeVeiculos Vincular] Associado encontrado:', associado.nome);

    // ===== 4. Buscar configuração da plataforma =====
    const { data: plataforma, error: plataformaError } = await supabase
      .from('rastreadores_config_plataformas')
      .select('*')
      .eq('plataforma', 'rede_veiculos')
      .single();

    if (plataformaError || !plataforma) {
      throw new Error('Configuração da plataforma Rede Veículos não encontrada');
    }

    // ===== 5. Obter token de autenticação =====
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

    console.log('[RedeVeiculos Vincular] Autenticado, ambiente:', plataforma.ambiente_atual);

    // ===== 6. Montar payload para API Rede Veículos =====
    const payload = {
      // Dados do Equipamento
      equipamento: {
        imei: rastreador.imei,
        localInstalacao: localInstalacao,
        possuiBloqueio: possuiBloqueio,
      },
      // Dados do Veículo
      veiculo: {
        tipo: mapTipoVeiculo(veiculo.tipo),
        marca: veiculo.marca || 'NI',
        modelo: veiculo.modelo || 'NI',
        placa: veiculo.placa,
        cor: veiculo.cor || 'NI',
        ano: veiculo.ano_modelo || new Date().getFullYear(),
        chassi: veiculo.chassi || undefined,
        renavam: veiculo.renavam || undefined,
      },
      // Dados do Cliente
      cliente: {
        cpfCnpj: formatarCpfCnpj(associado.cpf),
        nome: associado.nome,
        celular: formatarTelefone(associado.telefone),
        email: associado.email,
        endereco: associado.logradouro ? {
          cep: associado.cep?.replace(/\D/g, '') || '',
          logradouro: associado.logradouro || '',
          numero: associado.numero || 'S/N',
          bairro: associado.bairro || '',
          cidade: associado.cidade || '',
          uf: associado.uf || '',
        } : undefined,
      },
      // Permissões padrão
      permissoes: {
        acessoWeb: true,
        pushNotifications: true,
        alertaVelocidade: true,
        alertaCercaVirtual: true,
        alertaIgnicao: true,
      },
    };

    console.log('[RedeVeiculos Vincular] Payload montado:', JSON.stringify(payload, null, 2));

    // ===== 7. Chamar API Rede Veículos - POST /vincularClienteVeiculo =====
    const formData = new URLSearchParams();
    formData.append('json', JSON.stringify(payload));

    const apiResponse = await fetch(`${baseUrl}/vincularClienteVeiculo/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    const responseText = await apiResponse.text();
    console.log('[RedeVeiculos Vincular] Resposta API:', responseText);

    let apiResult: VincularResponse;
    try {
      apiResult = JSON.parse(responseText);
    } catch {
      throw new Error(`Resposta inválida da API: ${responseText}`);
    }

    // Verificar código de resposta
    // Código 1 = sucesso, outros = erro
    if (apiResult.codigo !== 1) {
      // Registrar log de erro
      await supabase.from('rastreadores_api_logs').insert({
        rastreador_id: rastreador.id,
        plataforma: 'rede_veiculos',
        operacao: 'vincularClienteVeiculo',
        request: payload,
        response: apiResult,
        status: 'erro',
        erro_mensagem: apiResult.msg,
      });

      throw new Error(`Erro na API Rede Veículos: ${apiResult.msg} (código: ${apiResult.codigo})`);
    }

    console.log('[RedeVeiculos Vincular] Vinculação bem sucedida:', apiResult);

    // ===== 8. Atualizar banco local com IDs da plataforma =====
    const updateData: Record<string, unknown> = {
      status: 'instalado',
      veiculo_id: veiculoId,
      updated_at: new Date().toISOString(),
    };

    if (apiResult.idEquipamento) {
      updateData.plataforma_device_id = apiResult.idEquipamento.toString();
    }

    await supabase
      .from('rastreadores')
      .update(updateData)
      .eq('id', rastreador.id);

    // Atualizar veículo com IDs da Rede Veículos
    const veiculoUpdateData: Record<string, unknown> = {};
    if (apiResult.idCliente) {
      veiculoUpdateData.rede_veiculos_cliente_id = apiResult.idCliente.toString();
    }
    if (apiResult.idVeiculo) {
      veiculoUpdateData.rede_veiculos_veiculo_id = apiResult.idVeiculo.toString();
    }

    if (Object.keys(veiculoUpdateData).length > 0) {
      await supabase
        .from('veiculos')
        .update(veiculoUpdateData)
        .eq('id', veiculoId);
    }

    // ===== 9. Registrar log de sucesso =====
    await supabase.from('rastreadores_api_logs').insert({
      rastreador_id: rastreador.id,
      plataforma: 'rede_veiculos',
      operacao: 'vincularClienteVeiculo',
      request: payload,
      response: apiResult,
      status: 'sucesso',
    });

    console.log('[RedeVeiculos Vincular] Processo concluído com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        rastreador_id: rastreador.id,
        rede_veiculos_cliente_id: apiResult.idCliente,
        rede_veiculos_veiculo_id: apiResult.idVeiculo,
        rede_veiculos_equipamento_id: apiResult.idEquipamento,
        mensagem: 'Cliente, veículo e equipamento vinculados com sucesso na Rede Veículos',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[RedeVeiculos Vincular] Erro:', error);

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

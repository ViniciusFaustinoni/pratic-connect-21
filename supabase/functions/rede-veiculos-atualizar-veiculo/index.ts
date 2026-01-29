import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  veiculoId: string;
  camposAlterados: {
    placa?: string;
    marca?: string;
    modelo?: string;
    ano_fabricacao?: number;
    ano_modelo?: number;
    cor?: string;
    chassi?: string;
    renavam?: string;
    valor_fipe?: number;
    codigo_fipe?: string;
    tipo?: string;
  };
}

interface Veiculo {
  id: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
  ano_fabricacao: number | null;
  ano_modelo: number | null;
  cor: string | null;
  chassi: string | null;
  renavam: string | null;
  tipo: string | null;
  valor_fipe: number | null;
  codigo_fipe: string | null;
  associado_id: string;
  rede_veiculos_cliente_id: string | null;
  rede_veiculos_veiculo_id: string | null;
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json() as RequestBody;
    const { veiculoId, camposAlterados } = body;

    console.log('[RedeVeiculos Atualizar Veículo] Iniciando atualização:', { veiculoId, campos: Object.keys(camposAlterados) });

    if (!veiculoId) {
      throw new Error('ID do veículo é obrigatório');
    }

    if (!camposAlterados || Object.keys(camposAlterados).length === 0) {
      console.log('[RedeVeiculos Atualizar Veículo] Nenhum campo para atualizar');
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum campo para atualizar' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // ===== 1. Buscar veículo =====
    const { data: veiculo, error: veiculoError } = await supabase
      .from('veiculos')
      .select(`
        id,
        placa,
        marca,
        modelo,
        ano_fabricacao,
        ano_modelo,
        cor,
        chassi,
        renavam,
        tipo,
        valor_fipe,
        codigo_fipe,
        associado_id,
        rede_veiculos_cliente_id,
        rede_veiculos_veiculo_id
      `)
      .eq('id', veiculoId)
      .single();

    if (veiculoError || !veiculo) {
      throw new Error(`Veículo não encontrado: ${veiculoError?.message || 'ID inválido'}`);
    }

    console.log('[RedeVeiculos Atualizar Veículo] Veículo encontrado:', veiculo.placa);

    // ===== 2. Verificar se veículo tem vínculo na Rede Veículos =====
    if (!veiculo.rede_veiculos_veiculo_id) {
      console.log('[RedeVeiculos Atualizar Veículo] Veículo não possui vínculo na Rede Veículos');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Veículo não possui vínculo na Rede Veículos. Atualização local apenas.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`[RedeVeiculos Atualizar Veículo] ID na plataforma: ${veiculo.rede_veiculos_veiculo_id}`);

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

    console.log('[RedeVeiculos Atualizar Veículo] Autenticado, ambiente:', plataforma.ambiente_atual);

    // ===== 5. Montar payload com apenas os campos alterados =====
    const payload: Record<string, unknown> = {
      // ID do veículo na plataforma (obrigatório, imutável)
      idVeiculo: parseInt(veiculo.rede_veiculos_veiculo_id, 10),
    };

    // Objeto para campos do veículo alterados
    const veiculoPayload: Record<string, unknown> = {};

    // Adicionar campos alterados
    if (camposAlterados.placa !== undefined) {
      veiculoPayload.placa = camposAlterados.placa;
    }
    if (camposAlterados.marca !== undefined) {
      veiculoPayload.marca = camposAlterados.marca;
    }
    if (camposAlterados.modelo !== undefined) {
      veiculoPayload.modelo = camposAlterados.modelo;
    }
    if (camposAlterados.ano_modelo !== undefined) {
      veiculoPayload.ano = camposAlterados.ano_modelo;
    }
    if (camposAlterados.ano_fabricacao !== undefined) {
      veiculoPayload.anoFabricacao = camposAlterados.ano_fabricacao;
    }
    if (camposAlterados.cor !== undefined) {
      veiculoPayload.cor = camposAlterados.cor.toUpperCase();
    }
    if (camposAlterados.chassi !== undefined) {
      veiculoPayload.chassi = camposAlterados.chassi;
    }
    if (camposAlterados.renavam !== undefined) {
      veiculoPayload.renavam = camposAlterados.renavam;
    }
    if (camposAlterados.tipo !== undefined) {
      veiculoPayload.tipo = mapTipoVeiculo(camposAlterados.tipo);
    }
    if (camposAlterados.valor_fipe !== undefined) {
      veiculoPayload.valorFipe = camposAlterados.valor_fipe;
    }
    if (camposAlterados.codigo_fipe !== undefined) {
      veiculoPayload.codigoFipe = camposAlterados.codigo_fipe;
    }

    // Adicionar ao payload apenas se houver campos alterados
    if (Object.keys(veiculoPayload).length > 0) {
      payload.veiculo = veiculoPayload;
    }

    console.log('[RedeVeiculos Atualizar Veículo] Payload montado:', JSON.stringify(payload, null, 2));

    // ===== 6. Chamar API Rede Veículos - POST /atualizarDadosVeiculo =====
    const formData = new URLSearchParams();
    formData.append('json', JSON.stringify(payload));

    const apiResponse = await fetch(`${baseUrl}/atualizarDadosVeiculo/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    const responseText = await apiResponse.text();
    console.log('[RedeVeiculos Atualizar Veículo] Resposta API:', responseText);

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
        operacao: 'atualizarDadosVeiculo',
        request: payload,
        response: apiResult,
        status: 'erro',
        erro_mensagem: apiResult.msg,
      });

      throw new Error(`Erro na API Rede Veículos: ${apiResult.msg} (código: ${apiResult.codigo})`);
    }

    console.log('[RedeVeiculos Atualizar Veículo] Atualização bem sucedida:', apiResult);

    // ===== 7. Registrar log de sucesso =====
    await supabase.from('rastreadores_api_logs').insert({
      plataforma: 'rede_veiculos',
      operacao: 'atualizarDadosVeiculo',
      request: payload,
      response: apiResult,
      status: 'sucesso',
    });

    console.log('[RedeVeiculos Atualizar Veículo] Processo concluído com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        campos_atualizados: Object.keys(camposAlterados),
        id_veiculo_plataforma: veiculo.rede_veiculos_veiculo_id,
        mensagem: 'Dados do veículo atualizados com sucesso na Rede Veículos',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[RedeVeiculos Atualizar Veículo] Erro:', error);

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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AgendarVistoriaRequest {
  cotacaoId: string;
  dataAgendada: string;
  horarioAgendado: string;
  endereco: {
    cep: string;
    logradouro: string;
    numero: string;
    bairro: string;
    cidade: string;
    estado: string;
  };
  responsavel: {
    euMesmo: boolean;
    nome?: string;
    telefone?: string;
  };
  latitude?: number | null;
  longitude?: number | null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Usar service_role para bypassar RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const body: AgendarVistoriaRequest = await req.json();
    const { cotacaoId, dataAgendada, horarioAgendado, endereco, responsavel, latitude, longitude } = body;

    console.log('[AgendarVistoriaCompleta] Iniciando para cotação:', cotacaoId);

    // 0. VERIFICAR SE JÁ EXISTE INSTALAÇÃO/VISTORIA PARA EVITAR DUPLICATAS
    const { data: instalacaoExistente } = await supabase
      .from('instalacoes')
      .select('id, status')
      .eq('cotacao_id', cotacaoId)
      .in('status', ['agendada', 'concluida', 'em_andamento', 'em_rota'])
      .maybeSingle();

    if (instalacaoExistente) {
      console.log('[AgendarVistoriaCompleta] Instalação já existe:', instalacaoExistente.id);
      
      // Retornar sucesso com o ID existente (idempotência)
      return new Response(JSON.stringify({
        success: true,
        vistoriaId: null,
        instalacaoId: instalacaoExistente.id,
        message: 'Agendamento já existente'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 1. Buscar cotação e contrato
    const { data: cotacao, error: cotacaoError } = await supabase
      .from('cotacoes')
      .select('id, nome_solicitante, telefone1_solicitante, veiculo_placa, veiculo_marca, veiculo_modelo')
      .eq('id', cotacaoId)
      .single();

    if (cotacaoError || !cotacao) {
      console.error('[AgendarVistoriaCompleta] Cotação não encontrada:', cotacaoError);
      return new Response(JSON.stringify({ success: false, error: 'Cotação não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Buscar contrato vinculado (validação de segurança: deve ter link_token)
    const { data: contrato, error: contratoError } = await supabase
      .from('contratos')
      .select('id, associado_id, veiculo_id, link_token')
      .eq('cotacao_id', cotacaoId)
      .single();

    if (contratoError || !contrato) {
      console.error('[AgendarVistoriaCompleta] Contrato não encontrado:', contratoError);
      return new Response(JSON.stringify({ success: false, error: 'Contrato não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validação de segurança: só permite se o contrato tem link_token (foi gerado para acesso público)
    if (!contrato.link_token) {
      console.error('[AgendarVistoriaCompleta] Contrato sem link_token');
      return new Response(JSON.stringify({ success: false, error: 'Acesso não autorizado' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Atualizar cotação com dados da vistoria completa
    const updateData: Record<string, unknown> = {
      vistoria_completa_data_agendada: dataAgendada,
      vistoria_completa_horario_agendado: horarioAgendado,
      vistoria_completa_endereco_cep: endereco.cep,
      vistoria_completa_endereco_logradouro: endereco.logradouro,
      vistoria_completa_endereco_numero: endereco.numero,
      vistoria_completa_endereco_bairro: endereco.bairro,
      vistoria_completa_endereco_cidade: endereco.cidade,
      vistoria_completa_endereco_estado: endereco.estado,
      vistoria_completa_responsavel_eu_mesmo: responsavel.euMesmo,
      vistoria_completa_responsavel_nome: responsavel.nome || null,
      vistoria_completa_responsavel_telefone: responsavel.telefone || null,
    };

    if (latitude && longitude) {
      updateData.vistoria_endereco_latitude = latitude;
      updateData.vistoria_endereco_longitude = longitude;
    }

    const { error: updateCotacaoError } = await supabase
      .from('cotacoes')
      .update(updateData)
      .eq('id', cotacaoId);

    if (updateCotacaoError) {
      console.error('[AgendarVistoriaCompleta] Erro ao atualizar cotação:', updateCotacaoError);
      throw updateCotacaoError;
    }

    // 4. Montar observações do responsável
    const obsResponsavel = responsavel.euMesmo 
      ? `Responsável: ${cotacao.nome_solicitante} - ${cotacao.telefone1_solicitante}` 
      : `Responsável: ${responsavel.nome} - ${responsavel.telefone}`;

    // 5. CRIAR VISTORIA
    const vistoriaData = {
      cotacao_id: cotacaoId,
      contrato_id: contrato.id,
      associado_id: contrato.associado_id,
      veiculo_id: contrato.veiculo_id,
      tipo: 'entrada',
      modalidade: 'presencial',
      status: 'agendada',
      origem: 'cotacao',
      data_agendada: dataAgendada,
      horario_agendado: horarioAgendado,
      endereco_cep: endereco.cep,
      endereco_logradouro: endereco.logradouro,
      endereco_numero: endereco.numero,
      endereco_bairro: endereco.bairro,
      endereco_cidade: endereco.cidade,
      endereco_estado: endereco.estado,
      endereco_latitude: latitude || null,
      endereco_longitude: longitude || null,
      observacoes: obsResponsavel,
    };

    const { data: novaVistoria, error: vistoriaError } = await supabase
      .from('vistorias')
      .insert(vistoriaData)
      .select('id')
      .single();

    if (vistoriaError) {
      console.error('[AgendarVistoriaCompleta] Erro ao criar vistoria:', vistoriaError);
      throw vistoriaError;
    }

    console.log('[AgendarVistoriaCompleta] Vistoria criada:', novaVistoria.id);

    // 6. Atualizar contrato com vistoria_id
    await supabase
      .from('contratos')
      .update({ vistoria_id: novaVistoria.id })
      .eq('id', contrato.id);

    // 7. CRIAR INSTALAÇÃO (usando nomes de colunas corretos da tabela instalacoes)
    const instalacaoData = {
      contrato_id: contrato.id,
      cotacao_id: cotacaoId,
      associado_id: contrato.associado_id,
      veiculo_id: contrato.veiculo_id,
      status: 'agendada',
      data_agendada: dataAgendada,
      hora_agendada: horarioAgendado,
      cep: endereco.cep,
      logradouro: endereco.logradouro,
      numero: endereco.numero,
      bairro: endereco.bairro,
      cidade: endereco.cidade,
      uf: endereco.estado,
      endereco_latitude: latitude || null,
      endereco_longitude: longitude || null,
      observacoes: obsResponsavel,
    };

    console.log('[AgendarVistoriaCompleta] Dados da instalação:', JSON.stringify(instalacaoData));

    const { data: novaInstalacao, error: instalacaoError } = await supabase
      .from('instalacoes')
      .insert(instalacaoData)
      .select('id')
      .single();

    if (instalacaoError) {
      console.error('[AgendarVistoriaCompleta] Erro ao criar instalação:', instalacaoError);
      throw new Error(`Erro ao criar instalação: ${instalacaoError.message}`);
    }
    
    console.log('[AgendarVistoriaCompleta] Instalação criada com sucesso:', novaInstalacao.id);

    return new Response(JSON.stringify({
      success: true,
      vistoriaId: novaVistoria.id,
      instalacaoId: novaInstalacao?.id || null
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[AgendarVistoriaCompleta] Erro geral:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

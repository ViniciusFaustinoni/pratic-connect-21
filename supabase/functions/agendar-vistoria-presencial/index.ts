import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AgendarVistoriaPresencialRequest {
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

    const body: AgendarVistoriaPresencialRequest = await req.json();
    const { cotacaoId, dataAgendada, horarioAgendado, endereco, responsavel, latitude, longitude } = body;

    console.log('[AgendarVistoriaPresencial] Iniciando para cotação:', cotacaoId);

    // 0. VERIFICAR SE JÁ EXISTE INSTALAÇÃO PARA EVITAR DUPLICATAS
    const { data: instalacaoExistente } = await supabase
      .from('instalacoes')
      .select('id, status')
      .eq('cotacao_id', cotacaoId)
      .in('status', ['agendada', 'concluida', 'em_andamento', 'em_rota'])
      .maybeSingle();

    if (instalacaoExistente) {
      console.log('[AgendarVistoriaPresencial] Instalação já existe:', instalacaoExistente.id);
      
      // Buscar vistoria existente também
      const { data: vistoriaExistente } = await supabase
        .from('vistorias')
        .select('id')
        .eq('cotacao_id', cotacaoId)
        .eq('modalidade', 'presencial')
        .maybeSingle();
      
      // Retornar sucesso com os IDs existentes (idempotência)
      return new Response(JSON.stringify({
        success: true,
        vistoriaId: vistoriaExistente?.id || null,
        instalacaoId: instalacaoExistente.id,
        message: 'Agendamento já existente'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verificar se já existe vistoria presencial
    const { data: vistoriaExistente } = await supabase
      .from('vistorias')
      .select('id')
      .eq('cotacao_id', cotacaoId)
      .eq('modalidade', 'presencial')
      .maybeSingle();

    if (vistoriaExistente) {
      console.log('[AgendarVistoriaPresencial] Vistoria já existe, criando apenas instalação');
    }

    // 1. Buscar cotação
    const { data: cotacao, error: cotacaoError } = await supabase
      .from('cotacoes')
      .select('id, nome_solicitante, telefone1_solicitante, veiculo_placa, veiculo_marca, veiculo_modelo')
      .eq('id', cotacaoId)
      .single();

    if (cotacaoError || !cotacao) {
      console.error('[AgendarVistoriaPresencial] Cotação não encontrada:', cotacaoError);
      return new Response(JSON.stringify({ success: false, error: 'Cotação não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Buscar contrato vinculado
    const { data: contrato, error: contratoError } = await supabase
      .from('contratos')
      .select('id, associado_id, veiculo_id, link_token')
      .eq('cotacao_id', cotacaoId)
      .single();

    if (contratoError || !contrato) {
      console.error('[AgendarVistoriaPresencial] Contrato não encontrado:', contratoError);
      return new Response(JSON.stringify({ success: false, error: 'Contrato não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validação de segurança: só permite se o contrato tem link_token
    if (!contrato.link_token) {
      console.error('[AgendarVistoriaPresencial] Contrato sem link_token');
      return new Response(JSON.stringify({ success: false, error: 'Acesso não autorizado' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Atualizar cotação com dados da vistoria presencial (campos vistoria_*, não vistoria_completa_*)
    const updateData: Record<string, unknown> = {
      tipo_vistoria: 'agendada',
      status_contratacao: 'vistoria_ok',
      vistoria_data_agendada: dataAgendada,
      vistoria_horario_agendado: horarioAgendado,
      vistoria_endereco_cep: endereco.cep,
      vistoria_endereco_logradouro: endereco.logradouro,
      vistoria_endereco_numero: endereco.numero,
      vistoria_endereco_bairro: endereco.bairro,
      vistoria_endereco_cidade: endereco.cidade,
      vistoria_endereco_estado: endereco.estado,
      vistoria_responsavel_eu_mesmo: responsavel.euMesmo,
      vistoria_responsavel_nome: responsavel.nome || null,
      vistoria_responsavel_telefone: responsavel.telefone || null,
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
      console.error('[AgendarVistoriaPresencial] Erro ao atualizar cotação:', updateCotacaoError);
      throw updateCotacaoError;
    }

    console.log('[AgendarVistoriaPresencial] Cotação atualizada com sucesso');

    // 4. Montar observações do responsável
    const obsResponsavel = responsavel.euMesmo 
      ? `Responsável: ${cotacao.nome_solicitante} - ${cotacao.telefone1_solicitante}` 
      : `Responsável: ${responsavel.nome} - ${responsavel.telefone}`;

    let vistoriaId = vistoriaExistente?.id || null;

    // 5. CRIAR VISTORIA (se não existir)
    if (!vistoriaExistente) {
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
        console.error('[AgendarVistoriaPresencial] Erro ao criar vistoria:', vistoriaError);
        throw vistoriaError;
      }

      vistoriaId = novaVistoria.id;
      console.log('[AgendarVistoriaPresencial] Vistoria criada:', vistoriaId);

      // 6. Atualizar contrato com vistoria_id
      await supabase
        .from('contratos')
        .update({ vistoria_id: vistoriaId })
        .eq('id', contrato.id);
    }

    // 7. A instalação será criada apenas quando a vistoria for aprovada (processar-vistoria)
    // Não criar instalação prematuramente para evitar duplicação no mapa
    console.log('[AgendarVistoriaPresencial] Vistoria agendada. Instalação será criada após aprovação.');

    return new Response(JSON.stringify({
      success: true,
      vistoriaId,
      instalacaoId: null, // Será criada após aprovação da vistoria
      message: 'Vistoria presencial agendada com sucesso'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AgendarVistoriaPresencial] Erro geral:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

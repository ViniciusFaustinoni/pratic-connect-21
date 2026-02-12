import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CriarInstalacaoRequest {
  cotacaoId: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const body: CriarInstalacaoRequest = await req.json();
    const { cotacaoId } = body;

    console.log('[CriarInstalacaoPosPagamento] Iniciando para cotação:', cotacaoId);

    // 0. VERIFICAR SE JÁ EXISTE INSTALAÇÃO PARA EVITAR DUPLICATAS
    const { data: instalacaoExistente } = await supabase
      .from('instalacoes')
      .select('id, status')
      .eq('cotacao_id', cotacaoId)
      .maybeSingle();

    if (instalacaoExistente) {
      console.log('[CriarInstalacaoPosPagamento] Instalação já existe:', instalacaoExistente.id);
      return new Response(JSON.stringify({
        success: true,
        instalacaoId: instalacaoExistente.id,
        message: 'Instalação já existente'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 1. Buscar cotação com dados de agendamento
    const { data: cotacao, error: cotacaoError } = await supabase
      .from('cotacoes')
      .select(`
        id,
        nome_solicitante,
        telefone1_solicitante,
        tipo_vistoria,
        vistoria_data_agendada,
        vistoria_horario_agendado,
        vistoria_periodo,
        vistoria_endereco_cep,
        vistoria_endereco_logradouro,
        vistoria_endereco_numero,
        vistoria_endereco_bairro,
        vistoria_endereco_cidade,
        vistoria_endereco_estado,
        vistoria_endereco_latitude,
        vistoria_endereco_longitude,
        vistoria_responsavel_eu_mesmo,
        vistoria_responsavel_nome,
        vistoria_responsavel_telefone,
        vistoria_permite_encaixe,
        vistoria_completa_data_agendada,
        vistoria_completa_horario_agendado,
        vistoria_completa_periodo,
        vistoria_completa_endereco_cep,
        vistoria_completa_endereco_logradouro,
        vistoria_completa_endereco_numero,
        vistoria_completa_endereco_bairro,
        vistoria_completa_endereco_cidade,
        vistoria_completa_endereco_estado,
        vistoria_completa_responsavel_eu_mesmo,
        vistoria_completa_responsavel_nome,
        vistoria_completa_responsavel_telefone
      `)
      .eq('id', cotacaoId)
      .single();

    if (cotacaoError || !cotacao) {
      console.error('[CriarInstalacaoPosPagamento] Cotação não encontrada:', cotacaoError);
      return new Response(JSON.stringify({ success: false, error: 'Cotação não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Buscar contrato vinculado
    const { data: contrato, error: contratoError } = await supabase
      .from('contratos')
      .select('id, associado_id, veiculo_id, adesao_paga')
      .eq('cotacao_id', cotacaoId)
      .single();

    if (contratoError || !contrato) {
      console.error('[CriarInstalacaoPosPagamento] Contrato não encontrado:', contratoError);
      return new Response(JSON.stringify({ success: false, error: 'Contrato não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Verificar se pagamento foi realizado
    if (!contrato.adesao_paga) {
      console.log('[CriarInstalacaoPosPagamento] Pagamento ainda não confirmado');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Pagamento não confirmado',
        message: 'A instalação só será criada após confirmação do pagamento'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3.1 CORREÇÃO: Garantir que veiculo_id existe, buscar pela placa se necessário
    let veiculoIdFinal = contrato.veiculo_id;

    if (!veiculoIdFinal) {
      console.log('[CriarInstalacaoPosPagamento] veiculo_id null no contrato, buscando pela placa...');
      
      // Buscar placa da cotação
      const { data: cotacaoVeiculo } = await supabase
        .from('cotacoes')
        .select('veiculo_placa')
        .eq('id', cotacaoId)
        .single();
      
      if (cotacaoVeiculo?.veiculo_placa) {
        const placaLimpa = cotacaoVeiculo.veiculo_placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        
        const { data: veiculo } = await supabase
          .from('veiculos')
          .select('id')
          .eq('placa', placaLimpa)
          .maybeSingle();
        
        if (veiculo) {
          veiculoIdFinal = veiculo.id;
          console.log('[CriarInstalacaoPosPagamento] Veículo encontrado pela placa:', veiculoIdFinal);
          
          // Atualizar contrato com o veiculo_id correto
          await supabase
            .from('contratos')
            .update({ veiculo_id: veiculoIdFinal })
            .eq('id', contrato.id);
          
          console.log('[CriarInstalacaoPosPagamento] Contrato atualizado com veiculo_id');
        }
      }
    }

    if (!veiculoIdFinal) {
      console.error('[CriarInstalacaoPosPagamento] Não foi possível encontrar veículo');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Veículo não encontrado para criar instalação'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 4. Determinar qual conjunto de dados usar baseado no tipo_vistoria
    const tipoVistoria = cotacao.tipo_vistoria;
    let dataAgendada: string | null = null;
    let periodoAgendado: string | null = null;
    let endereco = {
      cep: '',
      logradouro: '',
      numero: '',
      bairro: '',
      cidade: '',
      estado: '',
      latitude: null as number | null,
      longitude: null as number | null,
    };
    let obsResponsavel = '';

    // Log detalhado para debug
    console.log(`[CriarInstalacaoPosPagamento] tipo_vistoria: ${tipoVistoria}`);

    if (tipoVistoria === 'agendada') {
      // VISTORIA PRESENCIAL SIMPLES: Usar campos vistoria_*
      console.log('[CriarInstalacaoPosPagamento] Modo: vistoria agendada (presencial simples)');
      dataAgendada = cotacao.vistoria_data_agendada;
      // Priorizar período sobre horário (novo fluxo)
      periodoAgendado = (cotacao as any).vistoria_periodo || cotacao.vistoria_horario_agendado;
      endereco = {
        cep: cotacao.vistoria_endereco_cep || '',
        logradouro: cotacao.vistoria_endereco_logradouro || '',
        numero: cotacao.vistoria_endereco_numero || '',
        bairro: cotacao.vistoria_endereco_bairro || '',
        cidade: cotacao.vistoria_endereco_cidade || '',
        estado: cotacao.vistoria_endereco_estado || '',
        latitude: cotacao.vistoria_endereco_latitude,
        longitude: cotacao.vistoria_endereco_longitude,
      };
      obsResponsavel = cotacao.vistoria_responsavel_eu_mesmo
        ? `Responsável: ${cotacao.nome_solicitante} - ${cotacao.telefone1_solicitante}`
        : `Responsável: ${cotacao.vistoria_responsavel_nome || ''} - ${cotacao.vistoria_responsavel_telefone || ''}`;
    } else if (tipoVistoria === 'autovistoria') {
      // AUTOVISTORIA: Tentar vistoria_completa_* primeiro, FALLBACK para vistoria_*
      console.log('[CriarInstalacaoPosPagamento] Modo: autovistoria');
      dataAgendada = cotacao.vistoria_completa_data_agendada;
      periodoAgendado = (cotacao as any).vistoria_completa_periodo || cotacao.vistoria_completa_horario_agendado;
      
      if (dataAgendada) {
        // Dados completos disponíveis
        console.log('[CriarInstalacaoPosPagamento] Usando dados de vistoria_completa_*');
        endereco = {
          cep: cotacao.vistoria_completa_endereco_cep || '',
          logradouro: cotacao.vistoria_completa_endereco_logradouro || '',
          numero: cotacao.vistoria_completa_endereco_numero || '',
          bairro: cotacao.vistoria_completa_endereco_bairro || '',
          cidade: cotacao.vistoria_completa_endereco_cidade || '',
          estado: cotacao.vistoria_completa_endereco_estado || '',
          latitude: cotacao.vistoria_endereco_latitude,
          longitude: cotacao.vistoria_endereco_longitude,
        };
        obsResponsavel = cotacao.vistoria_completa_responsavel_eu_mesmo
          ? `Responsável: ${cotacao.nome_solicitante} - ${cotacao.telefone1_solicitante}`
          : `Responsável: ${cotacao.vistoria_completa_responsavel_nome || ''} - ${cotacao.vistoria_completa_responsavel_telefone || ''}`;
      } else {
        // FALLBACK: vistoria_completa_* está vazio, usar vistoria_* simples
        console.log('[CriarInstalacaoPosPagamento] FALLBACK: vistoria_completa_* vazio, usando vistoria_*');
        dataAgendada = cotacao.vistoria_data_agendada;
        periodoAgendado = (cotacao as any).vistoria_periodo || cotacao.vistoria_horario_agendado;
        
        // Se ainda não tem data, usar data de amanhã como fallback para encaixes
        if (!dataAgendada && cotacao.vistoria_permite_encaixe) {
          const amanha = new Date(Date.now() + 86400000).toISOString().split('T')[0];
          dataAgendada = amanha;
          console.log(`[CriarInstalacaoPosPagamento] Sem data agendada mas permite encaixe - usando amanhã: ${amanha}`);
        }
        
        endereco = {
          cep: cotacao.vistoria_endereco_cep || '',
          logradouro: cotacao.vistoria_endereco_logradouro || '',
          numero: cotacao.vistoria_endereco_numero || '',
          bairro: cotacao.vistoria_endereco_bairro || '',
          cidade: cotacao.vistoria_endereco_cidade || '',
          estado: cotacao.vistoria_endereco_estado || '',
          latitude: cotacao.vistoria_endereco_latitude,
          longitude: cotacao.vistoria_endereco_longitude,
        };
        obsResponsavel = cotacao.vistoria_responsavel_eu_mesmo
          ? `Responsável: ${cotacao.nome_solicitante} - ${cotacao.telefone1_solicitante}`
          : `Responsável: ${cotacao.vistoria_responsavel_nome || ''} - ${cotacao.vistoria_responsavel_telefone || ''}`;
      }
    } else {
      // FALLBACK para outros tipos futuros: usar vistoria_completa_*
      console.log(`[CriarInstalacaoPosPagamento] Modo: fallback (tipo=${tipoVistoria}) → usando dados de vistoria_completa_*`);
      dataAgendada = cotacao.vistoria_completa_data_agendada;
      periodoAgendado = (cotacao as any).vistoria_completa_periodo || cotacao.vistoria_completa_horario_agendado;
      endereco = {
        cep: cotacao.vistoria_completa_endereco_cep || '',
        logradouro: cotacao.vistoria_completa_endereco_logradouro || '',
        numero: cotacao.vistoria_completa_endereco_numero || '',
        bairro: cotacao.vistoria_completa_endereco_bairro || '',
        cidade: cotacao.vistoria_completa_endereco_cidade || '',
        estado: cotacao.vistoria_completa_endereco_estado || '',
        latitude: cotacao.vistoria_endereco_latitude,
        longitude: cotacao.vistoria_endereco_longitude,
      };
      obsResponsavel = cotacao.vistoria_completa_responsavel_eu_mesmo
        ? `Responsável: ${cotacao.nome_solicitante} - ${cotacao.telefone1_solicitante}`
        : `Responsável: ${cotacao.vistoria_completa_responsavel_nome || ''} - ${cotacao.vistoria_completa_responsavel_telefone || ''}`;
    }
    
    console.log(`[CriarInstalacaoPosPagamento] dataAgendada: ${dataAgendada}`);
    console.log(`[CriarInstalacaoPosPagamento] periodoAgendado: ${periodoAgendado}`);
    console.log(`[CriarInstalacaoPosPagamento] endereco: ${JSON.stringify(endereco)}`);

    // 5. Verificar se tem data agendada
    if (!dataAgendada) {
      console.log('[CriarInstalacaoPosPagamento] Nenhuma data de agendamento encontrada');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Dados de agendamento não encontrados',
        message: 'A cotação não possui dados de agendamento de instalação'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 5.1 VALIDAÇÃO CRÍTICA: Verificar coordenadas para atribuição automática
    // Se não tiver coordenadas, GEOCODIFICAR para garantir que atribuição automática funcione
    if (!endereco.latitude || !endereco.longitude) {
      console.warn('[CriarInstalacaoPosPagamento] ⚠️ Coordenadas ausentes! Tentando geocodificar...');
      console.log('[CriarInstalacaoPosPagamento] Endereço para geocodificação:', JSON.stringify(endereco));
      
      if (endereco.logradouro && endereco.cidade) {
        try {
          const geoResponse = await fetch(`${supabaseUrl}/functions/v1/geocode-endereco`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              logradouro: endereco.logradouro,
              numero: endereco.numero,
              bairro: endereco.bairro,
              cidade: endereco.cidade,
              uf: endereco.estado,
              cep: endereco.cep,
            }),
          });
          
          if (geoResponse.ok) {
            const geoData = await geoResponse.json();
            if (geoData.success && geoData.latitude && geoData.longitude) {
              endereco.latitude = geoData.latitude;
              endereco.longitude = geoData.longitude;
              console.log(`[CriarInstalacaoPosPagamento] ✓ Geocodificado com sucesso: (${endereco.latitude}, ${endereco.longitude})`);
            } else {
              console.warn('[CriarInstalacaoPosPagamento] Geocodificação retornou sem coordenadas:', geoData);
            }
          } else {
            console.warn('[CriarInstalacaoPosPagamento] Geocodificação falhou com status:', geoResponse.status);
          }
        } catch (geoError) {
          console.warn('[CriarInstalacaoPosPagamento] Erro na geocodificação:', geoError);
        }
      } else {
        console.warn('[CriarInstalacaoPosPagamento] Dados insuficientes para geocodificar');
      }
    } else {
      console.log(`[CriarInstalacaoPosPagamento] ✓ Coordenadas já presentes: (${endereco.latitude}, ${endereco.longitude})`);
    }

    // 5.2 Log do permite_encaixe
    const permiteEncaixe = cotacao.vistoria_permite_encaixe || false;
    console.log(`[CriarInstalacaoPosPagamento] permite_encaixe: ${permiteEncaixe} (origem: cotacao.vistoria_permite_encaixe = ${cotacao.vistoria_permite_encaixe})`);

    // 6. CRIAR INSTALAÇÃO (única, tipo instalacao, não entrada)
    // Determinar o período válido (manha ou tarde)
    const periodoValido = ['manha', 'tarde'].includes(periodoAgendado || '') ? periodoAgendado : null;
    
    const instalacaoData = {
      contrato_id: contrato.id,
      cotacao_id: cotacaoId,
      associado_id: contrato.associado_id,
      veiculo_id: veiculoIdFinal, // CORREÇÃO: Usar veiculoIdFinal que foi validado/recuperado
      status: 'agendada', // ✅ Status correto para atribuição automática
      data_agendada: dataAgendada,
      hora_agendada: null, // Não usa mais horário específico
      periodo: periodoValido, // ✅ Usa o período (manha/tarde)
      cep: endereco.cep,
      logradouro: endereco.logradouro,
      numero: endereco.numero,
      bairro: endereco.bairro,
      cidade: endereco.cidade,
      uf: endereco.estado,
      endereco_latitude: endereco.latitude || null,
      endereco_longitude: endereco.longitude || null,
      observacoes: obsResponsavel,
      permite_encaixe: permiteEncaixe, // ✅ Usando variável já logada
      local_vistoria: 'cliente', // ✅ CRÍTICO: Define que é atendimento no cliente (não na base)
      instalador_responsavel_id: null, // ✅ CRÍTICO: NULL para ser elegível à atribuição automática
    };
    
    console.log('[CriarInstalacaoPosPagamento] Período:', periodoValido);
    console.log('[CriarInstalacaoPosPagamento] Criando instalação:', JSON.stringify(instalacaoData));

    const { data: novaInstalacao, error: instalacaoError } = await supabase
      .from('instalacoes')
      .insert(instalacaoData)
      .select('id')
      .single();

    if (instalacaoError) {
      console.error('[CriarInstalacaoPosPagamento] Erro ao criar instalação:', instalacaoError);
      throw new Error(`Erro ao criar instalação: ${instalacaoError.message}`);
    }

    console.log('[CriarInstalacaoPosPagamento] Instalação criada com sucesso:', novaInstalacao.id);

    return new Response(JSON.stringify({
      success: true,
      instalacaoId: novaInstalacao.id,
      message: 'Instalação criada com sucesso'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[CriarInstalacaoPosPagamento] Erro geral:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

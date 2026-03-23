import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CriarInstalacaoRequest {
  cotacaoId: string;
  skipPaymentCheck?: boolean;
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
    const { cotacaoId, skipPaymentCheck } = body;

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

    // 3. Verificar se pagamento foi realizado (pular se skipPaymentCheck)
    if (!contrato.adesao_paga && !skipPaymentCheck) {
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
    if (skipPaymentCheck) {
      console.log('[CriarInstalacaoPosPagamento] skipPaymentCheck=true, pulando verificação de adesao_paga');
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
    // Para autovistoria sem data: pular criação de instalação (cadastro criará depois)
    // mas ainda gerar lançamentos CC do vendedor externo
    let novaInstalacaoId: string | null = null;
    
    if (!dataAgendada) {
      if (tipoVistoria === 'autovistoria') {
        console.log('[CriarInstalacaoPosPagamento] Autovistoria sem data de agendamento — pulando criação de instalação (cadastro criará após aprovação)');
      } else {
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
    }

    // Se tem data, criar instalação normalmente
    if (dataAgendada) {
      // 5.1 VALIDAÇÃO CRÍTICA: Verificar coordenadas para atribuição automática
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
      console.log(`[CriarInstalacaoPosPagamento] permite_encaixe: ${permiteEncaixe}`);

      // 5.3 Determinar tipo_deslocamento pelo Mapa de Atendimento
      let tipoDeslocamento = 'volante';
      try {
        const { data: municipio } = await supabase
          .from('municipios_atendimento')
          .select('tipo_atendimento')
          .ilike('nome', (endereco.cidade || '').trim())
          .ilike('uf', (endereco.estado || '').trim())
          .maybeSingle();

        if (municipio?.tipo_atendimento === 'viagem') {
          tipoDeslocamento = 'viagem';
        } else if (municipio?.tipo_atendimento === 'prestador') {
          tipoDeslocamento = 'prestador';
        }
        console.log(`[CriarInstalacaoPosPagamento] tipo_deslocamento: ${tipoDeslocamento} (municipio: ${endereco.cidade}/${endereco.estado})`);
      } catch (err) {
        console.warn('[CriarInstalacaoPosPagamento] Erro ao consultar municipio, usando volante:', err);
      }

      // 6. CRIAR INSTALAÇÃO
      const periodoValido = ['manha', 'tarde'].includes(periodoAgendado || '') ? periodoAgendado : null;
      
      const instalacaoData = {
        contrato_id: contrato.id,
        cotacao_id: cotacaoId,
        associado_id: contrato.associado_id,
        veiculo_id: veiculoIdFinal,
        status: 'agendada',
        data_agendada: dataAgendada,
        hora_agendada: null,
        periodo: periodoValido,
        cep: endereco.cep,
        logradouro: endereco.logradouro,
        numero: endereco.numero,
        bairro: endereco.bairro,
        cidade: endereco.cidade,
        uf: endereco.estado,
        endereco_latitude: endereco.latitude || null,
        endereco_longitude: endereco.longitude || null,
        observacoes: obsResponsavel,
        permite_encaixe: permiteEncaixe,
        local_vistoria: 'cliente',
        instalador_responsavel_id: null,
        tipo_deslocamento: tipoDeslocamento,
      };
      
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

      novaInstalacaoId = novaInstalacao.id;
      console.log('[CriarInstalacaoPosPagamento] Instalação criada com sucesso:', novaInstalacaoId);
    }

    // 6.1 GERAR LANÇAMENTOS CC VENDEDOR EXTERNO (roda INDEPENDENTE da criação de instalação)
    try {
      const { data: cotacaoVendedor } = await supabase
        .from('cotacoes')
        .select('vendedor_id, tipo_instalacao, valor_adesao')
        .eq('id', cotacaoId)
        .single();

      if (cotacaoVendedor?.vendedor_id) {
        const { data: perfilVendedor } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', cotacaoVendedor.vendedor_id)
          .eq('role', 'vendedor_externo')
          .maybeSingle();

        if (perfilVendedor) {
          console.log('[CriarInstalacaoPosPagamento] Vendedor externo detectado, gerando lançamentos CC...');
          
          const { data: lancExistente } = await supabase
            .from('cc_vendedor_lancamentos')
            .select('id')
            .eq('contrato_id', contrato.id)
            .eq('vendedor_id', cotacaoVendedor.vendedor_id)
            .limit(1);

          if (lancExistente && lancExistente.length > 0) {
            console.log('[CriarInstalacaoPosPagamento] Lançamentos CC já existem, pulando...');
          } else {
            const { data: configs } = await supabase
              .from('configuracoes')
              .select('chave, valor')
              .in('chave', [
                'comissao_ext_pct_adesao',
                'comissao_ext_valor_volante',
                'comissao_ext_tipo_recorrente',
                'comissao_ext_valor_recorrente',
                'comissao_ext_parcelas_recorrente',
              ]);

            const configMap: Record<string, string> = {
              comissao_ext_pct_adesao: '100',
              comissao_ext_valor_volante: '50',
              comissao_ext_tipo_recorrente: 'percentual',
              comissao_ext_valor_recorrente: '0',
              comissao_ext_parcelas_recorrente: '6',
            };
            configs?.forEach(c => { if (c.valor) configMap[c.chave] = c.valor; });

            const pctAdesao = Number(configMap.comissao_ext_pct_adesao) / 100;
            const valorVolante = Number(configMap.comissao_ext_valor_volante);
            const tipoRecorrente = configMap.comissao_ext_tipo_recorrente;
            const valorRecorrente = Number(configMap.comissao_ext_valor_recorrente);
            const parcelasRecorrente = Number(configMap.comissao_ext_parcelas_recorrente);

            const valorAdesao = cotacaoVendedor.valor_adesao || 0;
            const tipoInstalacao = cotacaoVendedor.tipo_instalacao || 'base';
            const cobrou = valorAdesao > 0;
            const volante = tipoInstalacao === 'volante' || tipoInstalacao === 'rota';
            const hoje = new Date().toISOString().slice(0, 10);

            const { data: assocData } = await supabase
              .from('associados')
              .select('nome')
              .eq('id', contrato.associado_id)
              .single();
            const nomeAssociado = assocData?.nome || 'Associado';

            if (!cobrou && !volante) {
              console.log('[CriarInstalacaoPosPagamento] Cenário isenta+base: nenhum lançamento CC');
            } else {
              const inserts: any[] = [];

              if (cobrou) {
                const comissaoAdesao = valorAdesao * pctAdesao;
                inserts.push({
                  vendedor_id: cotacaoVendedor.vendedor_id,
                  associado_id: contrato.associado_id,
                  contrato_id: contrato.id,
                  tipo: 'credito', categoria: 'adesao',
                  descricao: `Comissão de adesão — ${nomeAssociado} — R$ ${comissaoAdesao.toFixed(2)}`,
                  valor_bruto: comissaoAdesao, valor_abatimento: 0, valor_liquido: comissaoAdesao,
                  status: 'a_pagar', data_lancamento: hoje,
                });
              }

              if (volante) {
                inserts.push({
                  vendedor_id: cotacaoVendedor.vendedor_id,
                  associado_id: contrato.associado_id,
                  contrato_id: contrato.id,
                  tipo: 'debito', categoria: 'volante',
                  descricao: `Débito instalação volante — ${nomeAssociado} — R$ ${valorVolante.toFixed(2)}`,
                  valor_bruto: valorVolante, valor_abatimento: 0, valor_liquido: valorVolante,
                  status: cobrou ? 'a_pagar' : 'pendente',
                  data_lancamento: hoje,
                });
              }

              for (let i = 1; i <= parcelasRecorrente; i++) {
                const valorBruto = tipoRecorrente === 'fixo' ? valorRecorrente : 0;
                inserts.push({
                  vendedor_id: cotacaoVendedor.vendedor_id,
                  associado_id: contrato.associado_id,
                  contrato_id: contrato.id,
                  tipo: 'credito', categoria: 'recorrente',
                  descricao: `Comissão recorrente parcela ${i}/${parcelasRecorrente} — ${nomeAssociado}`,
                  valor_bruto: valorBruto, valor_abatimento: 0, valor_liquido: valorBruto,
                  parcela_numero: i, parcela_total: parcelasRecorrente,
                  status: 'pendente',
                  data_lancamento: hoje,
                });
              }

              const { error: ccError } = await supabase.from('cc_vendedor_lancamentos').insert(inserts);
              if (ccError) {
                console.error('[CriarInstalacaoPosPagamento] Erro ao gerar lançamentos CC:', ccError);
              } else {
                console.log(`[CriarInstalacaoPosPagamento] ✓ ${inserts.length} lançamentos CC gerados para vendedor ${cotacaoVendedor.vendedor_id}`);
              }
            }
          }
        }
      }
    } catch (ccErr) {
      console.error('[CriarInstalacaoPosPagamento] Erro ao processar CC vendedor externo:', ccErr);
    }

    // 7. DISPARAR ATRIBUIÇÃO AUTOMÁTICA (só se instalação foi criada)
    if (novaInstalacaoId) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/cron-atribuir-tarefas`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        console.log('[CriarInstalacaoPosPagamento] ✓ Atribuição automática disparada');
      } catch (atribErr) {
        console.warn('[CriarInstalacaoPosPagamento] Atribuição imediata falhou:', atribErr);
      }

      // 8. NOTIFICAR ASSOCIADO via WhatsApp
      try {
        const periodoValido2 = ['manha', 'tarde'].includes(periodoAgendado || '') ? periodoAgendado : 'manha';
        const periodoTexto = periodoValido2 === 'manha' ? 'Manhã (08:00-12:00)' : 'Tarde (14:00-18:00)';
        await supabase.functions.invoke('notificar-cliente', {
          body: {
            tipo: 'instalacao_agendada',
            associado_id: contrato.associado_id,
            dados: {
              data: dataAgendada,
              periodo: periodoTexto,
            },
          },
        });
        console.log(`[CriarInstalacaoPosPagamento] ✓ Notificação enviada ao associado`);
      } catch (notifErr) {
        console.error('[CriarInstalacaoPosPagamento] Erro ao enviar notificação:', notifErr);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      instalacaoId: novaInstalacaoId,
      instalacaoCriada: !!novaInstalacaoId,
      message: novaInstalacaoId 
        ? 'Instalação criada com sucesso' 
        : 'Lançamentos CC gerados (instalação será criada após aprovação do cadastro)'
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

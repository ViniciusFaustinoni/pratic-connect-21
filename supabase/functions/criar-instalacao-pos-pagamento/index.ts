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
      .select('id, status, associado_id, veiculo_id, adesao_paga, aprovado_em')
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

    // O pagamento/agendamento não libera instalação sozinho.
    // A instalação só pode ser criada após aprovação explícita do Cadastro,
    // mas os lançamentos financeiros abaixo continuam idempotentes.
    const cadastroAprovado = !!contrato.aprovado_em;

    // 3.1 CORREÇÃO: Garantir que veiculo_id existe — fallback por placa OU por associado
    let veiculoIdFinal = contrato.veiculo_id;

    if (!veiculoIdFinal) {
      console.log('[CriarInstalacaoPosPagamento] veiculo_id null no contrato, tentando recuperar...');

      const { data: cotacaoVeiculo } = await supabase
        .from('cotacoes')
        .select('veiculo_placa, veiculo_marca, veiculo_modelo')
        .eq('id', cotacaoId)
        .single();

      // Tentativa 1: pela placa (se houver)
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
        }
      }

      // Tentativa 2: pelo associado_id + marca/modelo (carros 0km / placeholder 0KM*)
      if (!veiculoIdFinal && contrato.associado_id) {
        const { data: veiculoPorAssociado } = await supabase
          .from('veiculos')
          .select('id')
          .eq('associado_id', contrato.associado_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (veiculoPorAssociado) {
          veiculoIdFinal = veiculoPorAssociado.id;
          console.log('[CriarInstalacaoPosPagamento] Veículo encontrado pelo associado_id:', veiculoIdFinal);
        }
      }

      if (veiculoIdFinal) {
        await supabase
          .from('contratos')
          .update({ veiculo_id: veiculoIdFinal })
          .eq('id', contrato.id);
        console.log('[CriarInstalacaoPosPagamento] Contrato atualizado com veiculo_id');
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

    let agendamentoBaseId: string | null = null;
    let localVistoriaForce: 'cliente' | 'base' = 'cliente';

    if (tipoVistoria === 'agendada_base') {
      // VISTORIA AGENDADA NA BASE / OFICINA: ler dados de agendamentos_base
      console.log('[CriarInstalacaoPosPagamento] Modo: agendada_base (oficina/base)');
      localVistoriaForce = 'base';

      const { data: agBase } = await supabase
        .from('agendamentos_base')
        .select('id, data_agendada, horario, oficina_id, cliente_nome, cliente_telefone')
        .eq('cotacao_id', cotacaoId)
        .in('status', ['agendado', 'confirmado'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (agBase) {
        agendamentoBaseId = agBase.id;
        dataAgendada = agBase.data_agendada;
        const hStr = String(agBase.horario || '').trim().toLowerCase();
        if (hStr === 'manha' || hStr === 'tarde') {
          periodoAgendado = hStr;
        } else {
          const m = /^(\d{1,2}):/.exec(hStr);
          const h = m ? parseInt(m[1], 10) : 8;
          periodoAgendado = h < 12 ? 'manha' : 'tarde';
        }

        // Endereço: oficina vinculada ou base padrão das configurações
        if (agBase.oficina_id) {
          const { data: oficina } = await supabase
            .from('oficinas')
            .select('cep, logradouro, numero, bairro, cidade, estado, latitude, longitude')
            .eq('id', agBase.oficina_id)
            .maybeSingle();
          if (oficina) {
            endereco = {
              cep: oficina.cep || '',
              logradouro: oficina.logradouro || '',
              numero: oficina.numero || '',
              bairro: oficina.bairro || '',
              cidade: oficina.cidade || '',
              estado: oficina.estado || '',
              latitude: oficina.latitude ?? null,
              longitude: oficina.longitude ?? null,
            };
          }
        }
        if (!endereco.logradouro) {
          const { data: cfgs } = await supabase
            .from('configuracoes')
            .select('chave, valor')
            .in('chave', ['base_cep', 'base_logradouro', 'base_numero', 'base_bairro', 'base_cidade', 'base_uf']);
          const cfgMap: Record<string, string> = {};
          (cfgs || []).forEach((c: any) => { cfgMap[c.chave] = c.valor || ''; });
          endereco = {
            cep: cfgMap.base_cep || '',
            logradouro: cfgMap.base_logradouro || '',
            numero: cfgMap.base_numero || '',
            bairro: cfgMap.base_bairro || '',
            cidade: cfgMap.base_cidade || '',
            estado: cfgMap.base_uf || '',
            latitude: null,
            longitude: null,
          };
        }
        obsResponsavel = `Atendimento na base/oficina — ${agBase.cliente_nome || cotacao.nome_solicitante} - ${agBase.cliente_telefone || cotacao.telefone1_solicitante || ''}`;
      } else {
        console.warn('[CriarInstalacaoPosPagamento] tipo_vistoria=agendada_base mas sem registro em agendamentos_base');
      }
    } else if (tipoVistoria === 'agendada') {
      // VISTORIA PRESENCIAL SIMPLES: Usar campos vistoria_*
      // FALLBACK: fluxo público (agendar-vistoria-completa) salva em vistoria_completa_*
      // mesmo quando tipo_vistoria='agendada'. Aceitar ambos para evitar limbo.
      console.log('[CriarInstalacaoPosPagamento] Modo: vistoria agendada (presencial simples)');
      dataAgendada = cotacao.vistoria_data_agendada || cotacao.vistoria_completa_data_agendada;
      periodoAgendado = (cotacao as any).vistoria_periodo
        || cotacao.vistoria_horario_agendado
        || (cotacao as any).vistoria_completa_periodo
        || cotacao.vistoria_completa_horario_agendado;
      const usarCompleta = !cotacao.vistoria_data_agendada && !!cotacao.vistoria_completa_data_agendada;
      endereco = {
        cep: (usarCompleta ? cotacao.vistoria_completa_endereco_cep : cotacao.vistoria_endereco_cep) || '',
        logradouro: (usarCompleta ? cotacao.vistoria_completa_endereco_logradouro : cotacao.vistoria_endereco_logradouro) || '',
        numero: (usarCompleta ? cotacao.vistoria_completa_endereco_numero : cotacao.vistoria_endereco_numero) || '',
        bairro: (usarCompleta ? cotacao.vistoria_completa_endereco_bairro : cotacao.vistoria_endereco_bairro) || '',
        cidade: (usarCompleta ? cotacao.vistoria_completa_endereco_cidade : cotacao.vistoria_endereco_cidade) || '',
        estado: (usarCompleta ? cotacao.vistoria_completa_endereco_estado : cotacao.vistoria_endereco_estado) || '',
        latitude: cotacao.vistoria_endereco_latitude,
        longitude: cotacao.vistoria_endereco_longitude,
      };
      const respEuMesmo = usarCompleta ? cotacao.vistoria_completa_responsavel_eu_mesmo : cotacao.vistoria_responsavel_eu_mesmo;
      const respNome = usarCompleta ? cotacao.vistoria_completa_responsavel_nome : cotacao.vistoria_responsavel_nome;
      const respTel = usarCompleta ? cotacao.vistoria_completa_responsavel_telefone : cotacao.vistoria_responsavel_telefone;
      obsResponsavel = respEuMesmo
        ? `Responsável: ${cotacao.nome_solicitante} - ${cotacao.telefone1_solicitante}`
        : `Responsável: ${respNome || ''} - ${respTel || ''}`;
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

    // Se tem data e o Cadastro já aprovou, criar instalação normalmente
    if (dataAgendada && cadastroAprovado) {
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
        local_vistoria: localVistoriaForce,
        instalador_responsavel_id: null,
        tipo_deslocamento: localVistoriaForce === 'base' ? 'base' : tipoDeslocamento,
      };
      
      console.log('[CriarInstalacaoPosPagamento] Criando instalação:', JSON.stringify(instalacaoData));

      // Guard de idempotência: se já há instalação ativa para mesma cotação+veículo, reusar
      const { data: instExistente } = await supabase
        .from('instalacoes')
        .select('id')
        .eq('cotacao_id', cotacaoId)
        .eq('veiculo_id', veiculoIdFinal)
        .in('status', ['agendada', 'em_andamento', 'em_analise'])
        .limit(1)
        .maybeSingle();

      if (instExistente?.id) {
        novaInstalacaoId = instExistente.id;
        console.log(`[CriarInstalacaoPosPagamento] Instalação já existe (${novaInstalacaoId}), reusando.`);
      } else {
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

      // Back-link agendamentos_base.instalacao_id
      if (agendamentoBaseId && novaInstalacaoId) {
        await supabase
          .from('agendamentos_base')
          .update({ instalacao_id: novaInstalacaoId, updated_at: new Date().toISOString() })
          .eq('id', agendamentoBaseId);
        console.log('[CriarInstalacaoPosPagamento] agendamentos_base back-linked:', agendamentoBaseId);
      }
    } else if (dataAgendada && !cadastroAprovado) {
      console.log('[CriarInstalacaoPosPagamento] Agendamento encontrado, mas Cadastro ainda não aprovou — instalação não criada.');
    }

    // 6.1 GERAR LANÇAMENTOS FINANCEIROS (consultor + módulo Financeiro empresa)
    // Aplica as 4 regras de cenário de adesão:
    //   cobra_base   → consultor recebe 100% adesão; empresa não recebe.
    //   cobra_rota   → consultor recebe (adesão − R$50); empresa recebe R$50 (repasse_volante recebido).
    //   isenta_base  → nenhum lançamento.
    //   isenta_rota  → débito recorrente de R$50 no consultor (abate dos próximos créditos);
    //                  registra entrada PENDENTE de R$50 no Financeiro empresa.
    try {
      const { data: cotacaoVendedor } = await supabase
        .from('cotacoes')
        .select('vendedor_id, tipo_instalacao, valor_adesao, cenario_adesao')
        .eq('id', cotacaoId)
        .single();

      if (cotacaoVendedor?.vendedor_id) {
        // Verificar idempotência (já gerado anteriormente)
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

          const valorAdesao = Number(cotacaoVendedor.valor_adesao || 0);
          const tipoInstalacao = cotacaoVendedor.tipo_instalacao || 'base';

          // Resolver cenário (com fallback para cotações antigas)
          let cenario: 'cobra_rota' | 'cobra_base' | 'isenta_rota' | 'isenta_base' =
            (cotacaoVendedor.cenario_adesao as any) || (
              valorAdesao > 0
                ? (tipoInstalacao === 'rota' || tipoInstalacao === 'volante' ? 'cobra_rota' : 'cobra_base')
                : (tipoInstalacao === 'rota' || tipoInstalacao === 'volante' ? 'isenta_rota' : 'isenta_base')
            );

          console.log(`[CriarInstalacaoPosPagamento] Cenário resolvido: ${cenario} | adesão=${valorAdesao} | tipo=${tipoInstalacao}`);

          const hoje = new Date().toISOString().slice(0, 10);

          const { data: assocData } = await supabase
            .from('associados')
            .select('nome')
            .eq('id', contrato.associado_id)
            .single();
          const nomeAssociado = assocData?.nome || 'Associado';

          const inserts: any[] = [];
          const movimentacoesEmpresa: any[] = [];

          if (cenario === 'cobra_base') {
            // 100% adesão para o consultor; sem repasse para empresa.
            const comissaoAdesao = valorAdesao * pctAdesao;
            inserts.push({
              vendedor_id: cotacaoVendedor.vendedor_id,
              associado_id: contrato.associado_id,
              contrato_id: contrato.id,
              tipo: 'credito', categoria: 'adesao',
              descricao: `Comissão de adesão (cobra+base) — ${nomeAssociado} — R$ ${comissaoAdesao.toFixed(2)}`,
              valor_bruto: comissaoAdesao, valor_abatimento: 0, valor_liquido: comissaoAdesao,
              status: 'a_pagar', data_lancamento: hoje,
            });
          } else if (cenario === 'cobra_rota') {
            // Empresa recebe R$ 50 (repasse_volante); consultor recebe o restante.
            const valorEmpresa = Math.min(valorAdesao, valorVolante);
            const comissaoConsultor = Math.max(valorAdesao - valorVolante, 0) * pctAdesao;

            if (comissaoConsultor > 0) {
              inserts.push({
                vendedor_id: cotacaoVendedor.vendedor_id,
                associado_id: contrato.associado_id,
                contrato_id: contrato.id,
                tipo: 'credito', categoria: 'adesao',
                descricao: `Comissão de adesão (cobra+rota) — ${nomeAssociado} — R$ ${comissaoConsultor.toFixed(2)} (após repasse R$ ${valorEmpresa.toFixed(2)})`,
                valor_bruto: comissaoConsultor, valor_abatimento: 0, valor_liquido: comissaoConsultor,
                status: 'a_pagar', data_lancamento: hoje,
              });
            }

            if (valorEmpresa > 0) {
              movimentacoesEmpresa.push({
                tipo: 'entrada',
                categoria: 'repasse_volante',
                referencia_tipo: 'contrato',
                referencia_id: contrato.id,
                valor: valorEmpresa,
                data_movimentacao: hoje,
                data_competencia: hoje,
                descricao: `Repasse Volante (cobra+rota) — ${nomeAssociado}`,
                observacao: `Cotação ${cotacaoId} | Vendedor ${cotacaoVendedor.vendedor_id}`,
              });
            }
          } else if (cenario === 'isenta_base') {
            // Nenhum lançamento.
            console.log('[CriarInstalacaoPosPagamento] Cenário isenta+base: sem lançamentos.');
          } else if (cenario === 'isenta_rota') {
            // Débito de R$ 50 no recorrente do consultor + entrada pendente no Financeiro empresa.
            inserts.push({
              vendedor_id: cotacaoVendedor.vendedor_id,
              associado_id: contrato.associado_id,
              contrato_id: contrato.id,
              tipo: 'debito', categoria: 'volante_recorrente',
              descricao: `Débito recorrente — instalação volante (isenta+rota) — ${nomeAssociado} — R$ ${valorVolante.toFixed(2)}`,
              valor_bruto: valorVolante, valor_abatimento: 0, valor_liquido: valorVolante,
              status: 'pendente', data_lancamento: hoje,
              abate_recorrente: true,
            });

            movimentacoesEmpresa.push({
              tipo: 'entrada',
              categoria: 'repasse_volante_pendente',
              referencia_tipo: 'contrato',
              referencia_id: contrato.id,
              valor: valorVolante,
              data_movimentacao: hoje,
              data_competencia: hoje,
              descricao: `Repasse Volante a receber do consultor (isenta+rota) — ${nomeAssociado}`,
              observacao: `Cotação ${cotacaoId} | Vendedor ${cotacaoVendedor.vendedor_id} | abate dos próximos recorrentes`,
            });
          }

          // Parcelas recorrentes mensais (independem do cenário)
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

          if (inserts.length > 0) {
            const { error: ccError } = await supabase.from('cc_vendedor_lancamentos').insert(inserts);
            if (ccError) {
              console.error('[CriarInstalacaoPosPagamento] Erro ao gerar lançamentos CC:', ccError);
            } else {
              console.log(`[CriarInstalacaoPosPagamento] ✓ ${inserts.length} lançamentos CC gerados (cenário=${cenario})`);
            }
          }

          if (movimentacoesEmpresa.length > 0) {
            const { error: movError } = await supabase.from('movimentacoes_financeiras').insert(movimentacoesEmpresa);
            if (movError) {
              console.error('[CriarInstalacaoPosPagamento] Erro ao registrar movimentação financeira da empresa:', movError);
            } else {
              console.log(`[CriarInstalacaoPosPagamento] ✓ ${movimentacoesEmpresa.length} movimentação(ões) registrada(s) no Financeiro empresa`);
            }
          }
        }
      }
    } catch (ccErr) {
      console.error('[CriarInstalacaoPosPagamento] Erro ao processar lançamentos financeiros:', ccErr);
    }

    // 7. DISPARAR ATRIBUIÇÃO AUTOMÁTICA (só se instalação foi criada E modo manual estiver desligado)
    if (novaInstalacaoId) {
      try {
        const { data: configManual } = await supabase
          .from('configuracoes')
          .select('valor')
          .eq('chave', 'atribuicao_manual_rotas')
          .maybeSingle();

        if (configManual?.valor === 'true') {
          console.log('[CriarInstalacaoPosPagamento] Atribuição MANUAL ativa — pulando disparo automático');
        } else {
          await fetch(`${supabaseUrl}/functions/v1/cron-atribuir-tarefas`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${serviceRoleKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
          });
          console.log('[CriarInstalacaoPosPagamento] ✓ Atribuição automática disparada');
        }
      } catch (atribErr) {
        console.warn('[CriarInstalacaoPosPagamento] Atribuição imediata falhou:', atribErr);
      }

      // 8. ENVIAR CONFIRMAÇÃO WHATSAPP AO CLIENTE
      const permiteEncaixe = cotacao.vistoria_permite_encaixe || false;

      if (permiteEncaixe) {
        // ========== ENCAIXE: Enviar template de confirmação IMEDIATAMENTE ==========
        console.log('[CriarInstalacaoPosPagamento] 🔔 ENCAIXE detectado — enviando confirmação WhatsApp imediata ao cliente');
        try {
          const { data: associadoData } = await supabase
            .from('associados')
            .select('nome, telefone, whatsapp')
            .eq('id', contrato.associado_id)
            .single();

          const telefoneCliente = (associadoData?.whatsapp || associadoData?.telefone || '').replace(/\D/g, '');
          const nomeCliente = associadoData?.nome || 'Cliente';
          const nomeAbrev = nomeCliente.split(' ')[0];

          if (telefoneCliente) {
            const periodoValido2 = ['manha', 'tarde'].includes(periodoAgendado || '') ? periodoAgendado : 'manha';
            const periodoTexto = periodoValido2 === 'manha' ? 'pela manhã' : 'pela tarde';
            const dataObj = new Date((dataAgendada || '') + 'T12:00:00');
            const dataFormatada = dataObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
            const enderecoTexto = [endereco.logradouro, endereco.numero, endereco.bairro, endereco.cidade]
              .filter(Boolean).join(', ') || 'endereço agendado';

            const mensagem = `Olá, *${nomeAbrev}*! 👋

Seu serviço de *instalação* foi agendado como *encaixe* para:
📅 ${dataFormatada} ${periodoTexto}
📍 ${enderecoTexto}

O técnico mais próximo será designado em breve.

✅ Responda *SIM* para confirmar
📅 Ou informe se precisa *reagendar*

*PRATIC Proteção Veicular*`;

            const { error: sendError } = await supabase.functions.invoke('whatsapp-send-text', {
              body: {
                telefone: telefoneCliente,
                mensagem,
                template_name: 'confirmacao_agendamento_v1',
                template_params: [nomeAbrev, 'instalação', `${dataFormatada} ${periodoTexto}`],
              }
            });

            if (sendError) {
              console.error('[CriarInstalacaoPosPagamento] Erro ao enviar confirmação encaixe:', sendError);
            } else {
              console.log(`[CriarInstalacaoPosPagamento] ✅ Confirmação encaixe enviada para ${telefoneCliente}`);
            }

            // Buscar o servico correspondente à instalação
            const { data: servicoData } = await supabase
              .from('servicos')
              .select('id')
              .eq('instalacao_origem_id', novaInstalacaoId)
              .maybeSingle();

            if (servicoData) {
              await supabase.from('confirmacoes_agendamento').insert({
                servico_id: servicoData.id,
                telefone: telefoneCliente,
                status: 'enviada',
                mensagem_enviada_em: new Date().toISOString(),
                contexto_ia: {
                  nome_cliente: nomeCliente,
                  tipo_servico: 'instalacao',
                  hora_agendada: null,
                  endereco: enderecoTexto,
                  disparo: 'encaixe_imediato',
                }
              });
              console.log('[CriarInstalacaoPosPagamento] ✓ Registro confirmação encaixe criado');
            }
          } else {
            console.warn('[CriarInstalacaoPosPagamento] Telefone não encontrado para confirmação encaixe');
          }
        } catch (confErr) {
          console.error('[CriarInstalacaoPosPagamento] Erro ao processar confirmação encaixe:', confErr);
        }
      } else {
        // ========== NORMAL: Apenas notificar (confirmação será enviada pelo cron 1h antes do turno) ==========
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
          console.log(`[CriarInstalacaoPosPagamento] ✓ Notificação enviada (normal — confirmação via cron 1h antes do turno)`);
        } catch (notifErr) {
          console.error('[CriarInstalacaoPosPagamento] Erro ao enviar notificação:', notifErr);
        }
      }
    }

    // 9. CHAIN ATIVAÇÃO — para inclusão/adesão isenta com instalação criada,
    // dispara ativar-associado (single-source-activation). Idempotente: edge
    // valida lock + CAS internamente.
    if (novaInstalacaoId && contrato.associado_id) {
      try {
        const { data: cotEntrada } = await supabase
          .from('cotacoes')
          .select('tipo_entrada, dados_extras, valor_adesao, cobertura_total, cobertura_roubo_furto')
          .eq('id', cotacaoId)
          .maybeSingle();
        const tipoEntradaCot = (cotEntrada as any)?.tipo_entrada
          || ((cotEntrada as any)?.dados_extras?.tipo_entrada)
          || 'adesao';
        const valorAdesaoCot = Number((cotEntrada as any)?.valor_adesao || 0);
        const isInclusao = tipoEntradaCot === 'inclusao';
        const isAdesaoIsenta = valorAdesaoCot <= 0;

        if (isInclusao || isAdesaoIsenta) {
          // Veículo NOVO sempre aguarda a vistoria/instalação concluir antes de
          // virar 'ativo'. Mesmo veículos com dispensa_rastreador (FIPE < limite)
          // precisam passar pela vistoria fotográfica aprovada manualmente —
          // paridade total com fluxo ≥30k/9k.
          const aguardarInstalacaoFisica = true;
          console.log(`[CriarInstalacaoPosPagamento] Chain ativar-associado (tipo=${tipoEntradaCot}, isento=${isAdesaoIsenta}, veiculo=${veiculoIdFinal}, aguardar_instalacao=${aguardarInstalacaoFisica})`);
          const ativResp = await fetch(`${supabaseUrl}/functions/v1/ativar-associado`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${serviceRoleKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              associado_id: contrato.associado_id,
              contrato_id: contrato.id,
              veiculo_id: veiculoIdFinal,
              cotacao_id: cotacaoId,
              instalacao_id: novaInstalacaoId,
              source: 'edge:criar-instalacao-pos-pagamento',
              ativar_cobertura_total: !!(cotEntrada as any)?.cobertura_total,
              ativar_cobertura_roubo_furto: !!(cotEntrada as any)?.cobertura_roubo_furto,
              aguardar_instalacao: aguardarInstalacaoFisica,
              metadata: {
                tipo_entrada: tipoEntradaCot,
                isento: isAdesaoIsenta,
                motivo: isInclusao ? 'inclusao_pos_instalacao' : 'adesao_isenta_pos_instalacao',
                aguardar_instalacao: aguardarInstalacaoFisica,
              },
            }),
          });
          if (!ativResp.ok) {
            const txt = await ativResp.text();
            console.warn(`[CriarInstalacaoPosPagamento] ativar-associado retornou ${ativResp.status}: ${txt}`);
          } else {
            console.log('[CriarInstalacaoPosPagamento] ✓ ativar-associado concluído');
          }
        }
      } catch (ativErr) {
        console.warn('[CriarInstalacaoPosPagamento] Chain ativar-associado falhou (não bloqueante):', ativErr);
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

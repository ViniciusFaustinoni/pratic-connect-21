import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Calcula a distância entre dois pontos usando a fórmula de Haversine
 * Retorna a distância em quilômetros
 */
function calcularDistanciaKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Raio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Verifica se o profissional tem tarefas agendadas dentro da janela de horas configurada
 */
async function temTarefasNaJanela(
  supabase: any,
  profissionalId: string,
  janelaHoras: number
): Promise<boolean> {
  const agora = new Date();
  const limiteJanela = new Date(agora.getTime() + janelaHoras * 60 * 60 * 1000);
  const hojeStr = agora.toISOString().split('T')[0];
  const limiteJanelaStr = limiteJanela.toISOString().split('T')[0];
  const horaAtual = agora.toTimeString().slice(0, 5); // "HH:MM"
  const horaLimite = limiteJanela.toTimeString().slice(0, 5);

  // Buscar instalações agendadas nas próximas X horas
  const { data: instAgendadas } = await supabase
    .from('instalacoes')
    .select('id, data_agendada, hora_agendada')
    .eq('instalador_responsavel_id', profissionalId)
    .eq('status', 'agendada')
    .gte('data_agendada', hojeStr)
    .lte('data_agendada', limiteJanelaStr);

  // Buscar vistorias agendadas nas próximas X horas
  const { data: vistAgendadas } = await supabase
    .from('vistorias')
    .select('id, data_agendada, hora_agendada')
    .eq('vistoriador_id', profissionalId)
    .in('status', ['pendente', 'agendada'])
    .gte('data_agendada', hojeStr)
    .lte('data_agendada', limiteJanelaStr);

  // Filtrar apenas tarefas DENTRO da janela de tempo
  const todasTarefas = [...(instAgendadas || []), ...(vistAgendadas || [])];
  
  const tarefasNaJanela = todasTarefas.filter(tarefa => {
    // Se é de um dia futuro (dentro do limite), conta
    if (tarefa.data_agendada > hojeStr && tarefa.data_agendada <= limiteJanelaStr) {
      return true;
    }
    
    // Se é de hoje, verificar se está dentro da janela de horas
    if (tarefa.data_agendada === hojeStr) {
      // Se não tem hora específica, considera que está na janela
      if (!tarefa.hora_agendada) return true;
      
      // Verificar se a hora está entre agora e o limite
      return tarefa.hora_agendada >= horaAtual && tarefa.hora_agendada <= horaLimite;
    }
    
    return false;
  });

  return tarefasNaJanela.length > 0;
}

interface ServicoDisponivel {
  id: string;
  tipo: string;
  data_agendada: string;
  hora_agendada: string | null;
  latitude: number | null;
  longitude: number | null;
  permite_encaixe: boolean;
  status: string;
  associado_id: string | null;
  associado_nome: string;
  associado_telefone: string;
  associado_whatsapp: string;
  veiculo_id: string | null;
  veiculo_placa: string;
  veiculo_marca: string;
  veiculo_modelo: string;
  veiculo_cor: string;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
}

interface ServicoComDistancia extends ServicoDisponivel {
  distancia_km: number;
  is_hoje: boolean;
  is_amanha: boolean;
  is_encaixe_futuro: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Token não fornecido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decode JWT to get user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get request body
    const { latitude, longitude, acao } = await req.json();

    // Validate coordinates
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return new Response(
        JSON.stringify({ error: "Coordenadas inválidas. Latitude e longitude são obrigatórias." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const profissionalId = user.id;
    console.log(`[atribuir-proxima-tarefa] Profissional ${profissionalId} em (${latitude}, ${longitude}), ação: ${acao || 'iniciar'}`);

    // 1. Verificar se profissional já tem tarefa em andamento (usando nova RPC da tabela servicos)
    const { data: tarefaAtual } = await supabase.rpc('buscar_tarefa_atual_profissional', {
      p_profissional_id: profissionalId
    });

    if (tarefaAtual && tarefaAtual.length > 0) {
      const tarefa = tarefaAtual[0];
      console.log(`[atribuir-proxima-tarefa] Profissional já tem tarefa: ${tarefa.tipo} ${tarefa.id}`);
      
      // Calcular distância até a tarefa atual
      let distancia_km = null;
      if (tarefa.latitude && tarefa.longitude) {
        distancia_km = calcularDistanciaKm(
          latitude, longitude,
          tarefa.latitude, tarefa.longitude
        );
      }

      return new Response(
        JSON.stringify({
          resultado: 'ja_tem_tarefa',
          tarefa: {
            id: tarefa.id,
            tipo: tarefa.tipo,
            status: tarefa.status,
            data_agendada: tarefa.data_agendada,
            hora_agendada: tarefa.hora_agendada,
            cliente: {
              id: tarefa.associado_id,
              nome: tarefa.associado_nome,
              telefone: tarefa.associado_telefone,
              whatsapp: tarefa.associado_whatsapp
            },
            veiculo: {
              id: tarefa.veiculo_id,
              placa: tarefa.veiculo_placa,
              marca: tarefa.veiculo_marca,
              modelo: tarefa.veiculo_modelo,
              cor: tarefa.veiculo_cor
            },
            endereco: {
              logradouro: tarefa.logradouro,
              numero: tarefa.numero,
              bairro: tarefa.bairro,
              cidade: tarefa.cidade,
              uf: tarefa.uf,
              cep: tarefa.cep,
              latitude: tarefa.latitude,
              longitude: tarefa.longitude
            },
            local_vistoria: tarefa.local_vistoria,
            observacoes: tarefa.observacoes,
            distancia_km,
            rota_id: tarefa.rota_id
          }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar configurações de encaixe
    const { data: configRaio } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'operacional_encaixe_raio_km')
      .single();

    const raioMaximoEncaixeKm = configRaio?.valor ? parseFloat(configRaio.valor) : 10;
    console.log(`[atribuir-proxima-tarefa] Raio máximo para encaixe: ${raioMaximoEncaixeKm} km`);

    // Buscar configuração de janela de horas
    const { data: configJanela } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'operacional_encaixe_janela_horas')
      .single();

    const janelaHoras = configJanela?.valor ? parseInt(configJanela.valor) : 2;
    console.log(`[atribuir-proxima-tarefa] Janela de horas livre: ${janelaHoras}h`);

    // ✅ NOVA VERIFICAÇÃO: Verificar se profissional tem tarefas nas próximas X horas
    const temTarefasProximas = await temTarefasNaJanela(supabase, profissionalId, janelaHoras);
    console.log(`[atribuir-proxima-tarefa] Profissional tem tarefas nas próximas ${janelaHoras}h: ${temTarefasProximas}`);

    // 2. Buscar serviços disponíveis (sem atribuição) da tabela UNIFICADA servicos
    const hoje = new Date().toISOString().split('T')[0];
    const amanha = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    // BUSCA 1: Serviços NORMAIS (hoje/amanhã)
    const { data: servicosNormais, error: servicosNormaisError } = await supabase
      .from('servicos')
      .select(`
        id,
        tipo,
        data_agendada,
        hora_agendada,
        latitude,
        longitude,
        permite_encaixe,
        status,
        logradouro,
        numero,
        bairro,
        cidade,
        uf,
        associado_id,
        veiculo_id,
        local_vistoria,
        associado:associados(nome, telefone, whatsapp),
        veiculo:veiculos(placa, marca, modelo, cor)
      `)
      .is('profissional_id', null)
      .in('status', ['pendente', 'agendada'])
      .or('local_vistoria.is.null,local_vistoria.eq.cliente')
      .gte('data_agendada', hoje)
      .lte('data_agendada', amanha)
      .order('data_agendada', { ascending: true });

    if (servicosNormaisError) {
      console.error('[atribuir-proxima-tarefa] Erro ao buscar serviços normais:', servicosNormaisError);
      throw servicosNormaisError;
    }

    // BUSCA 2: Serviços FUTUROS com ENCAIXE habilitado
    // Só busca encaixes se o profissional NÃO tem tarefas nas próximas X horas
    let servicosEncaixe: any[] = [];
    
    if (!temTarefasProximas) {
      const { data: encaixes, error: servicosEncaixeError } = await supabase
        .from('servicos')
        .select(`
          id,
          tipo,
          data_agendada,
          hora_agendada,
          latitude,
          longitude,
          permite_encaixe,
          status,
          logradouro,
          numero,
          bairro,
          cidade,
          uf,
          associado_id,
          veiculo_id,
          local_vistoria,
          associado:associados(nome, telefone, whatsapp),
          veiculo:veiculos(placa, marca, modelo, cor)
        `)
        .is('profissional_id', null)
        .in('status', ['pendente', 'agendada'])
        .or('local_vistoria.is.null,local_vistoria.eq.cliente')
        .gt('data_agendada', amanha)     // DATAS FUTURAS (> amanhã)
        .eq('permite_encaixe', true)      // APENAS os que aceitam encaixe
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (servicosEncaixeError) {
        console.error('[atribuir-proxima-tarefa] Erro ao buscar serviços encaixe:', servicosEncaixeError);
      } else {
        servicosEncaixe = encaixes || [];
      }
    } else {
      console.log(`[atribuir-proxima-tarefa] Profissional tem tarefas nas próximas ${janelaHoras}h - NÃO elegível para encaixes`);
    }

    // Combinar as duas listas
    const todosServicos = [
      ...(servicosNormais || []),
      ...servicosEncaixe
    ];

    console.log(`[atribuir-proxima-tarefa] Serviços encontrados: ${(servicosNormais || []).length} normais + ${servicosEncaixe.length} encaixes futuros`);

    // 3. Mapear para formato comum
    const servicosDisponiveis: ServicoDisponivel[] = todosServicos.map((s: any) => ({
      id: s.id,
      tipo: s.tipo,
      data_agendada: s.data_agendada,
      hora_agendada: s.hora_agendada,
      latitude: s.latitude,
      longitude: s.longitude,
      permite_encaixe: s.permite_encaixe || false,
      status: s.status,
      associado_id: s.associado_id,
      associado_nome: s.associado?.nome || 'Cliente não vinculado',
      associado_telefone: s.associado?.telefone || '',
      associado_whatsapp: s.associado?.whatsapp || '',
      veiculo_id: s.veiculo_id,
      veiculo_placa: s.veiculo?.placa || 'Placa pendente',
      veiculo_marca: s.veiculo?.marca || '',
      veiculo_modelo: s.veiculo?.modelo || '',
      veiculo_cor: s.veiculo?.cor || '',
      logradouro: s.logradouro,
      numero: s.numero,
      bairro: s.bairro,
      cidade: s.cidade,
      uf: s.uf,
    }));

    console.log(`[atribuir-proxima-tarefa] ${servicosDisponiveis.length} serviços disponíveis no total`);

    if (servicosDisponiveis.length === 0) {
      // Marcar profissional como em serviço mesmo sem tarefas
      await supabase
        .from('vistoriadores_localizacao')
        .upsert({
          vistoriador_id: profissionalId,
          latitude,
          longitude,
          em_servico: true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'vistoriador_id' });

      return new Response(
        JSON.stringify({
          resultado: 'sem_tarefas',
          mensagem: 'Você está ativo para receber serviços. Aguarde novas tarefas próximas de você.'
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Calcular distâncias e ordenar com nova lógica de prioridades
    const servicosComDistancia: ServicoComDistancia[] = servicosDisponiveis
      .filter(s => s.latitude && s.longitude)
      .map(s => {
        const distancia_km = calcularDistanciaKm(latitude, longitude, s.latitude!, s.longitude!);
        const is_hoje = s.data_agendada === hoje;
        const is_amanha_flag = s.data_agendada === amanha;
        const is_encaixe_futuro = s.data_agendada > amanha && s.permite_encaixe;
        
        return {
          ...s,
          distancia_km,
          is_hoje,
          is_amanha: is_amanha_flag,
          is_encaixe_futuro
        };
      })
      .filter(s => {
        // Encaixes futuros SÓ entram se estiverem dentro do raio máximo
        if (s.is_encaixe_futuro) {
          const dentroDoRaio = s.distancia_km <= raioMaximoEncaixeKm;
          if (!dentroDoRaio) {
            console.log(`[atribuir-proxima-tarefa] Encaixe ${s.id} descartado: ${s.distancia_km.toFixed(2)}km > ${raioMaximoEncaixeKm}km`);
          }
          return dentroDoRaio;
        }
        // Serviços de hoje/amanhã: sem limite de raio
        return true;
      })
      .sort((a, b) => {
        // PRIORIDADE 1: Serviços de HOJE (por proximidade)
        if (a.is_hoje && !b.is_hoje) return -1;
        if (!a.is_hoje && b.is_hoje) return 1;
        
        // PRIORIDADE 2: Encaixes futuros próximos (já filtrados por raio)
        if (a.is_encaixe_futuro && !b.is_encaixe_futuro && !b.is_hoje) return -1;
        if (!a.is_encaixe_futuro && b.is_encaixe_futuro && !a.is_hoje) return 1;
        
        // PRIORIDADE 3: Serviços de AMANHÃ
        if (a.is_amanha && !b.is_amanha && !b.is_hoje && !b.is_encaixe_futuro) return -1;
        if (!a.is_amanha && b.is_amanha && !a.is_hoje && !a.is_encaixe_futuro) return 1;
        
        // PRIORIDADE 4: Por distância (dentro da mesma categoria)
        return a.distancia_km - b.distancia_km;
      });
    
    console.log(`[atribuir-proxima-tarefa] ${servicosComDistancia.length} serviços após filtro de raio (encaixes <= ${raioMaximoEncaixeKm}km)`);

    if (servicosComDistancia.length === 0) {
      return new Response(
        JSON.stringify({
          resultado: 'sem_tarefas',
          mensagem: 'Nenhum serviço com coordenadas disponível.'
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Tentar atribuir o serviço mais próximo
    for (const servico of servicosComDistancia) {
      console.log(`[atribuir-proxima-tarefa] Tentando atribuir ${servico.tipo} ${servico.id} (${servico.distancia_km.toFixed(2)} km)`);
      
      const agora = new Date().toISOString();
      
      // Preparar dados de atualização
      const updateData: Record<string, any> = {
        profissional_id: profissionalId,
        status: 'em_rota',
        em_rota_em: agora,
        updated_at: agora
      };

      // Se for ENCAIXE FUTURO, puxar para HOJE e marcar como encaixe executado
      if (servico.is_encaixe_futuro) {
        updateData.data_agendada_original = servico.data_agendada;
        updateData.data_agendada = hoje;
        updateData.encaixe_executado = true;
        console.log(`[atribuir-proxima-tarefa] ⚡ ENCAIXE EXECUTADO: Serviço ${servico.id} antecipado de ${servico.data_agendada} para ${hoje}`);
      }

      // Atualizar na tabela SERVICOS
      const { data: atualizado, error: updateError } = await supabase
        .from('servicos')
        .update(updateData)
        .eq('id', servico.id)
        .is('profissional_id', null) // Só atualiza se ainda não tiver responsável
        .select('*, instalacao_origem_id, vistoria_origem_id')
        .single();

      if (updateError) {
        console.log(`[atribuir-proxima-tarefa] Serviço ${servico.id} já foi atribuído a outro profissional`);
        continue;
      }

      if (atualizado) {
        console.log(`[atribuir-proxima-tarefa] ✓ Serviço ${servico.id} atribuído ao profissional ${profissionalId}`);
        
        // 6. SINCRONIZAR COM TABELA DE ORIGEM (instalacoes ou vistorias)
        if (atualizado.instalacao_origem_id) {
          console.log(`[atribuir-proxima-tarefa] Sincronizando com instalacoes ${atualizado.instalacao_origem_id}`);
          
          // Buscar dados do cliente/veículo da instalação de origem
          const { data: instalacaoOrigem } = await supabase
            .from('instalacoes')
            .select('associado_id, veiculo_id')
            .eq('id', atualizado.instalacao_origem_id)
            .single();
          
          // Atualizar status na instalação de origem
          const instalacaoUpdate: Record<string, any> = {
            instalador_responsavel_id: profissionalId,
            status: 'em_rota'
          };
          
          // Se for encaixe, sincronizar data também na tabela de origem
          if (servico.is_encaixe_futuro) {
            instalacaoUpdate.data_agendada_original = servico.data_agendada;
            instalacaoUpdate.data_agendada = hoje;
            instalacaoUpdate.encaixe_executado = true;
          }
          
          await supabase
            .from('instalacoes')
            .update(instalacaoUpdate)
            .eq('id', atualizado.instalacao_origem_id);
          
          // Copiar associado_id e veiculo_id para o servico se não tiver
          if (instalacaoOrigem && (!servico.associado_id || !servico.veiculo_id)) {
            const updateData: any = {};
            if (!servico.associado_id && instalacaoOrigem.associado_id) {
              updateData.associado_id = instalacaoOrigem.associado_id;
            }
            if (!servico.veiculo_id && instalacaoOrigem.veiculo_id) {
              updateData.veiculo_id = instalacaoOrigem.veiculo_id;
            }
            if (Object.keys(updateData).length > 0) {
              console.log(`[atribuir-proxima-tarefa] Copiando dados cliente/veículo da instalação de origem`);
              await supabase
                .from('servicos')
                .update(updateData)
                .eq('id', servico.id);
            }
          }
        }
        
        if (atualizado.vistoria_origem_id) {
          console.log(`[atribuir-proxima-tarefa] Sincronizando com vistorias ${atualizado.vistoria_origem_id}`);
          
          const vistoriaUpdate: Record<string, any> = {
            vistoriador_id: profissionalId,
            status: 'em_rota'
          };
          
          // Se for encaixe, sincronizar data também na tabela de origem
          if (servico.is_encaixe_futuro) {
            vistoriaUpdate.data_agendada_original = servico.data_agendada;
            vistoriaUpdate.data_agendada = hoje;
            vistoriaUpdate.encaixe_executado = true;
          }
          
          await supabase
            .from('vistorias')
            .update(vistoriaUpdate)
            .eq('id', atualizado.vistoria_origem_id);
        }
        
        // 7. Criar ou atualizar rota do dia
        const { data: rotaExistente } = await supabase
          .from('rotas')
          .select('id')
          .eq('instalador_id', profissionalId)
          .eq('data', hoje)
          .maybeSingle();

        let rotaId = rotaExistente?.id;

        if (!rotaId) {
          const { data: novaRota, error: rotaError } = await supabase
            .from('rotas')
            .insert({
              instalador_id: profissionalId,
              data: hoje,
              status: 'em_andamento',
              tipo: 'automatica'
            })
            .select('id')
            .single();

          if (rotaError) {
            console.error('[atribuir-proxima-tarefa] Erro ao criar rota:', rotaError);
          } else {
            rotaId = novaRota.id;
          }
        }

        // Vincular serviço à rota
        if (rotaId) {
          await supabase
            .from('servicos')
            .update({ rota_id: rotaId })
            .eq('id', servico.id);
            
          // Também vincular instalacao/vistoria de origem à rota
          if (atualizado.instalacao_origem_id) {
            await supabase
              .from('instalacoes')
              .update({ rota_id: rotaId })
              .eq('id', atualizado.instalacao_origem_id);
          }
        }

        // Salvar localização atual do profissional
        await supabase
          .from('vistoriadores_localizacao')
          .upsert({
            vistoriador_id: profissionalId,
            latitude,
            longitude,
            em_servico: true,
            updated_at: new Date().toISOString()
          }, { onConflict: 'vistoriador_id' });

        // 8. Enviar notificação push para o profissional
        try {
          const tipoLabel = servico.tipo === 'instalacao' ? 'Instalação' : 'Vistoria';
          const localLabel = servico.bairro || servico.cidade || 'Local não informado';
          const clienteLabel = servico.associado_nome || 'Cliente';
          
          await supabase.functions.invoke('send-push-profissional', {
            body: {
              profissional_id: profissionalId,
              notification: {
                title: `Nova Tarefa: ${tipoLabel}`,
                body: `${clienteLabel} - ${localLabel}`,
                tag: `tarefa-${servico.id}`,
                data: {
                  url: '/instalador',
                  tarefa_id: servico.id,
                  tipo: servico.tipo
                }
              }
            }
          });
          console.log(`[atribuir-proxima-tarefa] ✓ Push notification enviada para profissional ${profissionalId}`);
        } catch (pushError) {
          console.error('[atribuir-proxima-tarefa] Erro ao enviar push notification:', pushError);
          // Não bloqueia o fluxo principal
        }

        return new Response(
          JSON.stringify({
            resultado: 'atribuida',
            tarefa: {
              id: servico.id,
              tipo: servico.tipo,
              status: 'em_rota',
              data_agendada: servico.data_agendada,
              hora_agendada: servico.hora_agendada,
              cliente: {
                id: servico.associado_id,
                nome: servico.associado_nome,
                telefone: servico.associado_telefone
              },
              veiculo: {
                id: servico.veiculo_id,
                placa: servico.veiculo_placa,
                marca: servico.veiculo_marca,
                modelo: servico.veiculo_modelo
              },
              endereco: {
                logradouro: servico.logradouro,
                numero: servico.numero,
                bairro: servico.bairro,
                cidade: servico.cidade,
                uf: servico.uf,
                latitude: servico.latitude,
                longitude: servico.longitude
              },
              distancia_km: servico.distancia_km,
              rota_id: rotaId
            }
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Se chegou aqui, nenhum serviço disponível
    await supabase
      .from('vistoriadores_localizacao')
      .upsert({
        vistoriador_id: profissionalId,
        latitude,
        longitude,
        em_servico: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'vistoriador_id' });

    return new Response(
      JSON.stringify({
        resultado: 'sem_tarefas',
        mensagem: 'Você está ativo para receber serviços. Aguarde novas tarefas próximas de você.'
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[atribuir-proxima-tarefa] Erro:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

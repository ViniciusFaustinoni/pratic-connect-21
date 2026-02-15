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
 * Verifica se um serviço pode ser atribuído no momento atual
 * Regras:
 * - Serviços com permite_encaixe = true podem ser atribuídos a qualquer momento
 * - Serviços normais de HOJE só podem ser atribuídos após o hora_agendada
 * - Serviços de datas futuras (amanhã) podem ser atribuídos normalmente
 */
function podeSerAtribuido(
  servico: { data_agendada: string; hora_agendada: string | null; permite_encaixe: boolean },
  agora: Date,
  hojeStr: string
): boolean {
  // Encaixes podem ser atribuídos livremente
  if (servico.permite_encaixe) return true;
  
  // Serviços de datas futuras podem ser atribuídos (amanhã)
  if (servico.data_agendada > hojeStr) return true;
  
  // Serviços de HOJE com hora específica
  if (servico.data_agendada === hojeStr && servico.hora_agendada) {
    const horaAtual = agora.toTimeString().slice(0, 5); // "HH:MM"
    return horaAtual >= servico.hora_agendada;
  }
  
  // Sem hora específica = pode ser atribuído
  return true;
}

interface ProfissionalDisponivel {
  vistoriador_id: string;
  latitude: number;
  longitude: number;
  updated_at: string;
}

interface ServicoComDistancia {
  id: string;
  tipo: string;
  data_agendada: string;
  hora_agendada: string | null;
  latitude: number;
  longitude: number;
  permite_encaixe: boolean;
  instalacao_origem_id: string | null;
  vistoria_origem_id: string | null;
  associado_nome: string;
  veiculo_placa: string;
  distancia_km: number;
  is_encaixe: boolean;
  is_hoje: boolean;
  is_amanha: boolean;
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

    console.log("[cron-atribuir-tarefas] Iniciando atribuição automática de tarefas...");

    const hoje = new Date().toISOString().split('T')[0];
    const amanha = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const trintaMinutosAtras = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    // ✅ NOVA LÓGICA SIMPLIFICADA: Sem restrição de raio e janela
    // Prioridade é sempre o agendamento do dia
    // Se não houver agendamento próximo, buscar encaixe (vistoriador mais próximo disponível)
    console.log(`[cron-atribuir-tarefas] Lógica simplificada: sem limite de raio e janela`);

    // 1. Buscar profissionais em serviço com localização recente
    const { data: profissionais, error: profError } = await supabase
      .from('vistoriadores_localizacao')
      .select('vistoriador_id, latitude, longitude, updated_at')
      .eq('em_servico', true)
      .gte('updated_at', trintaMinutosAtras)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (profError) {
      console.error('[cron-atribuir-tarefas] Erro ao buscar profissionais:', profError);
      throw profError;
    }

    if (!profissionais || profissionais.length === 0) {
      console.log('[cron-atribuir-tarefas] Nenhum profissional em serviço com localização recente');
      return new Response(
        JSON.stringify({ resultado: 'sem_profissionais', mensagem: 'Nenhum profissional ativo com GPS recente' }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[cron-atribuir-tarefas] ${profissionais.length} profissional(is) em serviço`);

    const atribuicoes: { profissional_id: string; servico_id: string; distancia_km: number; tipo_atribuicao: string }[] = [];

    // 2. Para cada profissional, verificar se já tem tarefa e tentar atribuir
    for (const prof of profissionais as ProfissionalDisponivel[]) {
      // ========== VERIFICAR STATUS DE JORNADA (ALMOÇO) ==========
      const { data: turnoHoje } = await supabase
        .from('turnos_profissionais')
        .select('id, status, inicio_almoco, fim_almoco')
        .eq('profissional_id', prof.vistoriador_id)
        .eq('data', hoje)
        .maybeSingle();

      // Se está em almoço, pular atribuição
      if (turnoHoje?.status === 'em_almoco') {
        console.log(`[cron-atribuir-tarefas] ☕ Profissional ${prof.vistoriador_id} em ALMOÇO - pulando`);
        continue;
      }

      // Verificar se precisa forçar almoço (4h trabalhadas sem almoço)
      if (turnoHoje && turnoHoje.status === 'ativo' && !turnoHoje.inicio_almoco) {
        const { data: turnoCompleto } = await supabase
          .from('turnos_profissionais')
          .select('inicio_turno')
          .eq('id', turnoHoje.id)
          .single();

        if (turnoCompleto?.inicio_turno) {
          const inicioTurno = new Date(turnoCompleto.inicio_turno);
          const agora = new Date();
          const minutosTrabalhados = Math.floor((agora.getTime() - inicioTurno.getTime()) / 60000);

          if (minutosTrabalhados >= 240) { // 4 horas
            console.log(`[cron-atribuir-tarefas] ⏰ Profissional ${prof.vistoriador_id} atingiu 4h - forçando ALMOÇO`);
            
            await supabase
              .from('turnos_profissionais')
              .update({ 
                status: 'em_almoco',
                inicio_almoco: new Date().toISOString()
              })
              .eq('id', turnoHoje.id);
            
            continue; // Pular atribuição
          }
        }
      }

      // Verificar se profissional já tem tarefa em andamento
      const { data: tarefaAtual } = await supabase.rpc('buscar_tarefa_atual_profissional', {
        p_profissional_id: prof.vistoriador_id
      });

      if (tarefaAtual && tarefaAtual.length > 0) {
        console.log(`[cron-atribuir-tarefas] Profissional ${prof.vistoriador_id} já tem tarefa ativa`);
        continue;
      }

      // ========== BUSCA 1: Serviços NORMAIS (hoje/amanhã) ==========
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
          local_vistoria,
          instalacao_origem_id,
          vistoria_origem_id,
          associado:associados!servicos_associado_id_fkey(nome),
          veiculo:veiculos!servicos_veiculo_id_fkey(placa)
        `)
        .is('profissional_id', null)
        .in('status', ['pendente', 'agendada'])
        .or('local_vistoria.is.null,local_vistoria.eq.cliente')
        .gte('data_agendada', hoje)
        .lte('data_agendada', amanha)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        // FILTRO DE CONFIRMAÇÃO: Só atribuir serviços confirmados ou sem fluxo de confirmação
        .or('confirmacao_whatsapp.is.null,confirmacao_whatsapp.eq.confirmada,permite_encaixe.eq.true');

      if (servicosNormaisError) {
        console.error('[cron-atribuir-tarefas] Erro ao buscar serviços normais:', servicosNormaisError);
        continue;
      }

      // ========== BUSCA 2: Serviços FUTUROS com ENCAIXE ==========
      // ✅ NOVA LÓGICA: Sempre busca encaixes (sem verificar janela de horas)
      let servicosEncaixe: any[] = [];
      
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
          local_vistoria,
          instalacao_origem_id,
          vistoria_origem_id,
          associado:associados!servicos_associado_id_fkey(nome),
          veiculo:veiculos!servicos_veiculo_id_fkey(placa)
        `)
        .is('profissional_id', null)
        .in('status', ['pendente', 'agendada'])
        .or('local_vistoria.is.null,local_vistoria.eq.cliente')
        .gt('data_agendada', amanha) // DATAS FUTURAS (> amanhã)
        .eq('permite_encaixe', true)  // APENAS os que aceitam encaixe
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        // FILTRO DE CONFIRMAÇÃO: Encaixes também precisam de confirmação se entraram no fluxo
        .or('confirmacao_whatsapp.is.null,confirmacao_whatsapp.eq.confirmada');

      if (servicosEncaixeError) {
        console.error('[cron-atribuir-tarefas] Erro ao buscar serviços encaixe:', servicosEncaixeError);
      } else {
        servicosEncaixe = encaixes || [];
      }

      // Combinar as duas listas
      const todosServicos = [
        ...(servicosNormais || []),
        ...servicosEncaixe
      ];

      if (todosServicos.length === 0) {
        console.log(`[cron-atribuir-tarefas] Nenhum serviço disponível para profissional ${prof.vistoriador_id}`);
        continue;
      }

      // NOVO: Filtrar serviços que ainda não podem ser atribuídos (horário futuro)
      const agoraFiltro = new Date();
      const servicosFiltrados = todosServicos.filter((s: any) => 
        podeSerAtribuido(s, agoraFiltro, hoje)
      );
      
      const bloqueadosPorHorario = todosServicos.length - servicosFiltrados.length;
      if (bloqueadosPorHorario > 0) {
        console.log(`[cron-atribuir-tarefas] ${servicosFiltrados.length} serviços após filtro de horário (${bloqueadosPorHorario} bloqueados por horário futuro)`);
      }
      
      if (servicosFiltrados.length === 0) {
        console.log(`[cron-atribuir-tarefas] Nenhum serviço disponível no horário atual para profissional ${prof.vistoriador_id}`);
        continue;
      }

      // 4. Mapear, calcular distâncias e aplicar NOVA LÓGICA DE ORDENAÇÃO
      const servicosComDistancia: ServicoComDistancia[] = servicosFiltrados
        .map((s: any) => {
          const distancia = calcularDistanciaKm(
            prof.latitude, prof.longitude,
            s.latitude, s.longitude
          );
          const isHoje = s.data_agendada === hoje;
          const isAmanha = s.data_agendada === amanha;
          const isEncaixe = s.data_agendada > amanha && s.permite_encaixe;

          return {
            id: s.id,
            tipo: s.tipo,
            data_agendada: s.data_agendada,
            hora_agendada: s.hora_agendada,
            latitude: s.latitude,
            longitude: s.longitude,
            permite_encaixe: s.permite_encaixe || false,
            instalacao_origem_id: s.instalacao_origem_id,
            vistoria_origem_id: s.vistoria_origem_id,
            associado_nome: s.associado?.nome || 'Cliente não vinculado',
            veiculo_placa: s.veiculo?.placa || 'Placa pendente',
            distancia_km: distancia,
            is_encaixe: isEncaixe,
            is_hoje: isHoje,
            is_amanha: isAmanha
          };
        })
        .sort((a: ServicoComDistancia, b: ServicoComDistancia) => a.distancia_km - b.distancia_km); // Ordenar por proximidade

      // ✅ LÓGICA CORRETA DE ENCAIXE:
      // Encaixe SÓ acontece se NÃO há mais serviços de HOJE disponíveis
      const servicosHoje = servicosComDistancia.filter(s => s.is_hoje);
      const temServicoHoje = servicosHoje.length > 0;
      
      let servicosParaAtribuir: ServicoComDistancia[];
      
      if (temServicoHoje) {
        // Há serviços de HOJE - BLOQUEAR encaixes, só considerar serviços de hoje
        servicosParaAtribuir = servicosHoje.sort((a, b) => a.distancia_km - b.distancia_km);
        console.log(`[cron-atribuir-tarefas] 📅 ${servicosHoje.length} serviços de HOJE para ${prof.vistoriador_id} - encaixe BLOQUEADO`);
      } else {
        // NÃO há serviços de hoje - permitir encaixe do mais próximo
        servicosParaAtribuir = servicosComDistancia.sort((a, b) => a.distancia_km - b.distancia_km);
        console.log(`[cron-atribuir-tarefas] ⚡ Nenhum serviço de HOJE para ${prof.vistoriador_id} - encaixe PERMITIDO`);
      }
      
      console.log(`[cron-atribuir-tarefas] ${servicosParaAtribuir.length} serviços disponíveis para profissional ${prof.vistoriador_id}`);
      
      // Log detalhado para debug
      const hojeCount = servicosHoje.length;
      const amanhaCount = servicosComDistancia.filter(s => s.is_amanha).length;
      const encaixeCount = servicosComDistancia.filter(s => s.is_encaixe).length;
      console.log(`[cron-atribuir-tarefas] Distribuição: ${hojeCount} hoje, ${amanhaCount} amanhã, ${encaixeCount} encaixes futuros`);

      // 5. Tentar atribuir o de maior prioridade
      for (const servico of servicosParaAtribuir) {
        const tipoAtribuicao = servico.is_encaixe ? 'encaixe' : (servico.is_hoje ? 'hoje' : 'amanha');
        console.log(`[cron-atribuir-tarefas] Tentando atribuir ${servico.tipo} ${servico.id} (${servico.distancia_km.toFixed(2)} km, tipo: ${tipoAtribuicao})`);

        const agora = new Date().toISOString();

        // Preparar dados de atualização
        const updateData: any = {
          profissional_id: prof.vistoriador_id,
          status: 'em_rota',
          em_rota_em: agora,
          updated_at: agora
        };

        // SE É UM ENCAIXE: puxar para HOJE e marcar como encaixe executado
        if (servico.is_encaixe) {
          updateData.data_agendada_original = servico.data_agendada; // Salvar data original
          updateData.data_agendada = hoje; // Puxar para HOJE
          updateData.encaixe_executado = true; // Marcar como encaixe
          console.log(`[cron-atribuir-tarefas] ⚡ ENCAIXE: Puxando serviço de ${servico.data_agendada} para ${hoje}`);
        }

        // Atribuir na tabela SERVICOS
        const { data: atualizado, error: updateError } = await supabase
          .from('servicos')
          .update(updateData)
          .eq('id', servico.id)
          .is('profissional_id', null)
          .select()
          .single();

        if (updateError) {
          // ✅ CORRIGIDO: Logar erro REAL do banco em vez de assumir concorrência
          console.error(`[cron-atribuir-tarefas] ERRO ao atribuir serviço ${servico.id}:`, JSON.stringify({
            message: updateError.message,
            code: updateError.code,
            details: updateError.details,
            hint: updateError.hint
          }));
          
          // Identificar se é erro de concorrência ou erro técnico
          if (updateError.code === 'PGRST116' || updateError.message?.includes('0 rows')) {
            console.log(`[cron-atribuir-tarefas] Serviço ${servico.id} já foi atribuído a outro (concorrência)`);
          } else {
            console.error(`[cron-atribuir-tarefas] ❌ ERRO TÉCNICO na atribuição: ${updateError.message}`);
          }
          continue;
        }

        if (atualizado) {
          console.log(`[cron-atribuir-tarefas] ✓ Serviço ${servico.id} atribuído ao profissional ${prof.vistoriador_id}`);

          // SINCRONIZAR COM TABELA DE ORIGEM (instalacoes ou vistorias)
          if (servico.instalacao_origem_id) {
            console.log(`[cron-atribuir-tarefas] Sincronizando com instalacoes ${servico.instalacao_origem_id}`);
            
            // Buscar dados do cliente/veículo da instalação de origem
            const { data: instalacaoOrigem } = await supabase
              .from('instalacoes')
              .select('associado_id, veiculo_id')
              .eq('id', servico.instalacao_origem_id)
              .single();
            
            // Preparar dados para instalação
            const instUpdateData: any = {
              instalador_responsavel_id: prof.vistoriador_id,
              status: 'em_rota'
            };
            
            // Se é encaixe, atualizar data também na tabela de origem
            if (servico.is_encaixe) {
              instUpdateData.data_agendada_original = servico.data_agendada;
              instUpdateData.data_agendada = hoje;
              instUpdateData.encaixe_executado = true;
            }
            
            await supabase
              .from('instalacoes')
              .update(instUpdateData)
              .eq('id', servico.instalacao_origem_id);
            
            // Copiar associado_id e veiculo_id para o servico se não tiver
            if (instalacaoOrigem) {
              const copyData: any = {};
              if (instalacaoOrigem.associado_id) {
                copyData.associado_id = instalacaoOrigem.associado_id;
              }
              if (instalacaoOrigem.veiculo_id) {
                copyData.veiculo_id = instalacaoOrigem.veiculo_id;
              }
              if (Object.keys(copyData).length > 0) {
                console.log(`[cron-atribuir-tarefas] Copiando dados cliente/veículo da instalação de origem`);
                await supabase
                  .from('servicos')
                  .update(copyData)
                  .eq('id', servico.id);
              }
            }
          }
          
          if (servico.vistoria_origem_id) {
            console.log(`[cron-atribuir-tarefas] Sincronizando com vistorias ${servico.vistoria_origem_id}`);
            
            // Preparar dados para vistoria
            const vistUpdateData: any = {
              vistoriador_id: prof.vistoriador_id,
              status: 'em_rota'
            };
            
            // Se é encaixe, atualizar data também na tabela de origem
            if (servico.is_encaixe) {
              vistUpdateData.data_agendada_original = servico.data_agendada;
              vistUpdateData.data_agendada = hoje;
              vistUpdateData.encaixe_executado = true;
            }
            
            await supabase
              .from('vistorias')
              .update(vistUpdateData)
              .eq('id', servico.vistoria_origem_id);

            // Enviar push notification para o regulador atribuído
            try {
              await supabase.functions.invoke('send-push-profissional', {
                body: {
                  profissional_id: prof.vistoriador_id,
                  notification: {
                    title: 'Nova Vistoria Atribuída',
                    body: `Vistoria ${servico.is_encaixe ? '(encaixe) ' : ''}atribuída - ${servico.associado_nome}`,
                    tag: `vistoria-${servico.vistoria_origem_id}`,
                    data: { url: '/instalador', tarefa_id: servico.id, tipo: 'vistoria' },
                  }
                }
              });
              console.log(`[cron-atribuir-tarefas] ✓ Push enviado para regulador ${prof.vistoriador_id}`);
            } catch (pushErr) {
              console.error('[cron-atribuir-tarefas] Erro ao enviar push:', pushErr);
            }
          }

          // 6. Criar ou atualizar rota do dia
          const { data: rotaExistente } = await supabase
            .from('rotas')
            .select('id')
            .eq('instalador_id', prof.vistoriador_id)
            .eq('data', hoje)
            .maybeSingle();

          let rotaId = rotaExistente?.id;

          if (!rotaId) {
            const { data: novaRota, error: rotaError } = await supabase
              .from('rotas')
              .insert({
                instalador_id: prof.vistoriador_id,
                data: hoje,
                status: 'em_andamento',
                tipo: 'automatica'
              })
              .select('id')
              .single();

            if (rotaError) {
              console.error('[cron-atribuir-tarefas] Erro ao criar rota:', rotaError);
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
            if (servico.instalacao_origem_id) {
              await supabase
                .from('instalacoes')
                .update({ rota_id: rotaId })
                .eq('id', servico.instalacao_origem_id);
            }
          }

          atribuicoes.push({
            profissional_id: prof.vistoriador_id,
            servico_id: servico.id,
            distancia_km: servico.distancia_km,
            tipo_atribuicao: tipoAtribuicao
          });

          break; // Próximo profissional
        }
      }
    }

    console.log(`[cron-atribuir-tarefas] Concluído: ${atribuicoes.length} atribuição(ões) realizadas`);
    
    // Log resumo por tipo
    const hojeAtrib = atribuicoes.filter(a => a.tipo_atribuicao === 'hoje').length;
    const amanhaAtrib = atribuicoes.filter(a => a.tipo_atribuicao === 'amanha').length;
    const encaixeAtrib = atribuicoes.filter(a => a.tipo_atribuicao === 'encaixe').length;
    console.log(`[cron-atribuir-tarefas] Resumo: ${hojeAtrib} hoje, ${amanhaAtrib} amanhã, ${encaixeAtrib} encaixes`);

    return new Response(
      JSON.stringify({
        resultado: 'sucesso',
        atribuicoes,
        total_profissionais: profissionais.length,
        total_atribuicoes: atribuicoes.length,
        resumo: {
          hoje: hojeAtrib,
          amanha: amanhaAtrib,
          encaixes: encaixeAtrib
        },
        logica: 'simplificada - sem limite de raio e janela de horas'
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[cron-atribuir-tarefas] Erro:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

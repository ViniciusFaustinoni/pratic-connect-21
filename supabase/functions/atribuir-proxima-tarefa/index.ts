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

interface TarefaDisponivel {
  id: string;
  tipo: 'instalacao' | 'vistoria';
  data_agendada: string;
  hora_agendada: string | null;
  endereco_latitude: number | null;
  endereco_longitude: number | null;
  permite_encaixe: boolean;
  status: string;
  // Dados do cliente
  associado_id: string;
  associado_nome: string;
  associado_telefone: string;
  // Dados do veículo
  veiculo_id: string;
  veiculo_placa: string;
  veiculo_marca: string;
  veiculo_modelo: string;
  // Endereço
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
}

interface TarefaComDistancia extends TarefaDisponivel {
  distancia_km: number;
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

    const vistoriadorId = user.id;
    console.log(`[atribuir-proxima-tarefa] Vistoriador ${vistoriadorId} em (${latitude}, ${longitude}), ação: ${acao || 'iniciar'}`);

    // 1. Verificar se vistoriador já tem tarefa em andamento
    const { data: tarefaAtual } = await supabase.rpc('buscar_tarefa_atual_vistoriador', {
      p_vistoriador_id: vistoriadorId
    });

    if (tarefaAtual && tarefaAtual.length > 0) {
      const tarefa = tarefaAtual[0];
      console.log(`[atribuir-proxima-tarefa] Vistoriador já tem tarefa: ${tarefa.tipo} ${tarefa.id}`);
      
      // Calcular distância até a tarefa atual
      let distancia_km = null;
      if (tarefa.endereco_latitude && tarefa.endereco_longitude) {
        distancia_km = calcularDistanciaKm(
          latitude, longitude,
          tarefa.endereco_latitude, tarefa.endereco_longitude
        );
      }

      return new Response(
        JSON.stringify({
          resultado: 'ja_tem_tarefa',
          tarefa: {
            ...tarefa,
            distancia_km
          }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Buscar tarefas disponíveis (sem atribuição)
    const hoje = new Date().toISOString().split('T')[0];
    const amanha = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    // Buscar instalações disponíveis
    const { data: instalacoes, error: instError } = await supabase
      .from('instalacoes')
      .select(`
        id,
        data_agendada,
        hora_agendada,
        endereco_latitude,
        endereco_longitude,
        permite_encaixe,
        status,
        logradouro,
        numero,
        bairro,
        cidade,
        uf,
        associado_id,
        veiculo_id,
        associado:associados!inner(nome, telefone),
        veiculo:veiculos!inner(placa, marca, modelo)
      `)
      .is('instalador_responsavel_id', null)
      .in('status', ['agendada'])
      .gte('data_agendada', hoje)
      .lte('data_agendada', amanha)
      .order('data_agendada', { ascending: true });

    if (instError) {
      console.error('[atribuir-proxima-tarefa] Erro ao buscar instalações:', instError);
    }

    // Buscar vistorias disponíveis
    const { data: vistorias, error: vistError } = await supabase
      .from('vistorias')
      .select(`
        id,
        data_agendada,
        hora_agendada,
        endereco_latitude,
        endereco_longitude,
        permite_encaixe,
        status,
        logradouro,
        numero,
        bairro,
        cidade,
        uf,
        associado_id,
        veiculo_id,
        associado:associados!inner(nome, telefone),
        veiculo:veiculos!inner(placa, marca, modelo)
      `)
      .is('vistoriador_id', null)
      .in('status', ['pendente', 'agendada'])
      .gte('data_agendada', hoje)
      .lte('data_agendada', amanha)
      .order('data_agendada', { ascending: true });

    if (vistError) {
      console.error('[atribuir-proxima-tarefa] Erro ao buscar vistorias:', vistError);
    }

    // 3. Mapear para formato comum
    const tarefasDisponiveis: TarefaDisponivel[] = [];

    if (instalacoes) {
      for (const inst of instalacoes) {
        const associado = inst.associado as any;
        const veiculo = inst.veiculo as any;
        tarefasDisponiveis.push({
          id: inst.id,
          tipo: 'instalacao',
          data_agendada: inst.data_agendada,
          hora_agendada: inst.hora_agendada,
          endereco_latitude: inst.endereco_latitude,
          endereco_longitude: inst.endereco_longitude,
          permite_encaixe: inst.permite_encaixe || false,
          status: inst.status,
          associado_id: inst.associado_id,
          associado_nome: associado?.nome || 'Cliente',
          associado_telefone: associado?.telefone || '',
          veiculo_id: inst.veiculo_id,
          veiculo_placa: veiculo?.placa || '',
          veiculo_marca: veiculo?.marca || '',
          veiculo_modelo: veiculo?.modelo || '',
          logradouro: inst.logradouro,
          numero: inst.numero,
          bairro: inst.bairro,
          cidade: inst.cidade,
          uf: inst.uf,
        });
      }
    }

    if (vistorias) {
      for (const vist of vistorias) {
        const associado = vist.associado as any;
        const veiculo = vist.veiculo as any;
        tarefasDisponiveis.push({
          id: vist.id,
          tipo: 'vistoria',
          data_agendada: vist.data_agendada,
          hora_agendada: vist.hora_agendada,
          endereco_latitude: vist.endereco_latitude,
          endereco_longitude: vist.endereco_longitude,
          permite_encaixe: vist.permite_encaixe || false,
          status: vist.status,
          associado_id: vist.associado_id,
          associado_nome: associado?.nome || 'Cliente',
          associado_telefone: associado?.telefone || '',
          veiculo_id: vist.veiculo_id,
          veiculo_placa: veiculo?.placa || '',
          veiculo_marca: veiculo?.marca || '',
          veiculo_modelo: veiculo?.modelo || '',
          logradouro: vist.logradouro,
          numero: vist.numero,
          bairro: vist.bairro,
          cidade: vist.cidade,
          uf: vist.uf,
        });
      }
    }

    console.log(`[atribuir-proxima-tarefa] ${tarefasDisponiveis.length} tarefas disponíveis encontradas`);

    if (tarefasDisponiveis.length === 0) {
      return new Response(
        JSON.stringify({
          resultado: 'sem_tarefas',
          mensagem: 'Não há tarefas disponíveis no momento.'
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Calcular distâncias e ordenar
    const tarefasComDistancia: TarefaComDistancia[] = tarefasDisponiveis
      .filter(t => t.endereco_latitude && t.endereco_longitude)
      .map(t => ({
        ...t,
        distancia_km: calcularDistanciaKm(
          latitude, longitude,
          t.endereco_latitude!, t.endereco_longitude!
        )
      }))
      .sort((a, b) => {
        // Prioridade 1: Encaixe (permite_encaixe = true e hoje)
        if (a.permite_encaixe && a.data_agendada === hoje && !b.permite_encaixe) return -1;
        if (b.permite_encaixe && b.data_agendada === hoje && !a.permite_encaixe) return 1;
        
        // Prioridade 2: Proximidade
        return a.distancia_km - b.distancia_km;
      });

    if (tarefasComDistancia.length === 0) {
      return new Response(
        JSON.stringify({
          resultado: 'sem_tarefas',
          mensagem: 'Nenhuma tarefa com coordenadas disponível.'
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Tentar atribuir a tarefa mais próxima (com transação para evitar race condition)
    for (const tarefa of tarefasComDistancia) {
      console.log(`[atribuir-proxima-tarefa] Tentando atribuir ${tarefa.tipo} ${tarefa.id} (${tarefa.distancia_km.toFixed(2)} km)`);
      
      const tabela = tarefa.tipo === 'instalacao' ? 'instalacoes' : 'vistorias';
      const campoResponsavel = tarefa.tipo === 'instalacao' ? 'instalador_responsavel_id' : 'vistoriador_id';
      
      // Tentar atribuir usando update condicional (atomicidade garantida pelo banco)
      const agora = new Date().toISOString();
      const { data: atualizado, error: updateError } = await supabase
        .from(tabela)
        .update({
          [campoResponsavel]: vistoriadorId,
          status: 'em_rota',
          em_rota_em: agora, // Registrar timestamp para métricas de tempo
          updated_at: agora
        })
        .eq('id', tarefa.id)
        .is(campoResponsavel, null) // Só atualiza se ainda não tiver responsável
        .select()
        .single();

      if (updateError) {
        console.log(`[atribuir-proxima-tarefa] Tarefa ${tarefa.id} já foi atribuída a outro vistoriador`);
        continue; // Tentar próxima tarefa
      }

      if (atualizado) {
        console.log(`[atribuir-proxima-tarefa] ✓ Tarefa ${tarefa.id} atribuída ao vistoriador ${vistoriadorId}`);
        
        // 6. Criar ou atualizar rota do dia
        const { data: rotaExistente } = await supabase
          .from('rotas')
          .select('id')
          .eq('instalador_id', vistoriadorId)
          .eq('data', hoje)
          .maybeSingle();

        let rotaId = rotaExistente?.id;

        if (!rotaId) {
          // Criar nova rota
          const { data: novaRota, error: rotaError } = await supabase
            .from('rotas')
            .insert({
              instalador_id: vistoriadorId,
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

        // Vincular tarefa à rota
        if (rotaId) {
          await supabase
            .from(tabela)
            .update({ rota_id: rotaId })
            .eq('id', tarefa.id);
        }

        // Salvar localização atual do vistoriador
        await supabase
          .from('vistoriadores_localizacao')
          .upsert({
            vistoriador_id: vistoriadorId,
            latitude,
            longitude,
            updated_at: new Date().toISOString()
          }, { onConflict: 'vistoriador_id' });

        return new Response(
          JSON.stringify({
            resultado: 'atribuida',
            tarefa: {
              id: tarefa.id,
              tipo: tarefa.tipo,
              status: 'em_rota',
              data_agendada: tarefa.data_agendada,
              hora_agendada: tarefa.hora_agendada,
              cliente: {
                nome: tarefa.associado_nome,
                telefone: tarefa.associado_telefone
              },
              veiculo: {
                placa: tarefa.veiculo_placa,
                marca: tarefa.veiculo_marca,
                modelo: tarefa.veiculo_modelo
              },
              endereco: {
                logradouro: tarefa.logradouro,
                numero: tarefa.numero,
                bairro: tarefa.bairro,
                cidade: tarefa.cidade,
                uf: tarefa.uf,
                latitude: tarefa.endereco_latitude,
                longitude: tarefa.endereco_longitude
              },
              distancia_km: tarefa.distancia_km,
              rota_id: rotaId
            }
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Se chegou aqui, todas as tarefas foram atribuídas a outros
    return new Response(
      JSON.stringify({
        resultado: 'sem_tarefas',
        mensagem: 'Todas as tarefas próximas já foram atribuídas a outros vistoriadores.'
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

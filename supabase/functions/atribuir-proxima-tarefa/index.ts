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

interface ServicoDisponivel {
  id: string;
  tipo: string;
  data_agendada: string;
  hora_agendada: string | null;
  latitude: number | null;
  longitude: number | null;
  permite_encaixe: boolean;
  status: string;
  associado_id: string;
  associado_nome: string;
  associado_telefone: string;
  veiculo_id: string;
  veiculo_placa: string;
  veiculo_marca: string;
  veiculo_modelo: string;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
}

interface ServicoComDistancia extends ServicoDisponivel {
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

    // 2. Buscar serviços disponíveis (sem atribuição) da tabela UNIFICADA servicos
    const hoje = new Date().toISOString().split('T')[0];
    const amanha = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const { data: servicos, error: servicosError } = await supabase
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
        associado:associados!inner(nome, telefone),
        veiculo:veiculos!inner(placa, marca, modelo)
      `)
      .is('profissional_id', null)
      .in('status', ['pendente', 'agendada'])
      .or('local_vistoria.is.null,local_vistoria.eq.cliente')
      .gte('data_agendada', hoje)
      .lte('data_agendada', amanha)
      .order('data_agendada', { ascending: true });

    if (servicosError) {
      console.error('[atribuir-proxima-tarefa] Erro ao buscar serviços:', servicosError);
      throw servicosError;
    }

    // 3. Mapear para formato comum
    const servicosDisponiveis: ServicoDisponivel[] = (servicos || []).map((s: any) => ({
      id: s.id,
      tipo: s.tipo,
      data_agendada: s.data_agendada,
      hora_agendada: s.hora_agendada,
      latitude: s.latitude,
      longitude: s.longitude,
      permite_encaixe: s.permite_encaixe || false,
      status: s.status,
      associado_id: s.associado_id,
      associado_nome: s.associado?.nome || 'Cliente',
      associado_telefone: s.associado?.telefone || '',
      veiculo_id: s.veiculo_id,
      veiculo_placa: s.veiculo?.placa || '',
      veiculo_marca: s.veiculo?.marca || '',
      veiculo_modelo: s.veiculo?.modelo || '',
      logradouro: s.logradouro,
      numero: s.numero,
      bairro: s.bairro,
      cidade: s.cidade,
      uf: s.uf,
    }));

    console.log(`[atribuir-proxima-tarefa] ${servicosDisponiveis.length} serviços disponíveis encontrados`);

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

    // 4. Calcular distâncias e ordenar
    const servicosComDistancia: ServicoComDistancia[] = servicosDisponiveis
      .filter(s => s.latitude && s.longitude)
      .map(s => ({
        ...s,
        distancia_km: calcularDistanciaKm(
          latitude, longitude,
          s.latitude!, s.longitude!
        )
      }))
      .sort((a, b) => {
        // Prioridade 1: Encaixe (permite_encaixe = true e hoje)
        if (a.permite_encaixe && a.data_agendada === hoje && !b.permite_encaixe) return -1;
        if (b.permite_encaixe && b.data_agendada === hoje && !a.permite_encaixe) return 1;
        
        // Prioridade 2: Proximidade
        return a.distancia_km - b.distancia_km;
      });

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
      
      // Atualizar na tabela SERVICOS
      const { data: atualizado, error: updateError } = await supabase
        .from('servicos')
        .update({
          profissional_id: profissionalId,
          status: 'em_rota',
          em_rota_em: agora,
          updated_at: agora
        })
        .eq('id', servico.id)
        .is('profissional_id', null) // Só atualiza se ainda não tiver responsável
        .select()
        .single();

      if (updateError) {
        console.log(`[atribuir-proxima-tarefa] Serviço ${servico.id} já foi atribuído a outro profissional`);
        continue;
      }

      if (atualizado) {
        console.log(`[atribuir-proxima-tarefa] ✓ Serviço ${servico.id} atribuído ao profissional ${profissionalId}`);
        
        // 6. Criar ou atualizar rota do dia
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

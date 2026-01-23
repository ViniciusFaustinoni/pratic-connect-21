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

interface ProfissionalDisponivel {
  vistoriador_id: string;
  latitude: number;
  longitude: number;
  updated_at: string;
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

    const atribuicoes: { profissional_id: string; servico_id: string; distancia_km: number }[] = [];

    // 2. Para cada profissional, verificar se já tem tarefa e tentar atribuir
    for (const prof of profissionais as ProfissionalDisponivel[]) {
      // Verificar se profissional já tem tarefa em andamento
      const { data: tarefaAtual } = await supabase.rpc('buscar_tarefa_atual_profissional', {
        p_profissional_id: prof.vistoriador_id
      });

      if (tarefaAtual && tarefaAtual.length > 0) {
        console.log(`[cron-atribuir-tarefas] Profissional ${prof.vistoriador_id} já tem tarefa ativa`);
        continue;
      }

      // 3. Buscar serviços disponíveis da tabela UNIFICADA servicos (LEFT JOIN para incluir serviços sem cliente/veículo)
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
          local_vistoria,
          associado:associados(nome),
          veiculo:veiculos(placa)
        `)
        .is('profissional_id', null)
        .in('status', ['pendente', 'agendada'])
        .or('local_vistoria.is.null,local_vistoria.eq.cliente')
        .gte('data_agendada', hoje)
        .lte('data_agendada', amanha)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (servicosError) {
        console.error('[cron-atribuir-tarefas] Erro ao buscar serviços:', servicosError);
        continue;
      }

      if (!servicos || servicos.length === 0) {
        console.log(`[cron-atribuir-tarefas] Nenhum serviço disponível para profissional ${prof.vistoriador_id}`);
        continue;
      }

      // 4. Mapear e calcular distâncias (SEM LIMITE DE RAIO)
      const servicosComDistancia = servicos
        .map((s: any) => ({
          id: s.id,
          tipo: s.tipo,
          data_agendada: s.data_agendada,
          hora_agendada: s.hora_agendada,
          latitude: s.latitude,
          longitude: s.longitude,
          permite_encaixe: s.permite_encaixe || false,
          associado_nome: s.associado?.nome || 'Cliente não vinculado',
          veiculo_placa: s.veiculo?.placa || 'Placa pendente',
          distancia_km: calcularDistanciaKm(
            prof.latitude, prof.longitude,
            s.latitude, s.longitude
          )
        }))
        .sort((a: any, b: any) => {
          // Prioridade 1: Encaixe (permite_encaixe = true e hoje)
          if (a.permite_encaixe && a.data_agendada === hoje && !b.permite_encaixe) return -1;
          if (b.permite_encaixe && b.data_agendada === hoje && !a.permite_encaixe) return 1;
          // Prioridade 2: Proximidade (sem limite de raio)
          return a.distancia_km - b.distancia_km;
        });

      console.log(`[cron-atribuir-tarefas] ${servicosComDistancia.length} serviços disponíveis para profissional ${prof.vistoriador_id}`);

      // 5. Tentar atribuir o mais próximo (sem limite de raio)
      for (const servico of servicosComDistancia) {
        console.log(`[cron-atribuir-tarefas] Tentando atribuir ${servico.tipo} ${servico.id} (${servico.distancia_km.toFixed(2)} km)`);

        const agora = new Date().toISOString();

        // Atribuir na tabela SERVICOS
        const { data: atualizado, error: updateError } = await supabase
          .from('servicos')
          .update({
            profissional_id: prof.vistoriador_id,
            status: 'em_rota',
            em_rota_em: agora,
            updated_at: agora
          })
          .eq('id', servico.id)
          .is('profissional_id', null)
          .select()
          .single();

        if (updateError) {
          console.log(`[cron-atribuir-tarefas] Serviço ${servico.id} já foi atribuído a outro`);
          continue;
        }

        if (atualizado) {
          console.log(`[cron-atribuir-tarefas] ✓ Serviço ${servico.id} atribuído ao profissional ${prof.vistoriador_id}`);

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
          }

          atribuicoes.push({
            profissional_id: prof.vistoriador_id,
            servico_id: servico.id,
            distancia_km: servico.distancia_km
          });

          break; // Próximo profissional
        }
      }
    }

    console.log(`[cron-atribuir-tarefas] Concluído: ${atribuicoes.length} atribuição(ões) realizadas`);

    return new Response(
      JSON.stringify({
        resultado: 'sucesso',
        atribuicoes,
        total_profissionais: profissionais.length,
        total_atribuicoes: atribuicoes.length
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

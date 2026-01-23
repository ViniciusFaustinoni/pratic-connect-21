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

interface EncaixeFuturo {
  id: string;
  tipo: 'instalacao' | 'vistoria';
  data_agendada: string;
  hora_agendada: string | null;
  endereco_latitude: number;
  endereco_longitude: number;
  associado_id: string;
  veiculo_id: string;
  bairro: string | null;
  cidade: string | null;
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

    console.log("[processar-encaixes-automaticos] Iniciando processamento de encaixes FUTUROS...");

    // 1. Buscar configuração de raio máximo
    const { data: configRaio } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'operacional_encaixe_raio_km')
      .single();

    const raioMaximoKm = configRaio?.valor ? parseFloat(configRaio.valor) : 10;
    console.log(`[processar-encaixes-automaticos] Raio máximo configurado: ${raioMaximoKm} km`);

    const hoje = new Date().toISOString().split('T')[0];

    // ========== CORREÇÃO PRINCIPAL ==========
    // Buscar encaixes de datas FUTURAS (> hoje), não de hoje!
    // Conceito: encaixe = serviço que PODE SER ANTECIPADO para hoje

    // Instalações FUTURAS com encaixe habilitado
    const { data: instalacoesEncaixe, error: instError } = await supabase
      .from('instalacoes')
      .select('id, data_agendada, hora_agendada, endereco_latitude, endereco_longitude, associado_id, veiculo_id, bairro, cidade')
      .eq('permite_encaixe', true)
      .is('instalador_responsavel_id', null)
      .gt('data_agendada', hoje) // ✅ CORRIGIDO: > hoje (datas FUTURAS)
      .in('status', ['agendada'])
      .not('endereco_latitude', 'is', null)
      .not('endereco_longitude', 'is', null);

    if (instError) {
      console.error('[processar-encaixes-automaticos] Erro ao buscar instalações:', instError);
    }

    // Vistorias FUTURAS com encaixe habilitado
    const { data: vistoriasEncaixe, error: vistError } = await supabase
      .from('vistorias')
      .select('id, data_agendada, hora_agendada, endereco_latitude, endereco_longitude, associado_id, veiculo_id, bairro, cidade')
      .eq('permite_encaixe', true)
      .is('vistoriador_id', null)
      .gt('data_agendada', hoje) // ✅ CORRIGIDO: > hoje (datas FUTURAS)
      .in('status', ['pendente', 'agendada'])
      .not('endereco_latitude', 'is', null)
      .not('endereco_longitude', 'is', null);

    if (vistError) {
      console.error('[processar-encaixes-automaticos] Erro ao buscar vistorias:', vistError);
    }

    // Mapear para formato comum
    const encaixes: EncaixeFuturo[] = [];

    if (instalacoesEncaixe) {
      for (const inst of instalacoesEncaixe) {
        encaixes.push({
          id: inst.id,
          tipo: 'instalacao',
          data_agendada: inst.data_agendada,
          hora_agendada: inst.hora_agendada,
          endereco_latitude: inst.endereco_latitude,
          endereco_longitude: inst.endereco_longitude,
          associado_id: inst.associado_id,
          veiculo_id: inst.veiculo_id,
          bairro: inst.bairro,
          cidade: inst.cidade,
        });
      }
    }

    if (vistoriasEncaixe) {
      for (const vist of vistoriasEncaixe) {
        encaixes.push({
          id: vist.id,
          tipo: 'vistoria',
          data_agendada: vist.data_agendada,
          hora_agendada: vist.hora_agendada,
          endereco_latitude: vist.endereco_latitude,
          endereco_longitude: vist.endereco_longitude,
          associado_id: vist.associado_id,
          veiculo_id: vist.veiculo_id,
          bairro: vist.bairro,
          cidade: vist.cidade,
        });
      }
    }

    console.log(`[processar-encaixes-automaticos] ${encaixes.length} encaixes FUTUROS encontrados`);

    if (encaixes.length === 0) {
      return new Response(
        JSON.stringify({ 
          sucesso: true, 
          mensagem: 'Nenhum encaixe futuro pendente',
          processados: 0 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Buscar profissionais com localização recente (últimos 30 minutos)
    const limite30Min = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data: localizacoes, error: locError } = await supabase
      .from('vistoriadores_localizacao')
      .select('vistoriador_id, latitude, longitude, updated_at')
      .eq('em_servico', true) // ✅ Adicionado: só profissionais em serviço
      .gte('updated_at', limite30Min);

    if (locError) {
      console.error('[processar-encaixes-automaticos] Erro ao buscar localizações:', locError);
      throw new Error('Erro ao buscar localizações dos profissionais');
    }

    console.log(`[processar-encaixes-automaticos] ${localizacoes?.length || 0} profissionais com localização recente`);

    if (!localizacoes || localizacoes.length === 0) {
      return new Response(
        JSON.stringify({ 
          sucesso: true, 
          mensagem: 'Nenhum profissional com localização recente',
          processados: 0 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Filtrar profissionais que NÃO têm tarefa ativa (em_rota ou em_andamento)
    const profissionaisDisponiveis: ProfissionalDisponivel[] = [];

    for (const loc of localizacoes) {
      const { data: tarefaAtual } = await supabase.rpc('buscar_tarefa_atual_profissional', {
        p_profissional_id: loc.vistoriador_id
      });

      // Se não tem tarefa ativa, está disponível
      if (!tarefaAtual || tarefaAtual.length === 0) {
        profissionaisDisponiveis.push(loc as ProfissionalDisponivel);
      }
    }

    console.log(`[processar-encaixes-automaticos] ${profissionaisDisponiveis.length} profissionais disponíveis (sem tarefa ativa)`);

    if (profissionaisDisponiveis.length === 0) {
      return new Response(
        JSON.stringify({ 
          sucesso: true, 
          mensagem: 'Todos os profissionais estão ocupados',
          processados: 0 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Para cada encaixe, encontrar profissional disponível próximo e PUXAR para hoje
    let processados = 0;
    const atribuicoes: Array<{ 
      encaixe_id: string; 
      tipo: string; 
      profissional_id: string; 
      distancia_km: number;
      data_original: string;
      data_nova: string;
    }> = [];

    // Manter lista mutável de profissionais livres
    let profissionaisLivres = [...profissionaisDisponiveis];

    for (const encaixe of encaixes) {
      if (profissionaisLivres.length === 0) {
        console.log('[processar-encaixes-automaticos] Não há mais profissionais disponíveis');
        break;
      }

      // Calcular distância para cada profissional disponível
      const candidatos = profissionaisLivres
        .map(prof => ({
          ...prof,
          distancia_km: calcularDistanciaKm(
            prof.latitude,
            prof.longitude,
            encaixe.endereco_latitude,
            encaixe.endereco_longitude
          )
        }))
        .filter(c => c.distancia_km <= raioMaximoKm) // Filtrar por raio
        .sort((a, b) => a.distancia_km - b.distancia_km); // Mais próximo primeiro

      if (candidatos.length === 0) {
        console.log(`[processar-encaixes-automaticos] Nenhum profissional dentro do raio (${raioMaximoKm}km) para encaixe ${encaixe.id}`);
        continue;
      }

      const maisProximo = candidatos[0];
      console.log(`[processar-encaixes-automaticos] ⚡ ENCAIXE: Puxando ${encaixe.tipo} ${encaixe.id} de ${encaixe.data_agendada} para ${hoje}`);
      console.log(`[processar-encaixes-automaticos] Atribuindo ao profissional ${maisProximo.vistoriador_id} (${maisProximo.distancia_km.toFixed(2)} km)`);

      // Atribuir tarefa e PUXAR PARA HOJE
      const tabela = encaixe.tipo === 'instalacao' ? 'instalacoes' : 'vistorias';
      const campoResponsavel = encaixe.tipo === 'instalacao' ? 'instalador_responsavel_id' : 'vistoriador_id';

      const { data: atualizado, error: updateError } = await supabase
        .from(tabela)
        .update({
          [campoResponsavel]: maisProximo.vistoriador_id,
          status: 'em_rota',
          data_agendada_original: encaixe.data_agendada, // ✅ Salvar data original
          data_agendada: hoje,                           // ✅ PUXAR para hoje
          encaixe_executado: true,                       // ✅ Marcar como encaixe executado
          updated_at: new Date().toISOString()
        })
        .eq('id', encaixe.id)
        .is(campoResponsavel, null) // Garante atomicidade
        .select()
        .single();

      if (updateError || !atualizado) {
        console.log(`[processar-encaixes-automaticos] Encaixe ${encaixe.id} já foi atribuído por outro processo`);
        continue;
      }

      // Sincronizar com tabela servicos (se existir registro correspondente)
      const servicoField = encaixe.tipo === 'instalacao' ? 'instalacao_origem_id' : 'vistoria_origem_id';
      await supabase
        .from('servicos')
        .update({
          profissional_id: maisProximo.vistoriador_id,
          status: 'em_rota',
          data_agendada_original: encaixe.data_agendada,
          data_agendada: hoje,
          encaixe_executado: true,
          em_rota_em: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq(servicoField, encaixe.id);

      // Criar ou atualizar rota do dia
      const { data: rotaExistente } = await supabase
        .from('rotas')
        .select('id')
        .eq('instalador_id', maisProximo.vistoriador_id)
        .eq('data', hoje)
        .maybeSingle();

      let rotaId = rotaExistente?.id;

      if (!rotaId) {
        const { data: novaRota } = await supabase
          .from('rotas')
          .insert({
            instalador_id: maisProximo.vistoriador_id,
            data: hoje,
            status: 'em_andamento',
            tipo: 'automatica'
          })
          .select('id')
          .single();

        rotaId = novaRota?.id;
      }

      if (rotaId) {
        await supabase
          .from(tabela)
          .update({ rota_id: rotaId })
          .eq('id', encaixe.id);
          
        await supabase
          .from('servicos')
          .update({ rota_id: rotaId })
          .eq(servicoField, encaixe.id);
      }

      // Registrar atribuição
      atribuicoes.push({
        encaixe_id: encaixe.id,
        tipo: encaixe.tipo,
        profissional_id: maisProximo.vistoriador_id,
        distancia_km: maisProximo.distancia_km,
        data_original: encaixe.data_agendada,
        data_nova: hoje
      });

      // Remover profissional da lista (agora está ocupado)
      profissionaisLivres = profissionaisLivres.filter(
        p => p.vistoriador_id !== maisProximo.vistoriador_id
      );

      processados++;
      console.log(`[processar-encaixes-automaticos] ✓ Encaixe ${encaixe.id} executado com sucesso (${encaixe.data_agendada} → ${hoje})`);
    }

    console.log(`[processar-encaixes-automaticos] Processamento concluído: ${processados} encaixes executados`);

    return new Response(
      JSON.stringify({
        sucesso: true,
        mensagem: `${processados} encaixe(s) executado(s) - serviços puxados para hoje`,
        processados,
        atribuicoes
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[processar-encaixes-automaticos] Erro:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para calcular distância entre dois pontos usando Haversine
function calcularDistanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

interface ProfissionalDisponivel {
  vistoriador_id: string;
  latitude: number;
  longitude: number;
  updated_at: string;
  nome?: string;
}

interface ServicoDisponivel {
  id: string;
  tipo: 'instalacao' | 'vistoria';
  latitude: number;
  longitude: number;
  data_agendada: string;
  horario_agendado: string | null;
  veiculo_placa: string | null;
  associado_nome: string | null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('[CRON-ATRIBUIR] Iniciando verificação de atribuições automáticas...');

  try {
    // 1. Buscar configuração de raio máximo
    const { data: configRaio } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'operacional_encaixe_raio_km')
      .single();

    // Usar 30km como padrão se não configurado (maior para cobrir áreas metropolitanas)
    const raioMaximoKm = configRaio?.valor ? parseFloat(configRaio.valor) : 30;
    console.log(`[CRON-ATRIBUIR] Raio máximo configurado: ${raioMaximoKm} km`);

    // 2. Buscar profissionais em serviço com localização atualizada (últimos 30 minutos)
    const trintaMinutosAtras = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data: profissionais, error: erroProfissionais } = await supabase
      .from('vistoriadores_localizacao')
      .select(`
        vistoriador_id,
        latitude,
        longitude,
        updated_at,
        profiles:vistoriador_id (nome)
      `)
      .eq('em_servico', true)
      .gte('updated_at', trintaMinutosAtras);

    if (erroProfissionais) {
      console.error('[CRON-ATRIBUIR] Erro ao buscar profissionais:', erroProfissionais);
      throw erroProfissionais;
    }

    if (!profissionais || profissionais.length === 0) {
      console.log('[CRON-ATRIBUIR] Nenhum profissional em serviço com localização recente');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Nenhum profissional disponível',
        atribuicoes: 0 
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log(`[CRON-ATRIBUIR] ${profissionais.length} profissional(is) em serviço encontrado(s)`);

    // 3. Para cada profissional, verificar se tem tarefa ativa
    const atribuicoes: Array<{ profissional: string; servico: string; tipo: string; distancia: number }> = [];
    const hoje = new Date().toISOString().split('T')[0];
    const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    for (const profissional of profissionais) {
      const prof = profissional as any;
      const profNome = prof.profiles?.nome || 'Profissional';
      
      console.log(`[CRON-ATRIBUIR] Verificando ${profNome}...`);

      // Verificar se já tem tarefa em andamento
      const { data: rotaAtiva } = await supabase
        .from('rotas')
        .select('id')
        .eq('profissional_id', prof.vistoriador_id)
        .in('status', ['em_rota', 'em_atendimento'])
        .single();

      if (rotaAtiva) {
        console.log(`[CRON-ATRIBUIR] ${profNome} já possui tarefa ativa, pulando...`);
        continue;
      }

      // 4. Buscar serviços disponíveis (instalações e vistorias)
      const servicosDisponiveis: ServicoDisponivel[] = [];

      // Buscar instalações pendentes
      const { data: instalacoes } = await supabase
        .from('instalacoes')
        .select(`
          id,
          data_agendada,
          horario_agendado,
          latitude,
          longitude,
          veiculos!inner(placa),
          associados!inner(nome)
        `)
        .is('vistoriador_id', null)
        .in('status', ['agendado', 'pendente'])
        .in('data_agendada', [hoje, amanha])
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (instalacoes) {
        for (const inst of instalacoes as any[]) {
          servicosDisponiveis.push({
            id: inst.id,
            tipo: 'instalacao',
            latitude: inst.latitude,
            longitude: inst.longitude,
            data_agendada: inst.data_agendada,
            horario_agendado: inst.horario_agendado,
            veiculo_placa: inst.veiculos?.placa,
            associado_nome: inst.associados?.nome,
          });
        }
      }

      // Buscar vistorias pendentes
      const { data: vistorias } = await supabase
        .from('vistorias')
        .select(`
          id,
          data_agendada,
          horario_agendado,
          latitude,
          longitude,
          veiculos!inner(placa),
          associados!inner(nome)
        `)
        .is('vistoriador_id', null)
        .in('status', ['agendado', 'pendente'])
        .in('data_agendada', [hoje, amanha])
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (vistorias) {
        for (const vist of vistorias as any[]) {
          servicosDisponiveis.push({
            id: vist.id,
            tipo: 'vistoria',
            latitude: vist.latitude,
            longitude: vist.longitude,
            data_agendada: vist.data_agendada,
            horario_agendado: vist.horario_agendado,
            veiculo_placa: vist.veiculos?.placa,
            associado_nome: vist.associados?.nome,
          });
        }
      }

      if (servicosDisponiveis.length === 0) {
        console.log(`[CRON-ATRIBUIR] Nenhum serviço disponível para atribuição`);
        continue;
      }

      // 5. Calcular distâncias e ordenar por proximidade
      const servicosComDistancia = servicosDisponiveis.map(servico => ({
        ...servico,
        distancia: calcularDistanciaKm(
          prof.latitude, 
          prof.longitude, 
          servico.latitude, 
          servico.longitude
        )
      })).sort((a, b) => a.distancia - b.distancia);

      // 6. Tentar atribuir o serviço mais próximo dentro do raio
      const servicoMaisProximo = servicosComDistancia[0];
      
      console.log(`[CRON-ATRIBUIR] Serviço mais próximo: ${servicoMaisProximo.tipo} a ${servicoMaisProximo.distancia.toFixed(2)} km`);

      if (servicoMaisProximo.distancia > raioMaximoKm) {
        console.log(`[CRON-ATRIBUIR] Fora do raio máximo (${raioMaximoKm} km), não atribuindo`);
        continue;
      }

      // 7. Atribuir o serviço ao profissional
      const tabela = servicoMaisProximo.tipo === 'instalacao' ? 'instalacoes' : 'vistorias';
      
      const { error: erroAtribuicao } = await supabase
        .from(tabela)
        .update({ 
          vistoriador_id: prof.vistoriador_id,
          status: 'em_rota',
          updated_at: new Date().toISOString()
        })
        .eq('id', servicoMaisProximo.id);

      if (erroAtribuicao) {
        console.error(`[CRON-ATRIBUIR] Erro ao atribuir serviço:`, erroAtribuicao);
        continue;
      }

      // 8. Criar/atualizar rota
      await supabase
        .from('rotas')
        .upsert({
          profissional_id: prof.vistoriador_id,
          servico_id: servicoMaisProximo.id,
          tipo_servico: servicoMaisProximo.tipo,
          status: 'em_rota',
          data: hoje,
          origem_latitude: prof.latitude,
          origem_longitude: prof.longitude,
          destino_latitude: servicoMaisProximo.latitude,
          destino_longitude: servicoMaisProximo.longitude,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'profissional_id,servico_id'
        });

      console.log(`[CRON-ATRIBUIR] ✅ Atribuído: ${servicoMaisProximo.tipo} ${servicoMaisProximo.veiculo_placa || servicoMaisProximo.id} → ${profNome}`);

      atribuicoes.push({
        profissional: profNome,
        servico: `${servicoMaisProximo.tipo}: ${servicoMaisProximo.veiculo_placa || servicoMaisProximo.id}`,
        tipo: servicoMaisProximo.tipo,
        distancia: Math.round(servicoMaisProximo.distancia * 100) / 100
      });
    }

    console.log(`[CRON-ATRIBUIR] Finalizado. ${atribuicoes.length} atribuição(ões) realizada(s)`);

    return new Response(JSON.stringify({ 
      success: true, 
      atribuicoes: atribuicoes.length,
      detalhes: atribuicoes,
      raioMaximoKm
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[CRON-ATRIBUIR] Erro geral:', errorMessage);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

export type StatusTratativa = 'aguardando_contato' | 'em_tratativa' | 'agendado' | 'visita_realizada' | 'acompanhamento' | 'resolvido_sem_visita';
export type FiltroPeriodo = 'hoje' | '3dias' | 'semana' | 'mes';

export interface VeiculoManutencao {
  veiculoId: string;
  associadoId: string;
  associadoNome: string;
  rastreadorId: string;
  placa: string;
  marca: string;
  modelo: string;
  ultimaComunicacao: string | null;
  horasSemComunicacao: number;
  diasSemPontuar: number;
  status: StatusTratativa | 'sem_tratativa';
  tratativaId: string | null;
  temEventoAberto: boolean;
  inadimplente: boolean;
}

export interface MetricasManutencao {
  aguardandoContato: number;
  emTratativa: number;
  agendados: number;
  concluidosHoje: number;
}

function getDataInicio(periodo: FiltroPeriodo): Date {
  const now = new Date();
  switch (periodo) {
    case 'hoje':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case '3dias':
      return new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    case 'semana':
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      return new Date(now.getFullYear(), now.getMonth(), diff);
    case 'mes':
      return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}

export function useManutencaoRastreadores() {
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodo>('3dias');
  const queryClient = useQueryClient();

  // Query 1: Veículos sem comunicação >= 72h com status instalado
  const { data: veiculosSemPontuar, isLoading: loadingVeiculos } = useQuery({
    queryKey: ['manutencao-veiculos-sem-pontuar'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('view_rastreadores_posicao')
        .select('*')
        .gte('horas_sem_comunicacao', 72)
        .eq('status', 'instalado');
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 5 * 60 * 1000,
    refetchIntervalInBackground: false,
  });

  // Query 2: Tratativas existentes
  const { data: tratativas, isLoading: loadingTratativas } = useQuery({
    queryKey: ['manutencao-tratativas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('manutencao_tratativas')
        .select('*');
      if (error) throw error;
      return data || [];
    },
  });

  // Query 3: Sinistros abertos (para verificar evento aberto)
  const veiculoIds = useMemo(() => 
    (veiculosSemPontuar || []).map(v => v.veiculo_id).filter(Boolean) as string[],
    [veiculosSemPontuar]
  );

  const { data: sinistrosAbertos } = useQuery({
    queryKey: ['manutencao-sinistros-abertos', veiculoIds],
    queryFn: async () => {
      if (!veiculoIds.length) return [];
      const { data, error } = await supabase
        .from('sinistros')
        .select('id, veiculo_id, status')
        .in('veiculo_id', veiculoIds)
        .not('status', 'in', '("cancelado","encerrado","negado","reprovado","pago","indenizado")');
      if (error) throw error;
      return data || [];
    },
    enabled: veiculoIds.length > 0,
  });

  // Query 4: Inadimplentes
  const associadoIds = useMemo(() => 
    [...new Set((veiculosSemPontuar || []).map(v => v.associado_id).filter(Boolean))] as string[],
    [veiculosSemPontuar]
  );

  const { data: inadimplentes } = useQuery({
    queryKey: ['manutencao-inadimplentes', associadoIds],
    queryFn: async () => {
      if (!associadoIds.length) return [];
      const { data, error } = await supabase
        .from('view_inadimplentes')
        .select('associado_id')
        .in('associado_id', associadoIds);
      if (error) throw error;
      return data || [];
    },
    enabled: associadoIds.length > 0,
  });

  // Merge all data
  const veiculosEnriquecidos = useMemo<VeiculoManutencao[]>(() => {
    if (!veiculosSemPontuar) return [];

    const sinistroVeiculoIds = new Set((sinistrosAbertos || []).map(s => s.veiculo_id));
    const inadimplenteIds = new Set((inadimplentes || []).map(i => i.associado_id));
    
    // Map tratativas by veiculo_id (most recent)
    const tratativaMap = new Map<string, { id: string; status: string }>();
    (tratativas || [])
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .forEach(t => {
        if (!tratativaMap.has(t.veiculo_id)) {
          tratativaMap.set(t.veiculo_id, { id: t.id, status: t.status });
        }
      });

    return veiculosSemPontuar.map(v => {
      const tratativa = tratativaMap.get(v.veiculo_id!);
      return {
        veiculoId: v.veiculo_id!,
        associadoId: v.associado_id!,
        associadoNome: v.associado_nome || 'Sem nome',
        rastreadorId: v.rastreador_id!,
        placa: v.placa || '',
        marca: v.marca || '',
        modelo: v.modelo || '',
        ultimaComunicacao: v.ultima_comunicacao,
        horasSemComunicacao: v.horas_sem_comunicacao || 0,
        diasSemPontuar: Math.floor((v.horas_sem_comunicacao || 0) / 24),
        status: (tratativa?.status as StatusTratativa) || 'sem_tratativa',
        tratativaId: tratativa?.id || null,
        temEventoAberto: sinistroVeiculoIds.has(v.veiculo_id!),
        inadimplente: inadimplenteIds.has(v.associado_id!),
      };
    });
  }, [veiculosSemPontuar, tratativas, sinistrosAbertos, inadimplentes]);

  // Filtered list
  const veiculosFiltrados = useMemo(() => {
    let lista = veiculosEnriquecidos;

    // Filter by search
    if (busca.trim()) {
      const termo = busca.toLowerCase();
      lista = lista.filter(v =>
        v.associadoNome.toLowerCase().includes(termo) ||
        v.placa.toLowerCase().includes(termo)
      );
    }

    // Filter by status
    if (filtroStatus !== 'todos') {
      lista = lista.filter(v => v.status === filtroStatus);
    }

    // Sort by dias sem pontuar desc
    lista.sort((a, b) => b.diasSemPontuar - a.diasSemPontuar);

    return lista;
  }, [veiculosEnriquecidos, busca, filtroStatus]);

  // Metrics
  const metricas = useMemo<MetricasManutencao>(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const concluidosHoje = (tratativas || []).filter(t => {
      const isTerminal = t.status === 'visita_realizada' || t.status === 'resolvido_sem_visita';
      const updatedAt = new Date(t.updated_at);
      return isTerminal && updatedAt >= hoje;
    }).length;

    return {
      aguardandoContato: veiculosEnriquecidos.filter(v => v.status === 'aguardando_contato' || v.status === 'sem_tratativa').length,
      emTratativa: veiculosEnriquecidos.filter(v => v.status === 'em_tratativa').length,
      agendados: veiculosEnriquecidos.filter(v => v.status === 'agendado').length,
      concluidosHoje,
    };
  }, [veiculosEnriquecidos, tratativas]);

  // Mutation: Iniciar tratativa
  const iniciarTratativa = useMutation({
    mutationFn: async (veiculo: VeiculoManutencao) => {
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id || null;
      
      // Verify user exists in profiles before setting criado_por
      let criadoPor: string | null = null;
      if (userId) {
        const { data: profile } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
        if (profile) criadoPor = userId;
      }
      
      const { error } = await supabase
        .from('manutencao_tratativas')
        .insert({
          veiculo_id: veiculo.veiculoId,
          associado_id: veiculo.associadoId,
          rastreador_id: veiculo.rastreadorId,
          status: 'aguardando_contato',
          criado_por: criadoPor,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Tratativa iniciada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['manutencao-tratativas'] });
    },
    onError: (err: Error) => {
      toast.error('Erro ao iniciar tratativa: ' + err.message);
    },
  });

  return {
    veiculos: veiculosFiltrados,
    metricas,
    isLoading: loadingVeiculos || loadingTratativas,
    busca,
    setBusca,
    filtroStatus,
    setFiltroStatus,
    filtroPeriodo,
    setFiltroPeriodo,
    iniciarTratativa,
  };
}

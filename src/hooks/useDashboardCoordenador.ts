import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay, endOfDay } from 'date-fns';

export interface EquipeMembro {
  id: string;
  nome: string;
  status: 'online' | 'em_rota' | 'offline';
  tarefasConcluidas: number;
  tarefasTotal: number;
  regiao: string | null;
}

export interface AlertaCoordenador {
  id: string;
  mensagem: string;
  tipo: 'error' | 'warning' | 'info';
  link?: string;
}

export function useEquipeHoje() {
  return useQuery({
    queryKey: ['equipe-hoje'],
    queryFn: async () => {
      const hoje = format(new Date(), 'yyyy-MM-dd');

      // Buscar rotas de hoje com instaladores
      const { data: rotasHoje, error: rotasError } = await supabase
        .from('rotas')
        .select(`
          id,
          status,
          rota_instaladores(
            instalador_id,
            instalador:profiles(id, nome)
          ),
          instalacoes(id, status),
          vistorias:cotacoes!cotacoes_vistoria_rota_id_fkey(id, status_vistoria)
        `)
        .eq('data_rota', hoje);

      if (rotasError) throw rotasError;

      // Mapear profissionais únicos com suas estatísticas
      const profissionaisMap = new Map<string, EquipeMembro>();

      rotasHoje?.forEach(rota => {
        rota.rota_instaladores?.forEach((ri: any) => {
          if (!ri.instalador) return;

          const instaladorId = ri.instalador.id;
          const existing = profissionaisMap.get(instaladorId);

          // Contar tarefas desta rota
          const instTotal = rota.instalacoes?.length || 0;
          const instConcluidas = rota.instalacoes?.filter((i: any) => i.status === 'concluida').length || 0;
          const vistTotal = rota.vistorias?.length || 0;
          const vistConcluidas = rota.vistorias?.filter((v: any) => v.status_vistoria === 'aprovada' || v.status_vistoria === 'reprovada').length || 0;

          const tarefasTotal = instTotal + vistTotal;
          const tarefasConcluidas = instConcluidas + vistConcluidas;

          // Determinar status
          let status: 'online' | 'em_rota' | 'offline' = 'offline';
          if (rota.status === 'em_andamento') {
            status = 'em_rota';
          } else if (rota.status === 'pendente') {
            status = 'online';
          }

          if (existing) {
            existing.tarefasTotal += tarefasTotal;
            existing.tarefasConcluidas += tarefasConcluidas;
            if (status === 'em_rota') existing.status = 'em_rota';
          } else {
            profissionaisMap.set(instaladorId, {
              id: instaladorId,
              nome: ri.instalador.nome,
              status,
              tarefasConcluidas,
              tarefasTotal,
              regiao: null, // Poderia buscar do primeiro serviço
            });
          }
        });
      });

      return Array.from(profissionaisMap.values());
    },
    refetchInterval: 30000, // Atualizar a cada 30 segundos
  });
}

export function useAlertasCoordenador() {
  return useQuery({
    queryKey: ['alertas-coordenador'],
    queryFn: async () => {
      const alertas: AlertaCoordenador[] = [];
      const hoje = new Date();
      const hojeStr = format(hoje, 'yyyy-MM-dd');
      const ontem = format(new Date(hoje.getTime() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

      // 1. Instalações atrasadas
      const { count: instalacoesAtrasadas } = await supabase
        .from('instalacoes')
        .select('*', { count: 'exact', head: true })
        .in('status', ['agendada', 'em_rota'])
        .lt('data_agendada', ontem);

      if ((instalacoesAtrasadas || 0) > 0) {
        alertas.push({
          id: 'instalacoes-atrasadas',
          mensagem: `${instalacoesAtrasadas} instalação(ões) atrasada(s)`,
          tipo: 'error',
          link: '/monitoramento/instalacoes',
        });
      }

      // 2. Rotas de hoje sem instalador
      const { data: rotasSemInstalador } = await supabase
        .from('rotas')
        .select(`id, rota_instaladores(id)`)
        .eq('data_rota', hojeStr)
        .eq('status', 'pendente');

      const rotasSemEquipe = rotasSemInstalador?.filter((r: any) => !r.rota_instaladores?.length) || [];
      if (rotasSemEquipe.length > 0) {
        alertas.push({
          id: 'rotas-sem-equipe',
          mensagem: `${rotasSemEquipe.length} rota(s) de hoje sem equipe atribuída`,
          tipo: 'error',
          link: '/monitoramento/rotas',
        });
      }

      // 3. Vistorias pendentes
      const { count: vistoriasPendentes } = await supabase
        .from('vistorias')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pendente');

      if ((vistoriasPendentes || 0) > 3) {
        alertas.push({
          id: 'vistorias-pendentes',
          mensagem: `${vistoriasPendentes} vistoria(s) aguardando agendamento`,
          tipo: 'warning',
          link: '/monitoramento/vistorias',
        });
      }

      return alertas;
    },
    refetchInterval: 60000,
  });
}

export function useRotasHojeMetricas() {
  return useQuery({
    queryKey: ['rotas-hoje-metricas'],
    queryFn: async () => {
      const hoje = format(new Date(), 'yyyy-MM-dd');

      // Total de rotas hoje
      const { count: totalRotas } = await supabase
        .from('rotas')
        .select('*', { count: 'exact', head: true })
        .eq('data_rota', hoje);

      // Rotas em andamento
      const { count: emAndamento } = await supabase
        .from('rotas')
        .select('*', { count: 'exact', head: true })
        .eq('data_rota', hoje)
        .eq('status', 'em_andamento');

      // Rotas concluídas hoje
      const { count: concluidas } = await supabase
        .from('rotas')
        .select('*', { count: 'exact', head: true })
        .eq('data_rota', hoje)
        .eq('status', 'concluida');

      // Instalações hoje
      const { count: instalacoesHoje } = await supabase
        .from('instalacoes')
        .select('*', { count: 'exact', head: true })
        .eq('data_agendada', hoje);

      const { count: instalacoesConcluidas } = await supabase
        .from('instalacoes')
        .select('*', { count: 'exact', head: true })
        .eq('data_agendada', hoje)
        .eq('status', 'concluida');

      // Taxa de conclusão
      const totalTarefas = (totalRotas || 0);
      const taxaConclusao = totalTarefas > 0 
        ? Math.round(((concluidas || 0) / totalTarefas) * 100) 
        : 0;

      return {
        totalRotas: totalRotas || 0,
        emAndamento: emAndamento || 0,
        concluidas: concluidas || 0,
        instalacoesHoje: instalacoesHoje || 0,
        instalacoesConcluidas: instalacoesConcluidas || 0,
        taxaConclusao,
      };
    },
    refetchInterval: 30000,
  });
}

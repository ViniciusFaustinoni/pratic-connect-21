import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { ServicoRota, BairroServico, FiltroTipoServico, TipoVistoria } from '@/types/servicos-rota';

/**
 * Hook para buscar bairros com serviços pendentes (instalações + vistorias)
 * Agrupa por bairro/cidade e conta quantos serviços existem de cada tipo
 */
export function useBairrosServicos(data?: Date) {
  return useQuery({
    queryKey: ['bairros-servicos', data ? format(data, 'yyyy-MM-dd') : 'todas'],
    queryFn: async () => {
      const dataFormatada = data ? format(data, 'yyyy-MM-dd') : null;
      
      // Buscar da view unificada
      let query = supabase
        .from('servicos_pendentes_rota')
        .select('*')
        .is('rota_id', null);
      
      if (dataFormatada) {
        query = query.eq('data_agendada', dataFormatada);
      }
      
      const { data: servicos, error } = await query;
      if (error) throw error;

      // Agrupar por bairro e cidade
      const agrupado = new Map<string, BairroServico>();

      (servicos as ServicoRota[])?.forEach((srv) => {
        const bairro = srv.endereco_bairro || 'Sem bairro';
        const cidade = srv.endereco_cidade || 'Sem cidade';
        const key = `${cidade}-${bairro}`;
        const isInstalacao = srv.tipo_servico === 'instalacao';

        if (agrupado.has(key)) {
          const existing = agrupado.get(key)!;
          existing.total += 1;
          if (isInstalacao) {
            existing.totalInstalacoes += 1;
          } else {
            existing.totalVistorias += 1;
          }
        } else {
          agrupado.set(key, {
            bairro,
            cidade,
            totalInstalacoes: isInstalacao ? 1 : 0,
            totalVistorias: isInstalacao ? 0 : 1,
            total: 1,
          });
        }
      });

      // Ordenar por total (decrescente) e depois por nome do bairro
      const resultado = Array.from(agrupado.values()).sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return a.bairro.localeCompare(b.bairro);
      });

      return resultado;
    },
  });
}

/**
 * Hook para buscar serviços de bairros específicos (sem rota)
 * Inclui instalações + vistorias + vistorias de cotações
 */
export function useServicosPorBairros(
  bairros: string[], 
  data?: Date,
  filtroTipos?: FiltroTipoServico
) {
  return useQuery({
    queryKey: ['servicos-por-bairros', bairros, data ? format(data, 'yyyy-MM-dd') : 'todas', filtroTipos],
    queryFn: async () => {
      if (!bairros.length) return [];

      const dataFormatada = data ? format(data, 'yyyy-MM-dd') : null;

      let query = supabase
        .from('servicos_pendentes_rota')
        .select('*')
        .is('rota_id', null)
        .in('endereco_bairro', bairros);

      if (dataFormatada) {
        query = query.eq('data_agendada', dataFormatada);
      }

      const { data: servicos, error } = await query;
      if (error) throw error;

      let resultado = (servicos || []) as ServicoRota[];

      // Aplicar filtros de tipo
      if (filtroTipos) {
        resultado = resultado.filter((srv) => {
          if (srv.tipo_servico === 'instalacao') {
            return filtroTipos.instalacao;
          }
          // Para vistorias, filtrar pelo tipo_vistoria
          const tipoVistoria = srv.tipo_vistoria as TipoVistoria;
          if (tipoVistoria && tipoVistoria in filtroTipos) {
            return filtroTipos[tipoVistoria as keyof FiltroTipoServico];
          }
          return true;
        });
      }

      // Ordenar por bairro, tipo de serviço e data
      resultado.sort((a, b) => {
        const bairroCompare = (a.endereco_bairro || '').localeCompare(b.endereco_bairro || '');
        if (bairroCompare !== 0) return bairroCompare;
        
        // Instalações primeiro, depois vistorias
        if (a.tipo_servico !== b.tipo_servico) {
          return a.tipo_servico === 'instalacao' ? -1 : 1;
        }
        
        return 0;
      });

      return resultado;
    },
    enabled: bairros.length > 0,
  });
}

/**
 * Hook para vincular serviços a uma rota
 * Suporta todos os tipos de vistoria incluindo autovistoria
 */
export function useVincularServicosRota() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      rotaId, 
      servicos 
    }: { 
      rotaId: string; 
      servicos: { id: string; tipo_servico: string; instalador_id?: string }[] 
    }) => {
      // Separar por tipo
      const instalacoes = servicos.filter(s => s.tipo_servico === 'instalacao');
      const vistorias = servicos.filter(s => s.tipo_servico === 'vistoria');
      // Inclui todos os tipos de vistoria de cotação (vistoria_cotacao, vistoria_cotacao_autovistoria, etc.)
      const vistoriasCotacao = servicos.filter(s => s.tipo_servico.startsWith('vistoria_cotacao'));
      // Vistorias de contrato (vistoria_contrato, vistoria_contrato_autovistoria, etc.)
      const vistoriasContrato = servicos.filter(s => s.tipo_servico.startsWith('vistoria_contrato'));

      // Atualizar instalações
      if (instalacoes.length > 0) {
        for (const inst of instalacoes) {
          const { error } = await supabase
            .from('instalacoes')
            .update({ 
              rota_id: rotaId,
              instalador_responsavel_id: inst.instalador_id || null
            })
            .eq('id', inst.id);
          if (error) throw error;
        }
      }

      // Atualizar vistorias (tabela vistorias)
      if (vistorias.length > 0) {
        for (const vist of vistorias) {
          const { error } = await supabase
            .from('vistorias')
            .update({ 
              rota_id: rotaId,
              vistoriador_id: vist.instalador_id || null
            })
            .eq('id', vist.id);
          if (error) throw error;
        }
      }

      // Atualizar cotações (vistorias agendadas de cotação)
      if (vistoriasCotacao.length > 0) {
        for (const cot of vistoriasCotacao) {
          const { error } = await supabase
            .from('cotacoes')
            .update({ vistoria_rota_id: rotaId })
            .eq('id', cot.id);
          if (error) throw error;
        }
      }

      // Atualizar contratos (vistorias agendadas de contrato)
      if (vistoriasContrato.length > 0) {
        for (const cont of vistoriasContrato) {
          const { error } = await supabase
            .from('contratos')
            .update({ vistoria_rota_id: rotaId })
            .eq('id', cont.id);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicos-por-bairros'] });
      queryClient.invalidateQueries({ queryKey: ['bairros-servicos'] });
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias-mapa'] });
      queryClient.invalidateQueries({ queryKey: ['rotas-bairros'] });
    },
    onError: (error) => {
      console.error('Erro ao vincular serviços:', error);
      toast.error('Erro ao vincular serviços à rota');
    },
  });
}

/**
 * Hook para desvincular serviço de uma rota
 */
export function useDesvincularServicoRota() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      tipo_servico 
    }: { 
      id: string; 
      tipo_servico: string;
    }) => {
      if (tipo_servico === 'instalacao') {
        const { error } = await supabase
          .from('instalacoes')
          .update({ rota_id: null, instalador_responsavel_id: null })
          .eq('id', id);
        if (error) throw error;
      } else if (tipo_servico === 'vistoria') {
        const { error } = await supabase
          .from('vistorias')
          .update({ rota_id: null, vistoriador_id: null })
          .eq('id', id);
        if (error) throw error;
      } else if (tipo_servico.startsWith('vistoria_cotacao')) {
        // Suporta vistoria_cotacao e vistoria_cotacao_autovistoria
        const { error } = await supabase
          .from('cotacoes')
          .update({ vistoria_rota_id: null })
          .eq('id', id);
        if (error) throw error;
      } else if (tipo_servico.startsWith('vistoria_contrato')) {
        // Suporta vistoria_contrato e vistoria_contrato_autovistoria
        const { error } = await supabase
          .from('contratos')
          .update({ vistoria_rota_id: null })
          .eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicos-por-bairros'] });
      queryClient.invalidateQueries({ queryKey: ['bairros-servicos'] });
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias-mapa'] });
      queryClient.invalidateQueries({ queryKey: ['rotas-bairros'] });
      toast.success('Serviço removido da rota');
    },
    onError: (error) => {
      console.error('Erro ao desvincular serviço:', error);
      toast.error('Erro ao remover serviço da rota');
    },
  });
}

/**
 * Função utilitária para distribuir serviços entre instaladores/vistoriadores
 */
export function distribuirServicos(
  servicos: ServicoRota[],
  instaladores: { id: string; nome: string }[]
): { instaladorId: string; instaladorNome: string; servicos: ServicoRota[] }[] {
  if (!instaladores.length || !servicos.length) return [];

  // Agrupar serviços por bairro para manter proximidade
  const servicosPorBairro = new Map<string, ServicoRota[]>();
  servicos.forEach((srv) => {
    const bairro = srv.endereco_bairro || 'Sem bairro';
    if (!servicosPorBairro.has(bairro)) {
      servicosPorBairro.set(bairro, []);
    }
    servicosPorBairro.get(bairro)!.push(srv);
  });

  // Criar distribuição inicial vazia
  const distribuicao = instaladores.map((inst) => ({
    instaladorId: inst.id,
    instaladorNome: inst.nome,
    servicos: [] as ServicoRota[],
  }));

  // Distribuir bairros inteiros primeiro (round-robin)
  let currentIndex = 0;
  const bairrosOrdenados = Array.from(servicosPorBairro.entries())
    .sort((a, b) => b[1].length - a[1].length);

  for (const [, bairroServicos] of bairrosOrdenados) {
    // Encontrar o instalador com menos serviços
    const menorCarga = Math.min(...distribuicao.map(d => d.servicos.length));
    const candidatos = distribuicao.filter(d => d.servicos.length === menorCarga);
    const destino = candidatos[currentIndex % candidatos.length];
    
    destino.servicos.push(...bairroServicos);
    currentIndex++;
  }

  return distribuicao;
}

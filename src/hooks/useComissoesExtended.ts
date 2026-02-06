import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { TipoComissao, Deducao } from '@/types/comissoes';

// Tipos para resultados das queries
export interface VendedorResumo {
  vendedor_id: string;
  vendedor_nome: string;
  vendedor_avatar: string | null;
  tipo_consultor: string;
  total_adesao: number;
  total_recorrente: number;
  total_producao: number;
  total_classificacao: number;
  total_crescimento: number;
  total_recorde: number;
  total_geral: number;
  vendas_confirmadas: number;
}

export interface DeducaoMensal extends Omit<Deducao, 'id'> {
  id: string;
  vendedor_nome?: string;
  vendedor_avatar?: string | null;
}

export interface AuditoriaRegistro {
  id: string;
  tabela: string;
  registro_id: string | null;
  acao: string;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
  usuario_id: string | null;
  usuario_nome?: string;
  created_at: string;
}

export interface FechamentoResultado {
  campanha_id: string;
  mes: number;
  ano: number;
  vendedores_processados: number;
  resultados: Array<{
    vendedor_id: string;
    nome: string;
    adesao: Record<string, unknown>;
    recorrente: Record<string, unknown>;
    producao: Record<string, unknown>;
    crescimento: Record<string, unknown>;
    recorde: Record<string, unknown>;
  }>;
}

interface UseComissoesExtendedFilters {
  mes?: number;
  ano?: number;
}

export function useComissoesExtended(filters: UseComissoesExtendedFilters = {}) {
  const queryClient = useQueryClient();
  const { mes, ano } = filters;

  // Query: Resumo por vendedor (agrupado por tipo de comissão)
  const { data: resumoVendedores, isLoading: isLoadingResumo } = useQuery({
    queryKey: ['comissoes-resumo-vendedores', mes, ano],
    queryFn: async () => {
      if (!mes || !ano) return [];

      // Buscar todas as comissões do mês com dados do vendedor
      const { data: comissoes, error } = await supabase
        .from('comissoes')
        .select(`
          id,
          vendedor_id,
          tipo_comissao,
          valor_total,
          vendedor:profiles!comissoes_vendedor_id_fkey(id, nome, avatar_url)
        `)
        .eq('mes_referencia', mes)
        .eq('ano_referencia', ano)
        .neq('status', 'cancelada');

      if (error) throw error;

      // Agrupar por vendedor
      const resumoPorVendedor = new Map<string, VendedorResumo>();

      comissoes?.forEach((c: any) => {
        const vendedorId = c.vendedor_id;
        if (!vendedorId) return;

        if (!resumoPorVendedor.has(vendedorId)) {
          resumoPorVendedor.set(vendedorId, {
            vendedor_id: vendedorId,
            vendedor_nome: c.vendedor?.nome || 'Desconhecido',
            vendedor_avatar: c.vendedor?.avatar_url || null,
            tipo_consultor: 'interno', // Será determinado por outra query
            total_adesao: 0,
            total_recorrente: 0,
            total_producao: 0,
            total_classificacao: 0,
            total_crescimento: 0,
            total_recorde: 0,
            total_geral: 0,
            vendas_confirmadas: 0,
          });
        }

        const resumo = resumoPorVendedor.get(vendedorId)!;
        const valor = c.valor_total || 0;
        
        switch (c.tipo_comissao as TipoComissao) {
          case 'adesao':
            resumo.total_adesao += valor;
            resumo.vendas_confirmadas++;
            break;
          case 'recorrente':
            resumo.total_recorrente += valor;
            break;
          case 'producao':
            resumo.total_producao += valor;
            break;
          case 'classificacao':
            resumo.total_classificacao += valor;
            break;
          case 'crescimento':
            resumo.total_crescimento += valor;
            break;
          case 'recorde':
            resumo.total_recorde += valor;
            break;
        }
        resumo.total_geral += valor;
      });

      return Array.from(resumoPorVendedor.values())
        .sort((a, b) => b.total_geral - a.total_geral);
    },
    enabled: !!mes && !!ano,
  });

  // Query: Deduções do mês
  const { data: deducoesMensal, isLoading: isLoadingDeducoes } = useQuery({
    queryKey: ['comissoes-deducoes-mensal', mes, ano],
    queryFn: async () => {
      if (!mes || !ano) return [];

      // Filtrar por aplicada_em no mês/ano
      const startDate = new Date(ano, mes - 1, 1).toISOString();
      const endDate = new Date(ano, mes, 0, 23, 59, 59).toISOString();

      const { data, error } = await supabase
        .from('comissoes_deducoes')
        .select(`
          *,
          vendedor:profiles!comissoes_deducoes_vendedor_id_fkey(nome, avatar_url)
        `)
        .gte('aplicada_em', startDate)
        .lte('aplicada_em', endDate)
        .order('aplicada_em', { ascending: false });

      if (error) throw error;

      return (data || []).map((d: any) => ({
        ...d,
        vendedor_nome: d.vendedor?.nome,
        vendedor_avatar: d.vendedor?.avatar_url,
      })) as DeducaoMensal[];
    },
    enabled: !!mes && !!ano,
  });

  // Query: Auditoria recente
  const { data: auditoriaRecente, isLoading: isLoadingAuditoria } = useQuery({
    queryKey: ['comissoes-auditoria'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comissoes_auditoria')
        .select(`
          *,
          usuario:profiles!comissoes_auditoria_usuario_id_fkey(nome)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return (data || []).map((a: any) => ({
        ...a,
        usuario_nome: a.usuario?.nome,
      })) as AuditoriaRegistro[];
    },
  });

  // Mutation: Contestar comissão
  const contestarComissao = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { error } = await supabase
        .from('comissoes')
        .update({
          contestada: true,
          contestada_em: new Date().toISOString(),
          contestacao_motivo: motivo,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comissoes'] });
      toast.success('Comissão marcada como contestada');
    },
    onError: (error: Error) => {
      toast.error('Erro ao contestar: ' + error.message);
    },
  });

  // Mutation: Executar fechamento mensal
  const executarFechamento = useMutation({
    mutationFn: async ({ mes, ano }: { mes: number; ano: number }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      // Buscar profile_id do usuário
      let usuarioId: string | null = null;
      if (userData.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', userData.user.id)
          .single();
        usuarioId = profile?.id ?? null;
      }

      const { data, error } = await supabase.rpc('fn_fechamento_mensal_comissoes', {
        p_mes: mes,
        p_ano: ano,
        p_usuario_id: usuarioId,
      });

      if (error) throw error;
      return data as unknown as FechamentoResultado;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['comissoes'] });
      queryClient.invalidateQueries({ queryKey: ['comissoes-campanhas'] });
      queryClient.invalidateQueries({ queryKey: ['comissoes-resumo'] });
      queryClient.invalidateQueries({ queryKey: ['comissoes-resumo-vendedores'] });
      queryClient.invalidateQueries({ queryKey: ['comissoes-ranking'] });
      toast.success(`Fechamento concluído: ${data?.vendedores_processados || 0} vendedores processados`);
    },
    onError: (error: Error) => {
      toast.error('Erro no fechamento: ' + error.message);
    },
  });

  // Totais derivados
  const totaisDeducoes = deducoesMensal?.reduce((sum, d) => sum + d.valor, 0) || 0;
  const totalComissoes = resumoVendedores?.reduce((sum, v) => sum + v.total_geral, 0) || 0;
  const vendedoresAtivos = resumoVendedores?.length || 0;
  const totalVendas = resumoVendedores?.reduce((sum, v) => sum + v.vendas_confirmadas, 0) || 0;

  return {
    resumoVendedores,
    deducoesMensal,
    auditoriaRecente,
    isLoading: isLoadingResumo || isLoadingDeducoes || isLoadingAuditoria,
    isLoadingResumo,
    isLoadingDeducoes,
    isLoadingAuditoria,
    contestarComissao,
    executarFechamento,
    // Totais derivados
    totaisDeducoes,
    totalComissoes,
    vendedoresAtivos,
    totalVendas,
  };
}

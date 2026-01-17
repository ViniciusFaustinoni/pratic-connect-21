import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ============================================
// TIPOS
// ============================================

export interface FaixaCota {
  id: string;
  fipe_de: number;
  fipe_ate: number;
  quantidade_cotas: number;
  ajuste_percentual: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface FaixaCotaHistorico {
  id: string;
  faixa_id: string;
  ajuste_anterior: number | null;
  ajuste_novo: number | null;
  alterado_por: string | null;
  alterado_em: string;
  motivo: string | null;
}

export interface FaixaTaxaAdministrativa {
  id: string;
  fipe_de: number;
  fipe_ate: number;
  valor_taxa: number;
  ajuste_percentual: number;
  ativo: boolean;
}

export interface RateioPorCota {
  faixa_id: string;
  fipe_de: number;
  fipe_ate: number;
  quantidade_cotas: number;
  contratos_na_faixa: number;
  total_cotas_faixa: number;
  ajuste_percentual: number;
  valor_base_cota: number;
  valor_final_cota: number;
}

export interface LimitesFipe {
  minimo: number;
  maximo: number;
}

// ============================================
// HOOKS - FAIXAS DE COTAS
// ============================================

/**
 * Hook para buscar todas as faixas de cotas
 */
export function useFaixasCotas() {
  return useQuery({
    queryKey: ['faixas-cotas'],
    queryFn: async (): Promise<FaixaCota[]> => {
      const { data, error } = await supabase
        .from('faixas_cotas')
        .select('*')
        .eq('ativo', true)
        .order('fipe_de', { ascending: true });
      
      if (error) {
        console.error('[useFaixasCotas] Erro:', error);
        throw error;
      }
      
      return data || [];
    },
    staleTime: 1000 * 60 * 10, // 10 minutos
  });
}

/**
 * Hook para buscar a quantidade de cotas de um valor FIPE específico
 */
export function useCotasPorFipe(valorFipe: number | undefined) {
  const { data: faixas } = useFaixasCotas();
  
  if (!valorFipe || !faixas) return null;
  
  const faixa = faixas.find(f => valorFipe >= f.fipe_de && valorFipe <= f.fipe_ate);
  
  if (faixa) {
    return {
      cotas: faixa.quantidade_cotas,
      ajustePercentual: faixa.ajuste_percentual,
      faixaId: faixa.id,
    };
  }
  
  // Fallback: calcular manualmente
  return {
    cotas: Math.ceil(valorFipe / 5000),
    ajustePercentual: 0,
    faixaId: null,
  };
}

/**
 * Hook para buscar o histórico de alterações de faixas
 */
export function useFaixasCotasHistorico(faixaId?: string) {
  return useQuery({
    queryKey: ['faixas-cotas-historico', faixaId],
    queryFn: async () => {
      let query = supabase
        .from('faixas_cotas_historico')
        .select('*')
        .order('alterado_em', { ascending: false })
        .limit(100);
      
      if (faixaId) {
        query = query.eq('faixa_id', faixaId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as FaixaCotaHistorico[];
    },
    enabled: true,
  });
}

/**
 * Hook para atualizar ajuste percentual de uma faixa
 */
export function useAtualizarAjusteFaixa() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      faixaId, 
      ajustePercentual,
      motivo 
    }: { 
      faixaId: string; 
      ajustePercentual: number;
      motivo?: string;
    }) => {
      const { error } = await supabase
        .from('faixas_cotas')
        .update({ ajuste_percentual: ajustePercentual })
        .eq('id', faixaId);
      
      if (error) throw error;
      
      // Adicionar motivo ao histórico se fornecido
      if (motivo) {
        await supabase
          .from('faixas_cotas_historico')
          .update({ motivo })
          .eq('faixa_id', faixaId)
          .order('alterado_em', { ascending: false })
          .limit(1);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faixas-cotas'] });
      queryClient.invalidateQueries({ queryKey: ['faixas-cotas-historico'] });
      toast.success('Ajuste atualizado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar ajuste: ' + error.message);
    },
  });
}

/**
 * Hook para atualizar ajuste percentual em grupo (várias faixas)
 */
export function useAtualizarAjusteGrupo() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      fipeInicio, 
      fipeFim, 
      ajustePercentual 
    }: { 
      fipeInicio: number; 
      fipeFim: number;
      ajustePercentual: number;
    }) => {
      const { error } = await supabase
        .from('faixas_cotas')
        .update({ ajuste_percentual: ajustePercentual })
        .gte('fipe_de', fipeInicio)
        .lte('fipe_ate', fipeFim);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faixas-cotas'] });
      queryClient.invalidateQueries({ queryKey: ['faixas-cotas-historico'] });
      toast.success('Ajustes em grupo atualizados!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar ajustes: ' + error.message);
    },
  });
}

// ============================================
// HOOKS - LIMITES FIPE
// ============================================

/**
 * Hook para buscar os limites FIPE (mínimo e máximo)
 */
export function useLimitesFipe() {
  return useQuery({
    queryKey: ['limites-fipe'],
    queryFn: async (): Promise<LimitesFipe> => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', ['atuarial_fipe_minimo', 'atuarial_fipe_maximo']);
      
      if (error) {
        console.error('[useLimitesFipe] Erro:', error);
        return { minimo: 20000, maximo: 180000 };
      }
      
      const limites = {
        minimo: 20000,
        maximo: 180000,
      };
      
      data?.forEach(config => {
        if (config.chave === 'atuarial_fipe_minimo') {
          limites.minimo = Number(config.valor) || 20000;
        }
        if (config.chave === 'atuarial_fipe_maximo') {
          limites.maximo = Number(config.valor) || 180000;
        }
      });
      
      return limites;
    },
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Valida se um valor FIPE está dentro dos limites aceitos
 */
export function validarValorFipe(
  valorFipe: number | undefined, 
  limites: LimitesFipe | undefined
): { valido: boolean; mensagem?: string } {
  if (!valorFipe) {
    return { valido: false, mensagem: 'Valor FIPE não informado' };
  }
  
  if (!limites) {
    return { valido: true }; // Se não tem limites, aceita
  }
  
  if (valorFipe < limites.minimo) {
    return { 
      valido: false, 
      mensagem: `Valor FIPE abaixo do mínimo aceito (R$ ${limites.minimo.toLocaleString('pt-BR')})` 
    };
  }
  
  if (valorFipe > limites.maximo) {
    return { 
      valido: false, 
      mensagem: `Valor FIPE acima do máximo aceito (R$ ${limites.maximo.toLocaleString('pt-BR')})` 
    };
  }
  
  return { valido: true };
}

// ============================================
// HOOKS - TAXA ADMINISTRATIVA
// ============================================

/**
 * Hook para buscar faixas de taxa administrativa
 */
export function useFaixasTaxaAdministrativa() {
  return useQuery({
    queryKey: ['faixas-taxa-administrativa'],
    queryFn: async (): Promise<FaixaTaxaAdministrativa[]> => {
      const { data, error } = await supabase
        .from('faixas_taxa_administrativa')
        .select('*')
        .eq('ativo', true)
        .order('fipe_de', { ascending: true });
      
      if (error) {
        console.error('[useFaixasTaxaAdministrativa] Erro:', error);
        throw error;
      }
      
      return data || [];
    },
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Hook para buscar taxa administrativa de um valor FIPE
 */
export function useTaxaAdministrativaPorFipe(valorFipe: number | undefined) {
  const { data: faixas } = useFaixasTaxaAdministrativa();
  
  if (!valorFipe || !faixas) return null;
  
  const faixa = faixas.find(f => valorFipe >= f.fipe_de && valorFipe <= f.fipe_ate);
  
  return faixa?.valor_taxa || 0;
}

// ============================================
// HOOKS - CÁLCULO DE RATEIO POR COTAS
// ============================================

/**
 * Hook para simular cálculo de rateio por cotas
 */
export function useSimularRateioPorCotas(custoTotal: number, percentualFundo: number = 10) {
  return useQuery({
    queryKey: ['simular-rateio-cotas', custoTotal, percentualFundo],
    queryFn: async (): Promise<RateioPorCota[]> => {
      const { data, error } = await supabase
        .rpc('fn_calcular_rateio_por_cotas', {
          p_custo_total: custoTotal,
          p_percentual_fundo: percentualFundo,
        });
      
      if (error) {
        console.error('[useSimularRateioPorCotas] Erro:', error);
        throw error;
      }
      
      return data || [];
    },
    enabled: custoTotal > 0,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Hook para buscar total de cotas ativas
 */
export function useTotalCotasAtivas() {
  return useQuery({
    queryKey: ['total-cotas-ativas'],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .rpc('fn_calcular_total_cotas_ativos');
      
      if (error) {
        console.error('[useTotalCotasAtivas] Erro:', error);
        return 0;
      }
      
      return data || 0;
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ============================================
// HOOKS - SIMULAÇÃO EM TEMPO REAL
// ============================================

export interface SimulacaoFaixaResult {
  faixaId: string;
  fipeDe: number;
  fipeAte: number;
  quantidadeCotas: number;
  ajustePercentual: number;
  valorBaseCota: number;
  valorFinalCota: number;
  diferencaCota: number;
  totalCotasNaFaixa: number;
  impactoTotal: number;
}

export interface SimulacaoResult {
  custoSimulado: number;
  totalCotas: number;
  valorBasePorCota: number;
  custoDescontos: number;
  novoValorBase: number;
  percentualAumento: number;
  faixas: SimulacaoFaixaResult[];
}

/**
 * Hook para simulação em tempo real do impacto dos ajustes
 * Calcula localmente sem chamar RPC a cada mudança
 */
export function useSimulacaoFaixas(
  faixas: FaixaCota[] | undefined,
  custoSimulado: number,
  totalCotasAtivas: number,
  ajustesTemporarios?: Record<string, number> // faixaId -> novo ajuste
): SimulacaoResult | null {
  if (!faixas || faixas.length === 0 || custoSimulado <= 0 || totalCotasAtivas <= 0) {
    return null;
  }

  // Valor base por cota SEM ajustes
  const valorBasePorCota = custoSimulado / totalCotasAtivas;

  // Calcular custo dos descontos (faixas com ajuste negativo)
  let custoDescontos = 0;
  const faixasComDados: SimulacaoFaixaResult[] = [];

  // Primeiro passo: calcular impacto de cada faixa
  faixas.forEach(faixa => {
    const ajuste = ajustesTemporarios?.[faixa.id] ?? faixa.ajuste_percentual;
    
    // Estimativa: assume distribuição proporcional de cotas por faixa
    // Em produção, seria ideal ter o número real de contratos por faixa
    const estimativaCotasNaFaixa = faixa.quantidade_cotas * 10; // Placeholder
    
    const valorFinalCota = valorBasePorCota * (1 + ajuste / 100);
    const diferencaCota = valorFinalCota - valorBasePorCota;
    const impactoTotal = diferencaCota * estimativaCotasNaFaixa;
    
    if (ajuste < 0) {
      custoDescontos += Math.abs(impactoTotal);
    }

    faixasComDados.push({
      faixaId: faixa.id,
      fipeDe: faixa.fipe_de,
      fipeAte: faixa.fipe_ate,
      quantidadeCotas: faixa.quantidade_cotas,
      ajustePercentual: ajuste,
      valorBaseCota: valorBasePorCota,
      valorFinalCota,
      diferencaCota,
      totalCotasNaFaixa: estimativaCotasNaFaixa,
      impactoTotal,
    });
  });

  // O custo dos descontos é redistribuído entre todas as cotas
  const novoValorBase = valorBasePorCota + (custoDescontos / totalCotasAtivas);
  const percentualAumento = ((novoValorBase - valorBasePorCota) / valorBasePorCota) * 100;

  // Recalcular valores finais com novo valor base
  const faixasFinais = faixasComDados.map(f => ({
    ...f,
    valorBaseCota: novoValorBase,
    valorFinalCota: novoValorBase * (1 + f.ajustePercentual / 100),
    diferencaCota: (novoValorBase * (1 + f.ajustePercentual / 100)) - novoValorBase,
  }));

  return {
    custoSimulado,
    totalCotas: totalCotasAtivas,
    valorBasePorCota,
    custoDescontos,
    novoValorBase,
    percentualAumento,
    faixas: faixasFinais,
  };
}

// ============================================
// UTILITÁRIOS
// ============================================

/**
 * Formata valor FIPE para exibição
 */
export function formatFipe(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(valor);
}

/**
 * Formata percentual para exibição
 */
export function formatPercentual(valor: number): string {
  const sinal = valor >= 0 ? '+' : '';
  return `${sinal}${valor.toFixed(1)}%`;
}

/**
 * Calcula quantidade de cotas com base no valor FIPE (fallback manual)
 */
export function calcularCotasManual(valorFipe: number): number {
  if (!valorFipe || valorFipe <= 0) return 0;
  return Math.ceil(valorFipe / 5000);
}

/**
 * Formata valor em moeda
 */
export function formatCurrency(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
}

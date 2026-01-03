import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Types
export interface PlanoContas {
  id: string;
  codigo: string;
  descricao: string;
  conta_pai_id: string | null;
  nivel: number;
  tipo: 'ativo' | 'passivo' | 'patrimonio_liquido' | 'receita' | 'despesa';
  natureza: 'devedora' | 'credora';
  sintetica: boolean;
  aceita_lancamento: boolean;
  ativa: boolean;
  ordem: number;
  conta_padrao_para: string | null;
  created_at: string;
  updated_at: string;
  children?: PlanoContas[];
}

export interface LancamentoPartida {
  id: string;
  lancamento_id: string;
  conta_id: string;
  tipo: 'debito' | 'credito';
  valor: number;
  ordem: number;
  created_at: string;
  conta?: PlanoContas;
}

export interface LancamentoContabil {
  id: string;
  numero: string;
  data_lancamento: string;
  data_competencia: string;
  lote_id: string | null;
  origem: 'manual' | 'cobranca' | 'pagamento' | 'acordo' | 'sinistro' | 'oficina' | 'folha' | 'fechamento';
  origem_id: string | null;
  historico: string;
  complemento: string | null;
  documento_tipo: string | null;
  documento_numero: string | null;
  status: 'rascunho' | 'ativo' | 'estornado' | 'fechado';
  criado_por: string | null;
  estornado_por: string | null;
  estornado_em: string | null;
  motivo_estorno: string | null;
  lancamento_estorno_id: string | null;
  created_at: string;
  updated_at: string;
  partidas?: LancamentoPartida[];
  criador?: { nome: string };
}

export interface FechamentoContabil {
  id: string;
  mes: number;
  ano: number;
  status: 'aberto' | 'em_fechamento' | 'fechado' | 'reaberto';
  total_debitos: number;
  total_creditos: number;
  qtd_lancamentos: number;
  resultado_periodo: number | null;
  data_fechamento: string | null;
  data_reabertura: string | null;
  fechado_por: string | null;
  reaberto_por: string | null;
  motivo_reabertura: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaldoConta {
  id: string;
  conta_id: string;
  mes: number;
  ano: number;
  saldo_anterior: number;
  total_debitos: number;
  total_creditos: number;
  saldo_atual: number;
  conta?: PlanoContas;
}

interface FiltrosLancamentos {
  dataInicio?: string;
  dataFim?: string;
  contaId?: string;
  origem?: string;
  status?: string;
}

// Hook para Plano de Contas
export function usePlanoContas() {
  return useQuery({
    queryKey: ['plano-contas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plano_contas')
        .select('*')
        .order('codigo');
      
      if (error) throw error;
      return data as PlanoContas[];
    },
  });
}

export function usePlanoContasTree() {
  const { data: contas, ...rest } = usePlanoContas();

  const tree = contas ? buildTree(contas) : [];

  return { data: tree, contas, ...rest };
}

function buildTree(contas: PlanoContas[]): PlanoContas[] {
  const map = new Map<string, PlanoContas>();
  const roots: PlanoContas[] = [];

  contas.forEach(conta => {
    map.set(conta.id, { ...conta, children: [] });
  });

  contas.forEach(conta => {
    const node = map.get(conta.id)!;
    if (conta.conta_pai_id) {
      const parent = map.get(conta.conta_pai_id);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export function useContasAnaliticas() {
  return useQuery({
    queryKey: ['contas-analiticas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plano_contas')
        .select('*')
        .eq('aceita_lancamento', true)
        .eq('ativa', true)
        .order('codigo');
      
      if (error) throw error;
      return data as PlanoContas[];
    },
  });
}

// Hook para Lançamentos
export function useLancamentos(filtros?: FiltrosLancamentos) {
  return useQuery({
    queryKey: ['lancamentos', filtros],
    queryFn: async () => {
      let query = supabase
        .from('lancamentos_contabeis')
        .select(`*`)
        .order('data_competencia', { ascending: false })
        .order('created_at', { ascending: false });

      if (filtros?.dataInicio) {
        query = query.gte('data_competencia', filtros.dataInicio);
      }
      if (filtros?.dataFim) {
        query = query.lte('data_competencia', filtros.dataFim);
      }
      if (filtros?.origem) {
        query = query.eq('origem', filtros.origem);
      }
      if (filtros?.status) {
        query = query.eq('status', filtros.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as LancamentoContabil[];
    },
  });
}

export function useLancamento(id: string) {
  return useQuery({
    queryKey: ['lancamento', id],
    queryFn: async () => {
      const { data: lancamento, error: lancamentoError } = await supabase
        .from('lancamentos_contabeis')
        .select(`*`)
        .eq('id', id)
        .single();

      if (lancamentoError) throw lancamentoError;

      const { data: partidas, error: partidasError } = await supabase
        .from('lancamentos_partidas')
        .select(`*`)
        .eq('lancamento_id', id)
        .order('ordem');

      if (partidasError) throw partidasError;

      // Fetch conta info separately
      const contaIds = [...new Set(partidas.map(p => p.conta_id))];
      const { data: contas } = await supabase
        .from('plano_contas')
        .select('id, codigo, descricao')
        .in('id', contaIds);

      const contasMap = new Map(contas?.map(c => [c.id, c]) || []);
      const partidasWithConta = partidas.map(p => ({
        ...p,
        conta: contasMap.get(p.conta_id),
      }));

      return { ...lancamento, partidas: partidasWithConta } as unknown as LancamentoContabil;
    },
    enabled: !!id,
  });
}

export function useCriarLancamento() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (dados: {
      data_lancamento: string;
      data_competencia: string;
      historico: string;
      complemento?: string;
      documento_tipo?: string;
      documento_numero?: string;
      origem?: string;
      status?: string;
      partidas: Array<{
        conta_id: string;
        tipo: 'debito' | 'credito';
        valor: number;
      }>;
    }) => {
      const { partidas, ...lancamento } = dados;

      // Validar balanceamento
      const totalDebito = partidas
        .filter(p => p.tipo === 'debito')
        .reduce((sum, p) => sum + p.valor, 0);
      const totalCredito = partidas
        .filter(p => p.tipo === 'credito')
        .reduce((sum, p) => sum + p.valor, 0);

      if (Math.abs(totalDebito - totalCredito) > 0.01) {
        throw new Error(`Lançamento não balanceado: Débito (${totalDebito}) ≠ Crédito (${totalCredito})`);
      }

      // Inserir lançamento
      const { data: novoLancamento, error: lancamentoError } = await supabase
        .from('lancamentos_contabeis')
        .insert({
          ...lancamento,
          origem: lancamento.origem || 'manual',
          status: lancamento.status || 'ativo',
        })
        .select()
        .single();

      if (lancamentoError) throw lancamentoError;

      // Inserir partidas
      const partidasParaInserir = partidas.map((p, index) => ({
        lancamento_id: novoLancamento.id,
        conta_id: p.conta_id,
        tipo: p.tipo,
        valor: p.valor,
        ordem: index + 1,
      }));

      const { error: partidasError } = await supabase
        .from('lancamentos_partidas')
        .insert(partidasParaInserir);

      if (partidasError) throw partidasError;

      return novoLancamento;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
      toast({
        title: 'Lançamento criado',
        description: 'Lançamento contábil registrado com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao criar lançamento',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useEstornarLancamento() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { error } = await supabase
        .from('lancamentos_contabeis')
        .update({
          status: 'estornado',
          motivo_estorno: motivo,
          estornado_em: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
      toast({
        title: 'Lançamento estornado',
        description: 'Lançamento contábil foi estornado.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao estornar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Hook para Fechamentos
export function useFechamentos(ano: number) {
  return useQuery({
    queryKey: ['fechamentos', ano],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fechamentos_contabeis')
        .select('*')
        .eq('ano', ano)
        .order('mes');

      if (error) throw error;
      return data as FechamentoContabil[];
    },
  });
}

export function useCriarFechamento() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ mes, ano }: { mes: number; ano: number }) => {
      // Calcular totais do período
      const { data: partidas, error: partidasError } = await supabase
        .from('lancamentos_partidas')
        .select(`
          tipo,
          valor,
          lancamento:lancamento_id(data_competencia, status)
        `);

      if (partidasError) throw partidasError;

      const partidasPeriodo = (partidas as any[]).filter(p => {
        const data = new Date(p.lancamento.data_competencia);
        return data.getMonth() + 1 === mes && 
               data.getFullYear() === ano && 
               p.lancamento.status === 'ativo';
      });

      const totalDebitos = partidasPeriodo
        .filter(p => p.tipo === 'debito')
        .reduce((sum, p) => sum + Number(p.valor), 0);

      const totalCreditos = partidasPeriodo
        .filter(p => p.tipo === 'credito')
        .reduce((sum, p) => sum + Number(p.valor), 0);

      const { data, error } = await supabase
        .from('fechamentos_contabeis')
        .insert({
          mes,
          ano,
          status: 'fechado',
          total_debitos: totalDebitos,
          total_creditos: totalCreditos,
          qtd_lancamentos: partidasPeriodo.length,
          resultado_periodo: totalCreditos - totalDebitos,
          data_fechamento: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fechamentos'] });
      toast({
        title: 'Período fechado',
        description: 'Fechamento contábil realizado com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao fechar período',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Hook para Saldos e Relatórios
export function useBalancete(mes: number, ano: number) {
  return useQuery({
    queryKey: ['balancete', mes, ano],
    queryFn: async () => {
      // Buscar todas as contas
      const { data: contas, error: contasError } = await supabase
        .from('plano_contas')
        .select('*')
        .eq('ativa', true)
        .order('codigo');

      if (contasError) throw contasError;

      // Buscar partidas do período
      const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
      const dataFim = new Date(ano, mes, 0).toISOString().split('T')[0];

      const { data: partidas, error: partidasError } = await supabase
        .from('lancamentos_partidas')
        .select(`
          conta_id,
          tipo,
          valor,
          lancamento:lancamento_id!inner(data_competencia, status)
        `)
        .gte('lancamento.data_competencia', dataInicio)
        .lte('lancamento.data_competencia', dataFim)
        .eq('lancamento.status', 'ativo');

      if (partidasError) throw partidasError;

      // Calcular saldos por conta
      const saldosPorConta = new Map<string, { debitos: number; creditos: number }>();
      
      (partidas as any[]).forEach(p => {
        const atual = saldosPorConta.get(p.conta_id) || { debitos: 0, creditos: 0 };
        if (p.tipo === 'debito') {
          atual.debitos += Number(p.valor);
        } else {
          atual.creditos += Number(p.valor);
        }
        saldosPorConta.set(p.conta_id, atual);
      });

      return (contas as PlanoContas[]).map(conta => ({
        ...conta,
        debitos: saldosPorConta.get(conta.id)?.debitos || 0,
        creditos: saldosPorConta.get(conta.id)?.creditos || 0,
        saldo: (saldosPorConta.get(conta.id)?.debitos || 0) - 
               (saldosPorConta.get(conta.id)?.creditos || 0),
      }));
    },
    enabled: !!mes && !!ano,
  });
}

export function useRazaoConta(contaId: string, mes: number, ano: number) {
  return useQuery({
    queryKey: ['razao', contaId, mes, ano],
    queryFn: async () => {
      const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
      const dataFim = new Date(ano, mes, 0).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('lancamentos_partidas')
        .select(`
          *,
          lancamento:lancamento_id!inner(
            numero,
            data_competencia,
            historico,
            status
          )
        `)
        .eq('conta_id', contaId)
        .gte('lancamento.data_competencia', dataInicio)
        .lte('lancamento.data_competencia', dataFim)
        .eq('lancamento.status', 'ativo')
        .order('lancamento(data_competencia)');

      if (error) throw error;
      return data;
    },
    enabled: !!contaId && !!mes && !!ano,
  });
}

// Hook para criar/editar conta
export function useCriarConta() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (dados: Partial<PlanoContas>) => {
      const { data, error } = await supabase
        .from('plano_contas')
        .insert(dados as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plano-contas'] });
      toast({
        title: 'Conta criada',
        description: 'Conta contábil criada com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao criar conta',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useAtualizarConta() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...dados }: Partial<PlanoContas> & { id: string }) => {
      const { data, error } = await supabase
        .from('plano_contas')
        .update(dados)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plano-contas'] });
      toast({
        title: 'Conta atualizada',
        description: 'Conta contábil atualizada com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar conta',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

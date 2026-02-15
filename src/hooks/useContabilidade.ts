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
        .select(`
          *,
          partidas:lancamentos_partidas(
            id, tipo, valor, ordem,
            conta:plano_contas(codigo, descricao)
          )
        `)
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

// ========== NOVOS HOOKS - FASE 5-5 ==========

// Saldos acumulados para Dashboard KPIs
export function useSaldosAcumulados(mes: number, ano: number) {
  return useQuery({
    queryKey: ['saldos-acumulados', mes, ano],
    queryFn: async () => {
      const fimPeriodo = new Date(ano, mes, 0).toISOString().split('T')[0];
      const inicioAno = `${ano}-01-01`;

      // Partidas acumuladas (todo o histórico até fim do período) para ativo/passivo/PL
      const { data: partidasAcum } = await supabase
        .from('lancamentos_partidas')
        .select(`
          tipo, valor,
          conta:plano_contas!inner(codigo, tipo, natureza),
          lancamento:lancamento_id!inner(data_competencia, status)
        `)
        .lte('lancamento.data_competencia', fimPeriodo)
        .eq('lancamento.status', 'ativo');

      // Year-to-date para receitas/despesas
      const { data: partidasAno } = await supabase
        .from('lancamentos_partidas')
        .select(`
          tipo, valor,
          conta:plano_contas!inner(codigo, tipo),
          lancamento:lancamento_id!inner(data_competencia, status)
        `)
        .gte('lancamento.data_competencia', inicioAno)
        .lte('lancamento.data_competencia', fimPeriodo)
        .eq('lancamento.status', 'ativo');

      let ativoTotal = 0;
      let passivoTotal = 0;
      let plTotal = 0;

      (partidasAcum as any[] || []).forEach((p: any) => {
        const valor = Number(p.valor);
        const contaTipo = p.conta?.tipo;
        if (contaTipo === 'ativo') {
          ativoTotal += p.tipo === 'debito' ? valor : -valor;
        } else if (contaTipo === 'passivo') {
          passivoTotal += p.tipo === 'credito' ? valor : -valor;
        } else if (contaTipo === 'patrimonio_liquido') {
          plTotal += p.tipo === 'credito' ? valor : -valor;
        }
      });

      let receitaAno = 0;
      let despesaAno = 0;

      (partidasAno as any[] || []).forEach((p: any) => {
        const valor = Number(p.valor);
        if (p.conta?.tipo === 'receita' && p.tipo === 'credito') {
          receitaAno += valor;
        } else if (p.conta?.tipo === 'despesa' && p.tipo === 'debito') {
          despesaAno += valor;
        }
      });

      return {
        ativoTotal,
        passivoTotal,
        patrimonioSocial: plTotal,
        receitaAno,
        despesaAno,
        resultadoExercicio: receitaAno - despesaAno,
      };
    },
    enabled: !!mes && !!ano,
  });
}

// Receita vs Despesa por mês (12 meses)
export function useReceitaDespesaMensal(ano: number) {
  return useQuery({
    queryKey: ['receita-despesa-mensal', ano],
    queryFn: async () => {
      const inicioAno = `${ano}-01-01`;
      const fimAno = `${ano}-12-31`;

      const { data: partidas } = await supabase
        .from('lancamentos_partidas')
        .select(`
          tipo, valor,
          conta:plano_contas!inner(tipo),
          lancamento:lancamento_id!inner(data_competencia, status)
        `)
        .gte('lancamento.data_competencia', inicioAno)
        .lte('lancamento.data_competencia', fimAno)
        .eq('lancamento.status', 'ativo');

      const meses = Array.from({ length: 12 }, (_, i) => ({
        mes: i + 1,
        receitas: 0,
        despesas: 0,
      }));

      (partidas as any[] || []).forEach((p: any) => {
        const mesIdx = new Date(p.lancamento.data_competencia).getMonth();
        const valor = Number(p.valor);
        if (p.conta?.tipo === 'receita' && p.tipo === 'credito') {
          meses[mesIdx].receitas += valor;
        } else if (p.conta?.tipo === 'despesa' && p.tipo === 'debito') {
          meses[mesIdx].despesas += valor;
        }
      });

      return meses;
    },
  });
}

// Composição do Ativo (para PieChart)
export function useComposicaoAtivo(mes: number, ano: number) {
  return useQuery({
    queryKey: ['composicao-ativo', mes, ano],
    queryFn: async () => {
      const fimPeriodo = new Date(ano, mes, 0).toISOString().split('T')[0];

      const { data: partidas } = await supabase
        .from('lancamentos_partidas')
        .select(`
          tipo, valor,
          conta:plano_contas!inner(codigo, descricao, tipo),
          lancamento:lancamento_id!inner(data_competencia, status)
        `)
        .eq('conta.tipo', 'ativo')
        .lte('lancamento.data_competencia', fimPeriodo)
        .eq('lancamento.status', 'ativo');

      const grupos: Record<string, number> = {};
      (partidas as any[] || []).forEach((p: any) => {
        const codigo = p.conta.codigo;
        let grupo = 'Outros';
        if (codigo.startsWith('1.1.01')) grupo = 'Caixa e Bancos';
        else if (codigo.startsWith('1.1.02')) grupo = 'Contas a Receber';
        else if (codigo.startsWith('1.1.03')) grupo = 'Adiantamentos';
        else if (codigo.startsWith('1.1.04')) grupo = 'Estoques';
        else if (codigo.startsWith('1.2')) grupo = 'Imobilizado';

        const valor = Number(p.valor);
        grupos[grupo] = (grupos[grupo] || 0) + (p.tipo === 'debito' ? valor : -valor);
      });

      return Object.entries(grupos)
        .filter(([_, v]) => Math.abs(v) > 0.01)
        .map(([name, value]) => ({ name, value: Math.abs(value) }))
        .sort((a, b) => b.value - a.value);
    },
    enabled: !!mes && !!ano,
  });
}

// DRE Estruturado
export interface DRESecao {
  titulo: string;
  contas: { codigo: string; descricao: string; valorAtual: number; valorAnterior: number }[];
  totalAtual: number;
  totalAnterior: number;
}

export function useDREEstruturado(mes: number, ano: number, compararAnterior: boolean = false) {
  return useQuery({
    queryKey: ['dre-estruturado', mes, ano, compararAnterior],
    queryFn: async () => {
      const fetchPeriodo = async (m: number, a: number) => {
        const dataInicio = `${a}-${String(m).padStart(2, '0')}-01`;
        const dataFim = new Date(a, m, 0).toISOString().split('T')[0];

        const { data: partidas } = await supabase
          .from('lancamentos_partidas')
          .select(`
            tipo, valor,
            conta:plano_contas!inner(codigo, descricao, tipo),
            lancamento:lancamento_id!inner(data_competencia, status)
          `)
          .gte('lancamento.data_competencia', dataInicio)
          .lte('lancamento.data_competencia', dataFim)
          .eq('lancamento.status', 'ativo');

        const porConta = new Map<string, { codigo: string; descricao: string; valor: number; tipo: string }>();
        (partidas as any[] || []).forEach((p: any) => {
          const key = p.conta.codigo;
          const existing = porConta.get(key) || { codigo: p.conta.codigo, descricao: p.conta.descricao, valor: 0, tipo: p.conta.tipo };
          const valor = Number(p.valor);
          if (p.conta.tipo === 'receita') {
            existing.valor += p.tipo === 'credito' ? valor : -valor;
          } else if (p.conta.tipo === 'despesa') {
            existing.valor += p.tipo === 'debito' ? valor : -valor;
          }
          porConta.set(key, existing);
        });

        return porConta;
      };

      const atual = await fetchPeriodo(mes, ano);
      const anterior = compararAnterior
        ? await fetchPeriodo(mes === 1 ? 12 : mes - 1, mes === 1 ? ano - 1 : ano)
        : new Map();

      const criarSecao = (titulo: string, prefixos: string[], tipo: 'receita' | 'despesa'): DRESecao => {
        const contas: DRESecao['contas'] = [];
        let totalAtual = 0;
        let totalAnterior = 0;

        atual.forEach((v, k) => {
          if (v.tipo === tipo && prefixos.some(p => k.startsWith(p))) {
            const va = anterior.get(k)?.valor || 0;
            contas.push({ codigo: k, descricao: v.descricao, valorAtual: v.valor, valorAnterior: va });
            totalAtual += v.valor;
            totalAnterior += va;
          }
        });

        // Add accounts only in anterior
        if (compararAnterior) {
          anterior.forEach((v, k) => {
            if (v.tipo === tipo && prefixos.some(p => k.startsWith(p)) && !atual.has(k)) {
              contas.push({ codigo: k, descricao: v.descricao, valorAtual: 0, valorAnterior: v.valor });
              totalAnterior += v.valor;
            }
          });
        }

        contas.sort((a, b) => a.codigo.localeCompare(b.codigo));
        return { titulo, contas, totalAtual, totalAnterior };
      };

      const receitasOperacionais = criarSecao('RECEITAS OPERACIONAIS', ['4.1'], 'receita');
      const outrasReceitas = criarSecao('OUTRAS RECEITAS OPERACIONAIS', ['4.2'], 'receita');
      const receitasFinanceiras = criarSecao('RECEITAS FINANCEIRAS', ['4.3'], 'receita');
      const despBeneficios = criarSecao('DESPESAS COM BENEFÍCIOS MUTUALISTAS', ['5.1.01', '5.1.02', '5.8', '5.9'], 'despesa');
      const despAdministrativas = criarSecao('DESPESAS ADMINISTRATIVAS', ['5.1.03', '5.1.04', '5.2', '5.3', '5.4', '5.6', '5.7'], 'despesa');
      const despFinanceiras = criarSecao('DESPESAS FINANCEIRAS', ['5.1.05'], 'despesa');
      const despTributos = criarSecao('TRIBUTOS', ['5.5'], 'despesa');

      // Catch-all for uncategorized despesas
      const categorizadas = new Set([
        ...despBeneficios.contas.map(c => c.codigo),
        ...despAdministrativas.contas.map(c => c.codigo),
        ...despFinanceiras.contas.map(c => c.codigo),
        ...despTributos.contas.map(c => c.codigo),
      ]);
      const outrasDesp: DRESecao['contas'] = [];
      let outrosDespTotal = 0;
      let outrosDespAnterior = 0;
      atual.forEach((v, k) => {
        if (v.tipo === 'despesa' && !categorizadas.has(k)) {
          const va = anterior.get(k)?.valor || 0;
          outrasDesp.push({ codigo: k, descricao: v.descricao, valorAtual: v.valor, valorAnterior: va });
          outrosDespTotal += v.valor;
          outrosDespAnterior += va;
        }
      });

      const totalReceitasAtual = receitasOperacionais.totalAtual + outrasReceitas.totalAtual + receitasFinanceiras.totalAtual;
      const totalReceitasAnterior = receitasOperacionais.totalAnterior + outrasReceitas.totalAnterior + receitasFinanceiras.totalAnterior;
      const totalDespesasAtual = despBeneficios.totalAtual + despAdministrativas.totalAtual + despFinanceiras.totalAtual + despTributos.totalAtual + outrosDespTotal;
      const totalDespesasAnterior = despBeneficios.totalAnterior + despAdministrativas.totalAnterior + despFinanceiras.totalAnterior + despTributos.totalAnterior + outrosDespAnterior;

      const resultadoBrutoAtual = receitasOperacionais.totalAtual - despBeneficios.totalAtual;
      const resultadoBrutoAnterior = receitasOperacionais.totalAnterior - despBeneficios.totalAnterior;
      const resultadoOpAtual = resultadoBrutoAtual - despAdministrativas.totalAtual;
      const resultadoOpAnterior = resultadoBrutoAnterior - despAdministrativas.totalAnterior;

      // Resultado Financeiro
      const resultadoFinanceiroAtual = receitasFinanceiras.totalAtual - despFinanceiras.totalAtual;
      const resultadoFinanceiroAnterior = receitasFinanceiras.totalAnterior - despFinanceiras.totalAnterior;

      // Resultado antes dos tributos
      const resultadoAntesTributosAtual = resultadoOpAtual + resultadoFinanceiroAtual + outrasReceitas.totalAtual - outrosDespTotal;
      const resultadoAntesTributosAnterior = resultadoOpAnterior + resultadoFinanceiroAnterior + outrasReceitas.totalAnterior - outrosDespAnterior;

      const resultadoFinalAtual = resultadoAntesTributosAtual - despTributos.totalAtual;
      const resultadoFinalAnterior = resultadoAntesTributosAnterior - despTributos.totalAnterior;

      return {
        receitasOperacionais,
        outrasReceitas,
        receitasFinanceiras,
        despBeneficios,
        despAdministrativas,
        despFinanceiras,
        despTributos,
        outrasDespesas: { titulo: 'OUTRAS DESPESAS', contas: outrasDesp, totalAtual: outrosDespTotal, totalAnterior: outrosDespAnterior },
        totalReceitasAtual,
        totalReceitasAnterior,
        totalDespesasAtual,
        totalDespesasAnterior,
        resultadoBrutoAtual,
        resultadoBrutoAnterior,
        resultadoOpAtual,
        resultadoOpAnterior,
        resultadoFinanceiroAtual,
        resultadoFinanceiroAnterior,
        resultadoAntesTributosAtual,
        resultadoAntesTributosAnterior,
        resultadoFinalAtual,
        resultadoFinalAnterior,
        indicadores: {
          sinistralidade: receitasOperacionais.totalAtual > 0 ? (despBeneficios.totalAtual / receitasOperacionais.totalAtual) * 100 : 0,
          custoAdmin: receitasOperacionais.totalAtual > 0 ? (despAdministrativas.totalAtual / receitasOperacionais.totalAtual) * 100 : 0,
          margemOperacional: receitasOperacionais.totalAtual > 0 ? (resultadoOpAtual / receitasOperacionais.totalAtual) * 100 : 0,
          margemFinal: totalReceitasAtual > 0 ? (resultadoFinalAtual / totalReceitasAtual) * 100 : 0,
        },
      };
    },
    enabled: !!mes && !!ano,
  });
}

// Balancete com saldo anterior
export function useBalanceteCompleto(mes: number, ano: number) {
  return useQuery({
    queryKey: ['balancete-completo', mes, ano],
    queryFn: async () => {
      const contas = await supabase
        .from('plano_contas')
        .select('*')
        .eq('ativa', true)
        .order('codigo');

      if (contas.error) throw contas.error;

      const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
      const dataFim = new Date(ano, mes, 0).toISOString().split('T')[0];
      const dataAnteriorFim = new Date(ano, mes - 1, 0).toISOString().split('T')[0];

      // Partidas do período atual
      const { data: partidasAtual } = await supabase
        .from('lancamentos_partidas')
        .select('conta_id, tipo, valor, lancamento:lancamento_id!inner(data_competencia, status)')
        .gte('lancamento.data_competencia', dataInicio)
        .lte('lancamento.data_competencia', dataFim)
        .eq('lancamento.status', 'ativo');

      // Partidas até fim do período anterior (saldo anterior)
      const { data: partidasAnteriores } = await supabase
        .from('lancamentos_partidas')
        .select('conta_id, tipo, valor, lancamento:lancamento_id!inner(data_competencia, status)')
        .lte('lancamento.data_competencia', dataAnteriorFim)
        .eq('lancamento.status', 'ativo');

      const saldosAnteriores = new Map<string, number>();
      (partidasAnteriores as any[] || []).forEach((p: any) => {
        const atual = saldosAnteriores.get(p.conta_id) || 0;
        saldosAnteriores.set(p.conta_id, atual + (p.tipo === 'debito' ? Number(p.valor) : -Number(p.valor)));
      });

      const movimentacao = new Map<string, { debitos: number; creditos: number }>();
      (partidasAtual as any[] || []).forEach((p: any) => {
        const atual = movimentacao.get(p.conta_id) || { debitos: 0, creditos: 0 };
        if (p.tipo === 'debito') atual.debitos += Number(p.valor);
        else atual.creditos += Number(p.valor);
        movimentacao.set(p.conta_id, atual);
      });

      return (contas.data as PlanoContas[]).map(conta => {
        const saldoAnterior = saldosAnteriores.get(conta.id) || 0;
        const mov = movimentacao.get(conta.id) || { debitos: 0, creditos: 0 };
        const saldoAtual = saldoAnterior + mov.debitos - mov.creditos;

        return {
          ...conta,
          saldoAnterior,
          debitos: mov.debitos,
          creditos: mov.creditos,
          saldoAtual,
        };
      });
    },
    enabled: !!mes && !!ano,
  });
}

// Fechamento Anual
export function useFechamentoAnual() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const criarLancamento = useCriarLancamento();

  const calcularResumo = async (ano: number) => {
    const inicioAno = `${ano}-01-01`;
    const fimAno = `${ano}-12-31`;

    const { data: partidas } = await supabase
      .from('lancamentos_partidas')
      .select(`
        tipo, valor, conta_id,
        conta:plano_contas!inner(codigo, descricao, tipo),
        lancamento:lancamento_id!inner(data_competencia, status)
      `)
      .gte('lancamento.data_competencia', inicioAno)
      .lte('lancamento.data_competencia', fimAno)
      .eq('lancamento.status', 'ativo');

    let totalReceitas = 0;
    let totalDespesas = 0;
    const contasReceita: { conta_id: string; codigo: string; descricao: string; saldo: number }[] = [];
    const contasDespesa: { conta_id: string; codigo: string; descricao: string; saldo: number }[] = [];

    const saldosPorConta = new Map<string, { conta_id: string; codigo: string; descricao: string; tipo: string; saldo: number }>();

    (partidas as any[] || []).forEach((p: any) => {
      const key = p.conta_id;
      const existing = saldosPorConta.get(key) || { conta_id: p.conta_id, codigo: p.conta.codigo, descricao: p.conta.descricao, tipo: p.conta.tipo, saldo: 0 };
      const valor = Number(p.valor);
      if (p.conta.tipo === 'receita') {
        existing.saldo += p.tipo === 'credito' ? valor : -valor;
      } else if (p.conta.tipo === 'despesa') {
        existing.saldo += p.tipo === 'debito' ? valor : -valor;
      }
      saldosPorConta.set(key, existing);
    });

    saldosPorConta.forEach((v) => {
      if (v.tipo === 'receita' && Math.abs(v.saldo) > 0.01) {
        totalReceitas += v.saldo;
        contasReceita.push(v);
      } else if (v.tipo === 'despesa' && Math.abs(v.saldo) > 0.01) {
        totalDespesas += v.saldo;
        contasDespesa.push(v);
      }
    });

    const resultado = totalReceitas - totalDespesas;
    return { totalReceitas, totalDespesas, resultado, contasReceita, contasDespesa };
  };

  const executarFechamento = useMutation({
    mutationFn: async (ano: number) => {
      const { CONTAS_PADRAO } = await import('@/lib/contabilidade-config');
      const resumo = await calcularResumo(ano);
      const dataFechamento = `${ano}-12-31`;
      const partidas: Array<{ conta_id: string; tipo: 'debito' | 'credito'; valor: number }> = [];

      // Zero receitas: D receita / C resultado
      resumo.contasReceita.forEach(c => {
        if (c.saldo > 0) {
          partidas.push({ conta_id: c.conta_id, tipo: 'debito', valor: c.saldo });
          partidas.push({ conta_id: CONTAS_PADRAO.RESULTADO_EXERCICIO, tipo: 'credito', valor: c.saldo });
        }
      });

      // Zero despesas: D resultado / C despesa
      resumo.contasDespesa.forEach(c => {
        if (c.saldo > 0) {
          partidas.push({ conta_id: CONTAS_PADRAO.RESULTADO_EXERCICIO, tipo: 'debito', valor: c.saldo });
          partidas.push({ conta_id: c.conta_id, tipo: 'credito', valor: c.saldo });
        }
      });

      // Transfer resultado to superávits/déficits
      const contaDestino = resumo.resultado >= 0
        ? CONTAS_PADRAO.SUPERAVITS_ACUMULADOS
        : CONTAS_PADRAO.DEFICITS_ACUMULADOS;
      const absResultado = Math.abs(resumo.resultado);

      if (absResultado > 0.01) {
        partidas.push({ conta_id: CONTAS_PADRAO.RESULTADO_EXERCICIO, tipo: resumo.resultado >= 0 ? 'debito' : 'credito', valor: absResultado });
        partidas.push({ conta_id: contaDestino, tipo: resumo.resultado >= 0 ? 'credito' : 'debito', valor: absResultado });
      }

      if (partidas.length > 0) {
        await criarLancamento.mutateAsync({
          data_lancamento: new Date().toISOString().split('T')[0],
          data_competencia: dataFechamento,
          historico: `Apuração do resultado do exercício ${ano} — ${resumo.resultado >= 0 ? 'Superávit' : 'Déficit'} de R$ ${Math.abs(resumo.resultado).toFixed(2)}`,
          origem: 'fechamento',
          status: 'ativo',
          partidas,
        });
      }

      return resumo;
    },
    onSuccess: (_, ano) => {
      queryClient.invalidateQueries({ queryKey: ['fechamentos'] });
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
      queryClient.invalidateQueries({ queryKey: ['saldos-acumulados'] });
      toast({ title: 'Exercício encerrado', description: `Fechamento anual de ${ano} realizado com sucesso.` });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro no fechamento anual', description: error.message, variant: 'destructive' });
    },
  });

  return { calcularResumo, executarFechamento };
}

// Reabrir fechamento
export function useReabrirFechamento() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { error } = await supabase
        .from('fechamentos_contabeis')
        .update({
          status: 'reaberto',
          motivo_reabertura: motivo,
          data_reabertura: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fechamentos'] });
      toast({ title: 'Período reaberto', description: 'O período foi reaberto com sucesso.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao reabrir', description: error.message, variant: 'destructive' });
    },
  });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Partida {
  conta_id: string;
  tipo: 'debito' | 'credito';
  valor: number;
}

interface NovoLancamento {
  data_competencia: string;
  historico: string;
  partidas: Partida[];
  documento_tipo?: string;
  documento_numero?: string;
}

export function useLancamentosContabeis() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Criar lançamento manual
  const criarLancamentoMutation = useMutation({
    mutationFn: async (dados: NovoLancamento) => {
      // Validar balanço
      const totalDebito = dados.partidas.filter(p => p.tipo === 'debito').reduce((acc, p) => acc + p.valor, 0);
      const totalCredito = dados.partidas.filter(p => p.tipo === 'credito').reduce((acc, p) => acc + p.valor, 0);
      
      if (Math.abs(totalDebito - totalCredito) > 0.01) {
        throw new Error('Lançamento não balanceado');
      }
      
      // Criar lançamento
      const { data: lancamento, error: errorLanc } = await supabase
        .from('lancamentos_contabeis')
        .insert({
          data_lancamento: new Date().toISOString().split('T')[0],
          data_competencia: dados.data_competencia,
          origem: 'manual',
          historico: dados.historico,
          documento_tipo: dados.documento_tipo,
          documento_numero: dados.documento_numero,
          status: 'ativo',
          criado_por: user?.id
        })
        .select()
        .single();
      
      if (errorLanc) throw errorLanc;
      
      // Criar partidas
      const partidasInsert = dados.partidas.map((p, idx) => ({
        lancamento_id: lancamento.id,
        conta_id: p.conta_id,
        tipo: p.tipo,
        valor: p.valor,
        ordem: idx + 1
      }));
      
      const { error: errorPartidas } = await supabase
        .from('lancamentos_partidas')
        .insert(partidasInsert);
      
      if (errorPartidas) throw errorPartidas;
      
      return lancamento;
    },
    onSuccess: () => {
      toast.success('Lançamento criado!');
      queryClient.invalidateQueries({ queryKey: ['lancamentos-contabeis'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao criar lançamento');
    }
  });

  // Criar lançamento automático (de outra origem)
  const criarLancamentoAutomaticoMutation = useMutation({
    mutationFn: async (dados: {
      origem: string;
      origem_id: string;
      data_competencia: string;
      historico: string;
      conta_debito_id: string;
      conta_credito_id: string;
      valor: number;
    }) => {
      // Criar lançamento
      const { data: lancamento, error: errorLanc } = await supabase
        .from('lancamentos_contabeis')
        .insert({
          data_lancamento: new Date().toISOString().split('T')[0],
          data_competencia: dados.data_competencia,
          origem: dados.origem,
          origem_id: dados.origem_id,
          historico: dados.historico,
          status: 'ativo'
        })
        .select()
        .single();
      
      if (errorLanc) throw errorLanc;
      
      // Criar partidas
      await supabase.from('lancamentos_partidas').insert([
        { lancamento_id: lancamento.id, conta_id: dados.conta_debito_id, tipo: 'debito', valor: dados.valor, ordem: 1 },
        { lancamento_id: lancamento.id, conta_id: dados.conta_credito_id, tipo: 'credito', valor: dados.valor, ordem: 2 }
      ]);
      
      return lancamento;
    }
  });

  // Estornar lançamento
  const estornarLancamentoMutation = useMutation({
    mutationFn: async ({ lancamentoId, motivo }: { lancamentoId: string; motivo: string }) => {
      // 1. Buscar lançamento original
      const { data: original } = await supabase
        .from('lancamentos_contabeis')
        .select(`*, partidas:lancamentos_partidas(*)`)
        .eq('id', lancamentoId)
        .single();
      
      if (!original) throw new Error('Lançamento não encontrado');
      
      // 2. Criar lançamento de estorno (partidas invertidas)
      const { data: estorno, error: errorEstorno } = await supabase
        .from('lancamentos_contabeis')
        .insert({
          data_lancamento: new Date().toISOString().split('T')[0],
          data_competencia: new Date().toISOString().split('T')[0],
          origem: 'manual',
          historico: `ESTORNO: ${original.historico}`,
          complemento: motivo,
          status: 'ativo',
          criado_por: user?.id
        })
        .select()
        .single();
      
      if (errorEstorno) throw errorEstorno;
      
      // 3. Criar partidas invertidas
      const partidasEstorno = (original.partidas as any[]).map((p, idx) => ({
        lancamento_id: estorno.id,
        conta_id: p.conta_id,
        tipo: p.tipo === 'debito' ? 'credito' : 'debito',
        valor: p.valor,
        ordem: idx + 1
      }));
      
      await supabase.from('lancamentos_partidas').insert(partidasEstorno);
      
      // 4. Marcar original como estornado
      await supabase.from('lancamentos_contabeis').update({
        status: 'estornado',
        estornado_por: user?.id,
        estornado_em: new Date().toISOString(),
        motivo_estorno: motivo,
        lancamento_estorno_id: estorno.id
      }).eq('id', lancamentoId);
      
      return estorno;
    },
    onSuccess: () => {
      toast.success('Lançamento estornado!');
      queryClient.invalidateQueries({ queryKey: ['lancamentos-contabeis'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao estornar lançamento');
    }
  });

  return {
    criarLancamento: criarLancamentoMutation.mutate,
    criarLancamentoAutomatico: criarLancamentoAutomaticoMutation.mutateAsync,
    estornarLancamento: estornarLancamentoMutation.mutate,
    isCriando: criarLancamentoMutation.isPending,
    isEstornando: estornarLancamentoMutation.isPending,
  };
}

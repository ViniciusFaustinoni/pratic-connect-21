import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface OrcamentoReparo {
  id: string;
  sinistro_id: string;
  oficina_id: string | null;
  status: 'elaboracao' | 'execucao' | 'consolidado';
  valor_inicial_total: number;
  valor_pecas: number;
  valor_mao_obra: number;
  valor_total: number;
  consolidado_em: string | null;
  consolidado_por: string | null;
  observacao_final: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrcamentoItem {
  id: string;
  orcamento_id: string;
  tipo: 'peca' | 'mao_de_obra';
  descricao: string;
  origem: 'original' | 'seminova' | 'paralela' | null;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  status: 'pendente' | 'aprovado' | 'comprado' | 'instalado' | 'cancelado';
  observacao: string | null;
  motivo_inclusao: string | null;
  motivo_cancelamento: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface OrcamentoHistorico {
  id: string;
  orcamento_id: string;
  item_id: string | null;
  acao: string;
  descricao: string | null;
  dados_anteriores: any;
  dados_novos: any;
  motivo: string | null;
  usuario_id: string | null;
  created_at: string;
  usuario_nome?: string;
}

export function useOrcamentoReparo(sinistroId: string | undefined) {
  return useQuery({
    queryKey: ['orcamento-reparo', sinistroId],
    queryFn: async () => {
      if (!sinistroId) return null;
      const { data, error } = await supabase
        .from('orcamento_reparo')
        .select('*')
        .eq('sinistro_id', sinistroId)
        .maybeSingle();
      if (error) throw error;
      return data as OrcamentoReparo | null;
    },
    enabled: !!sinistroId,
  });
}

export function useOrcamentoItens(orcamentoId: string | undefined) {
  return useQuery({
    queryKey: ['orcamento-reparo-itens', orcamentoId],
    queryFn: async () => {
      if (!orcamentoId) return [];
      const { data, error } = await supabase
        .from('orcamento_reparo_itens')
        .select('*')
        .eq('orcamento_id', orcamentoId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as OrcamentoItem[];
    },
    enabled: !!orcamentoId,
  });
}

export function useOrcamentoHistorico(orcamentoId: string | undefined) {
  return useQuery({
    queryKey: ['orcamento-reparo-historico', orcamentoId],
    queryFn: async () => {
      if (!orcamentoId) return [];
      const { data, error } = await supabase
        .from('orcamento_reparo_historico')
        .select('*, profiles:usuario_id(nome)')
        .eq('orcamento_id', orcamentoId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((h: any) => ({
        ...h,
        usuario_nome: h.profiles?.nome || 'Sistema',
      })) as OrcamentoHistorico[];
    },
    enabled: !!orcamentoId,
  });
}

export function useCriarOrcamento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sinistroId, oficinaId }: { sinistroId: string; oficinaId?: string }) => {
      const { data, error } = await supabase
        .from('orcamento_reparo')
        .insert({ sinistro_id: sinistroId, oficina_id: oficinaId || null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['orcamento-reparo', vars.sinistroId] });
    },
  });
}

export function useAdicionarItem() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({
      orcamentoId,
      item,
      motivo,
    }: {
      orcamentoId: string;
      item: Partial<OrcamentoItem>;
      motivo?: string;
    }) => {
      const { data: inserted, error } = await supabase
        .from('orcamento_reparo_itens')
        .insert({
          orcamento_id: orcamentoId,
          tipo: item.tipo!,
          descricao: item.descricao!,
          origem: item.origem || null,
          quantidade: item.quantidade || 1,
          valor_unitario: item.valor_unitario || 0,
          status: item.status || 'pendente',
          observacao: item.observacao || null,
          motivo_inclusao: item.motivo_inclusao || motivo || null,
          created_by: profile?.id || null,
        })
        .select()
        .single();
      if (error) throw error;

      // Registrar histórico
      await supabase.from('orcamento_reparo_historico').insert({
        orcamento_id: orcamentoId,
        item_id: inserted.id,
        acao: 'item_adicionado',
        descricao: `Adicionou ${item.tipo === 'peca' ? 'peça' : 'mão de obra'}: ${item.descricao} — R$ ${((item.quantidade || 1) * (item.valor_unitario || 0)).toFixed(2)}`,
        dados_novos: inserted,
        motivo: motivo || item.motivo_inclusao || null,
        usuario_id: profile?.id || null,
      });

      return inserted;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orcamento-reparo-itens', data.orcamento_id] });
      queryClient.invalidateQueries({ queryKey: ['orcamento-reparo'] });
      queryClient.invalidateQueries({ queryKey: ['orcamento-reparo-historico', data.orcamento_id] });
    },
  });
}

export function useEditarItem() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({
      item,
      changes,
      motivo,
    }: {
      item: OrcamentoItem;
      changes: Partial<OrcamentoItem>;
      motivo: string;
    }) => {
      const { data: updated, error } = await supabase
        .from('orcamento_reparo_itens')
        .update(changes)
        .eq('id', item.id)
        .select()
        .single();
      if (error) throw error;

      await supabase.from('orcamento_reparo_historico').insert({
        orcamento_id: item.orcamento_id,
        item_id: item.id,
        acao: 'item_editado',
        descricao: `Editou ${item.tipo === 'peca' ? 'peça' : 'mão de obra'}: ${item.descricao}`,
        dados_anteriores: { descricao: item.descricao, valor_unitario: item.valor_unitario, quantidade: item.quantidade, origem: item.origem, status: item.status },
        dados_novos: changes,
        motivo,
        usuario_id: profile?.id || null,
      });

      return updated;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orcamento-reparo-itens', data.orcamento_id] });
      queryClient.invalidateQueries({ queryKey: ['orcamento-reparo'] });
      queryClient.invalidateQueries({ queryKey: ['orcamento-reparo-historico', data.orcamento_id] });
    },
  });
}

export function useCancelarItem() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({
      item,
      motivo,
    }: {
      item: OrcamentoItem;
      motivo: string;
    }) => {
      const { data: updated, error } = await supabase
        .from('orcamento_reparo_itens')
        .update({ status: 'cancelado', motivo_cancelamento: motivo })
        .eq('id', item.id)
        .select()
        .single();
      if (error) throw error;

      await supabase.from('orcamento_reparo_historico').insert({
        orcamento_id: item.orcamento_id,
        item_id: item.id,
        acao: 'item_cancelado',
        descricao: `Cancelou ${item.tipo === 'peca' ? 'peça' : 'mão de obra'}: ${item.descricao}`,
        dados_anteriores: { status: item.status },
        dados_novos: { status: 'cancelado' },
        motivo,
        usuario_id: profile?.id || null,
      });

      return updated;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orcamento-reparo-itens', data.orcamento_id] });
      queryClient.invalidateQueries({ queryKey: ['orcamento-reparo'] });
      queryClient.invalidateQueries({ queryKey: ['orcamento-reparo-historico', data.orcamento_id] });
    },
  });
}

export function useConsolidarOrcamento() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({
      orcamentoId,
      observacaoFinal,
    }: {
      orcamentoId: string;
      observacaoFinal?: string;
    }) => {
      // Atualizar itens pendentes/aprovados para instalado
      await supabase
        .from('orcamento_reparo_itens')
        .update({ status: 'instalado' })
        .eq('orcamento_id', orcamentoId)
        .in('status', ['pendente', 'aprovado', 'comprado']);

      // Consolidar o orçamento
      const { data, error } = await supabase
        .from('orcamento_reparo')
        .update({
          status: 'consolidado',
          consolidado_em: new Date().toISOString(),
          consolidado_por: profile?.id || null,
          observacao_final: observacaoFinal || null,
        })
        .eq('id', orcamentoId)
        .select()
        .single();
      if (error) throw error;

      await supabase.from('orcamento_reparo_historico').insert({
        orcamento_id: orcamentoId,
        acao: 'consolidado',
        descricao: `Orçamento consolidado — Total final: R$ ${data.valor_total?.toFixed(2)}`,
        dados_novos: { valor_total: data.valor_total, valor_pecas: data.valor_pecas, valor_mao_obra: data.valor_mao_obra },
        motivo: observacaoFinal || null,
        usuario_id: profile?.id || null,
      });

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orcamento-reparo', data.sinistro_id] });
      queryClient.invalidateQueries({ queryKey: ['orcamento-reparo-itens', data.id] });
      queryClient.invalidateQueries({ queryKey: ['orcamento-reparo-historico', data.id] });
    },
  });
}

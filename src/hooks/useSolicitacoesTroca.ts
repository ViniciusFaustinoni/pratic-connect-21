import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type StatusTroca =
  | 'cotacao_em_andamento'
  | 'aguardando_cadastro'
  | 'aguardando_monitoramento'
  | 'aguardando_vistoria'
  | 'liberada_para_assinatura'
  | 'efetivada'
  | 'reprovada_cadastro'
  | 'reprovada_monitoramento'
  | 'cancelada';

export interface SolicitacaoTroca {
  id: string;
  associado_antigo_id: string;
  veiculo_id: string;
  cotacao_id: string | null;
  novo_titular_dados: { nome: string; cpf: string; email?: string; telefone?: string } | null;
  novo_associado_id: string | null;
  status: StatusTroca;
  token_publico: string;
  termo_cancelamento_autentique_id: string | null;
  termo_cancelamento_url: string | null;
  termo_cancelamento_enviado_em: string | null;
  termo_cancelamento_assinado_em: string | null;
  aprovado_cadastro_por: string | null;
  aprovado_cadastro_em: string | null;
  observacao_cadastro: string | null;
  aprovado_monitoramento_por: string | null;
  aprovado_monitoramento_em: string | null;
  observacao_monitoramento: string | null;
  servico_vistoria_id: string | null;
  motivo_reprovacao: string | null;
  reprovado_por: string | null;
  reprovado_em: string | null;
  efetivada_em: string | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
  analise_previa_resultado?: any;
  analise_previa_em?: string | null;
  associado_antigo?: { id: string; nome: string; cpf: string | null; email: string | null; telefone: string | null; codigo_hinova?: number | null } | null;
  veiculo?: { id: string; marca: string; modelo: string; ano_modelo: number | null; ano_fabricacao: number | null; placa: string } | null;
  cotacao?: { id: string; numero: string | null; token_publico: string | null; status: string; tipo_vistoria?: string | null; vistoria_concluida_em?: string | null } | null;
}

export function useSolicitacoesTroca(filtroStatus?: StatusTroca[], criadoPorProfileId?: string) {
  return useQuery({
    queryKey: ['solicitacoes-troca', filtroStatus, criadoPorProfileId],
    queryFn: async () => {
      let q = (supabase as any)
        .from('solicitacoes_troca_titularidade')
        .select(`
          *,
          associado_antigo:associados!associado_antigo_id(id, nome, cpf, email, telefone),
          veiculo:veiculos!veiculo_id(id, marca, modelo, ano_modelo, ano_fabricacao, placa),
          cotacao:cotacoes!cotacao_id(id, numero, token_publico, status)
        `)
        .order('created_at', { ascending: false });
      if (filtroStatus && filtroStatus.length) q = q.in('status', filtroStatus);
      if (criadoPorProfileId) q = q.eq('criado_por', criadoPorProfileId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as SolicitacaoTroca[];
    },
    refetchInterval: 30000,
  });
}

export function useSolicitacaoTroca(id: string | undefined) {
  const qc = useQueryClient();

  // Realtime: invalida o cache assim que o webhook Autentique gravar a assinatura
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`troca-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'solicitacoes_troca_titularidade', filter: `id=eq.${id}` },
        () => {
          qc.invalidateQueries({ queryKey: ['solicitacao-troca', id] });
          qc.invalidateQueries({ queryKey: ['solicitacoes-troca'] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, qc]);

  return useQuery({
    queryKey: ['solicitacao-troca', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await (supabase as any)
        .from('solicitacoes_troca_titularidade')
        .select(`
          *,
          associado_antigo:associados!associado_antigo_id(id, nome, cpf, email, telefone, status, codigo_hinova),
          veiculo:veiculos!veiculo_id(id, marca, modelo, ano_modelo, ano_fabricacao, placa),
          cotacao:cotacoes!cotacao_id(id, numero, token_publico, status, valor_total_mensal)
        `)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as SolicitacaoTroca | null;
    },
    enabled: !!id,
    refetchOnWindowFocus: true,
  });
}

export function useCriarSolicitacaoTroca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      associado_antigo_id: string;
      veiculo_id: string;
      veiculo_placa?: string;
      novo_titular: { nome: string; cpf: string; email?: string; telefone?: string };
    }) => {
      const { data, error } = await supabase.functions.invoke('criar-solicitacao-troca-titularidade', {
        body: params,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { solicitacao_id: string; cotacao_id: string; cotacao_token: string; termo_enviado_automaticamente?: boolean; termo_envio_erro?: string | null };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['solicitacoes-troca'] });
    },
  });
}

async function statusAvancou(id: string, esperados: StatusTroca[]): Promise<boolean> {
  try {
    const { data } = await (supabase as any)
      .from('solicitacoes_troca_titularidade')
      .select('status')
      .eq('id', id)
      .maybeSingle();
    return !!data?.status && esperados.includes(data.status as StatusTroca);
  } catch { return false; }
}

export function useAprovarTrocaCadastro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { solicitacao_id: string; observacao?: string }) => {
      const { data, error } = await supabase.functions.invoke('aprovar-troca-cadastro', { body: params });
      if (error) {
        // Pode ter sido sucesso silencioso (timeout/wrapper). Verifica status real.
        const ok = await statusAvancou(params.solicitacao_id, [
          'aguardando_monitoramento', 'aguardando_vistoria', 'liberada_para_assinatura', 'efetivada',
        ]);
        if (ok) return { success: true, silent: true };
        throw error;
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['solicitacoes-troca'] });
      qc.invalidateQueries({ queryKey: ['solicitacao-troca'] });
      toast.success(data?.silent
        ? 'Aprovada — processamento em segundo plano'
        : 'Solicitação aprovada e enviada ao Monitoramento');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAprovarTrocaMonitoramento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { solicitacao_id: string; acao: 'aprovar' | 'solicitar_vistoria'; observacao?: string }) => {
      const { data, error } = await supabase.functions.invoke('aprovar-troca-monitoramento', { body: params });
      if (error) {
        const esperados: StatusTroca[] = params.acao === 'aprovar'
          ? ['liberada_para_assinatura', 'efetivada']
          : ['aguardando_vistoria', 'liberada_para_assinatura', 'efetivada'];
        const ok = await statusAvancou(params.solicitacao_id, esperados);
        if (ok) return { success: true, silent: true };
        throw error;
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data: any, vars) => {
      qc.invalidateQueries({ queryKey: ['solicitacoes-troca'] });
      qc.invalidateQueries({ queryKey: ['solicitacao-troca'] });
      toast.success(data?.silent
        ? 'Aprovada — processamento em segundo plano'
        : (vars.acao === 'aprovar' ? 'Liberado para assinatura' : 'Vistoria solicitada'));
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReprovarTroca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { solicitacao_id: string; motivo: string; etapa: 'cadastro' | 'monitoramento' }) => {
      const { data, error } = await supabase.functions.invoke('reprovar-troca-titularidade', { body: params });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['solicitacoes-troca'] });
      qc.invalidateQueries({ queryKey: ['solicitacao-troca'] });
      toast.success('Solicitação reprovada');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useEnviarTermoCancelamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: string | { solicitacao_id: string; force_resend?: boolean }) => {
      const body = typeof params === 'string'
        ? { solicitacao_id: params }
        : { solicitacao_id: params.solicitacao_id, force_resend: !!params.force_resend };
      const { data, error } = await supabase.functions.invoke('enviar-termo-cancelamento-troca', { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { success: boolean; reenvio?: boolean; whatsapp_status?: string };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['solicitacao-troca'] });
      qc.invalidateQueries({ queryKey: ['solicitacoes-troca'] });
      qc.invalidateQueries({ queryKey: ['outros-processos'] });
      toast.success(data?.reenvio ? 'Termo reenviado ao titular antigo' : 'Termo de cancelamento enviado ao titular antigo');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

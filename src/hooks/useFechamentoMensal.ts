import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ============================================
// TIPOS
// ============================================

export interface FechamentoMensal {
  id: string;
  mes: number;
  ano: number;
  status: 'aberto' | 'fechado' | 'aprovado' | 'processado';
  data_fechamento: string;
  total_associados_ativos: number;
  total_cotas_ativas: number;
  total_despesas_rateio: number;
  total_taxa_administrativa: number;
  total_adicionais: number;
  total_geral: number;
  fechado_por: string | null;
  fechado_em: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
  processado_por: string | null;
  processado_em: string | null;
  created_at: string;
  updated_at: string;
  despesas_rateio?: DespesaRateio[];
}

export interface DespesaRateio {
  id: string;
  fechamento_id: string;
  tipo_beneficio: string;
  descricao: string | null;
  valor_total: number;
  total_cotas_elegivel: number;
  valor_por_cota: number;
  quantidade_eventos: number;
  sinistros_ids: string[];
  created_at: string;
}

export interface PreviewFatura {
  associado_id: string;
  associado_nome: string;
  veiculo_placa: string;
  valor_fipe: number;
  cotas: number;
  composicao: {
    taxa_administrativa: number;
    rateio_colisao: number;
    rateio_roubo_furto: number;
    rateio_incendio: number;
    rateio_vidros: number;
    rateio_terceiros: number;
    rateio_assistencia: number;
    rateio_outros: number;
    adicionais: number;
    fator_prorata: number;
    total: number;
  };
}

export interface DespesasManuais {
  colisao: number;
  roubo_furto: number;
  assistencia: number;
  terceiros: number;
  vidros: number;
  outros: number;
}

// ============================================
// HOOKS
// ============================================

export function useFechamentosMensais(ano?: number) {
  return useQuery({
    queryKey: ['fechamentos-mensais', ano],
    queryFn: async () => {
      let query = supabase
        .from('fechamentos_mensais')
        .select('*, despesas_rateio(*)')
        .order('ano', { ascending: false })
        .order('mes', { ascending: false });

      if (ano) {
        query = query.eq('ano', ano);
      }

      const { data, error } = await query.limit(24);
      if (error) throw error;
      return data as FechamentoMensal[];
    },
  });
}

export function useFechamento(mes?: number, ano?: number) {
  return useQuery({
    queryKey: ['fechamento', mes, ano],
    queryFn: async () => {
      if (!mes || !ano) return null;
      const { data, error } = await supabase
        .from('fechamentos_mensais')
        .select('*, despesas_rateio(*)')
        .eq('mes', mes)
        .eq('ano', ano)
        .maybeSingle();
      if (error) throw error;
      return data as FechamentoMensal | null;
    },
    enabled: !!mes && !!ano,
  });
}

export function useExecutarFechamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ mes, ano, forcar = false, despesas_manuais }: { 
      mes: number; ano: number; forcar?: boolean; despesas_manuais?: DespesasManuais 
    }) => {
      const { data, error } = await supabase.functions.invoke('fechamento-mensal', {
        body: { mes, ano, forcar, despesas_manuais },
      });
      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || data.message);
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Fechamento realizado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['fechamentos-mensais'] });
      queryClient.invalidateQueries({ queryKey: ['fechamento'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro no fechamento: ${error.message}`);
    },
  });
}

export function useCalcularRateio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fechamento_id, aprovar = false, profile_id }: { 
      fechamento_id: string; aprovar?: boolean; profile_id?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('calcular-rateio-completo', {
        body: { fechamento_id, aprovar, profile_id },
      });
      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || data.message);
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Rateio calculado!');
      queryClient.invalidateQueries({ queryKey: ['fechamentos-mensais'] });
      queryClient.invalidateQueries({ queryKey: ['fechamento'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao calcular rateio: ${error.message}`);
    },
  });
}

export function useGerarFaturas() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fechamento_id, preview = false, enviar_whatsapp = false, limite }: { 
      fechamento_id: string; preview?: boolean; enviar_whatsapp?: boolean; limite?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('gerar-faturas-mensais', {
        body: { fechamento_id, preview, enviar_whatsapp, limite },
      });
      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || data.message);
      return data;
    },
    onSuccess: (data) => {
      if (data.preview) {
        toast.success(`Preview: ${data.geradas} faturas calculadas`);
      } else {
        toast.success(`${data.geradas} faturas geradas! ${data.whatsappEnviados} WhatsApp enviados`);
      }
      queryClient.invalidateQueries({ queryKey: ['fechamentos-mensais'] });
      queryClient.invalidateQueries({ queryKey: ['fechamento'] });
      queryClient.invalidateQueries({ queryKey: ['asaas-cobrancas'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao gerar faturas: ${error.message}`);
    },
  });
}

export function useCobrancasFechamento(fechamentoId: string | undefined) {
  return useQuery({
    queryKey: ['cobrancas-fechamento', fechamentoId],
    queryFn: async () => {
      if (!fechamentoId) return [];
      const { data, error } = await supabase
        .from('asaas_cobrancas')
        .select(`
          *,
          associado:associados(id, nome, cpf, telefone, whatsapp),
          composicao:cobrancas_composicao(*)
        `)
        .eq('fechamento_id', fechamentoId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!fechamentoId,
  });
}

export function useEnviarCobrancaWhatsApp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ cobranca_id }: { cobranca_id: string }) => {
      const { data: cobranca, error: fetchError } = await supabase
        .from('asaas_cobrancas')
        .select(`*, associado:associados(nome, telefone, whatsapp)`)
        .eq('id', cobranca_id)
        .single();
      if (fetchError || !cobranca) throw new Error('Cobrança não encontrada');
      const telefone = cobranca.associado?.whatsapp || cobranca.associado?.telefone;
      if (!telefone) throw new Error('Associado sem telefone cadastrado');
      const valorFormatado = cobranca.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const vencimentoFormatado = new Date(cobranca.data_vencimento).toLocaleDateString('pt-BR');
      let mensagem = `📄 *Fatura ${cobranca.competencia}*\n\nOlá ${cobranca.associado?.nome?.split(' ')[0]}! 👋\n\nSua fatura de *${valorFormatado}* está disponível.\n📅 Vencimento: *${vencimentoFormatado}*\n\n`;
      if (cobranca.pix_copia_cola) mensagem += `💠 *PIX Copia e Cola:*\n\`${cobranca.pix_copia_cola}\`\n\n`;
      if (cobranca.boleto_url) mensagem += `📋 Boleto: ${cobranca.boleto_url}`;
      const { error: sendError } = await supabase.functions.invoke('whatsapp-send-text', {
        body: { telefone: telefone.replace(/\D/g, ''), mensagem },
      });
      if (sendError) throw new Error(sendError.message);
      await supabase.from('asaas_cobrancas').update({ enviada_whatsapp: true, enviada_whatsapp_em: new Date().toISOString() }).eq('id', cobranca_id);
      return { success: true };
    },
    onSuccess: () => {
      toast.success('Cobrança enviada via WhatsApp!');
      queryClient.invalidateQueries({ queryKey: ['cobrancas-fechamento'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao enviar: ${error.message}`);
    },
  });
}

// ============================================
// UTILITÁRIOS
// ============================================

export function getNomeMes(mes: number): string {
  const nomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return nomes[mes - 1] || '';
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = { aberto: 'Aberto', fechado: 'Fechado', aprovado: 'Aprovado', processado: 'Processado' };
  return labels[status] || status;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    aberto: 'bg-blue-100 text-blue-800',
    fechado: 'bg-yellow-100 text-yellow-800',
    aprovado: 'bg-green-100 text-green-800',
    processado: 'bg-purple-100 text-purple-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

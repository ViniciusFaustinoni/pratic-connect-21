import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  AssociadoApp,
  VeiculoApp,
  BoletoApp,
  AssistenciaApp,
  NotificacaoApp,
  SolicitarAssistenciaPayload,
  StatusBoleto,
} from '@/types/app-associado';

// Protocolo agora é gerado pela edge function

// ============================================
// HOOK: DADOS DO ASSOCIADO LOGADO
// ============================================
export function useAssociadoLogado() {
  return useQuery({
    queryKey: ['app-associado-logado'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data, error } = await supabase
        .from('associados')
        .select(`
          id, nome, cpf, email, telefone, whatsapp, avatar_url,
          status, data_adesao, dia_vencimento,
          plano:planos(nome)
        `)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      return {
        ...data,
        plano_nome: data.plano?.nome || 'Sem plano',
      } as AssociadoApp;
    },
  });
}

// ============================================
// HOOK: VEÍCULOS DO ASSOCIADO
// ============================================
export function useVeiculosApp() {
  return useQuery({
    queryKey: ['app-veiculos'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data: assoc } = await supabase
        .from('associados')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!assoc) throw new Error('Associado não encontrado');

      const { data, error } = await supabase
        .from('veiculos')
        .select(`
          id, placa, marca, modelo, ano_modelo, cor, status,
          rastreadores(id, status)
        `)
        .eq('associado_id', assoc.id)
        .eq('status', 'ativo');

      if (error) throw error;

      return (data || []).map(v => ({
        ...v,
        tem_rastreador: Array.isArray(v.rastreadores) && v.rastreadores.length > 0,
        rastreador_ativo: Array.isArray(v.rastreadores) && v.rastreadores.some(r => r.status === 'instalado'),
      })) as VeiculoApp[];
    },
  });
}

// ============================================
// HOOK: BOLETOS DO ASSOCIADO (tabela: cobrancas)
// ============================================
export function useBoletosApp(status?: StatusBoleto) {
  return useQuery({
    queryKey: ['app-boletos', status],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data: assoc } = await supabase
        .from('associados')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!assoc) throw new Error('Associado não encontrado');

      let query = supabase
        .from('cobrancas')
        .select('*')
        .eq('associado_id', assoc.id)
        .order('data_vencimento', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data as BoletoApp[];
    },
  });
}

// ============================================
// HOOK: BOLETO PENDENTE (para Home)
// ============================================
export function useBoletoAtual() {
  return useQuery({
    queryKey: ['app-boleto-atual'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data: assoc } = await supabase
        .from('associados')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!assoc) return null;

      const { data } = await supabase
        .from('cobrancas')
        .select('*')
        .eq('associado_id', assoc.id)
        .in('status', ['aguardando_pagamento', 'vencido'])
        .order('data_vencimento', { ascending: true })
        .limit(1)
        .maybeSingle();

      return data as BoletoApp | null;
    },
  });
}

// ============================================
// HOOK: BOLETO INDIVIDUAL
// ============================================
export function useBoletoApp(id: string | undefined) {
  return useQuery({
    queryKey: ['app-boleto', id],
    queryFn: async () => {
      if (!id) throw new Error('ID não informado');

      const { data, error } = await supabase
        .from('cobrancas')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as BoletoApp;
    },
    enabled: !!id,
  });
}

// ============================================
// HOOK: ASSISTÊNCIAS DO ASSOCIADO (tabela: chamados_assistencia)
// ============================================
export function useAssistenciasApp() {
  return useQuery({
    queryKey: ['app-assistencias'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data: assoc } = await supabase
        .from('associados')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!assoc) throw new Error('Associado não encontrado');

      const { data, error } = await supabase
        .from('chamados_assistencia')
        .select(`
          id, protocolo, tipo_servico, status, veiculo_id,
          origem_endereco, origem_lat, origem_lng, origem_cidade, origem_uf,
          destino_endereco, destino_lat, destino_lng,
          descricao, prestador_nome, prestador_telefone,
          data_abertura, data_conclusao, avaliacao_nota,
          veiculo:veiculos(id, placa, marca, modelo, ano_modelo, cor, status)
        `)
        .eq('associado_id', assoc.id)
        .order('data_abertura', { ascending: false });

      if (error) throw error;
      
      return (data || []).map(item => ({
        ...item,
        veiculo: item.veiculo ? {
          ...item.veiculo,
          tem_rastreador: false,
          rastreador_ativo: false,
        } : undefined,
      })) as AssistenciaApp[];
    },
  });
}

// ============================================
// HOOK: ASSISTÊNCIA ATIVA
// ============================================
export function useAssistenciaAtiva() {
  return useQuery({
    queryKey: ['app-assistencia-ativa'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: assoc } = await supabase
        .from('associados')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!assoc) return null;

      const { data } = await supabase
        .from('chamados_assistencia')
        .select(`
          id, protocolo, tipo_servico, status, veiculo_id,
          origem_endereco, origem_lat, origem_lng, origem_cidade, origem_uf,
          destino_endereco, destino_lat, destino_lng,
          descricao, prestador_nome, prestador_telefone,
          data_abertura, data_conclusao, avaliacao_nota,
          veiculo:veiculos(id, placa, marca, modelo, ano_modelo, cor, status)
        `)
        .eq('associado_id', assoc.id)
        .in('status', ['aberto', 'aguardando_prestador', 'prestador_despachado', 'prestador_a_caminho', 'em_atendimento'])
        .order('data_abertura', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) return null;

      return {
        ...data,
        veiculo: data.veiculo ? {
          ...data.veiculo,
          tem_rastreador: false,
          rastreador_ativo: false,
        } : undefined,
      } as AssistenciaApp;
    },
    refetchInterval: 30000,
  });
}

// ============================================
// HOOK: SOLICITAR ASSISTÊNCIA (via Edge Function)
// ============================================
export function useSolicitarAssistencia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SolicitarAssistenciaPayload) => {
      const { data, error } = await supabase.functions.invoke('criar-chamado-assistencia', {
        body: {
          veiculo_id: payload.veiculo_id,
          tipo_assistencia: payload.tipo,
          descricao: payload.descricao,
          latitude: payload.latitude,
          longitude: payload.longitude,
          endereco: payload.endereco,
        }
      });

      if (error) throw error;
      
      if (!data.success) {
        // Se já existe chamado aberto, retornar erro específico
        if (data.chamado_existente) {
          throw new Error(`Você já possui o chamado ${data.chamado_existente.protocolo} em aberto`);
        }
        throw new Error(data.error || 'Erro ao criar chamado');
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['app-assistencias'] });
      queryClient.invalidateQueries({ queryKey: ['app-assistencia-ativa'] });
      queryClient.invalidateQueries({ queryKey: ['meu-chamado-aberto'] });
      toast.success(data.mensagem_confirmacao || 'Assistência solicitada! Aguarde contato.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Erro ao solicitar assistência');
    },
  });
}

// ============================================
// HOOK: NOTIFICAÇÕES
// ============================================
export function useNotificacoesApp() {
  return useQuery({
    queryKey: ['app-notificacoes'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data, error } = await supabase
        .from('notificacoes')
        .select('id, tipo, titulo, mensagem, lida, created_at, link')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      return (data || []).map(n => ({
        ...n,
        data: n.created_at,
      })) as NotificacaoApp[];
    },
  });
}

// ============================================
// HOOK: MARCAR NOTIFICAÇÃO COMO LIDA
// ============================================
export function useMarcarNotificacaoLida() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-notificacoes'] });
    },
  });
}

// ============================================
// HOOK: CONTAGEM DE NÃO LIDAS
// ============================================
export function useNotificacoesNaoLidas() {
  return useQuery({
    queryKey: ['app-notificacoes-nao-lidas'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { count } = await supabase
        .from('notificacoes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('lida', false);

      return count || 0;
    },
    refetchInterval: 60000,
  });
}

// ============================================
// HOOK: RESUMO PARA HOME
// ============================================
export function useResumoApp() {
  const { data: associado, isLoading: loadingAssoc } = useAssociadoLogado();
  const { data: veiculos, isLoading: loadingVeic } = useVeiculosApp();
  const { data: boletoPendente, isLoading: loadingBoleto } = useBoletoAtual();
  const { data: assistenciaAtiva } = useAssistenciaAtiva();
  const { data: notificacoesNaoLidas } = useNotificacoesNaoLidas();

  const isLoading = loadingAssoc || loadingVeic || loadingBoleto;

  return {
    associado,
    veiculos: veiculos || [],
    boletoPendente,
    assistenciaAtiva,
    notificacoesNaoLidas: notificacoesNaoLidas || 0,
    isLoading,
  };
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface AcionamentoRequest {
  veiculo_id: string;
  sinistro_id?: string;
  chamado_assistencia_id?: string;
  tipo_origem: 'sinistro' | 'assistencia' | 'diretoria' | 'manual';
  observacoes?: string;
  modo_rastreamento?: 'intensivo' | 'emergencia';
}

interface AcionamentoResponse {
  success: boolean;
  acionamento_id?: string;
  protocolo_externo?: string;
  status?: string;
  error?: string;
  mensagem?: string;
}

interface Acionamento {
  id: string;
  sinistro_id: string | null;
  chamado_assistencia_id: string | null;
  veiculo_id: string;
  rastreador_id: string | null;
  associado_id: string | null;
  tipo_origem: string;
  protocolo_externo: string | null;
  plataforma: string;
  solicitado_por: string | null;
  solicitado_por_nome: string | null;
  solicitado_em: string;
  autorizado_por: string | null;
  autorizado_por_nome: string | null;
  autorizado_em: string | null;
  status: string;
  api_status_code: number | null;
  erro_mensagem: string | null;
  ultima_posicao_lat: number | null;
  ultima_posicao_lng: number | null;
  ultima_posicao_data: string | null;
  observacoes: string | null;
  encerrado_em: string | null;
  encerrado_por: string | null;
  motivo_encerramento: string | null;
  created_at: string;
  updated_at: string;
}

// Hook para acionar roubo/furto
export function useAcionarRouboFurto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AcionamentoRequest): Promise<AcionamentoResponse> => {
      const { data: response, error } = await supabase.functions.invoke<AcionamentoResponse>(
        'acionar-roubo-furto',
        { body: data }
      );

      if (error) throw new Error(error.message);
      if (!response?.success) throw new Error(response?.error || 'Erro ao acionar');
      
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['acionamentos'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores'] });
      queryClient.invalidateQueries({ queryKey: ['alertas'] });
      
      toast({
        title: "🚨 Acionamento Realizado",
        description: data.mensagem || "Acionamento de roubo/furto enviado com sucesso.",
        variant: data.status === 'confirmado' ? 'default' : 'destructive',
      });
    },
    onError: (error) => {
      toast({
        title: "Erro no Acionamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Hook para buscar acionamentos de um veículo
export function useAcionamentosVeiculo(veiculoId: string | undefined) {
  return useQuery({
    queryKey: ['acionamentos', 'veiculo', veiculoId],
    queryFn: async () => {
      if (!veiculoId) return [];

      const { data, error } = await supabase
        .from('acionamentos_roubo_furto')
        .select('*')
        .eq('veiculo_id', veiculoId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Acionamento[];
    },
    enabled: !!veiculoId,
  });
}

// Hook para buscar acionamento de um sinistro
export function useAcionamentoSinistro(sinistroId: string | undefined) {
  return useQuery({
    queryKey: ['acionamentos', 'sinistro', sinistroId],
    queryFn: async () => {
      if (!sinistroId) return null;

      const { data, error } = await supabase
        .from('acionamentos_roubo_furto')
        .select('*')
        .eq('sinistro_id', sinistroId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as Acionamento | null;
    },
    enabled: !!sinistroId,
  });
}

// Hook para buscar acionamentos ativos (para monitoramento)
export function useAcionamentosAtivos() {
  return useQuery({
    queryKey: ['acionamentos', 'ativos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('acionamentos_roubo_furto')
        .select(`
          *,
          veiculo:veiculos(id, placa, marca, modelo),
          rastreador:rastreadores(id, codigo, ultima_posicao_lat, ultima_posicao_lng, ultima_comunicacao),
          associado:associados(id, nome, telefone, whatsapp)
        `)
        .in('status', ['solicitado', 'autorizado', 'enviado', 'confirmado'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });
}

// Hook para encerrar acionamento
export function useEncerrarAcionamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      acionamentoId, 
      motivo 
    }: { 
      acionamentoId: string; 
      motivo: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, nome')
        .eq('user_id', user.id)
        .single();

      // Buscar acionamento para pegar o rastreador_id
      const { data: acionamento } = await supabase
        .from('acionamentos_roubo_furto')
        .select('rastreador_id')
        .eq('id', acionamentoId)
        .single();

      // Atualizar acionamento
      const { error } = await supabase
        .from('acionamentos_roubo_furto')
        .update({
          status: 'encerrado',
          encerrado_em: new Date().toISOString(),
          encerrado_por: profile?.id,
          motivo_encerramento: motivo,
        })
        .eq('id', acionamentoId);

      if (error) throw error;

      // Voltar rastreador para modo normal
      if (acionamento?.rastreador_id) {
        await supabase
          .from('rastreadores')
          .update({
            modo_rastreamento: 'normal',
            modo_ativado_em: null,
            modo_ativado_por: null,
            acionamento_ativo_id: null,
          })
          .eq('id', acionamento.rastreador_id);
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['acionamentos'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores'] });
      
      toast({
        title: "Acionamento Encerrado",
        description: "O rastreamento intensivo foi desativado.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao Encerrar",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Status labels
export const ACIONAMENTO_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  solicitado: { label: 'Solicitado', color: 'bg-yellow-500' },
  autorizado: { label: 'Autorizado', color: 'bg-blue-500' },
  enviado: { label: 'Enviado', color: 'bg-purple-500' },
  confirmado: { label: 'Confirmado', color: 'bg-green-500' },
  erro: { label: 'Erro', color: 'bg-red-500' },
  cancelado: { label: 'Cancelado', color: 'bg-gray-500' },
  encerrado: { label: 'Encerrado', color: 'bg-slate-500' },
};

export const TIPO_ORIGEM_LABELS: Record<string, string> = {
  sinistro: 'Sinistro Comunicado',
  assistencia: 'Assistência 24h',
  diretoria: 'Autorização Diretoria',
  manual: 'Acionamento Manual',
};

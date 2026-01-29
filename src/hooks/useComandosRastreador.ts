import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface ComandoRastreador {
  id: string;
  rastreador_id: string | null;
  veiculo_id: string | null;
  plataforma: string;
  tipo_comando: 'bloquear' | 'desbloquear' | 'localizar_agora';
  origem: 'monitoramento' | 'sinistro' | 'assistencia' | 'diretoria';
  origem_id: string | null;
  solicitado_por: string | null;
  solicitado_por_nome: string | null;
  solicitado_em: string;
  autorizado_por: string | null;
  autorizado_por_nome: string | null;
  autorizado_em: string | null;
  status: 'pendente' | 'autorizado' | 'enviado' | 'confirmado' | 'erro' | 'cancelado';
  metodo_envio: 'api' | 'sms' | 'manual' | null;
  telefone_destino: string | null;
  comando_enviado: string | null;
  api_request: Record<string, unknown> | null;
  api_response: Record<string, unknown> | null;
  erro_mensagem: string | null;
  confirmado_em: string | null;
  observacoes: string | null;
  motivo: string;
  created_at: string;
  updated_at: string;
}

interface EnviarComandoParams {
  rastreador_id: string;
  tipo_comando: 'bloquear' | 'desbloquear' | 'localizar_agora';
  motivo: string;
  origem?: 'monitoramento' | 'sinistro' | 'assistencia' | 'diretoria';
  origem_id?: string;
}

interface EnviarComandoResponse {
  success: boolean;
  comando_id: string;
  status: string;
  metodo_envio: string;
  mensagem: string;
  requer_acao_manual: boolean;
  instrucoes?: Record<string, unknown>;
}

export function useEnviarComando() {
  const queryClient = useQueryClient();

  return useMutation<EnviarComandoResponse, Error, EnviarComandoParams>({
    mutationFn: async (params) => {
      const { data, error } = await supabase.functions.invoke<EnviarComandoResponse>(
        'enviar-comando-rastreador',
        { body: params }
      );

      if (error) {
        throw new Error(error.message || 'Erro ao enviar comando');
      }

      if (!data) {
        throw new Error('Resposta vazia do servidor');
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['comandos-rastreador'] });
      queryClient.invalidateQueries({ queryKey: ['rastreador-alertas'] });
      
      if (data.requer_acao_manual) {
        toast({
          title: 'Comando Registrado',
          description: data.mensagem,
          variant: 'default',
        });
      } else {
        toast({
          title: 'Comando Enviado',
          description: data.mensagem,
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Erro ao Enviar Comando',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useHistoricoComandos(rastreadorId?: string) {
  return useQuery({
    queryKey: ['comandos-rastreador', rastreadorId],
    queryFn: async () => {
      let query = supabase
        .from('rastreadores_comandos')
        .select('*')
        .order('created_at', { ascending: false });

      if (rastreadorId) {
        query = query.eq('rastreador_id', rastreadorId);
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;
      return data as ComandoRastreador[];
    },
    enabled: true,
  });
}

export function useHistoricoComandosVeiculo(veiculoId?: string) {
  return useQuery({
    queryKey: ['comandos-veiculo', veiculoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rastreadores_comandos')
        .select('*')
        .eq('veiculo_id', veiculoId!)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as ComandoRastreador[];
    },
    enabled: !!veiculoId,
  });
}

export function useAtualizarStatusComando() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      comandoId, 
      status, 
      observacoes 
    }: { 
      comandoId: string; 
      status: 'confirmado' | 'erro' | 'cancelado';
      observacoes?: string;
    }) => {
      const { error } = await supabase
        .from('rastreadores_comandos')
        .update({
          status,
          observacoes,
          ...(status === 'confirmado' ? { confirmado_em: new Date().toISOString() } : {}),
        })
        .eq('id', comandoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comandos-rastreador'] });
      queryClient.invalidateQueries({ queryKey: ['comandos-veiculo'] });
      toast({
        title: 'Status Atualizado',
        description: 'O status do comando foi atualizado com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export const STATUS_COMANDO_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  autorizado: 'Autorizado',
  enviado: 'Enviado',
  confirmado: 'Confirmado',
  erro: 'Erro',
  cancelado: 'Cancelado',
};

export const STATUS_COMANDO_COLORS: Record<string, string> = {
  pendente: 'bg-yellow-100 text-yellow-800',
  autorizado: 'bg-blue-100 text-blue-800',
  enviado: 'bg-purple-100 text-purple-800',
  confirmado: 'bg-green-100 text-green-800',
  erro: 'bg-red-100 text-red-800',
  cancelado: 'bg-gray-100 text-gray-800',
};

export const TIPO_COMANDO_LABELS: Record<string, string> = {
  bloquear: 'Bloquear Veículo',
  desbloquear: 'Desbloquear Veículo',
  localizar_agora: 'Localizar Agora',
};

export const ORIGEM_COMANDO_LABELS: Record<string, string> = {
  monitoramento: 'Monitoramento',
  sinistro: 'Sinistro',
  assistencia: 'Assistência 24h',
  diretoria: 'Diretoria',
};

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface NotificacoesPreferencias {
  id: string;
  usuario_id: string;
  tipo_usuario: 'associado' | 'colaborador';
  
  // Canais
  push_ativo: boolean;
  email_ativo: boolean;
  whatsapp_ativo: boolean;
  whatsapp_horario_inicio: string;
  whatsapp_horario_fim: string;
  
  // Categorias (Associado)
  notif_financeiro: boolean;
  notif_veiculo: boolean;
  notif_comunicados: boolean;
  
  // Colaborador
  email_resumo_diario: boolean;
  email_alertas_criticos: boolean;
  horario_resumo: string;
  som_notificacao: boolean;
  
  // Onboarding
  onboarding_completo: boolean;
  
  created_at: string;
  updated_at: string;
}

const DEFAULT_PREFERENCIAS_ASSOCIADO: Partial<NotificacoesPreferencias> = {
  tipo_usuario: 'associado',
  push_ativo: true,
  email_ativo: true,
  whatsapp_ativo: false,
  whatsapp_horario_inicio: '08:00',
  whatsapp_horario_fim: '20:00',
  notif_financeiro: true,
  notif_veiculo: true,
  notif_comunicados: true,
  email_resumo_diario: false,
  email_alertas_criticos: false,
  horario_resumo: '08:00',
  som_notificacao: false,
  onboarding_completo: false,
};

const DEFAULT_PREFERENCIAS_COLABORADOR: Partial<NotificacoesPreferencias> = {
  tipo_usuario: 'colaborador',
  push_ativo: false,
  email_ativo: true,
  whatsapp_ativo: false,
  whatsapp_horario_inicio: '08:00',
  whatsapp_horario_fim: '20:00',
  notif_financeiro: true,
  notif_veiculo: true,
  notif_comunicados: true,
  email_resumo_diario: true,
  email_alertas_criticos: true,
  horario_resumo: '08:00',
  som_notificacao: true,
  onboarding_completo: false,
};

export function useNotificacoesPreferencias() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  
  // Determinar tipo de usuário
  const tipoUsuario = profile?.tipo === 'associado' ? 'associado' : 'colaborador';

  const query = useQuery({
    queryKey: ['notificacoes-preferencias', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('notificacoes_preferencias')
        .select('*')
        .eq('usuario_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      // Se não existir, criar com defaults
      if (!data) {
        const defaults = tipoUsuario === 'associado' 
          ? DEFAULT_PREFERENCIAS_ASSOCIADO 
          : DEFAULT_PREFERENCIAS_COLABORADOR;

        const { data: newData, error: insertError } = await supabase
          .from('notificacoes_preferencias')
          .insert({
            usuario_id: user.id,
            ...defaults,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Erro ao criar preferências:', insertError);
          return {
            ...defaults,
            usuario_id: user.id,
          } as NotificacoesPreferencias;
        }

        return newData as NotificacoesPreferencias;
      }

      return data as NotificacoesPreferencias;
    },
    enabled: !!user,
  });

  return {
    ...query,
    tipoUsuario,
  };
}

export function useUpdateNotificacoesPreferencias() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<NotificacoesPreferencias>) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('notificacoes_preferencias')
        .update(updates)
        .eq('usuario_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['notificacoes-preferencias', user?.id] 
      });
    },
  });
}

export function useCompleteOnboarding() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('notificacoes_preferencias')
        .update({ onboarding_completo: true })
        .eq('usuario_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['notificacoes-preferencias', user?.id] 
      });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EmailTemplateVariavel {
  code: string;
  label: string;
}

export interface EmailSuspensaoTemplateItem {
  id: string;
  fluxo_key: string;
  nome: string;
  assunto: string;
  corpo: string;
  ativo: boolean;
  variaveis_disponiveis: EmailTemplateVariavel[];
  updated_at: string;
}

const KEY_LIST = ['email-suspensao', 'templates-list'] as const;

export function useEmailSuspensaoTemplatesList() {
  return useQuery({
    queryKey: KEY_LIST,
    queryFn: async (): Promise<EmailSuspensaoTemplateItem[]> => {
      const { data, error } = await supabase
        .from('email_suspensao_templates')
        .select('id, fluxo_key, nome, assunto, corpo, ativo, variaveis_disponiveis, updated_at')
        .order('nome', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        variaveis_disponiveis: Array.isArray(r.variaveis_disponiveis)
          ? r.variaveis_disponiveis
          : [],
      })) as EmailSuspensaoTemplateItem[];
    },
    staleTime: 30_000,
  });
}

export function useUpdateEmailSuspensaoTemplateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      assunto?: string;
      corpo?: string;
      ativo?: boolean;
    }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const patch: Record<string, unknown> = { updated_by: userRes?.user?.id ?? null };
      if (input.assunto !== undefined) patch.assunto = input.assunto;
      if (input.corpo !== undefined) patch.corpo = input.corpo;
      if (input.ativo !== undefined) patch.ativo = input.ativo;
      const { error } = await supabase
        .from('email_suspensao_templates')
        .update(patch)
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_LIST });
      toast.success('Template atualizado');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao atualizar template'),
  });
}

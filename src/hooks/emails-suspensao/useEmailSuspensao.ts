import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const KEY_CONFIG = ['email-suspensao', 'config'] as const;
const KEY_TEMPLATE = ['email-suspensao', 'template'] as const;
const KEY_ENVIOS = ['email-suspensao', 'envios'] as const;

export interface EmailSuspensaoConfig {
  id: string;
  enabled: boolean;
  updated_at: string;
}

export interface EmailSuspensaoTemplate {
  id: string;
  assunto: string;
  corpo: string;
  updated_at: string;
}

export type EmailEnvioStatus = 'pendente' | 'entregue' | 'falhou';

export interface EmailSuspensaoEnvio {
  id: string;
  cliente_nome: string | null;
  cliente_id: string | null;
  destinatario: string;
  fluxo_origem: string | null;
  assunto_enviado: string | null;
  corpo_renderizado: string | null;
  status: EmailEnvioStatus;
  erro_mensagem: string | null;
  enviado_em: string;
}

// ============ CONFIG ============
export function useEmailSuspensaoConfig() {
  return useQuery({
    queryKey: KEY_CONFIG,
    queryFn: async (): Promise<EmailSuspensaoConfig | null> => {
      const { data, error } = await supabase
        .from('email_suspensao_config')
        .select('id, enabled, updated_at')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });
}

export function useUpdateEmailSuspensaoConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('email_suspensao_config')
        .update({ enabled, updated_by: userRes?.user?.id ?? null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_CONFIG });
      toast.success('Configuração atualizada');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao atualizar configuração'),
  });
}

// ============ TEMPLATE ============
export function useEmailSuspensaoTemplate() {
  return useQuery({
    queryKey: KEY_TEMPLATE,
    queryFn: async (): Promise<EmailSuspensaoTemplate | null> => {
      const { data, error } = await supabase
        .from('email_suspensao_template')
        .select('id, assunto, corpo, updated_at')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });
}

export function useUpdateEmailSuspensaoTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, assunto, corpo }: { id: string; assunto: string; corpo: string }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('email_suspensao_template')
        .update({ assunto, corpo, updated_by: userRes?.user?.id ?? null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_TEMPLATE });
      toast.success('Template salvo');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao salvar template'),
  });
}

// ============ ENVIOS (histórico) ============
export interface EnviosFilters {
  search?: string;
  status?: EmailEnvioStatus | 'all';
  fluxo?: string | 'all';
  page?: number;
  pageSize?: number;
}

export function useEmailSuspensaoEnvios(filters: EnviosFilters = {}) {
  const { search = '', status = 'all', fluxo = 'all', page = 1, pageSize = 25 } = filters;
  return useQuery({
    queryKey: [...KEY_ENVIOS, { search, status, fluxo, page, pageSize }],
    queryFn: async () => {
      let q = supabase
        .from('email_suspensao_envios')
        .select('*', { count: 'exact' })
        .order('enviado_em', { ascending: false });

      if (status && status !== 'all') q = q.eq('status', status);
      if (fluxo && fluxo !== 'all') q = q.eq('fluxo_origem', fluxo);
      if (search) {
        const safe = search.replace(/[%,]/g, '');
        q = q.or(`cliente_nome.ilike.%${safe}%,destinatario.ilike.%${safe}%`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      q = q.range(from, to);

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as EmailSuspensaoEnvio[], total: count ?? 0 };
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useEmailSuspensaoFluxos() {
  return useQuery({
    queryKey: ['email-suspensao', 'fluxos-distintos'],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('email_suspensao_envios')
        .select('fluxo_origem')
        .not('fluxo_origem', 'is', null)
        .limit(1000);
      if (error) throw error;
      const set = new Set<string>();
      (data ?? []).forEach((r: any) => r.fluxo_origem && set.add(r.fluxo_origem));
      return Array.from(set).sort();
    },
    staleTime: 5 * 60_000,
  });
}

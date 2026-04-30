import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type ProviderName = 'openai' | 'anthropic' | 'mistral';

export interface AIKeysStatus {
  openai: boolean;
  anthropic: boolean;
  mistral: boolean;
}

async function callManager(action: 'status' | 'set' | 'remove', payload?: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('ai-secret-manager', {
    body: { action, ...payload },
  });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}

export function useAIProviderKeysStatus() {
  return useQuery({
    queryKey: ['ai-provider-keys-status'],
    queryFn: async (): Promise<AIKeysStatus> => {
      const data = await callManager('status');
      return (data as any).status as AIKeysStatus;
    },
  });
}

export function useSetAIProviderKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ provider, value }: { provider: ProviderName; value: string }) => {
      await callManager('set', { provider, value });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-provider-keys-status'] });
      toast.success('Chave de API salva com sucesso');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar chave'),
  });
}

export function useRemoveAIProviderKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (provider: ProviderName) => {
      await callManager('remove', { provider });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-provider-keys-status'] });
      toast.success('Chave removida');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao remover chave'),
  });
}

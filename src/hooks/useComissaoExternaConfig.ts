import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const COMISSAO_KEYS = [
  'comissao_ext_pct_adesao',
  'comissao_ext_msg_adesao_zero',
  'comissao_ext_valor_volante',
  'comissao_ext_tipo_recorrente',
  'comissao_ext_valor_recorrente',
  'comissao_ext_parcelas_recorrente',
] as const;

const DEFAULTS: Record<string, string> = {
  comissao_ext_pct_adesao: '100',
  comissao_ext_msg_adesao_zero: '',
  comissao_ext_valor_volante: '50',
  comissao_ext_tipo_recorrente: 'percentual',
  comissao_ext_valor_recorrente: '0',
  comissao_ext_parcelas_recorrente: '6',
};

export type ComissaoConfigMap = Record<string, string>;

export function useComissaoExternaConfig() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  const { data: configs, isLoading } = useQuery({
    queryKey: ['comissao-externa-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', [...COMISSAO_KEYS]);
      if (error) throw error;
      const map: ComissaoConfigMap = { ...DEFAULTS };
      data?.forEach(c => { if (c.valor !== null) map[c.chave] = c.valor; });
      return map;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (updates: { chave: string; valor: string }[]) => {
      for (const { chave, valor } of updates) {
        const oldValue = configs?.[chave] || DEFAULTS[chave] || '';

        // Try update first; if no rows matched, do insert
        const { data: updated, error: updateError } = await supabase
          .from('configuracoes')
          .update({ valor, updated_at: new Date().toISOString(), updated_by: profile?.id || null })
          .eq('chave', chave)
          .select('id');
        if (updateError) throw updateError;

        if (!updated || updated.length === 0) {
          const { error: insertError } = await supabase
            .from('configuracoes')
            .insert({ chave, valor, descricao: `Comissão externa: ${chave}` });
          if (insertError) throw insertError;
        }

        // History
        const session = (await supabase.auth.getSession()).data.session;
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/configuracoes_historico`,
          {
            method: 'POST',
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Authorization': `Bearer ${session?.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chave,
              valor_anterior: oldValue,
              valor_novo: valor,
              alterado_por: profile?.id,
            }),
          }
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comissao-externa-config'] });
      toast.success('Configuração salva com sucesso!');
    },
    onError: (err) => {
      toast.error('Erro ao salvar: ' + (err as Error).message);
    },
  });

  const getValue = (key: string): string => {
    return configs?.[key] ?? DEFAULTS[key] ?? '';
  };

  return {
    configs,
    isLoading,
    getValue,
    save: saveMutation.mutate,
    isSaving: saveMutation.isPending,
  };
}

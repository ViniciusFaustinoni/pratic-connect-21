import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useEventoLink(sinistroId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: linkAtivo, isLoading } = useQuery({
    queryKey: ['evento-link', sinistroId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sinistro_evento_links' as any)
        .select('*')
        .eq('sinistro_id', sinistroId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as any;
    },
    enabled: !!sinistroId,
  });

  const gerarNovoLink = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('gerar-link-evento', {
        body: { sinistro_id: sinistroId },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evento-link', sinistroId] });
      toast.success('Novo link gerado com sucesso!');
    },
    onError: (err: any) => {
      toast.error('Erro ao gerar link: ' + err.message);
    },
  });

  // Contato agendado
  const { data: contato } = useQuery({
    queryKey: ['evento-contato', sinistroId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sinistro_contatos_agendados' as any)
        .select('*')
        .eq('sinistro_id', sinistroId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as any;
    },
    enabled: !!sinistroId,
  });

  // Realtime subscription para atualizar automaticamente
  useEffect(() => {
    if (!sinistroId) return;

    const channel = supabase
      .channel(`evento-link-realtime-${sinistroId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sinistro_evento_links',
          filter: `sinistro_id=eq.${sinistroId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['evento-link', sinistroId] });
          queryClient.invalidateQueries({ queryKey: ['evento-contato', sinistroId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sinistroId, queryClient]);

  return {
    linkAtivo,
    isLoading,
    contato,
    gerarNovoLink,
  };
}

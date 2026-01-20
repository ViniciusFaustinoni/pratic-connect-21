import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

/**
 * Tipos de ações que podem ser registradas no histórico de cotações
 */
export type AcaoHistorico = 
  | 'criacao'
  | 'pdf_baixado' 
  | 'whatsapp_enviado'
  | 'email_enviado'
  | 'status_alterado'
  | 'duplicada'
  | 'editada'
  | 'visualizada_cliente'
  | 'plano_escolhido'
  | 'link_copiado';

export interface EventoHistorico {
  id: string;
  cotacao_id: string;
  acao: string;
  detalhes: Record<string, unknown> | null;
  autor_id: string | null;
  autor_nome: string | null;
  created_at: string;
}

/**
 * Hook para buscar histórico de uma cotação
 */
export function useHistoricoCotacao(cotacaoId?: string) {
  return useQuery({
    queryKey: ['cotacao-historico', cotacaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cotacoes_historico')
        .select('*')
        .eq('cotacao_id', cotacaoId!)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as EventoHistorico[];
    },
    enabled: !!cotacaoId,
  });
}

/**
 * Função para registrar um evento no histórico da cotação
 */
export async function registrarEventoCotacao({
  cotacaoId,
  acao,
  detalhes,
  autorId,
  autorNome,
}: {
  cotacaoId: string;
  acao: AcaoHistorico;
  detalhes?: Record<string, string | number | boolean | null>;
  autorId?: string;
  autorNome?: string;
}) {
  const { error } = await supabase
    .from('cotacoes_historico')
    .insert([{
      cotacao_id: cotacaoId,
      acao,
      detalhes: (detalhes as Json) || null,
      autor_id: autorId || null,
      autor_nome: autorNome || null,
    }]);
  
  if (error) {
    console.error('[Histórico] Erro ao registrar evento:', error);
  } else {
    console.log('[Histórico] Evento registrado:', acao);
  }
}

/**
 * Hook para invalidar cache do histórico
 */
export function useInvalidarHistorico() {
  const queryClient = useQueryClient();
  
  return (cotacaoId: string) => {
    queryClient.invalidateQueries({ queryKey: ['cotacao-historico', cotacaoId] });
  };
}

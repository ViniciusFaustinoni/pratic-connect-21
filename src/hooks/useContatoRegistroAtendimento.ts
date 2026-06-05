import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EventoImportante {
  id: string;
  tipo: string;
  descricao: string;
  ocorrido_em: string;
  criado_por: string;
}

function normalizarTelefone(t: string | null): string {
  return (t ?? '').replace(/\D/g, '');
}

/**
 * Lê (somente leitura) o resumo do atendimento + eventos importantes
 * vinculados ao telefone do contato. O preenchimento automático pela IA
 * é a próxima etapa — nesta fase, hook é só de exibição.
 */
export function useContatoRegistroAtendimento(telefone: string | null) {
  const telLimpo = normalizarTelefone(telefone);

  const resumoQuery = useQuery({
    queryKey: ['contato-resumo', telLimpo],
    enabled: !!telLimpo,
    queryFn: async () => {
      const variacoes = [telLimpo];
      if (telLimpo.startsWith('55')) variacoes.push(telLimpo.slice(2));
      else variacoes.push(`55${telLimpo}`);

      const { data, error } = await supabase
        .from('agente_ia_contatos')
        .select('resumo_atendimento, resumo_atualizado_em, telefone')
        .in('telefone', variacoes)
        .order('resumo_atualizado_em', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as { resumo_atendimento: string | null; resumo_atualizado_em: string | null } | null;
    },
  });

  const eventosQuery = useQuery({
    queryKey: ['contato-eventos-importantes', telLimpo],
    enabled: !!telLimpo,
    queryFn: async () => {
      const variacoes = [telLimpo];
      if (telLimpo.startsWith('55')) variacoes.push(telLimpo.slice(2));
      else variacoes.push(`55${telLimpo}`);

      const { data, error } = await supabase
        .from('contato_eventos_importantes')
        .select('id, tipo, descricao, ocorrido_em, criado_por')
        .in('telefone', variacoes)
        .order('ocorrido_em', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as EventoImportante[];
    },
  });

  return {
    resumo: resumoQuery.data?.resumo_atendimento ?? null,
    resumoAtualizadoEm: resumoQuery.data?.resumo_atualizado_em ?? null,
    eventos: eventosQuery.data ?? [],
    isLoading: resumoQuery.isLoading || eventosQuery.isLoading,
  };
}

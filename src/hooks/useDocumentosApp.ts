import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMyAssociado } from './useMyData';

/**
 * Hook para buscar o contrato ativo do associado
 */
export function useContratoAssociado() {
  const { data: associado } = useMyAssociado();
  
  return useQuery({
    queryKey: ['meu-contrato', associado?.id],
    queryFn: async () => {
      if (!associado?.id) return null;
      
      const { data, error } = await supabase
        .from('contratos')
        .select(`
          id,
          numero,
          status,
          valor_mensal,
          valor_adesao,
          data_inicio,
          data_fim,
          data_assinatura,
          pdf_url,
          pdf_assinado_url,
          dia_vencimento
        `)
        .eq('associado_id', associado.id)
        .eq('status', 'ativo')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!associado?.id,
  });
}

/**
 * Hook para buscar todos os contratos do associado (histórico)
 */
export function useMyContratos() {
  const { data: associado } = useMyAssociado();

  return useQuery({
    queryKey: ['my-contratos', associado?.id],
    queryFn: async () => {
      if (!associado?.id) return [];

      const { data, error } = await supabase
        .from('contratos')
        .select(`
          id,
          numero,
          status,
          pdf_url,
          pdf_assinado_url,
          data_inicio,
          data_assinatura,
          plano:planos(nome)
        `)
        .eq('associado_id', associado.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!associado?.id,
  });
}

/**
 * Hook para buscar dados do plano (para regulamento futuro)
 */
export function useRegulamentoPlano() {
  const { data: associado } = useMyAssociado();
  
  return useQuery({
    queryKey: ['regulamento-plano', associado?.plano_id],
    queryFn: async () => {
      if (!associado?.plano_id) return null;
      
      const { data, error } = await supabase
        .from('planos')
        .select('nome, descricao')
        .eq('id', associado.plano_id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!associado?.plano_id,
  });
}

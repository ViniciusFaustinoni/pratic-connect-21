import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AssociadoSearchResult {
  id: string;
  nome: string;
  telefone: string | null;
  cpf: string;
  status: string | null;
  /** Marcado quando o resultado veio do SGA (não da base local) */
  origem_sga?: boolean;
  /** codigo_associado SGA quando origem_sga=true */
  codigo_associado?: number;
}

/**
 * Busca associados — comportamento híbrido:
 *  - CPF completo (11 dígitos): consulta SGA primeiro; cai pro local se SGA não achar.
 *  - Nome/telefone parcial: usa busca local (SGA não suporta busca textual).
 *
 * Esse hook é usado para autocompletes (indicador, troca, migração).
 */
export function useAssociadoSearch(termo: string) {
  return useQuery({
    queryKey: ['associado-search', termo],
    queryFn: async (): Promise<AssociadoSearchResult[]> => {
      if (!termo || termo.length < 2) return [];

      const cleaned = termo.replace(/\D/g, '');

      // ── Caso 1: CPF completo → tenta SGA primeiro ───────────────────────────
      if (cleaned.length === 11) {
        try {
          const { data, error } = await supabase.functions.invoke(
            'sga-buscar-associado-completo',
            { body: { cpf: cleaned } },
          );
          if (!error && data?.encontrado && data?.codigo_associado) {
            return [{
              id: String(data.codigo_associado),
              nome: data.associado?.nome || '',
              telefone: data.associado?.telefone || null,
              cpf: data.associado?.cpf || cleaned,
              status: 'ativo',
              origem_sga: true,
              codigo_associado: data.codigo_associado,
            }];
          }
        } catch (e) {
          console.warn('[useAssociadoSearch] SGA falhou, fallback local:', e);
        }
      }

      // ── Caso 2: busca textual (nome/telefone parcial) ou fallback de CPF ────
      let query = supabase
        .from('associados')
        .select('id, nome, telefone, cpf, status')
        .in('status', ['ativo', 'inadimplente', 'suspenso']);

      if (cleaned.length >= 3) {
        query = query.or(`nome.ilike.%${termo}%,telefone.ilike.%${cleaned}%,cpf.ilike.%${cleaned}%`);
      } else {
        query = query.ilike('nome', `%${termo}%`);
      }

      const { data, error } = await query.limit(15).order('nome');
      if (error) throw error;
      return (data || []) as AssociadoSearchResult[];
    },
    enabled: termo.length >= 2,
  });
}

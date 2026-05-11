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
  /** codigo_associado SGA — vindo do mirror local (preferencial) ou do SGA */
  codigo_associado?: number;
  /** Mesmo valor de codigo_associado quando origem é local (campo associados.codigo_hinova) */
  codigo_hinova?: number | null;
}

/**
 * Busca associados — Local-First:
 *  - CPF completo (11 dígitos): consulta a base LOCAL primeiro (fonte de verdade
 *    do nosso sistema). Se não encontrar, faz fallback no SGA (Hinova).
 *  - Nome/telefone parcial: busca local (SGA não suporta busca textual).
 *
 * Esse hook é usado para autocompletes (indicador, troca, migração).
 * A inversão de prioridade evita loops e dependência da disponibilidade do SGA.
 */
export function useAssociadoSearch(termo: string) {
  return useQuery({
    queryKey: ['associado-search', termo],
    queryFn: async (): Promise<AssociadoSearchResult[]> => {
      if (!termo || termo.length < 2) return [];

      const cleaned = termo.replace(/\D/g, '');

      // ── Caso 1: CPF completo → tenta LOCAL primeiro ─────────────────────────
      if (cleaned.length === 11) {
        // Consulta local com e sem máscara (campo `cpf` pode vir em qualquer formato)
        const cpfFormatado = `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9, 11)}`;
        const { data: locais } = await supabase
          .from('associados')
          .select('id, nome, telefone, cpf, status, codigo_hinova')
          .or(`cpf.eq.${cleaned},cpf.eq.${cpfFormatado}`)
          .limit(5);

        if (locais && locais.length > 0) {
          return locais.map((a: any) => ({
            id: a.id,
            nome: a.nome,
            telefone: a.telefone,
            cpf: a.cpf,
            status: a.status,
            codigo_hinova: a.codigo_hinova ?? null,
            codigo_associado: a.codigo_hinova ?? undefined,
            origem_sga: false,
          }));
        }

        // Fallback: SGA (associado ainda não importado para a base local)
        try {
          const { data, error } = await supabase.functions.invoke(
            'sga-buscar-associado-completo',
            { body: { cpf: cleaned } },
          );
          if (!error && data?.encontrado && data?.codigo_associado) {
            return [{
              // SGA-only: ainda não há UUID local. Use string vazia como
              // sentinela — o consumidor deve resolver via
              // `resolverAssociadoLocalId` antes de gravar em colunas UUID.
              id: '',
              nome: data.associado?.nome || '',
              telefone: data.associado?.telefone || null,
              cpf: data.associado?.cpf || cleaned,
              status: 'ativo',
              origem_sga: true,
              codigo_associado: data.codigo_associado,
              codigo_hinova: data.codigo_associado,
            }];
          }
        } catch (e) {
          console.warn('[useAssociadoSearch] SGA fallback falhou:', e);
        }
        return [];
      }

      // ── Caso 2: busca textual (nome/telefone parcial) ───────────────────────
      let query = supabase
        .from('associados')
        .select('id, nome, telefone, cpf, status, codigo_hinova')
        .in('status', ['ativo', 'inadimplente', 'suspenso']);

      if (cleaned.length >= 3) {
        query = query.or(`nome.ilike.%${termo}%,telefone.ilike.%${cleaned}%,cpf.ilike.%${cleaned}%`);
      } else {
        query = query.ilike('nome', `%${termo}%`);
      }

      const { data, error } = await query.limit(15).order('nome');
      if (error) throw error;
      return (data || []).map((a: any) => ({
        id: a.id,
        nome: a.nome,
        telefone: a.telefone,
        cpf: a.cpf,
        status: a.status,
        codigo_hinova: a.codigo_hinova ?? null,
        codigo_associado: a.codigo_hinova ?? undefined,
      })) as AssociadoSearchResult[];
    },
    enabled: termo.length >= 2,
  });
}

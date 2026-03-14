import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AssociadoSearchResult {
  id: string;
  nome: string;
  telefone: string | null;
  cpf: string;
  status: string | null;
}

export function useAssociadoSearch(termo: string) {
  return useQuery({
    queryKey: ['associado-search', termo],
    queryFn: async (): Promise<AssociadoSearchResult[]> => {
      if (!termo || termo.length < 2) return [];

      const cleaned = termo.replace(/\D/g, '');
      
      // If looks like phone/cpf digits, search by those
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

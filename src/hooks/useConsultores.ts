import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Consultor {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export function useConsultores(apenasAtivos = true) {
  return useQuery({
    queryKey: ['consultores', apenasAtivos],
    queryFn: async () => {
      let query = supabase
        .from('consultores')
        .select('*')
        .order('nome');

      if (apenasAtivos) {
        query = query.eq('ativo', true);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Consultor[];
    },
  });
}

export function useConsultor(id: string | undefined) {
  return useQuery({
    queryKey: ['consultor', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('consultores')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Consultor;
    },
    enabled: !!id,
  });
}

// Contagem de leads por consultor
export function useConsultoresContagem() {
  return useQuery({
    queryKey: ['consultores-leads-contagem'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('consultor_id, etapa')
        .not('consultor_id', 'is', null);

      if (error) throw error;

      // Agrupar por consultor
      const contagem: Record<string, {
        total: number;
        novos: number;
        emContato: number;
        cotacao: number;
        proposta: number;
        ganhos: number;
        perdidos: number;
      }> = {};

      data?.forEach((lead) => {
        if (!lead.consultor_id) return;
        
        if (!contagem[lead.consultor_id]) {
          contagem[lead.consultor_id] = {
            total: 0,
            novos: 0,
            emContato: 0,
            cotacao: 0,
            proposta: 0,
            ganhos: 0,
            perdidos: 0,
          };
        }

        contagem[lead.consultor_id].total++;

        switch (lead.etapa) {
          case 'novo':
            contagem[lead.consultor_id].novos++;
            break;
          case 'contato':
          case 'qualificado':
            contagem[lead.consultor_id].emContato++;
            break;
          case 'cotacao_enviada':
          case 'negociacao':
            contagem[lead.consultor_id].cotacao++;
            break;
          case 'contrato_enviado':
          case 'contrato_assinado':
          case 'vistoria_agendada':
          case 'instalacao_agendada':
            contagem[lead.consultor_id].proposta++;
            break;
          case 'ganho':
            contagem[lead.consultor_id].ganhos++;
            break;
          case 'perdido':
            contagem[lead.consultor_id].perdidos++;
            break;
        }
      });

      return contagem;
    },
  });
}

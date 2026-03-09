import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'>;

export interface Vendedor extends Profile {
  roles?: string[];
}

export function useVendedores() {
  return useQuery({
    queryKey: ['vendedores'],
    queryFn: async () => {
      // Buscar profiles que têm roles de vendedor
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['vendedor_clt', 'vendedor_externo', 'supervisor_vendas', 'gerente_comercial', 'diretor', 'supervisor_comercial']);

      if (rolesError) throw rolesError;

      if (!roles || roles.length === 0) return [];

      // Pegar IDs únicos de usuários com roles de vendas
      const userIds = [...new Set(roles.map((r) => r.user_id))];

      // Buscar profiles desses usuários
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', userIds)
        .eq('ativo', true)
        .order('nome');

      if (profilesError) throw profilesError;

      // Associar roles aos profiles
      return (profiles || []).map((profile) => ({
        ...profile,
        roles: roles
          .filter((r) => r.user_id === profile.user_id)
          .map((r) => r.role),
      })) as Vendedor[];
    },
  });
}

export function useVendedor(id: string | undefined) {
  return useQuery({
    queryKey: ['vendedor', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', id)
        .maybeSingle();

      if (error) throw error;
      return data as Vendedor | null;
    },
    enabled: !!id,
  });
}

// Contagem de leads por vendedor
export function useVendedoresContagem() {
  return useQuery({
    queryKey: ['vendedores-leads-contagem'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('vendedor_id, etapa')
        .not('vendedor_id', 'is', null);

      if (error) throw error;

      // Agrupar por vendedor
      const contagem: Record<string, {
        total: number;
        novos: number;
        emContato: number;
        cotacao: number;
        negociacao: number;
        ganhos: number;
        perdidos: number;
      }> = {};

      data?.forEach((lead) => {
        if (!lead.vendedor_id) return;
        
        if (!contagem[lead.vendedor_id]) {
          contagem[lead.vendedor_id] = {
            total: 0,
            novos: 0,
            emContato: 0,
            cotacao: 0,
            negociacao: 0,
            ganhos: 0,
            perdidos: 0,
          };
        }

        contagem[lead.vendedor_id].total++;

        switch (lead.etapa) {
          case 'novo':
            contagem[lead.vendedor_id].novos++;
            break;
          case 'contato':
          case 'qualificado':
            contagem[lead.vendedor_id].emContato++;
            break;
          case 'cotacao_enviada':
            contagem[lead.vendedor_id].cotacao++;
            break;
          case 'negociacao':
          case 'contrato_enviado':
          case 'contrato_assinado':
          case 'vistoria_agendada':
          case 'instalacao_agendada':
            contagem[lead.vendedor_id].negociacao++;
            break;
          case 'ganho':
            contagem[lead.vendedor_id].ganhos++;
            break;
          case 'perdido':
            contagem[lead.vendedor_id].perdidos++;
            break;
        }
      });

      return contagem;
    },
  });
}

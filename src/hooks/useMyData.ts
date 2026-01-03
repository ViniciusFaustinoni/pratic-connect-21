import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/integrations/supabase/types';

type Associado = Tables<'associados'>;
type Veiculo = Tables<'veiculos'>;
type Sinistro = Tables<'sinistros'>;
type Chamado = Tables<'chamados_assistencia'>;
type Rastreador = Tables<'rastreadores'>;
type Documento = Tables<'documentos'>;

export interface AssociadoWithRelations extends Associado {
  planos?: {
    id: string;
    codigo: string;
    nome: string;
    descricao?: string | null;
    tipo_uso: string;
    valor_adesao: number;
  } | null;
  contratos?: {
    id: string;
    numero: string;
    status: string;
    valor_mensal: number;
    valor_adesao: number;
    data_inicio: string;
    dia_vencimento?: number | null;
  } | null;
}

export function useMyAssociado() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-associado', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('associados')
        .select(`
          *,
          planos (
            id,
            codigo,
            nome,
            descricao,
            tipo_uso,
            valor_adesao
          ),
          contratos (
            id,
            numero,
            status,
            valor_mensal,
            valor_adesao,
            data_inicio,
            dia_vencimento
          )
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as AssociadoWithRelations | null;
    },
    enabled: !!user?.id,
  });
}

export function useMyVehicles() {
  const { data: associado } = useMyAssociado();

  return useQuery({
    queryKey: ['my-vehicles', associado?.id],
    queryFn: async () => {
      if (!associado?.id) return [];

      const { data, error } = await supabase
        .from('veiculos')
        .select('*')
        .eq('associado_id', associado.id)
        .eq('ativo', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Veiculo[];
    },
    enabled: !!associado?.id,
  });
}

export function useMyVehicleWithTracker() {
  const { data: vehicles } = useMyVehicles();
  const vehicleId = vehicles?.[0]?.id;

  return useQuery({
    queryKey: ['my-vehicle-tracker', vehicleId],
    queryFn: async () => {
      if (!vehicleId) return null;

      const { data, error } = await supabase
        .from('rastreadores')
        .select('*')
        .eq('veiculo_id', vehicleId)
        .maybeSingle();

      if (error) throw error;
      return data as Rastreador | null;
    },
    enabled: !!vehicleId,
  });
}

export function useMyDocumentos() {
  const { data: associado } = useMyAssociado();

  return useQuery({
    queryKey: ['my-documentos', associado?.id],
    queryFn: async () => {
      if (!associado?.id) return [];

      const { data, error } = await supabase
        .from('documentos')
        .select('*')
        .eq('associado_id', associado.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Documento[];
    },
    enabled: !!associado?.id,
  });
}

export function useMySinistros() {
  const { data: associado } = useMyAssociado();

  return useQuery({
    queryKey: ['my-sinistros', associado?.id],
    queryFn: async () => {
      if (!associado?.id) return [];

      const { data, error } = await supabase
        .from('sinistros')
        .select('*')
        .eq('associado_id', associado.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Sinistro[];
    },
    enabled: !!associado?.id,
  });
}

export function useMyChamados() {
  const { data: associado } = useMyAssociado();

  return useQuery({
    queryKey: ['my-chamados', associado?.id],
    queryFn: async () => {
      if (!associado?.id) return [];

      const { data, error } = await supabase
        .from('chamados_assistencia')
        .select('*')
        .eq('associado_id', associado.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Chamado[];
    },
    enabled: !!associado?.id,
  });
}

export function useChamado(id: string | undefined) {
  return useQuery({
    queryKey: ['chamado', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('chamados_assistencia')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as Chamado | null;
    },
    enabled: !!id,
  });
}

export function useMyPendingDocuments() {
  const { data: associado } = useMyAssociado();

  return useQuery({
    queryKey: ['my-pending-docs', associado?.id],
    queryFn: async () => {
      if (!associado?.id) return [];

      const { data, error } = await supabase
        .from('documentos')
        .select('*')
        .eq('associado_id', associado.id)
        .in('status', ['pendente', 'reprovado'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Documento[];
    },
    enabled: !!associado?.id,
  });
}

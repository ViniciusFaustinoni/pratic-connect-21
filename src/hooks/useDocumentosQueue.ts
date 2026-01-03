import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, Database } from '@/integrations/supabase/types';
import type { StatusDocumento } from '@/types/database';

type Documento = Tables<'documentos'>;
type TipoDocumentoEnum = Database['public']['Enums']['tipo_documento'];

export interface DocumentoWithFullRelations extends Documento {
  associados?: {
    id: string;
    nome: string;
    cpf: string;
    telefone: string;
    email: string;
    status: string;
    cep?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    uf?: string | null;
  } | null;
  veiculos?: {
    id: string;
    placa: string;
    marca: string;
    modelo: string;
    ano_fabricacao: number;
    ano_modelo: number;
    cor?: string | null;
    renavam?: string | null;
    chassi?: string | null;
    status?: string | null;
  } | null;
}

interface UseDocumentosQueueOptions {
  status?: StatusDocumento | 'all';
  orderBy?: 'oldest' | 'newest';
  search?: string;
  tipo?: string;
}

export function useDocumentosQueue(options: UseDocumentosQueueOptions = {}) {
  const { status = 'all', orderBy = 'oldest', search = '', tipo = 'all' } = options;

  return useQuery({
    queryKey: ['documentos', 'queue', status, orderBy, search, tipo],
    queryFn: async () => {
      let query = supabase
        .from('documentos')
        .select(`
          *,
          associados (
            id,
            nome,
            cpf,
            telefone,
            email,
            status,
            cep,
            logradouro,
            numero,
            complemento,
            bairro,
            cidade,
            uf
          ),
          veiculos (
            id,
            placa,
            marca,
            modelo,
            ano_fabricacao,
            ano_modelo,
            cor,
            renavam,
            chassi,
            status
          )
        `);

      // Filter by status
      if (status !== 'all') {
        query = query.eq('status', status);
      }

      // Filter by tipo
      if (tipo !== 'all') {
        query = query.eq('tipo', tipo as TipoDocumentoEnum);
      }

      // Order by date
      query = query.order('created_at', { ascending: orderBy === 'oldest' });

      const { data, error } = await query;

      if (error) throw error;

      // Filter by search term (client-side for flexibility)
      let filtered = data as DocumentoWithFullRelations[];
      if (search.trim()) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter((doc) => {
          const associadoNome = doc.associados?.nome?.toLowerCase() || '';
          const placa = doc.veiculos?.placa?.toLowerCase() || '';
          return associadoNome.includes(searchLower) || placa.includes(searchLower);
        });
      }

      return filtered;
    },
  });
}

export function useDocumentosFull(documentoId: string | undefined) {
  return useQuery({
    queryKey: ['documentos', 'full', documentoId],
    queryFn: async () => {
      if (!documentoId) throw new Error('ID é obrigatório');

      const { data, error } = await supabase
        .from('documentos')
        .select(`
          *,
          associados (
            id,
            nome,
            cpf,
            telefone,
            email,
            status,
            cep,
            logradouro,
            numero,
            complemento,
            bairro,
            cidade,
            uf
          ),
          veiculos (
            id,
            placa,
            marca,
            modelo,
            ano_fabricacao,
            ano_modelo,
            cor,
            renavam,
            chassi,
            status
          )
        `)
        .eq('id', documentoId)
        .single();

      if (error) throw error;
      return data as DocumentoWithFullRelations;
    },
    enabled: !!documentoId,
  });
}

export function useDocumentosByAssociadoFull(associadoId: string | undefined) {
  return useQuery({
    queryKey: ['documentos', 'associado-full', associadoId],
    queryFn: async () => {
      if (!associadoId) return [];

      const { data, error } = await supabase
        .from('documentos')
        .select('*')
        .eq('associado_id', associadoId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Documento[];
    },
    enabled: !!associadoId,
  });
}

export function useDocumentosStats() {
  return useQuery({
    queryKey: ['documentos', 'stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documentos')
        .select('status, created_at');

      if (error) throw error;

      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const stats = {
        total: data?.length || 0,
        pendentes: data?.filter((d) => d.status === 'pendente').length || 0,
        emAnalise: data?.filter((d) => d.status === 'em_analise').length || 0,
        aprovados: data?.filter((d) => d.status === 'aprovado').length || 0,
        reprovados: data?.filter((d) => d.status === 'reprovado').length || 0,
        pendentesAntigos: data?.filter((d) => {
          if (d.status !== 'pendente') return false;
          const createdAt = new Date(d.created_at);
          return createdAt < twentyFourHoursAgo;
        }).length || 0,
      };

      return stats;
    },
  });
}

export function useUpdateDocumentoStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: 'em_analise';
    }) => {
      const { data, error } = await supabase
        .from('documentos')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentos'] });
    },
  });
}

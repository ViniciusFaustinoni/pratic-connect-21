import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { 
  DocumentoFilters, 
  DocumentoComRelacoes, 
  ContagemDocumentos,
  StatusDocumento,
} from '@/types/cadastro';

// ============================================
// TYPES
// ============================================
interface UseDocumentosParams {
  filters?: DocumentoFilters;
  pagination?: { page: number; pageSize: number };
  enabled?: boolean;
}

interface DocumentosResult {
  documentos: DocumentoComRelacoes[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// HOOK: LISTA COM FILTROS E PAGINAÇÃO
// ============================================
export function useDocumentos({ filters, pagination, enabled = true }: UseDocumentosParams = {}) {
  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 10;

  return useQuery({
    queryKey: ['documentos', filters, pagination],
    queryFn: async (): Promise<DocumentosResult> => {
      let query = supabase
        .from('documentos')
        .select(`
          *,
          associados (
            id, nome, cpf, telefone
          ),
          veiculos (
            id, placa, marca, modelo
          )
        `, { count: 'exact' });

      // Filtros
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.tipo) {
        query = query.eq('tipo', filters.tipo);
      }
      if (filters?.associado_id) {
        query = query.eq('associado_id', filters.associado_id);
      }
      if (filters?.veiculo_id) {
        query = query.eq('veiculo_id', filters.veiculo_id);
      }
      if (filters?.data_inicio) {
        query = query.gte('created_at', filters.data_inicio);
      }
      if (filters?.data_fim) {
        query = query.lte('created_at', filters.data_fim);
      }

      // Filtro de prioridade (pendentes há mais de 24h)
      if (filters?.prioridade === 'alta') {
        const ontem = new Date();
        ontem.setDate(ontem.getDate() - 1);
        query = query
          .eq('status', 'pendente')
          .lt('created_at', ontem.toISOString());
      }

      // Ordenação: pendentes primeiro, depois por data
      query = query
        .order('status', { ascending: true })
        .order('created_at', { ascending: true })
        .range((page - 1) * pageSize, page * pageSize - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      // Map associados/veiculos to associado/veiculo for consistency
      const documentos = (data || []).map((doc: any) => ({
        ...doc,
        associado: doc.associados,
        veiculo: doc.veiculos,
      })) as DocumentoComRelacoes[];

      return {
        documentos,
        pagination: {
          page,
          pageSize,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / pageSize),
        },
      };
    },
    enabled,
  });
}

// ============================================
// HOOK: DOCUMENTO INDIVIDUAL
// ============================================
export function useDocumento(id: string | undefined) {
  return useQuery({
    queryKey: ['documento', id],
    queryFn: async () => {
      if (!id) throw new Error('ID não informado');

      const { data, error } = await supabase
        .from('documentos')
        .select(`
          *,
          associados (
            id, nome, cpf, telefone, email
          ),
          veiculos (
            id, placa, marca, modelo, ano_modelo
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      
      return {
        ...data,
        associado: data.associados,
        veiculo: data.veiculos,
      } as DocumentoComRelacoes;
    },
    enabled: !!id,
  });
}

// ============================================
// HOOK: CONTAGEM POR STATUS
// ============================================
export function useDocumentosContagem(filters?: { hoje?: boolean }) {
  return useQuery({
    queryKey: ['documentos-contagem', filters],
    queryFn: async (): Promise<ContagemDocumentos> => {
      let query = supabase
        .from('documentos')
        .select('status, created_at');

      // Se filtrar por hoje
      if (filters?.hoje) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        query = query.gte('created_at', hoje.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      const contagem: ContagemDocumentos = {
        total: data?.length || 0,
        pendente: 0,
        em_analise: 0,
        aprovado: 0,
        reprovado: 0,
        expirado: 0,
      };

      (data || []).forEach((doc) => {
        const status = doc.status as StatusDocumento;
        if (status === 'pendente') contagem.pendente++;
        else if (status === 'em_analise') contagem.em_analise++;
        else if (status === 'aprovado') contagem.aprovado++;
        else if (status === 'reprovado') contagem.reprovado++;
        else if (status === 'expirado') contagem.expirado++;
      });

      return contagem;
    },
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });
}

// ============================================
// HOOK: DOCUMENTOS POR ASSOCIADO
// ============================================
export function useDocumentosPorAssociado(associadoId: string | undefined) {
  return useQuery({
    queryKey: ['documentos-associado', associadoId],
    queryFn: async () => {
      if (!associadoId) throw new Error('ID do associado não informado');

      const { data, error } = await supabase
        .from('documentos')
        .select(`
          *,
          veiculos (
            id, placa, marca, modelo
          )
        `)
        .eq('associado_id', associadoId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return (data || []).map((doc: any) => ({
        ...doc,
        veiculo: doc.veiculos,
      })) as DocumentoComRelacoes[];
    },
    enabled: !!associadoId,
  });
}

// ============================================
// HOOK: AÇÕES DE DOCUMENTO
// ============================================
export function useDocumentoActions() {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['documentos'] });
    queryClient.invalidateQueries({ queryKey: ['documentos-contagem'] });
    queryClient.invalidateQueries({ queryKey: ['documento'] });
    queryClient.invalidateQueries({ queryKey: ['documentos-associado'] });
    queryClient.invalidateQueries({ queryKey: ['proximo-documento'] });
  };

  // Iniciar análise
  const iniciarAnalise = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get profile ID for the analyst
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id || '')
        .maybeSingle();

      const { error } = await supabase
        .from('documentos')
        .update({
          status: 'em_analise',
          analista_id: profile?.id,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Análise iniciada');
    },
    onError: () => {
      toast.error('Erro ao iniciar análise');
    },
  });

  // Aprovar documento
  const aprovarDocumento = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get profile ID for the analyst
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id || '')
        .maybeSingle();

      const { error } = await supabase
        .from('documentos')
        .update({
          status: 'aprovado',
          analista_id: profile?.id,
          data_analise: new Date().toISOString(),
          motivo_reprovacao: null,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Documento aprovado!');
    },
    onError: () => {
      toast.error('Erro ao aprovar documento');
    },
  });

  // Reprovar documento
  const reprovarDocumento = useMutation({
    mutationFn: async ({ id, motivo, observacao }: { id: string; motivo: string; observacao?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get profile ID for the analyst
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id || '')
        .maybeSingle();

      const motivoCompleto = observacao 
        ? `${motivo}: ${observacao}` 
        : motivo;

      const { error } = await supabase
        .from('documentos')
        .update({
          status: 'reprovado',
          analista_id: profile?.id,
          data_analise: new Date().toISOString(),
          motivo_reprovacao: motivoCompleto,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Documento reprovado');
    },
    onError: () => {
      toast.error('Erro ao reprovar documento');
    },
  });

  // Reabrir análise (voltar para pendente)
  const reabrirAnalise = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('documentos')
        .update({
          status: 'pendente',
          analista_id: null,
          data_analise: null,
          motivo_reprovacao: null,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Documento reaberto para análise');
    },
    onError: () => {
      toast.error('Erro ao reabrir análise');
    },
  });

  return {
    iniciarAnalise: iniciarAnalise.mutate,
    aprovarDocumento: aprovarDocumento.mutate,
    reprovarDocumento: reprovarDocumento.mutate,
    reabrirAnalise: reabrirAnalise.mutate,
    isIniciandoAnalise: iniciarAnalise.isPending,
    isAprovando: aprovarDocumento.isPending,
    isReprovando: reprovarDocumento.isPending,
    isReabrindo: reabrirAnalise.isPending,
  };
}

// ============================================
// HOOK: PRÓXIMO DOCUMENTO DA FILA
// ============================================
export function useProximoDocumento() {
  return useQuery({
    queryKey: ['proximo-documento'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documentos')
        .select(`
          *,
          associados (
            id, nome, cpf, telefone
          ),
          veiculos (
            id, placa, marca, modelo
          )
        `)
        .eq('status', 'pendente')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) return null;
      
      return {
        ...data,
        associado: data.associados,
        veiculo: data.veiculos,
      } as DocumentoComRelacoes;
    },
  });
}

// ============================================
// LEGACY EXPORTS (para compatibilidade)
// ============================================
export { useDocumentosByAssociadoFull } from './useDocumentosQueue';
export { useDocumentosStats } from './useDocumentosQueue';

// ============================================
// HOOK: DOCUMENTOS PENDENTES (para Dashboard)
// ============================================
export function usePendingDocumentos() {
  return useQuery({
    queryKey: ['documentos', 'pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documentos')
        .select(`
          *,
          associados (
            nome,
            cpf
          )
        `)
        .in('status', ['pendente', 'em_analise'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
  });
}

// ============================================
// HOOK LEGADO: useAnaliseDocumento (compatibilidade)
// ============================================
export function useAnaliseDocumento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      motivo_reprovacao,
    }: {
      id: string;
      status: 'aprovado' | 'reprovado';
      motivo_reprovacao?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Get profile ID for the analyst
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id || '')
        .maybeSingle();

      const { data, error } = await supabase
        .from('documentos')
        .update({
          status,
          motivo_reprovacao: status === 'reprovado' ? motivo_reprovacao : null,
          analista_id: profile?.id,
          data_analise: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['documentos'] });
      queryClient.invalidateQueries({ queryKey: ['documentos-contagem'] });
      queryClient.invalidateQueries({ queryKey: ['documento', data.id] });
      queryClient.invalidateQueries({ queryKey: ['documentos-associado', data.associado_id] });
      queryClient.invalidateQueries({ queryKey: ['proximo-documento'] });
    },
  });
}

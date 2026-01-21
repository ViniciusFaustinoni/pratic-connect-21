import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

// Types
type Sinistro = Tables<'sinistros'>;
type SinistroInsert = TablesInsert<'sinistros'>;

export interface SinistroFilters {
  status?: string;
  tipo?: string;
  busca?: string;
  dataInicio?: string;
  dataFim?: string;
}

export interface SinistroWithRelations extends Sinistro {
  associado?: {
    id: string;
    nome: string;
    cpf: string;
    telefone: string;
  } | null;
  veiculo?: {
    id: string;
    placa: string;
    marca: string;
    modelo: string;
  } | null;
}

interface UpdateStatusParams {
  id: string;
  novoStatus: string;
  observacao?: string;
}

interface EmitirParecerParams {
  id: string;
  resultado: 'aprovado' | 'negado';
  parecer: string;
  valorAprovado?: number;
  statusAnterior?: string;
}

// Hook para listar sinistros com filtros
export function useSinistros(filters?: SinistroFilters) {
  return useQuery({
    queryKey: ['sinistros', filters],
    queryFn: async () => {
      let query = supabase
        .from('sinistros')
        .select(`
          *,
          associado:associados(id, nome, cpf, telefone),
          veiculo:veiculos(id, placa, marca, modelo)
        `)
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status !== 'todos') {
        query = query.eq('status', filters.status as any);
      }
      if (filters?.tipo && filters.tipo !== 'todos') {
        query = query.eq('tipo', filters.tipo as any);
      }
      if (filters?.busca) {
        query = query.or(`protocolo.ilike.%${filters.busca}%`);
      }
      if (filters?.dataInicio) {
        query = query.gte('created_at', filters.dataInicio);
      }
      if (filters?.dataFim) {
        query = query.lte('created_at', filters.dataFim);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SinistroWithRelations[];
    }
  });
}

// Hook para buscar sinistro por ID
export function useSinistro(id: string | undefined) {
  return useQuery({
    queryKey: ['sinistro', id],
    queryFn: async () => {
      if (!id) throw new Error('ID obrigatório');
      
      const { data, error } = await supabase
        .from('sinistros')
        .select(`
          *,
          associado:associados(*),
          veiculo:veiculos(*)
        `)
        .eq('id', id)
        .single();
        
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });
}

// Interface para criar sinistro via edge function
export interface CriarSinistroPayload {
  veiculo_id: string;
  tipo_sinistro: string;
  data_evento: string;
  hora_evento?: string;
  endereco_evento?: string;
  cidade_evento?: string;
  estado_evento?: string;
  latitude?: number;
  longitude?: number;
  descricao: string;
  numero_bo?: string;
  delegacia_bo?: string;
  fotos?: string[];
  envolveu_terceiros?: boolean;
}

export interface CriarSinistroResponse {
  success: boolean;
  sinistro_id?: string;
  numero_sinistro?: string;
  status?: string;
  documentos_pendentes?: Array<{
    tipo: string;
    nome: string;
    obrigatorio: boolean;
  }>;
  analista_responsavel?: { id: string; nome: string } | null;
  mensagem_confirmacao?: string;
  veiculo?: {
    placa: string;
    modelo: string;
  };
  data_criacao?: string;
  error?: string;
  sinistro_existente?: {
    id: string;
    protocolo: string;
    status: string;
  };
}

// Hook para criar sinistro via edge function
export function useCreateSinistro() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CriarSinistroPayload): Promise<CriarSinistroResponse> => {
      const { data, error } = await supabase.functions.invoke<CriarSinistroResponse>('criar-sinistro', {
        body: payload
      });

      if (error) throw error;
      
      if (!data?.success) {
        // Se já existe sinistro aberto, retornar erro específico
        if (data?.sinistro_existente) {
          throw new Error(`Já existe um sinistro aberto: ${data.sinistro_existente.protocolo}`);
        }
        throw new Error(data?.error || 'Erro ao criar sinistro');
      }

      return data;
    },
    onSuccess: (data) => {
      toast.success(data.mensagem_confirmacao || 'Sinistro registrado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['sinistros'] });
      queryClient.invalidateQueries({ queryKey: ['meus-sinistros'] });
    },
    onError: (error) => {
      console.error('Erro ao criar sinistro:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao registrar sinistro');
    }
  });
}

// Hook para atualizar status do sinistro
export function useUpdateSinistroStatus() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, novoStatus, observacao }: UpdateStatusParams) => {
      // Buscar status atual
      const { data: sinistroAtual } = await supabase
        .from('sinistros')
        .select('status')
        .eq('id', id)
        .single();

      // Atualizar status
      const { error } = await supabase
        .from('sinistros')
        .update({ 
          status: novoStatus as any,
          updated_at: new Date().toISOString() 
        })
        .eq('id', id);

      if (error) throw error;

      // Registrar no histórico
      await supabase.from('sinistro_historico').insert({
        sinistro_id: id,
        status_anterior: sinistroAtual?.status,
        status_novo: novoStatus,
        usuario_id: user?.id,
        observacao
      });
    },
    onSuccess: (_, variables) => {
      toast.success('Status atualizado!');
      queryClient.invalidateQueries({ queryKey: ['sinistros'] });
      queryClient.invalidateQueries({ queryKey: ['sinistro', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['sinistro-historico'] });
    },
    onError: (error) => {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    }
  });
}

// Hook para emitir parecer
export function useEmitirParecer() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      id, 
      resultado, 
      parecer, 
      valorAprovado,
      statusAnterior
    }: EmitirParecerParams) => {
      const novoStatus = resultado === 'aprovado' ? 'aprovado' : 'negado';
      
      // Atualizar sinistro
      const { error } = await supabase
        .from('sinistros')
        .update({
          status: novoStatus as any,
          parecer,
          data_parecer: new Date().toISOString(),
          analista_id: profile?.id,
          valor_indenizacao: resultado === 'aprovado' ? valorAprovado : null
        })
        .eq('id', id);

      if (error) throw error;

      // Registrar histórico
      await supabase.from('sinistro_historico').insert({
        sinistro_id: id,
        status_anterior: statusAnterior,
        status_novo: novoStatus,
        usuario_id: user?.id,
        observacao: `Parecer emitido: ${novoStatus.toUpperCase()}`
      });
    },
    onSuccess: (_, variables) => {
      toast.success('Parecer registrado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['sinistros'] });
      queryClient.invalidateQueries({ queryKey: ['sinistro', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['sinistro-historico'] });
    },
    onError: (error) => {
      console.error('Erro ao emitir parecer:', error);
      toast.error('Erro ao registrar parecer');
    }
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type VistoriaStatus = 'pendente' | 'agendada' | 'em_analise' | 'aprovada' | 'reprovada';

export interface VistoriaFoto {
  id: string;
  vistoria_id: string;
  tipo: string;
  arquivo_url: string;
  created_at: string;
}

export interface Vistoria {
  id: string;
  associado_id: string;
  veiculo_id: string | null;
  vistoriador_id: string | null;
  tipo: string;
  status: VistoriaStatus;
  km_atual: number | null;
  avarias: string | null;
  observacoes: string | null;
  data_agendada: string | null;
  created_at: string;
  updated_at: string;
  veiculo?: {
    id: string;
    placa: string;
    marca: string | null;
    modelo: string | null;
    associado?: {
      id: string;
      nome: string;
      telefone: string;
    };
  } | null;
  vistoriador?: {
    id: string;
    nome: string;
  };
  fotos?: VistoriaFoto[];
}

export interface VistoriaFilters {
  status?: VistoriaStatus | 'todos';
  search?: string;
}

export function useVistorias(filters: VistoriaFilters = {}) {
  return useQuery({
    queryKey: ['vistorias', filters],
    queryFn: async () => {
      let query = supabase
        .from('vistorias')
        .select(`
          *,
          veiculo:veiculos(id, placa, marca, modelo, associado:associados(id, nome, telefone)),
          vistoriador:profiles!vistorias_vistoriador_id_fkey(id, nome)
        `)
        .eq('tipo', 'entrada')
        .order('created_at', { ascending: false });

      if (filters.status && filters.status !== 'todos') {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filtrar por busca se necessário
      let result = data || [];
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        result = result.filter((v: any) => 
          v.veiculo?.placa?.toLowerCase().includes(searchLower) ||
          v.veiculo?.associado?.nome?.toLowerCase().includes(searchLower)
        );
      }

      return result as Vistoria[];
    },
  });
}

export function useVistoria(id: string | null) {
  return useQuery({
    queryKey: ['vistoria', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('vistorias')
        .select(`
          *,
          veiculo:veiculos(id, placa, marca, modelo, associado:associados(id, nome, telefone)),
          vistoriador:profiles!vistorias_vistoriador_id_fkey(id, nome),
          fotos:vistoria_fotos(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Vistoria;
    },
    enabled: !!id,
  });
}

export function useCriarVistoria() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { veiculo_id: string; associado_id: string; tipo_veiculo: 'automovel' | 'moto' }) => {
      const { data: result, error } = await supabase
        .from('vistorias')
        .insert({
          veiculo_id: data.veiculo_id,
          associado_id: data.associado_id,
          tipo: 'entrada',
          status: 'em_analise',
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vistorias'] });
    },
    onError: (error) => {
      console.error('Erro ao criar vistoria:', error);
      toast.error('Erro ao criar vistoria');
    },
  });
}

export function useUploadVistoriaFoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { vistoria_id: string; tipo: string; file: File }) => {
      const fileExt = data.file.name.split('.').pop();
      const fileName = `${data.vistoria_id}/${data.tipo}_${Date.now()}.${fileExt}`;

      // Upload para o storage
      const { error: uploadError } = await supabase.storage
        .from('vistoria-fotos')
        .upload(fileName, data.file);

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: publicUrl } = supabase.storage
        .from('vistoria-fotos')
        .getPublicUrl(fileName);

      // Inserir registro na tabela
      const { data: result, error } = await supabase
        .from('vistoria_fotos')
        .insert({
          vistoria_id: data.vistoria_id,
          tipo: data.tipo,
          arquivo_url: publicUrl.publicUrl,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vistoria', variables.vistoria_id] });
    },
    onError: (error) => {
      console.error('Erro ao fazer upload:', error);
      toast.error('Erro ao enviar foto');
    },
  });
}

export function useFinalizarVistoria() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; observacoes?: string; km_atual?: number }) => {
      const { error } = await supabase
        .from('vistorias')
        .update({
          status: 'aprovada',
          observacoes: data.observacoes,
          km_atual: data.km_atual,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vistorias'] });
      toast.success('Vistoria finalizada com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao finalizar vistoria:', error);
      toast.error('Erro ao finalizar vistoria');
    },
  });
}

export function useSalvarRascunhoVistoria() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; observacoes?: string; km_atual?: number }) => {
      const { error } = await supabase
        .from('vistorias')
        .update({
          observacoes: data.observacoes,
          km_atual: data.km_atual,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vistorias'] });
      toast.success('Rascunho salvo!');
    },
    onError: (error) => {
      console.error('Erro ao salvar rascunho:', error);
      toast.error('Erro ao salvar rascunho');
    },
  });
}

export function useVistoriasMetricas() {
  return useQuery({
    queryKey: ['vistorias-metricas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vistorias')
        .select('status')
        .eq('tipo', 'entrada');

      if (error) throw error;

      const metricas = {
        pendentes: 0,
        em_andamento: 0,
        concluidas: 0,
        reprovadas: 0,
      };

      (data || []).forEach((v) => {
        switch (v.status) {
          case 'pendente':
          case 'agendada':
            metricas.pendentes++;
            break;
          case 'em_analise':
            metricas.em_andamento++;
            break;
          case 'aprovada':
            metricas.concluidas++;
            break;
          case 'reprovada':
            metricas.reprovadas++;
            break;
        }
      });

      return metricas;
    },
  });
}

export function useBuscarVeiculos(search: string) {
  return useQuery({
    queryKey: ['veiculos-busca', search],
    queryFn: async () => {
      if (!search || search.length < 2) return [];

      const { data, error } = await supabase
        .from('veiculos')
        .select(`
          id, placa, marca, modelo,
          associado:associados(id, nome, telefone)
        `)
        .or(`placa.ilike.%${search}%`)
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: search.length >= 2,
  });
}

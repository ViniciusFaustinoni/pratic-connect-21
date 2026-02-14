import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProcessoFilters {
  status?: string;
  tipo?: string;
  fase?: string;
  advogado_id?: string;
  associado_id?: string;
  origem?: string;
}

export function useProcessos(filters?: ProcessoFilters) {
  const queryClient = useQueryClient();

  const { data: processos = [], isLoading } = useQuery({
    queryKey: ['processos', filters],
    queryFn: async () => {
      let query = supabase
        .from('processos')
        .select(`
          *,
          advogado:advogados(*),
          associado:associados(id, nome, cpf),
          sinistro:sinistros(id, protocolo),
          responsavel:profiles!processos_responsavel_id_fkey(id, nome)
        `)
        .order('created_at', { ascending: false });

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.tipo) query = query.eq('tipo', filters.tipo);
      if (filters?.fase) query = query.eq('fase', filters.fase);
      if (filters?.advogado_id) query = query.eq('advogado_id', filters.advogado_id);
      if (filters?.associado_id) query = query.eq('associado_id', filters.associado_id);
      if (filters?.origem) query = query.eq('origem', filters.origem);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { mutateAsync: criarProcesso, isPending: isCriando } = useMutation({
    mutationFn: async (processo: {
      tipo: string;
      natureza: string;
      parte_contraria_nome: string;
      objeto: string;
      rito?: string;
      advogado_id?: string;
      associado_id?: string;
      sinistro_id?: string;
      tribunal?: string;
      comarca?: string;
      vara?: string;
      valor_causa?: number;
      data_distribuicao?: string;
      responsavel_id?: string;
    }) => {
      const { data, error } = await supabase
        .from('processos')
        .insert([processo])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processos'] });
      toast.success('Processo cadastrado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao cadastrar processo: ' + error.message);
    },
  });

  const { mutateAsync: atualizarProcesso, isPending: isAtualizando } = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: unknown }) => {
      const { error } = await supabase
        .from('processos')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processos'] });
      toast.success('Processo atualizado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar processo: ' + error.message);
    },
  });

  return {
    processos,
    isLoading,
    criarProcesso,
    atualizarProcesso,
    isCriando,
    isAtualizando,
  };
}

export function useProcesso(id?: string) {
  const queryClient = useQueryClient();

  const { data: processo, isLoading } = useQuery({
    queryKey: ['processos', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('processos')
        .select(`
          *,
          advogado:advogados(*),
          associado:associados(id, nome, cpf),
          sinistro:sinistros(id, protocolo),
          responsavel:profiles!processos_responsavel_id_fkey(id, nome)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Andamentos
  const { data: andamentos = [] } = useQuery({
    queryKey: ['processos', id, 'andamentos'],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('processos_andamentos')
        .select('*, usuario:profiles!processos_andamentos_registrado_por_fkey(id, nome)')
        .eq('processo_id', id)
        .order('data', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Audiências
  const { data: audiencias = [] } = useQuery({
    queryKey: ['processos', id, 'audiencias'],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('processos_audiencias')
        .select('*')
        .eq('processo_id', id)
        .order('data_hora', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Documentos
  const { data: documentos = [] } = useQuery({
    queryKey: ['processos', id, 'documentos'],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('processos_documentos')
        .select('*')
        .eq('processo_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Custas
  const { data: custas = [] } = useQuery({
    queryKey: ['processos', id, 'custas'],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('processos_custas')
        .select('*')
        .eq('processo_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Mutations
  const { mutateAsync: adicionarAndamento } = useMutation({
    mutationFn: async (andamento: {
      data: string;
      descricao: string;
      tipo?: string;
      gera_prazo?: boolean;
      prazo_dias?: number;
      prazo_data?: string;
      prazo_descricao?: string;
      registrado_por?: string;
    }) => {
      const { data, error } = await supabase
        .from('processos_andamentos')
        .insert([{ ...andamento, processo_id: id }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processos', id, 'andamentos'] });
      toast.success('Andamento registrado!');
    },
    onError: (error) => {
      toast.error('Erro ao registrar andamento: ' + error.message);
    },
  });

  const { mutateAsync: agendarAudiencia } = useMutation({
    mutationFn: async (audiencia: {
      tipo: string;
      data_hora: string;
      local?: string;
      link_videoconferencia?: string;
      pauta?: string;
    }) => {
      const { data, error } = await supabase
        .from('processos_audiencias')
        .insert([{ ...audiencia, processo_id: id }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processos', id, 'audiencias'] });
      toast.success('Audiência agendada!');
    },
    onError: (error) => {
      toast.error('Erro ao agendar audiência: ' + error.message);
    },
  });

  const { mutateAsync: adicionarDocumento } = useMutation({
    mutationFn: async (documento: {
      tipo: string;
      nome: string;
      descricao?: string;
      arquivo_url?: string;
      arquivo_tamanho?: number;
      enviado_por?: string;
    }) => {
      const { data, error } = await supabase
        .from('processos_documentos')
        .insert([{ ...documento, processo_id: id }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processos', id, 'documentos'] });
      toast.success('Documento adicionado!');
    },
    onError: (error) => {
      toast.error('Erro ao adicionar documento: ' + error.message);
    },
  });

  const { mutateAsync: adicionarCusta } = useMutation({
    mutationFn: async (custa: {
      tipo: string;
      descricao: string;
      valor: number;
      data_vencimento?: string;
    }) => {
      const { data, error } = await supabase
        .from('processos_custas')
        .insert([{ ...custa, processo_id: id }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processos', id, 'custas'] });
      toast.success('Custa registrada!');
    },
    onError: (error) => {
      toast.error('Erro ao registrar custa: ' + error.message);
    },
  });

  return {
    processo,
    andamentos,
    audiencias,
    documentos,
    custas,
    isLoading,
    adicionarAndamento,
    agendarAudiencia,
    adicionarDocumento,
    adicionarCusta,
  };
}

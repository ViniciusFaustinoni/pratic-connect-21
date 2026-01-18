import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
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
  contrato_id?: string | null;
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
  associado?: {
    id: string;
    nome: string;
    telefone: string;
    veiculos?: {
      id: string;
      placa: string;
      marca: string | null;
      modelo: string | null;
    }[];
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
          associado:associados!vistorias_associado_id_fkey(id, nome, telefone, veiculos(id, placa, marca, modelo)),
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
          v.veiculo?.associado?.nome?.toLowerCase().includes(searchLower) ||
          v.associado?.nome?.toLowerCase().includes(searchLower) ||
          v.associado?.veiculos?.[0]?.placa?.toLowerCase().includes(searchLower)
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

// Criar vistoria avulsa (sem veículo vinculado)
export function useCriarVistoriaAvulsa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { tipo_veiculo: 'automovel' | 'moto' }) => {
      // Buscar o profile do usuário atual para usar como vistoriador
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user.id) {
        throw new Error('Usuário não autenticado');
      }

      // Buscar um associado temporário (o primeiro disponível) para criar a vistoria avulsa
      // Será atualizado quando vincular a um contrato
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', session.session.user.id)
        .single();

      // Usar o próprio profile_id como associado_id temporário (vistoria avulsa)
      // veiculo_id é null para vistoria avulsa
      const { data: result, error } = await supabase
        .from('vistorias')
        .insert([{
          associado_id: profileData?.id || session.session.user.id,
          vistoriador_id: profileData?.id || null,
          veiculo_id: null as unknown as string, // Cast necessário até tipos serem atualizados
          tipo: 'entrada',
          status: 'em_analise' as const,
        }])
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

// Finalizar vistoria com decisão (aceito/não aceito) e vínculo opcional
export function useFinalizarVistoriaComDecisao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      aceito: boolean;
      contrato_id?: string | null;
      km_atual?: number;
      observacoes?: string;
    }) => {
      const status: VistoriaStatus = data.aceito ? 'aprovada' : 'reprovada';
      
      // Se aceito e tem contrato_id, buscar o associado_id do contrato
      let associadoId: string | undefined;
      if (data.aceito && data.contrato_id) {
        const { data: contrato, error: contratoError } = await supabase
          .from('contratos')
          .select('associado_id')
          .eq('id', data.contrato_id)
          .single();
        
        if (contratoError) throw contratoError;
        associadoId = contrato.associado_id || undefined;
      }

      // Atualizar a vistoria
      const updateData: Record<string, any> = {
        status,
        observacoes: data.observacoes,
        km_atual: data.km_atual,
        updated_at: new Date().toISOString(),
      };

      // Se tem associado do contrato, vincular
      if (associadoId) {
        updateData.associado_id = associadoId;
      }

      const { error } = await supabase
        .from('vistorias')
        .update(updateData)
        .eq('id', data.id);

      if (error) throw error;

      return { status, contrato_id: data.contrato_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['vistorias'] });
      queryClient.invalidateQueries({ queryKey: ['ativacoes'] });
      queryClient.invalidateQueries({ queryKey: ['contratos-pendentes-vinculo'] });
      
      if (result.status === 'aprovada') {
        if (result.contrato_id) {
          toast.success('Vistoria aprovada e vinculada ao contrato!');
        } else {
          toast.success('Vistoria aprovada! Você pode vincular a um contrato depois.');
        }
      } else {
        toast.success('Vistoria finalizada como não aceita.');
      }
    },
    onError: (error) => {
      console.error('Erro ao finalizar vistoria:', error);
      toast.error('Erro ao finalizar vistoria');
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

// Buscar contratos pendentes para vincular vistoria
export interface ContratoPendenteVinculo {
  id: string;
  numero: string;
  lead_nome: string | null;
  veiculo_placa: string | null;
  veiculo_marca: string | null;
  veiculo_modelo: string | null;
  associado_id: string | null;
}

export function useContratosPendentesVinculo() {
  return useQuery({
    queryKey: ['contratos-pendentes-vinculo'],
    queryFn: async (): Promise<ContratoPendenteVinculo[]> => {
      // Buscar contratos que não estão ativos e não têm vistoria aprovada
      const { data: contratos, error } = await supabase
        .from('contratos')
        .select('id, numero, lead_id, associado_id')
        .in('status', ['assinado', 'pendente', 'pendente_assinatura', 'enviado'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      const leadIds = (contratos || []).map(c => c.lead_id).filter(Boolean) as string[];
      const associadoIds = (contratos || []).map(c => c.associado_id).filter(Boolean) as string[];

      // Buscar leads e verificar vistorias existentes
      const [leadsRes, vistoriasRes] = await Promise.all([
        leadIds.length > 0
          ? supabase.from('leads').select('id, nome, veiculo_placa, veiculo_marca, veiculo_modelo').in('id', leadIds)
          : { data: [] },
        associadoIds.length > 0
          ? supabase.from('vistorias').select('associado_id, status').in('associado_id', associadoIds).eq('tipo', 'entrada').eq('status', 'aprovada')
          : { data: [] },
      ]);

      const leadsMap = new Map((leadsRes.data || []).map(l => [l.id, l]));
      const vistoriasAprovadas = new Set((vistoriasRes.data || []).map(v => v.associado_id));

      // Filtrar contratos que já têm vistoria aprovada
      const contratosSemVistoria = (contratos || []).filter(c => 
        !c.associado_id || !vistoriasAprovadas.has(c.associado_id)
      );

      return contratosSemVistoria.map(contrato => {
        const lead = contrato.lead_id ? leadsMap.get(contrato.lead_id) : null;
        return {
          id: contrato.id,
          numero: contrato.numero,
          lead_nome: lead?.nome || null,
          veiculo_placa: lead?.veiculo_placa || null,
          veiculo_marca: lead?.veiculo_marca || null,
          veiculo_modelo: lead?.veiculo_modelo || null,
          associado_id: contrato.associado_id,
        };
    });
  },
});
}

// Hook para buscar vistorias disponíveis para atribuição em rotas
export function useVistoriasDisponiveis(data?: Date) {
  return useQuery({
    queryKey: ['vistorias-disponiveis', data ? format(data, 'yyyy-MM-dd') : 'todas'],
    queryFn: async () => {
      let query = supabase
        .from('vistorias')
        .select(`
          *,
          associado:associados!vistorias_associado_id_fkey(id, nome, telefone),
          veiculo:veiculos(id, marca, modelo, placa)
        `)
        .is('vistoriador_id', null)
        .eq('status', 'agendada')
        .order('data_agendada');

      if (data) {
        query = query.eq('data_agendada', format(data, 'yyyy-MM-dd'));
      }

      const { data: vistorias, error } = await query;
      if (error) throw error;
      return vistorias || [];
    },
    enabled: !!data,
  });
}

// Hook para buscar vistoria completa com dados do veículo expandidos
export function useVistoriaCompleta(id: string | null) {
  return useQuery({
    queryKey: ['vistoria-completa', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('vistorias')
        .select(`
          *,
          veiculo:veiculos(
            id, placa, chassi, marca, modelo, 
            ano_fabricacao, ano_modelo, cor,
            associado:associados(id, nome, cpf, telefone)
          ),
          associado:associados!vistorias_associado_id_fkey(id, nome, cpf, telefone),
          vistoriador:profiles!vistorias_vistoriador_id_fkey(id, nome),
          fotos:vistoria_fotos(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Vistoria & {
        veiculo: {
          id: string;
          placa: string;
          chassi: string | null;
          marca: string | null;
          modelo: string | null;
          ano_fabricacao: number | null;
          ano_modelo: number | null;
          cor: string | null;
          associado: { id: string; nome: string; cpf: string; telefone: string } | null;
        } | null;
      };
    },
    enabled: !!id,
  });
}

// Hook para executar e finalizar vistoria
export function useExecutarVistoria() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      km_atual: number;
      avarias: string;
      observacoes: string;
      status: 'em_analise' | 'aprovada' | 'reprovada';
    }) => {
      const { error } = await supabase
        .from('vistorias')
        .update({
          km_atual: data.km_atual,
          avarias: data.avarias,
          observacoes: data.observacoes,
          status: data.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vistorias'] });
      queryClient.invalidateQueries({ queryKey: ['vistoria'] });
      queryClient.invalidateQueries({ queryKey: ['vistoria-completa'] });
      toast.success('Vistoria finalizada com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao executar vistoria:', error);
      toast.error('Erro ao executar vistoria');
    },
  });
}

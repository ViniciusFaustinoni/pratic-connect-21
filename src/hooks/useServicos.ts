import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useRef, useEffect } from 'react';

// ============================================
// TIPOS PARA TABELA UNIFICADA SERVICOS
// ============================================

export type TipoServico = 
  | 'instalacao' 
  | 'vistoria_entrada' 
  | 'vistoria_saida' 
  | 'vistoria_sinistro'
  | 'vistoria_periodica'
  | 'vistoria_manutencao'
  | 'vistoria_retirada';

export type StatusServico = 
  | 'pendente' 
  | 'agendada' 
  | 'em_rota' 
  | 'em_andamento'
  | 'concluida' 
  | 'aprovada' 
  | 'reprovada'
  | 'aprovada_ressalvas'
  | 'em_analise'
  | 'reagendada' 
  | 'nao_compareceu'
  | 'cancelada';

export type PeriodoServico = 'manha' | 'tarde' | 'noite';

export interface Servico {
  id: string;
  tipo: TipoServico;
  status: StatusServico;
  data_agendada: string;
  hora_agendada: string | null;
  periodo: PeriodoServico;
  permite_encaixe: boolean;
  local_vistoria: string | null;
  
  // Endereço
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  latitude: number | null;
  longitude: number | null;
  
  // Relacionamentos
  associado_id: string | null;
  veiculo_id: string | null;
  contrato_id: string | null;
  cotacao_id: string | null;
  lead_id: string | null;
  sinistro_id: string | null;
  profissional_id: string | null;
  rota_id: string | null;
  
  // Timestamps de workflow
  em_rota_em: string | null;
  iniciada_em: string | null;
  concluida_em: string | null;
  
  // Campos de instalação
  rastreador_id: string | null;
  imei_rastreador: string | null;
  checklist_data: Record<string, unknown>;
  quilometragem: number | null;
  assinatura_cliente_url: string | null;
  
  // Campos de vistoria
  km_atual: number | null;
  avarias: string | null;
  video_360_url: string | null;
  fotos_recusa: string[] | null;
  modalidade: string | null;
  protocolo: string | null;
  
  // Análise
  analisado_por: string | null;
  analisado_em: string | null;
  observacoes_analise: string | null;
  ressalvas: string | null;
  motivo_reprovacao: string | null;
  
  // Assinatura digital
  assinatura_autentique_id: string | null;
  assinatura_status: string | null;
  assinatura_enviada_em: string | null;
  assinatura_concluida_em: string | null;
  assinatura_documento_url: string | null;
  
  // Campos específicos de manutenção
  motivo_manutencao: string | null;
  motivo_detalhe: string | null;
  local_tipo_manutencao: string | null;
  protecao_suspensa: boolean | null;
  data_suspensao: string | null;
  rastreador_substituto_id: string | null;
  resultado_manutencao: string | null;
  
  // Outros
  observacoes: string | null;
  origem: string | null;
  created_at: string;
  updated_at: string;
  
  // Joins opcionais
  associado?: {
    id: string;
    nome: string;
    telefone: string;
    whatsapp: string | null;
    cpf: string;
    email: string;
  } | null;
  veiculo?: {
    id: string;
    placa: string;
    marca: string;
    modelo: string;
    cor: string | null;
    ano_fabricacao: number | null;
    ano_modelo: number | null;
  } | null;
  profissional?: {
    id: string;
    nome: string;
    telefone: string | null;
  } | null;
  cotacao?: {
    id: string;
    numero: string | null;
  } | null;
  contrato?: {
    id: string;
    numero: string | null;
  } | null;
}

// Interface para a tarefa atual (usada pelo instalador/vistoriador)
export interface TarefaAtual {
  id: string;
  tipo: TipoServico;
  status: StatusServico;
  data_agendada: string;
  hora_agendada: string | null;
  periodo: PeriodoServico;
  permite_encaixe?: boolean;
  cliente: {
    id: string;
    nome: string;
    telefone: string;
    whatsapp: string | null;
  };
  veiculo: {
    id: string;
    placa: string;
    marca: string;
    modelo: string;
    cor: string | null;
  };
  endereco: {
    logradouro: string | null;
    numero: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
    cep: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  cotacao_id: string | null;
  contrato_id: string | null;
  rastreador_id: string | null;
  imei_rastreador: string | null;
  local_vistoria: string | null;
  observacoes: string | null;
  distancia_km?: number;
  rota_id: string | null;
  iniciada_em: string | null;
  em_rota_em: string | null;
  instalacao_origem_id: string | null;
  vistoria_origem_id: string | null;
}

// Filtros para listagem de serviços
export interface ServicoFilters {
  tipo?: TipoServico | TipoServico[];
  status?: StatusServico | StatusServico[];
  profissional_id?: string;
  data_inicio?: string;
  data_fim?: string;
  associado_id?: string;
  veiculo_id?: string;
  rota_id?: string;
}

// ============================================
// LABELS E CORES
// ============================================

export const TIPO_SERVICO_LABELS: Record<TipoServico, string> = {
  instalacao: 'Instalação',
  vistoria_entrada: 'Vistoria de Entrada',
  vistoria_saida: 'Vistoria de Saída',
  vistoria_sinistro: 'Vistoria de Sinistro',
  vistoria_periodica: 'Vistoria Periódica',
  vistoria_manutencao: 'Vistoria de Manutenção',
  vistoria_retirada: 'Retirada de Rastreador',
};

export const STATUS_SERVICO_LABELS: Record<StatusServico, string> = {
  pendente: 'Pendente',
  agendada: 'Agendada',
  em_rota: 'Em Rota',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  aprovada: 'Aprovada',
  reprovada: 'Reprovada',
  aprovada_ressalvas: 'Aprovada c/ Ressalvas',
  em_analise: 'Em Análise',
  reagendada: 'Reagendada',
  nao_compareceu: 'Não Compareceu',
  cancelada: 'Cancelada',
};

export const STATUS_SERVICO_COLORS: Record<StatusServico, string> = {
  pendente: 'bg-gray-100 text-gray-800',
  agendada: 'bg-blue-100 text-blue-800',
  em_rota: 'bg-purple-100 text-purple-800',
  em_andamento: 'bg-yellow-100 text-yellow-800',
  concluida: 'bg-green-100 text-green-800',
  aprovada: 'bg-green-100 text-green-800',
  reprovada: 'bg-red-100 text-red-800',
  aprovada_ressalvas: 'bg-orange-100 text-orange-800',
  em_analise: 'bg-cyan-100 text-cyan-800',
  reagendada: 'bg-indigo-100 text-indigo-800',
  nao_compareceu: 'bg-orange-100 text-orange-800',
  cancelada: 'bg-gray-100 text-gray-600',
};

export const PERIODO_LABELS: Record<PeriodoServico, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
};

// ============================================
// HOOKS
// ============================================

/**
 * Hook para listar serviços com filtros opcionais
 */
export function useServicos(filters?: ServicoFilters) {
  return useQuery({
    queryKey: ['servicos', filters],
    queryFn: async () => {
      let query = supabase
        .from('servicos')
        .select(`
          *,
          associado:associados(id, nome, telefone, whatsapp, cpf, email),
          veiculo:veiculos(id, placa, marca, modelo, cor, ano_fabricacao, ano_modelo),
          profissional:profiles!servicos_profissional_id_fkey(id, nome, telefone),
          cotacao:cotacoes(id, numero),
          contrato:contratos(id, numero)
        `)
        .order('data_agendada', { ascending: true })
        .order('hora_agendada', { ascending: true });

      // Aplicar filtros
      if (filters?.tipo) {
        if (Array.isArray(filters.tipo)) {
          query = query.in('tipo', filters.tipo);
        } else {
          query = query.eq('tipo', filters.tipo);
        }
      }

      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status as any);
        } else {
          query = query.eq('status', filters.status as any);
        }
      }

      if (filters?.profissional_id) {
        query = query.eq('profissional_id', filters.profissional_id);
      }

      if (filters?.data_inicio) {
        query = query.gte('data_agendada', filters.data_inicio);
      }

      if (filters?.data_fim) {
        query = query.lte('data_agendada', filters.data_fim);
      }

      if (filters?.associado_id) {
        query = query.eq('associado_id', filters.associado_id);
      }

      if (filters?.veiculo_id) {
        query = query.eq('veiculo_id', filters.veiculo_id);
      }

      if (filters?.rota_id) {
        query = query.eq('rota_id', filters.rota_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as Servico[];
    },
  });
}

/**
 * Hook para buscar um serviço específico
 */
export function useServico(id: string | undefined) {
  return useQuery({
    queryKey: ['servico', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('servicos')
        .select(`
          *,
          associado:associados(id, nome, telefone, whatsapp, cpf, email),
          veiculo:veiculos(id, placa, marca, modelo, cor, ano_fabricacao, ano_modelo),
          profissional:profiles!servicos_profissional_id_fkey(id, nome, telefone),
          cotacao:cotacoes(id, numero),
          contrato:contratos(id, numero)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Servico;
    },
    enabled: !!id,
  });
}

/**
 * Hook para buscar a tarefa atual do profissional logado (usa a nova RPC)
 */
export function useTarefaAtualServico() {
  const { profile } = useAuth();
  const profissionalId = profile?.id;
  const previousTaskIdRef = useRef<string | null>(null);
  const hasShownAutoAssignToast = useRef(false);

  const query = useQuery({
    queryKey: ['tarefa-atual-servico', profissionalId],
    queryFn: async (): Promise<TarefaAtual | null> => {
      if (!profissionalId) return null;

      const { data, error } = await supabase.rpc('buscar_tarefa_atual_profissional', {
        p_profissional_id: profissionalId
      });

      if (error) {
        console.error('Erro ao buscar tarefa atual:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return null;
      }

      const tarefa = data[0];
      return {
        id: tarefa.id,
        tipo: tarefa.tipo as TipoServico,
        status: tarefa.status as StatusServico,
        data_agendada: tarefa.data_agendada,
        hora_agendada: tarefa.hora_agendada,
        periodo: (tarefa.periodo || 'manha') as PeriodoServico,
        cliente: {
          id: tarefa.associado_id || '',
          nome: tarefa.associado_nome || 'Cliente',
          telefone: tarefa.associado_telefone || '',
          whatsapp: tarefa.associado_whatsapp,
        },
        veiculo: {
          id: tarefa.veiculo_id || '',
          placa: tarefa.veiculo_placa || '',
          marca: tarefa.veiculo_marca || '',
          modelo: tarefa.veiculo_modelo || '',
          cor: tarefa.veiculo_cor,
        },
        endereco: {
          logradouro: tarefa.logradouro,
          numero: tarefa.numero,
          bairro: tarefa.bairro,
          cidade: tarefa.cidade,
          uf: tarefa.uf,
          cep: tarefa.cep,
          latitude: tarefa.latitude,
          longitude: tarefa.longitude,
        },
        cotacao_id: tarefa.cotacao_id,
        contrato_id: tarefa.contrato_id,
        rastreador_id: tarefa.rastreador_id,
        imei_rastreador: tarefa.imei_rastreador,
        local_vistoria: tarefa.local_vistoria,
        observacoes: tarefa.observacoes,
        rota_id: tarefa.rota_id,
        iniciada_em: tarefa.iniciada_em,
        em_rota_em: tarefa.em_rota_em,
        instalacao_origem_id: tarefa.instalacao_origem_id,
        vistoria_origem_id: tarefa.vistoria_origem_id,
        permite_encaixe: tarefa.permite_encaixe ?? false,
      };
    },
    enabled: !!profissionalId,
    refetchInterval: 30000,
    staleTime: 10000,
  });

  // Detectar quando uma nova tarefa é atribuída automaticamente
  useEffect(() => {
    const currentTaskId = query.data?.id || null;
    
    if (
      currentTaskId && 
      currentTaskId !== previousTaskIdRef.current &&
      previousTaskIdRef.current !== null &&
      !hasShownAutoAssignToast.current
    ) {
      const tipoLabel = TIPO_SERVICO_LABELS[query.data?.tipo || 'instalacao'];
      toast.success(`Nova tarefa atribuída automaticamente!`, {
        description: `${tipoLabel} para ${query.data?.cliente.nome || 'cliente'} em ${query.data?.endereco.bairro || query.data?.endereco.cidade || 'endereço'}`,
        duration: 8000,
      });
      hasShownAutoAssignToast.current = true;
      
      setTimeout(() => {
        hasShownAutoAssignToast.current = false;
      }, 5000);
    }
    
    previousTaskIdRef.current = currentTaskId;
  }, [query.data?.id, query.data?.tipo, query.data?.cliente.nome, query.data?.endereco.bairro, query.data?.endereco.cidade]);

  return query;
}

/**
 * Hook para iniciar um serviço (mudar status para em_andamento)
 */
export function useIniciarServicoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (servicoId: string) => {
      const { error } = await supabase
        .from('servicos')
        .update({ 
          status: 'em_andamento',
          iniciada_em: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', servicoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarefa-atual-servico'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      toast.success('Serviço iniciado!');
    },
    onError: (error) => {
      console.error('Erro ao iniciar serviço:', error);
      toast.error('Erro ao iniciar serviço');
    }
  });
}

/**
 * Hook para concluir um serviço
 */
export function useConcluirServicoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (servicoId: string) => {
      const { error } = await supabase
        .from('servicos')
        .update({ 
          status: 'concluida',
          concluida_em: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', servicoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarefa-atual-servico'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      queryClient.invalidateQueries({ queryKey: ['servicos-historico'] });
      toast.success('Serviço concluído!');
    },
    onError: (error) => {
      console.error('Erro ao concluir serviço:', error);
      toast.error('Erro ao concluir serviço');
    }
  });
}

/**
 * Hook para atribuir um profissional a um serviço
 */
export function useAtribuirProfissionalMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ servicoId, profissionalId }: { servicoId: string; profissionalId: string }) => {
      const { error } = await supabase
        .from('servicos')
        .update({ 
          profissional_id: profissionalId,
          updated_at: new Date().toISOString()
        })
        .eq('id', servicoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      toast.success('Profissional atribuído!');
    },
    onError: (error) => {
      console.error('Erro ao atribuir profissional:', error);
      toast.error('Erro ao atribuir profissional');
    }
  });
}

/**
 * Hook para mudar status de um serviço
 */
export function useAtualizarStatusServicoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ servicoId, status, dados }: { 
      servicoId: string; 
      status: StatusServico;
      dados?: Partial<Servico>;
    }) => {
      const updateData: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
        ...dados,
      };

      // Definir timestamps automáticos baseados no status
      if (status === 'em_rota') {
        updateData.em_rota_em = new Date().toISOString();
      } else if (status === 'em_andamento') {
        updateData.iniciada_em = new Date().toISOString();
      } else if (status === 'concluida' || status === 'aprovada' || status === 'reprovada') {
        updateData.concluida_em = new Date().toISOString();
      }

      const { error } = await supabase
        .from('servicos')
        .update(updateData)
        .eq('id', servicoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      queryClient.invalidateQueries({ queryKey: ['tarefa-atual-servico'] });
      toast.success('Status atualizado!');
    },
    onError: (error) => {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    }
  });
}

/**
 * Hook para criar um novo serviço
 */
export function useCriarServicoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dados: Partial<Servico>) => {
      const { data, error } = await supabase
        .from('servicos')
        .insert({
          tipo: dados.tipo as any,
          status: (dados.status || 'agendada') as any,
          data_agendada: dados.data_agendada,
          hora_agendada: dados.hora_agendada,
          periodo: dados.periodo || 'manha',
          cep: dados.cep,
          logradouro: dados.logradouro,
          numero: dados.numero,
          complemento: dados.complemento,
          bairro: dados.bairro,
          cidade: dados.cidade,
          uf: dados.uf,
          latitude: dados.latitude,
          longitude: dados.longitude,
          associado_id: dados.associado_id,
          veiculo_id: dados.veiculo_id,
          contrato_id: dados.contrato_id,
          cotacao_id: dados.cotacao_id,
          lead_id: dados.lead_id,
          sinistro_id: dados.sinistro_id,
          profissional_id: dados.profissional_id,
          local_vistoria: dados.local_vistoria,
          permite_encaixe: dados.permite_encaixe,
          observacoes: dados.observacoes,
          origem: dados.origem,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      toast.success('Serviço criado!');
    },
    onError: (error) => {
      console.error('Erro ao criar serviço:', error);
      toast.error('Erro ao criar serviço');
    }
  });
}

/**
 * Hook para histórico de serviços concluídos do profissional
 */
export function useServicosHistorico(dias: number = 7) {
  const { profile } = useAuth();
  const profissionalId = profile?.id;

  return useQuery({
    queryKey: ['servicos-historico', profissionalId, dias],
    queryFn: async () => {
      if (!profissionalId) return [];

      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - dias);

      const { data, error } = await supabase
        .from('servicos')
        .select(`
          id, tipo, status, data_agendada, concluida_em,
          associado:associados(nome),
          veiculo:veiculos(placa, marca, modelo),
          bairro, cidade
        `)
        .eq('profissional_id', profissionalId)
        .in('status', ['concluida', 'aprovada', 'reprovada'])
        .gte('concluida_em', dataLimite.toISOString())
        .order('concluida_em', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!profissionalId,
  });
}

/**
 * Hook para buscar fotos de um serviço
 */
export function useServicoFotos(servicoId: string | undefined) {
  return useQuery({
    queryKey: ['servico-fotos', servicoId],
    queryFn: async () => {
      if (!servicoId) return [];

      const { data, error } = await supabase
        .from('servico_fotos')
        .select('*')
        .eq('servico_id', servicoId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!servicoId,
  });
}

/**
 * Hook para adicionar foto a um serviço
 */
export function useAdicionarFotoServicoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ servicoId, tipo, arquivoUrl }: { 
      servicoId: string; 
      tipo: string; 
      arquivoUrl: string;
    }) => {
      const { error } = await supabase
        .from('servico_fotos')
        .insert({
          servico_id: servicoId,
          tipo,
          arquivo_url: arquivoUrl,
        });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['servico-fotos', variables.servicoId] });
    },
    onError: (error) => {
      console.error('Erro ao adicionar foto:', error);
      toast.error('Erro ao adicionar foto');
    }
  });
}

/**
 * Hook para buscar detalhes completos de um serviço para execução
 * (substitui useInstalacaoDetalhes e useVistoriaDetalhes)
 */
export function useServicoDetalhes(id: string | undefined) {
  return useQuery({
    queryKey: ['servico-detalhes', id],
    queryFn: async () => {
      if (!id) throw new Error('ID não fornecido');

      // Buscar primeiro em servicos
      const { data: servico, error: servicoError } = await supabase
        .from('servicos')
        .select(`
          *,
          associados:associado_id (
            id, nome, telefone, email, whatsapp, cpf, rg,
            logradouro, numero, bairro, cidade, uf, cep, complemento
          ),
          veiculos:veiculo_id (
            id, marca, modelo, placa, ano_modelo, ano_fabricacao, cor, chassi, renavam, valor_fipe, combustivel
          ),
          rastreadores:rastreador_id (
            id, codigo, numero_serie, imei, plataforma, status
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (servicoError) throw servicoError;

      // Se encontrou no servicos, retorna diretamente
      if (servico) {
        return servico as any;
      }

      // Fallback: tentar buscar na tabela legacy instalacoes
      const { data: instalacao, error: instalacaoError } = await supabase
        .from('instalacoes')
        .select(`
          *,
          associados (id, nome, telefone, email, whatsapp, cpf, rg, logradouro, numero, bairro, cidade, uf, cep, complemento),
          veiculos (id, marca, modelo, placa, ano_modelo, ano_fabricacao, cor, chassi, renavam, valor_fipe, combustivel),
          rastreadores (id, codigo, numero_serie, imei, plataforma, status)
        `)
        .eq('id', id)
        .maybeSingle();

      if (instalacaoError) throw instalacaoError;

      if (instalacao) {
        // Normalizar para o mesmo formato de servico
        return {
          ...instalacao,
          tipo: 'instalacao' as TipoServico,
          fonte_dados: 'legacy_instalacoes',
        } as any;
      }

      // Se não encontrou em nenhuma tabela, lançar erro
      throw new Error('Serviço não encontrado');
    },
    enabled: !!id,
    retry: 1,
  });
}

/**
 * Hook para salvar checklist de um serviço
 */
export function useSalvarChecklistServico() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, checklist_data, quilometragem }: {
      id: string;
      checklist_data: Record<string, unknown>;
      quilometragem?: number;
    }) => {
      const updateData: Record<string, unknown> = {
        checklist_data,
        updated_at: new Date().toISOString(),
      };
      if (quilometragem !== undefined) {
        updateData.quilometragem = quilometragem;
      }

      const { error } = await supabase
        .from('servicos')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['servico-detalhes', variables.id] });
    },
    onError: (error) => {
      console.error('Erro ao salvar checklist:', error);
      toast.error('Erro ao salvar checklist');
    }
  });
}

/**
 * Hook para aprovar veículo em um serviço (instalação/vistoria)
 */
export function useAprovarVeiculoServico() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      servicoId: string;
      veiculoId: string;
      associadoId: string;
      imeiRastreador: string;
    }) => {
      const agora = new Date().toISOString();

      // 1. Buscar e validar rastreador
      const { data: rastreador, error: rastreadorError } = await supabase
        .from('rastreadores')
        .select('id, status, portador_id, codigo')
        .eq('imei', data.imeiRastreador)
        .single();

      if (rastreadorError || !rastreador) {
        throw new Error('Rastreador não encontrado');
      }

      if (rastreador.status !== 'estoque') {
        throw new Error('Rastreador não está disponível');
      }

      // 2. Atualizar serviço
      const { error: servicoError } = await supabase
        .from('servicos')
        .update({
          status: 'concluida',
          concluida_em: agora,
          rastreador_id: rastreador.id,
          imei_rastreador: data.imeiRastreador,
          updated_at: agora,
        })
        .eq('id', data.servicoId);

      if (servicoError) throw servicoError;

      // 3. Vincular rastreador ao veículo e remover do porte
      const { error: rastreadorUpdateError } = await supabase
        .from('rastreadores')
        .update({
          status: 'instalado',
          veiculo_id: data.veiculoId,
          portador_id: null, // Remove do porte do instalador
          updated_at: agora,
        })
        .eq('id', rastreador.id);

      if (rastreadorUpdateError) throw rastreadorUpdateError;

      // 4. Registrar movimentação de estoque
      await supabase.from('estoque_movimentacoes').insert({
        rastreador_id: rastreador.id,
        tipo: 'instalacao',
        quantidade: 1,
        status_anterior: 'estoque',
        status_novo: 'instalado',
        veiculo_id: data.veiculoId,
        observacoes: `Instalado pelo profissional no veículo`,
        usuario_id: profile?.id,
      });

      // 4. Verificar se veículo já tinha cobertura_roubo_furto (autovistoria aprovada)
      const { data: veiculoAtual } = await supabase
        .from('veiculos')
        .select('cobertura_roubo_furto, cobertura_total')
        .eq('id', data.veiculoId)
        .single();

      // 5. Se já tinha autovistoria aprovada, ativar cobertura total automaticamente
      if (veiculoAtual?.cobertura_roubo_furto && !veiculoAtual?.cobertura_total) {
        console.log('[useAprovarVeiculoServico] Autovistoria prévia detectada, ativando cobertura_total automaticamente');
        
        const { error: veiculoError } = await supabase
          .from('veiculos')
          .update({
            status: 'ativo',
            cobertura_total: true, // Ativar cobertura total automaticamente
            updated_at: agora,
          })
          .eq('id', data.veiculoId);

        if (veiculoError) throw veiculoError;
      } else {
        // Fluxo normal sem autovistoria prévia
        const { error: veiculoError } = await supabase
          .from('veiculos')
          .update({
            status: 'ativo',
            updated_at: agora,
          })
          .eq('id', data.veiculoId);

        if (veiculoError) throw veiculoError;
      }

      // 6. SEMPRE tentar ativar rastreador na plataforma (independente de cobertura)
      try {
        const { data: associadoData } = await supabase
          .from('associados')
          .select('email')
          .eq('id', data.associadoId)
          .single();

        // Buscar plataforma do rastreador
        const { data: rastreadorInfo } = await supabase
          .from('rastreadores')
          .select('plataforma')
          .eq('imei', data.imeiRastreador)
          .single();

        if (rastreadorInfo?.plataforma === 'softruck') {
          console.log('[useAprovarVeiculoServico] Ativando rastreador na Softruck...');
          await supabase.functions.invoke('softruck-ativar-dispositivo', {
            body: {
              imei: data.imeiRastreador,
              veiculoId: data.veiculoId,
              associadoId: data.associadoId,
              associadoEmail: associadoData?.email,
            },
          });
          console.log('[useAprovarVeiculoServico] Rastreador ativado na Softruck com sucesso');
        } else if (rastreadorInfo?.plataforma === 'rede_veiculos') {
          console.log('[useAprovarVeiculoServico] Ativando rastreador na Rede Veículos...');
          await supabase.functions.invoke('rede-veiculos-vincular-cliente', {
            body: {
              imei: data.imeiRastreador,
              veiculoId: data.veiculoId,
              associadoId: data.associadoId,
            },
          });
          console.log('[useAprovarVeiculoServico] Rastreador vinculado na Rede Veículos com sucesso');
        }
      } catch (err) {
        console.warn('[useAprovarVeiculoServico] Ativação na plataforma falhou, requer ação manual:', err);
        // Não bloquear fluxo - ativação pode ser feita manualmente depois
      }

      // 6. Verificar status atual do associado antes de atualizar
      const { data: associadoAtual } = await supabase
        .from('associados')
        .select('status')
        .eq('id', data.associadoId)
        .single();

      // Só atualiza para em_analise se NÃO estava ativo (não regredir!)
      if (associadoAtual?.status !== 'ativo') {
        const { error: associadoError } = await supabase
          .from('associados')
          .update({ 
            status: 'em_analise',
            updated_at: agora,
          })
          .eq('id', data.associadoId)
          .in('status', ['pendente_vistoria', 'aguardando_instalacao']);

        if (associadoError) {
          console.error('Erro ao atualizar status do associado para análise:', associadoError);
        }
      } else {
        console.log('[useAprovarVeiculoServico] Associado já está ativo, mantendo status');
      }

      // 6. Registrar histórico
      await supabase.from('associados_historico').insert({
        associado_id: data.associadoId,
        tipo: 'instalacao_concluida',
        descricao: `Instalação concluída pelo técnico - Rastreador ${data.imeiRastreador} instalado`,
        dados_novos: {
          servico_id: data.servicoId,
          veiculo_id: data.veiculoId,
          rastreador_id: rastreador.id,
          imei: data.imeiRastreador,
        },
        usuario_id: profile?.id,
      });

      // Nota: O laudo de vistoria é gerado no momento da assinatura do cliente (useAssinatura.ts)
      // Isso garante que o laudo só é gerado após fotos + assinatura estarem completos

      return { sucesso: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servico-detalhes'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      queryClient.invalidateQueries({ queryKey: ['tarefa-atual-servico'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores-meu-porte'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias-mapa'] });
      toast.success('Instalação concluída! Aguardando análise cadastral.');
    },
    onError: (error) => {
      console.error('Erro ao aprovar veículo:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao aprovar veículo');
    },
  });
}

/**
 * Hook para recusar veículo em um serviço
 */
export function useRecusarVeiculoServico() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      servicoId: string;
      veiculoId: string;
      associadoId: string;
      motivo: string;
      contratoId?: string;
      vistoriaId?: string;
      cotacaoId?: string;
    }) => {
      const agora = new Date().toISOString();

      // 1. Buscar dados do serviço para obter contrato_id e cotacao_id se não fornecidos
      let contratoId = data.contratoId;
      let cotacaoId = data.cotacaoId;
      
      if (!contratoId || !cotacaoId) {
        const { data: servicoData } = await supabase
          .from('servicos')
          .select('contrato_id, cotacao_id')
          .eq('id', data.servicoId)
          .single();
        
        contratoId = contratoId || servicoData?.contrato_id;
        cotacaoId = cotacaoId || servicoData?.cotacao_id;
      }

      // 2. Atualizar serviço como cancelado
      const { error: servicoError } = await supabase
        .from('servicos')
        .update({
          status: 'cancelada',
          observacoes: `Veículo recusado: ${data.motivo}`,
          concluida_em: agora,
          updated_at: agora,
        })
        .eq('id', data.servicoId);

      if (servicoError) throw servicoError;

      // 3. Atualizar veículo como RECUSADO (não mais suspenso) e obter dados para blacklist
      const { data: veiculoData, error: veiculoError } = await supabase
        .from('veiculos')
        .update({
          status: 'recusado',
          motivo_recusa_veiculo: data.motivo,
          recusado_por: profile?.id,
          recusado_em: agora,
          updated_at: agora,
        })
        .eq('id', data.veiculoId)
        .select('placa, chassi')
        .single();

      if (veiculoError) throw veiculoError;

      // 4. NOVO: Buscar vistoria para reprovada (antes de inserir na blacklist)
      const vistoriaFilter = contratoId 
        ? `contrato_id.eq.${contratoId}` 
        : cotacaoId 
          ? `cotacao_id.eq.${cotacaoId}` 
          : null;
      
      let vistoriaId: string | null = null;
      if (vistoriaFilter) {
        const { data: vistoriaData } = await supabase
          .from('vistorias')
          .select('id')
          .or(vistoriaFilter)
          .maybeSingle();
        
        if (vistoriaData?.id) {
          vistoriaId = vistoriaData.id;
          await supabase
            .from('vistorias')
            .update({
              status: 'reprovada',
              observacoes: data.motivo,
              updated_at: agora,
            })
            .eq('id', vistoriaData.id);
        }
      }

      // 5. NOVO: Adicionar veículo à blacklist
      if (veiculoData) {
        await supabase
          .from('blacklist_veiculos')
          .insert({
            placa: veiculoData.placa?.toUpperCase().replace(/[^A-Z0-9]/g, '') || '',
            chassi: veiculoData.chassi,
            motivo: data.motivo,
            justificativa: `Veículo recusado pelo técnico: ${data.motivo}`,
            tipo_reprovacao: 'vistoria_reprovada',
            veiculo_id: data.veiculoId,
            associado_id: data.associadoId,
            contrato_id: contratoId,
            cotacao_id: cotacaoId,
            adicionado_por: profile?.id,
            vistoria_id: vistoriaId,
            ativo: true,
          });
      }

      // 6. NOVO: Atualizar associado para recusado
      await supabase
        .from('associados')
        .update({
          status: 'recusado',
          updated_at: agora,
        })
        .eq('id', data.associadoId);

      // 7. NOVO: Atualizar contrato para cancelado
      if (contratoId) {
        await supabase
          .from('contratos')
          .update({
            status: 'cancelado',
          })
          .eq('id', contratoId);
      }

      // 8. ATUALIZADO: Atualizar cotação - status E status_contratacao
      if (cotacaoId) {
        await supabase
          .from('cotacoes')
          .update({ 
            status: 'recusada',                    // Mudar status principal para aparecer correto na UI
            status_contratacao: 'veiculo_recusado' 
          })
          .eq('id', cotacaoId);
      }

      // 9. Registrar histórico
      await supabase.from('associados_historico').insert({
        associado_id: data.associadoId,
        tipo: 'veiculo_recusado',
        descricao: `Veículo recusado pelo técnico: ${data.motivo}`,
        dados_novos: {
          servico_id: data.servicoId,
          veiculo_id: data.veiculoId,
          motivo: data.motivo,
          contrato_id: contratoId,
          cotacao_id: cotacaoId,
        },
        usuario_id: profile?.id,
      });

      return { sucesso: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servico-detalhes'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      queryClient.invalidateQueries({ queryKey: ['tarefa-atual-servico'] });
      queryClient.invalidateQueries({ queryKey: ['blacklist-veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias'] });
      queryClient.invalidateQueries({ queryKey: ['associados'] });
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      toast.success('Veículo recusado. Adicionado à blacklist e associado suspenso.');
    },
    onError: (error) => {
      console.error('Erro ao recusar veículo:', error);
      toast.error('Erro ao recusar veículo');
    },
  });
}

// Helper para verificar se é uma instalação
export function isInstalacao(tipo: TipoServico): boolean {
  return tipo === 'instalacao';
}

// Helper para verificar se é uma vistoria
export function isVistoria(tipo: TipoServico): boolean {
  return tipo.startsWith('vistoria_');
}

// Helper para obter label amigável
export function getTipoServicoLabel(tipo: TipoServico): string {
  return TIPO_SERVICO_LABELS[tipo] || tipo;
}

export function getStatusServicoLabel(status: StatusServico): string {
  return STATUS_SERVICO_LABELS[status] || status;
}

export function getStatusServicoColor(status: StatusServico): string {
  return STATUS_SERVICO_COLORS[status] || 'bg-gray-100 text-gray-800';
}

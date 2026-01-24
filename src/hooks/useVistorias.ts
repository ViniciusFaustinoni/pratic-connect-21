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
          vistoriador:profiles!vistorias_vistoriador_id_fkey(id, nome),
          cotacao:cotacoes(id, nome_solicitante, telefone1_solicitante, veiculo_placa, veiculo_marca, veiculo_modelo)
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
          v.associado?.veiculos?.[0]?.placa?.toLowerCase().includes(searchLower) ||
          v.cotacao?.veiculo_placa?.toLowerCase().includes(searchLower) ||
          v.cotacao?.nome_solicitante?.toLowerCase().includes(searchLower)
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
      imei_rastreador?: string;
    }) => {
      const status: VistoriaStatus = data.aceito ? 'aprovada' : 'reprovada';
      
      // Buscar dados da vistoria para obter veiculo_id
      const { data: vistoriaData, error: vistoriaError } = await supabase
        .from('vistorias')
        .select('veiculo_id')
        .eq('id', data.id)
        .single();
      
      if (vistoriaError) throw vistoriaError;
      
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

      // Se aprovado e tem IMEI, vincular rastreador ao veículo
      if (data.aceito && data.imei_rastreador && vistoriaData.veiculo_id) {
        // Verificar se rastreador já existe pelo IMEI
        const { data: rastreadorExistente } = await supabase
          .from('rastreadores')
          .select('id')
          .eq('imei', data.imei_rastreador)
          .maybeSingle();
        
        if (rastreadorExistente) {
          // Atualizar rastreador existente para vincular ao veículo
          const { error: rastreadorError } = await supabase
            .from('rastreadores')
            .update({ 
              veiculo_id: vistoriaData.veiculo_id,
              status: 'instalado',
              updated_at: new Date().toISOString()
            })
            .eq('id', rastreadorExistente.id);
          
          if (rastreadorError) {
            console.error('Erro ao atualizar rastreador:', rastreadorError);
            // Não lançar erro, pois a vistoria já foi aprovada
          }
        } else {
          // Criar novo rastreador
          const { error: rastreadorError } = await supabase
            .from('rastreadores')
            .insert({
              imei: data.imei_rastreador,
              codigo: `RAW-${Date.now()}`,
              plataforma: 'manual',
              veiculo_id: vistoriaData.veiculo_id,
              status: 'instalado',
            });
          
          if (rastreadorError) {
            console.error('Erro ao criar rastreador:', rastreadorError);
            // Não lançar erro, pois a vistoria já foi aprovada
          }
        }
      }

      return { status, contrato_id: data.contrato_id, imei_rastreador: data.imei_rastreador };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['vistorias'] });
      queryClient.invalidateQueries({ queryKey: ['ativacoes'] });
      queryClient.invalidateQueries({ queryKey: ['contratos-pendentes-vinculo'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores'] });
      
      if (result.status === 'aprovada') {
        if (result.imei_rastreador) {
          toast.success('Vistoria aprovada e rastreador vinculado ao veículo!');
        } else if (result.contrato_id) {
          toast.success('Vistoria aprovada e vinculada ao contrato!');
        } else {
          toast.success('Vistoria aprovada!');
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
      // Buscar contratos com join direto para leads
      const { data: contratos, error } = await supabase
        .from('contratos')
        .select(`
          id, numero, lead_id, associado_id,
          leads (id, nome, veiculo_placa, veiculo_marca, veiculo_modelo)
        `)
        .in('status', ['assinado', 'pendente', 'pendente_assinatura', 'enviado'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      const associadoIds = (contratos || []).map(c => c.associado_id).filter(Boolean) as string[];

      // Verificar vistorias existentes
      const vistoriasRes = associadoIds.length > 0
        ? await supabase.from('vistorias').select('associado_id, status').in('associado_id', associadoIds).eq('tipo', 'entrada').eq('status', 'aprovada')
        : { data: [] };

      const vistoriasAprovadas = new Set((vistoriasRes.data || []).map(v => v.associado_id));

      // Filtrar contratos que já têm vistoria aprovada
      const contratosSemVistoria = (contratos || []).filter(c => 
        !c.associado_id || !vistoriasAprovadas.has(c.associado_id)
      );

      return contratosSemVistoria.map((contrato: any) => {
        const lead = contrato.leads;
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
// Hook para buscar vistoria por instalacao_id (criando se não existir)
export function useVistoriaCompleta(instalacaoId: string | null) {
  return useQuery({
    queryKey: ['vistoria-completa', instalacaoId],
    queryFn: async () => {
      if (!instalacaoId) return null;

      // Buscar dados da instalação primeiro para obter cotacao_id e rota_id
      const { data: instalacao } = await supabase
        .from('instalacoes')
        .select('associado_id, veiculo_id, instalador_id, contrato_id, cotacao_id, rota_id')
        .eq('id', instalacaoId)
        .single();

      // Primeiro, buscar vistoria existente vinculada à instalação
      let { data, error } = await supabase
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
        .eq('instalacao_id', instalacaoId)
        .maybeSingle();

      // Se não encontrou por instalacao_id, buscar por cotacao_id
      if (!data && !error && instalacao?.cotacao_id) {
        const { data: vistoriaExistente, error: errCotacao } = await supabase
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
          .eq('cotacao_id', instalacao.cotacao_id)
          .maybeSingle();

        if (vistoriaExistente && !errCotacao) {
          // Vincular instalacao_id à vistoria existente
          if (!vistoriaExistente.instalacao_id) {
            await supabase
              .from('vistorias')
              .update({ instalacao_id: instalacaoId })
              .eq('id', vistoriaExistente.id);
            console.log('[useVistoriaCompleta] Vinculou instalacao_id à vistoria existente:', vistoriaExistente.id);
          }
          data = { ...vistoriaExistente, instalacao_id: instalacaoId };
        }
      }

      // Se ainda não existir, criar nova vistoria vinculada à instalação
      if (!data && !error && instalacao) {
        // Buscar vistoriador_id: primeiro da instalação, depois da rota_instaladores
        let vistoriadorId = instalacao.instalador_id;
        
        if (!vistoriadorId && instalacao.rota_id) {
          // Buscar instalador atribuído via rota_instaladores
          const { data: rotaInstalador } = await supabase
            .from('rota_instaladores')
            .select('instalador_id')
            .eq('rota_id', instalacao.rota_id)
            .limit(1)
            .maybeSingle();
          
          vistoriadorId = rotaInstalador?.instalador_id ?? null;
          console.log('[useVistoriaCompleta] Instalador obtido da rota:', vistoriadorId);
        }

        const { data: novaVistoria, error: insertError } = await supabase
          .from('vistorias')
          .insert({
            instalacao_id: instalacaoId,
            associado_id: instalacao.associado_id,
            veiculo_id: instalacao.veiculo_id,
            vistoriador_id: vistoriadorId,
            contrato_id: instalacao.contrato_id,
            cotacao_id: instalacao.cotacao_id,
            tipo: 'entrada',
            modalidade: 'presencial',
            status: 'em_analise',
            origem: 'instalacao',
          })
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
          .single();

        if (insertError) throw insertError;
        data = novaVistoria;
      }

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
        instalacao_id?: string;
      };
    },
    enabled: !!instalacaoId,
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
      imei_rastreador?: string;
      rastreador_id?: string;
    }) => {
      const updateData: Record<string, unknown> = {
        km_atual: data.km_atual,
        avarias: data.avarias,
        observacoes: data.observacoes,
        status: data.status,
        updated_at: new Date().toISOString(),
      };

      // Adicionar IMEI se fornecido
      if (data.imei_rastreador) {
        updateData.imei_rastreador = data.imei_rastreador;
      }

      // Adicionar rastreador_id se fornecido (vínculo automático)
      if (data.rastreador_id) {
        updateData.rastreador_id = data.rastreador_id;
      }

      const { error } = await supabase
        .from('vistorias')
        .update(updateData)
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vistorias'] });
      queryClient.invalidateQueries({ queryKey: ['vistoria'] });
      queryClient.invalidateQueries({ queryKey: ['vistoria-completa'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores-metricas'] });
      toast.success('Vistoria finalizada com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao executar vistoria:', error);
      toast.error('Erro ao executar vistoria');
    },
  });
}

/**
 * Hook para buscar ou criar vistoria a partir de um serviço unificado
 * Usado pelo InstaladorChecklist que agora recebe servico_id ao invés de instalacao_id
 */
export function useVistoriaCompletaPorServico(servicoId: string | null) {
  return useQuery({
    queryKey: ['vistoria-completa-servico', servicoId],
    queryFn: async () => {
      if (!servicoId) return null;

      // 1. Buscar dados do serviço para obter relacionamentos
      const { data: servico, error: servicoError } = await supabase
        .from('servicos')
        .select('associado_id, veiculo_id, profissional_id, contrato_id, cotacao_id, rota_id, vistoria_origem_id, instalacao_origem_id')
        .eq('id', servicoId)
        .single();

      if (servicoError) throw servicoError;

      // 2. Se o serviço já tem vistoria_origem_id, buscar essa vistoria
      if (servico?.vistoria_origem_id) {
        const { data: vistoriaExistente } = await supabase
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
          .eq('id', servico.vistoria_origem_id)
          .maybeSingle();

        if (vistoriaExistente) {
          return vistoriaExistente;
        }
      }

      // 3. Se tem instalacao_origem_id, buscar vistoria vinculada a essa instalação
      if (servico?.instalacao_origem_id) {
        const { data: vistoriaInstalacao } = await supabase
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
          .eq('instalacao_id', servico.instalacao_origem_id)
          .maybeSingle();

        if (vistoriaInstalacao) {
          // Atualizar serviço com vistoria_origem_id
          await supabase
            .from('servicos')
            .update({ vistoria_origem_id: vistoriaInstalacao.id })
            .eq('id', servicoId);
          return vistoriaInstalacao;
        }
      }

      // 4. Se não encontrou, buscar por cotacao_id
      if (servico?.cotacao_id) {
        const { data: vistoriaCotacao } = await supabase
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
          .eq('cotacao_id', servico.cotacao_id)
          .maybeSingle();

        if (vistoriaCotacao) {
          // Atualizar serviço com vistoria_origem_id
          await supabase
            .from('servicos')
            .update({ vistoria_origem_id: vistoriaCotacao.id })
            .eq('id', servicoId);
          return vistoriaCotacao;
        }
      }

      // 5. Se ainda não existir, criar nova vistoria vinculada ao serviço
      if (servico) {
        console.log('[useVistoriaCompletaPorServico] Criando nova vistoria para serviço:', {
          servicoId,
          associado_id: servico.associado_id,
          veiculo_id: servico.veiculo_id,
          profissional_id: servico.profissional_id,
        });

        // Tentar criar com vistoriador_id primeiro
        let novaVistoria = null;
        let insertError = null;

        const { data: vistoriaComVistoriador, error: errorComVistoriador } = await supabase
          .from('vistorias')
          .insert({
            associado_id: servico.associado_id,
            veiculo_id: servico.veiculo_id,
            vistoriador_id: servico.profissional_id,
            contrato_id: servico.contrato_id,
            cotacao_id: servico.cotacao_id,
            tipo: 'entrada',
            status: 'em_analise',
          })
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
          .single();

        if (errorComVistoriador) {
          console.warn('[useVistoriaCompletaPorServico] Falha ao criar com vistoriador, tentando sem:', errorComVistoriador);
          
          // Fallback: criar sem vistoriador_id (RLS permite)
          const { data: vistoriaSemVistoriador, error: errorSemVistoriador } = await supabase
            .from('vistorias')
            .insert({
              associado_id: servico.associado_id,
              veiculo_id: servico.veiculo_id,
              vistoriador_id: null, // Sem vistoriador - RLS permite
              contrato_id: servico.contrato_id,
              cotacao_id: servico.cotacao_id,
              tipo: 'entrada',
              status: 'em_analise',
            })
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
            .single();

          if (errorSemVistoriador) {
            console.error('[useVistoriaCompletaPorServico] Erro ao criar vistoria (fallback também falhou):', {
              errorOriginal: errorComVistoriador,
              errorFallback: errorSemVistoriador,
              servicoId,
            });
            throw errorSemVistoriador;
          }

          novaVistoria = vistoriaSemVistoriador;
        } else {
          novaVistoria = vistoriaComVistoriador;
        }

        // Atualizar serviço com vistoria_origem_id
        await supabase
          .from('servicos')
          .update({ vistoria_origem_id: novaVistoria.id })
          .eq('id', servicoId);

        console.log('[useVistoriaCompletaPorServico] Vistoria criada com sucesso:', novaVistoria.id);
        return novaVistoria;
      }

      return null;
    },
    enabled: !!servicoId,
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { Periodo } from '@/data/autovistoriaConfig';
import type { MotivoRetirada, SubTipoRetirada, ModuloOrigem } from '@/types/retirada';

// =============== MUTATION: CRIAR SOLICITAÇÃO DE RETIRADA DO CADASTRO ===============

export interface CriarSolicitacaoRetiradaCadastroParams {
  rastreadorId: string;
  veiculoId: string;
  associadoId: string;
  motivo: MotivoRetirada;
}

export function useCriarSolicitacaoRetiradaCadastro() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CriarSolicitacaoRetiradaCadastroParams) => {
      // Criar serviço de retirada com status 'pendente' (Monitoramento vai agendar)
      const { data, error } = await supabase
        .from('servicos')
        .insert({
          tipo: 'vistoria_retirada' as const,
          status: 'pendente' as const,
          rastreador_id: params.rastreadorId,
          veiculo_id: params.veiculoId,
          associado_id: params.associadoId,
          motivo_retirada: params.motivo as unknown as string,
          solicitado_por_modulo: 'cadastro' as unknown as string,
          cancelamento_bloqueado_ate_devolucao: true,
        } as any)
        .select('id, protocolo')
        .single();

      if (error) {
        console.error('[useCriarSolicitacaoRetiradaCadastro] Erro ao criar serviço:', error);
        throw new Error('Erro ao criar solicitação de retirada');
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['retiradas'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      toast.success('Solicitação de retirada criada!', {
        description: `Protocolo: ${data.protocolo}`,
      });
    },
    onError: (error: Error) => {
      console.error('[useCriarSolicitacaoRetiradaCadastro] Erro:', error);
      toast.error(error.message || 'Erro ao criar solicitação de retirada');
    },
  });
}

// =============== TIPOS ===============

export interface AbrirRetiradaParams {
  rastreadorId: string;
  associadoId: string | null;
  veiculoId: string | null;
  // Motivo e subtipo
  motivo: MotivoRetirada;
  subTipo: SubTipoRetirada;
  novoVeiculoId?: string | null;
  // Situação financeira
  situacaoFinanceira: 'sem_debitos' | 'com_debitos' | 'nao_verificado';
  valorDebitos?: number;
  // Agendamento
  dataAgendada: string;  // YYYY-MM-DD
  periodo: Periodo;
  localTipo: 'base' | 'volante';
  localEndereco?: string;
  profissionalId: string;
  permiteEncaixe: boolean;
  // Notificação e observações
  notificarWhatsApp: boolean;
  observacoes?: string;
}

interface RetiradaFilters {
  status?: string;
  motivo?: MotivoRetirada;
  dataInicio?: string;
  dataFim?: string;
  profissionalId?: string;
}

// =============== MUTATION: ABRIR RETIRADA ===============

export function useAbrirRetirada() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AbrirRetiradaParams) => {
      // 1. Buscar dados completos do rastreador para validação
      const { data: rastreador, error: rastreadorError } = await supabase
        .from('rastreadores')
        .select(`
          id,
          codigo,
          imei,
          status,
          veiculo_id,
          veiculo:veiculos(
            id,
            placa,
            associado_id,
            associado:associados(
              id,
              nome,
              telefone,
              logradouro,
              numero,
              bairro,
              cidade,
              uf,
              cep,
              endereco_latitude,
              endereco_longitude
            )
          )
        `)
        .eq('id', params.rastreadorId)
        .single();

      if (rastreadorError) {
        console.error('[useAbrirRetirada] Erro ao buscar rastreador:', rastreadorError);
        throw new Error('Erro ao buscar dados do rastreador');
      }

      if (!rastreador.veiculo_id) {
        throw new Error('Rastreador não está instalado em um veículo');
      }

      // 2. Buscar usuário logado para registrar quem conferiu débitos
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // 3. Obter dados do associado (do veículo se disponível)
      const veiculoData = rastreador.veiculo as any;
      const associadoData = veiculoData?.associado;

      // 4. Determinar endereço baseado no localTipo
      let endereco = {
        logradouro: null as string | null,
        numero: null as string | null,
        bairro: null as string | null,
        cidade: null as string | null,
        uf: null as string | null,
        cep: null as string | null,
        latitude: null as number | null,
        longitude: null as number | null,
      };

      if (params.localTipo === 'volante' && associadoData) {
        endereco = {
          logradouro: associadoData.logradouro,
          numero: associadoData.numero,
          bairro: associadoData.bairro,
          cidade: associadoData.cidade,
          uf: associadoData.uf,
          cep: associadoData.cep,
          latitude: associadoData.endereco_latitude,
          longitude: associadoData.endereco_longitude,
        };
      }

      // 5. Criar serviço de retirada
      const servicoData = {
        tipo: 'vistoria_retirada' as const,
        status: 'agendada' as const,
        data_agendada: params.dataAgendada,
        periodo: params.periodo,
        rastreador_id: params.rastreadorId,
        veiculo_id: params.veiculoId || rastreador.veiculo_id,
        associado_id: params.associadoId || associadoData?.id || null,
        profissional_id: params.profissionalId,
        local_vistoria: params.localTipo === 'volante' ? 'cliente' : 'base',
        permite_encaixe: params.permiteEncaixe,
        observacoes: params.observacoes || null,
        // Campos específicos de retirada
        motivo_retirada: params.motivo,
        sub_tipo_retirada: params.subTipo,
        tem_debitos_pendentes: params.situacaoFinanceira === 'com_debitos' ? true : 
                                params.situacaoFinanceira === 'sem_debitos' ? false : null,
        debitos_conferidos_por: params.situacaoFinanceira !== 'nao_verificado' ? user.id : null,
        debitos_conferidos_em: params.situacaoFinanceira !== 'nao_verificado' ? new Date().toISOString() : null,
        solicitado_por_modulo: 'monitoramento' as ModuloOrigem,
        novo_veiculo_id: params.novoVeiculoId || null,
        whatsapp_notificado: params.notificarWhatsApp,
        // Endereço
        logradouro: endereco.logradouro,
        numero: endereco.numero,
        bairro: endereco.bairro,
        cidade: endereco.cidade,
        uf: endereco.uf,
        cep: endereco.cep,
        latitude: endereco.latitude,
        longitude: endereco.longitude,
      };

      const { data: servico, error: servicoError } = await supabase
        .from('servicos')
        .insert(servicoData)
        .select('id, protocolo')
        .single();

      if (servicoError) {
        console.error('[useAbrirRetirada] Erro ao criar serviço:', servicoError);
        throw new Error('Erro ao criar agendamento de retirada');
      }

      // 6. Atualizar status do rastreador para 'retirada_pendente'
      const { error: updateError } = await supabase
        .from('rastreadores')
        .update({ status: 'retirada_pendente' })
        .eq('id', params.rastreadorId);

      if (updateError) {
        console.error('[useAbrirRetirada] Erro ao atualizar rastreador:', updateError);
        // Não falha a operação, serviço já foi criado
      }

      // 7. Registrar movimentação no estoque
      await supabase
        .from('estoque_movimentacoes')
        .insert({
          rastreador_id: params.rastreadorId,
          tipo: 'saida',
          motivo: 'Envio para retirada',
          origem_destino: 'Retirada agendada',
          referencia_servico_id: servico.id,
          usuario_id: user.id,
        });

      // 8. Se notificar via WhatsApp, chamar edge function
      if (params.notificarWhatsApp && associadoData?.telefone) {
        try {
          await supabase.functions.invoke('notificar-retirada-whatsapp', {
            body: {
              servicoId: servico.id,
              associadoNome: associadoData.nome,
              associadoTelefone: associadoData.telefone || associadoData.whatsapp,
              dataAgendada: params.dataAgendada,
              periodo: params.periodo,
              veiculoPlaca: veiculoData?.placa,
              motivo: params.motivo,
            },
          });
        } catch (err) {
          console.warn('[useAbrirRetirada] Falha ao enviar WhatsApp:', err);
          // Não falha a operação principal
        }
      }

      return {
        servicoId: servico.id,
        protocolo: servico.protocolo,
        rastreadorCodigo: rastreador.codigo,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lista-rastreadores'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      queryClient.invalidateQueries({ queryKey: ['retiradas'] });

      toast.success('Retirada agendada com sucesso!', {
        description: `Protocolo: ${data.protocolo}`,
      });
    },
    onError: (error: Error) => {
      console.error('[useAbrirRetirada] Erro:', error);
      toast.error(error.message || 'Erro ao agendar retirada');
    },
  });
}

// =============== QUERY: LISTAR RETIRADAS ===============

export function useRetiradas(filters?: RetiradaFilters) {
  return useQuery({
    queryKey: ['retiradas', filters],
    queryFn: async () => {
      let query = supabase
        .from('servicos')
        .select(`
          *,
          associado:associados(id, nome, telefone, cpf),
          veiculo:veiculos!servicos_veiculo_id_fkey(id, placa, marca, modelo),
          rastreador:rastreadores(id, codigo, imei),
          profissional:profiles!servicos_profissional_id_fkey(id, nome)
        `)
        .eq('tipo', 'vistoria_retirada')
        .order('data_agendada', { ascending: false });

      // Aplicar filtros - usando casting para contornar tipagem
      if (filters?.status) {
        query = query.eq('status', filters.status as any);
      }
      if (filters?.motivo) {
        query = query.eq('motivo_retirada', filters.motivo as any);
      }
      if (filters?.dataInicio) {
        query = query.gte('data_agendada', filters.dataInicio);
      }
      if (filters?.dataFim) {
        query = query.lte('data_agendada', filters.dataFim);
      }
      if (filters?.profissionalId) {
        query = query.eq('profissional_id', filters.profissionalId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[useRetiradas] Erro ao buscar retiradas:', error);
        throw error;
      }

      return data;
    },
    staleTime: 30 * 1000,
  });
}

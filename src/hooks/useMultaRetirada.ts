import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAsaas } from './useAsaas';
import { usePermissions } from './usePermissions';
import { format, addDays } from 'date-fns';
import type { MotivoMulta, FormaCobrancaMulta } from '@/types/retirada';
import { VALOR_MULTA_NAO_DEVOLUCAO, MOTIVO_MULTA_LABELS } from '@/types/retirada';

// =============== TIPOS ===============

export interface AplicarMultaParams {
  servicoId: string;
  motivo: MotivoMulta;
  formaCobranca: FormaCobrancaMulta;
  bloquearCancelamento: boolean;
}

export interface FiltrosMulta {
  formaCobranca?: FormaCobrancaMulta;
  motivo?: MotivoMulta;
  dataDe?: string;
  dataAte?: string;
}

// =============== MUTATION: APLICAR MULTA ===============

export function useAplicarMulta() {
  const queryClient = useQueryClient();
  const { criarCobranca } = useAsaas();

  return useMutation({
    mutationFn: async (params: AplicarMultaParams) => {
      const { servicoId, motivo, formaCobranca, bloquearCancelamento } = params;

      // 1. Buscar dados do serviço para obter associado_id
      const { data: servico, error: servicoError } = await supabase
        .from('servicos')
        .select('id, associado_id, protocolo')
        .eq('id', servicoId)
        .single();

      if (servicoError || !servico) {
        throw new Error('Serviço não encontrado');
      }

      if (!servico.associado_id) {
        throw new Error('Serviço sem associado vinculado');
      }

      // 2. Atualizar serviço com dados da multa
      const updateData: Record<string, any> = {
        multa_aplicada: true,
        multa_valor: VALOR_MULTA_NAO_DEVOLUCAO,
        multa_motivo: motivo,
        multa_cobrada_em: new Date().toISOString(),
        multa_forma_cobranca: formaCobranca,
        cancelamento_bloqueado_ate_devolucao: bloquearCancelamento,
      };

      let asaasId: string | null = null;

      // 3. Se cobrança automática, criar cobrança no ASAAS
      if (formaCobranca === 'automatica_asaas') {
        try {
          const dueDate = format(addDays(new Date(), 5), 'yyyy-MM-dd');
          const descricao = `Multa rastreador - ${MOTIVO_MULTA_LABELS[motivo]} - Protocolo ${servico.protocolo}`;

          const result = await criarCobranca.mutateAsync({
            billingType: 'UNDEFINED', // Permite boleto ou PIX
            value: VALOR_MULTA_NAO_DEVOLUCAO,
            dueDate,
            description: descricao,
            externalReference: servicoId,
            tipo: 'multa_rastreador',
            associado_id: servico.associado_id,
          });

          asaasId = result?.cobranca?.asaas_id || 'PENDENTE_CONFIRMACAO';
        } catch (asaasError) {
          console.error('[useAplicarMulta] Erro ASAAS:', asaasError);
          asaasId = 'PENDENTE_CONFIG';
          toast.warning('Multa registrada, mas cobrança ASAAS não foi gerada. Verifique configurações.');
        }

        updateData.multa_asaas_id = asaasId;
      }

      // 4. Atualizar serviço
      const { error: updateError } = await supabase
        .from('servicos')
        .update(updateData)
        .eq('id', servicoId);

      if (updateError) {
        console.error('[useAplicarMulta] Erro ao atualizar serviço:', updateError);
        throw new Error('Erro ao registrar multa');
      }

      return {
        success: true,
        servicoId,
        asaasId,
        formaCobranca,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['retiradas'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      queryClient.invalidateQueries({ queryKey: ['multas-retirada'] });

      if (data.formaCobranca === 'automatica_asaas' && data.asaasId !== 'PENDENTE_CONFIG') {
        toast.success('Multa aplicada e cobrança gerada no ASAAS!');
      } else if (data.formaCobranca === 'manual_financeiro') {
        toast.success('Multa registrada para cobrança manual pelo Financeiro.');
      }
    },
    onError: (error: Error) => {
      console.error('[useAplicarMulta] Erro:', error);
      toast.error(error.message || 'Erro ao aplicar multa');
    },
  });
}

// =============== MUTATION: CANCELAR MULTA ===============

export function useCancelarMulta() {
  const queryClient = useQueryClient();
  const { isDiretor, isDesenvolvedor, isAdminMaster } = usePermissions();

  return useMutation({
    mutationFn: async (servicoId: string) => {
      // Verificar permissão
      if (!isDiretor && !isDesenvolvedor && !isAdminMaster) {
        throw new Error('Apenas Diretores podem cancelar multas');
      }

      // Buscar usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Atualizar serviço
      const { error } = await supabase
        .from('servicos')
        .update({
          multa_aplicada: false,
          cancelamento_bloqueado_ate_devolucao: false,
          multa_cancelada_em: new Date().toISOString(),
          multa_cancelada_por: user.id,
        })
        .eq('id', servicoId);

      if (error) {
        throw new Error('Erro ao cancelar multa');
      }

      return { servicoId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retiradas'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      queryClient.invalidateQueries({ queryKey: ['multas-retirada'] });
      toast.success('Multa cancelada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// =============== QUERY: CONSULTAR MULTAS ===============

export function useConsultarMultas(filtros?: FiltrosMulta) {
  return useQuery({
    queryKey: ['multas-retirada', filtros],
    queryFn: async () => {
      let query = supabase
        .from('servicos')
        .select(`
          id,
          protocolo,
          multa_aplicada,
          multa_valor,
          multa_motivo,
          multa_cobrada_em,
          multa_forma_cobranca,
          multa_asaas_id,
          cancelamento_bloqueado_ate_devolucao,
          integridade_aparelho,
          associado:associados(id, nome, cpf, telefone),
          veiculo:veiculos!servicos_veiculo_id_fkey(id, placa, marca, modelo),
          rastreador:rastreadores(id, codigo, imei)
        `)
        .eq('tipo', 'vistoria_retirada')
        .eq('multa_aplicada', true)
        .order('multa_cobrada_em', { ascending: false });

      // Aplicar filtros
      if (filtros?.formaCobranca) {
        query = query.eq('multa_forma_cobranca', filtros.formaCobranca);
      }
      if (filtros?.motivo) {
        query = query.eq('multa_motivo', filtros.motivo);
      }
      if (filtros?.dataDe) {
        query = query.gte('multa_cobrada_em', filtros.dataDe);
      }
      if (filtros?.dataAte) {
        query = query.lte('multa_cobrada_em', filtros.dataAte);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[useConsultarMultas] Erro:', error);
        throw error;
      }

      return data || [];
    },
    staleTime: 30 * 1000,
  });
}

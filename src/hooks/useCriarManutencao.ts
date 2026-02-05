import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import type { Periodo } from '@/data/autovistoriaConfig';

export interface CriarManutencaoParams {
  rastreadorId: string;
  dataAgendada: string;      // formato: YYYY-MM-DD
  periodo: Periodo;
  motivo?: string;
}

interface RastreadorInfo {
  id: string;
  codigo: string;
  veiculo_id: string | null;
  veiculo?: {
    id: string;
    associado_id: string | null;
    placa: string;
    associado?: {
      id: string;
      nome: string;
      telefone: string;
      logradouro: string | null;
      numero: string | null;
      bairro: string | null;
      cidade: string | null;
      uf: string | null;
      cep: string | null;
      endereco_latitude: number | null;
      endereco_longitude: number | null;
    } | null;
  } | null;
}

/**
 * Hook para criar um serviço de manutenção de rastreador.
 * 
 * Fluxo:
 * 1. Busca dados do rastreador (veiculo_id, associado_id)
 * 2. Atualiza rastreador.status = 'manutencao'
 * 3. Insere em servicos com tipo = 'vistoria_manutencao'
 */
export function useCriarManutencao() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (params: CriarManutencaoParams) => {
      // 1. Buscar dados do rastreador
      const { data: rastreador, error: rastreadorError } = await supabase
        .from('rastreadores')
        .select(`
          id,
          codigo,
          veiculo_id,
          veiculo:veiculos(
            id,
            associado_id,
            placa,
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
        console.error('[useCriarManutencao] Erro ao buscar rastreador:', rastreadorError);
        throw new Error('Erro ao buscar informações do rastreador');
      }

      const rastreadorInfo = rastreador as unknown as RastreadorInfo;

      // 2. Atualizar status do rastreador para manutenção
      const { error: updateError } = await supabase
        .from('rastreadores')
        .update({ 
          status: 'manutencao',
          updated_at: new Date().toISOString()
        })
        .eq('id', params.rastreadorId);

      if (updateError) {
        console.error('[useCriarManutencao] Erro ao atualizar status:', updateError);
        throw new Error('Erro ao atualizar status do rastreador');
      }

      // 3. Registrar movimentação de estoque
      await supabase.from('estoque_movimentacoes').insert({
        tipo: 'alteracao_status',
        quantidade: 1,
        status_anterior: 'instalado',
        status_novo: 'manutencao',
        rastreador_id: params.rastreadorId,
        observacoes: params.motivo || 'Enviado para manutenção',
      });

      // 4. Criar serviço de manutenção
      const associado = rastreadorInfo.veiculo?.associado;
      
      const servicoData = {
        tipo: 'vistoria_manutencao' as const,
        status: 'pendente' as const,
        data_agendada: params.dataAgendada,
        periodo: params.periodo,
        rastreador_id: params.rastreadorId,
        veiculo_id: rastreadorInfo.veiculo_id,
        associado_id: associado?.id || null,
        local_vistoria: 'cliente',
        observacoes: params.motivo || 'Manutenção de rastreador',
        permite_encaixe: true,
        // Endereço do associado
        logradouro: associado?.logradouro || null,
        numero: associado?.numero || null,
        bairro: associado?.bairro || null,
        cidade: associado?.cidade || null,
        uf: associado?.uf || null,
        cep: associado?.cep || null,
        latitude: associado?.endereco_latitude || null,
        longitude: associado?.endereco_longitude || null,
      };

      const { data: servico, error: servicoError } = await supabase
        .from('servicos')
        .insert(servicoData)
        .select('id, protocolo')
        .single();

      if (servicoError) {
        console.error('[useCriarManutencao] Erro ao criar serviço:', servicoError);
        throw new Error('Erro ao criar agendamento de manutenção');
      }

      return {
        servicoId: servico.id,
        protocolo: servico.protocolo,
        rastreadorCodigo: rastreadorInfo.codigo,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lista-rastreadores'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-movimentacoes'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      
      toast.success('Manutenção agendada com sucesso!', {
        description: `Rastreador ${data.rastreadorCodigo} foi enviado para manutenção`,
      });
    },
    onError: (error: Error) => {
      console.error('[useCriarManutencao] Erro:', error);
      toast.error(error.message || 'Erro ao agendar manutenção');
    },
  });
}

/**
 * Helper para verificar se um tipo de serviço é manutenção
 */
export function isManutencao(tipo: string): boolean {
  return tipo === 'vistoria_manutencao';
}

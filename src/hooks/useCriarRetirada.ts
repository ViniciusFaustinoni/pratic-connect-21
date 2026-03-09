import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Periodo } from '@/data/autovistoriaConfig';

export interface CriarRetiradaParams {
  rastreadorId: string;
  dataAgendada: string;      // formato: YYYY-MM-DD
  periodo: Periodo;
  motivo?: string;
  enderecoAlternativo?: {
    cep?: string;
    logradouro?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
  };
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
 * Hook para criar um serviço de retirada de rastreador.
 * 
 * Fluxo:
 * 1. Busca dados do rastreador (veiculo_id, associado_id)
 * 2. Insere em servicos com tipo = 'vistoria_retirada'
 * 3. O rastreador será desativado e desvinculado após conclusão pelo vistoriador
 */
export function useCriarRetirada() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CriarRetiradaParams) => {
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
        console.error('[useCriarRetirada] Erro ao buscar rastreador:', rastreadorError);
        throw new Error('Erro ao buscar informações do rastreador');
      }

      const rastreadorInfo = rastreador as unknown as RastreadorInfo;

      if (!rastreadorInfo.veiculo) {
        throw new Error('Rastreador não está vinculado a um veículo');
      }

      // 2. Criar serviço de retirada
      const associado = rastreadorInfo.veiculo?.associado;
      
      const servicoData = {
        tipo: 'vistoria_retirada' as const,
        status: 'pendente' as const,
        data_agendada: params.dataAgendada,
        periodo: params.periodo,
        rastreador_id: params.rastreadorId,
        veiculo_id: rastreadorInfo.veiculo_id,
        associado_id: associado?.id || null,
        local_vistoria: 'cliente',
        observacoes: params.motivo || 'Retirada de rastreador',
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
        console.error('[useCriarRetirada] Erro ao criar serviço:', servicoError);
        throw new Error('Erro ao criar agendamento de retirada');
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
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      
      toast.success('Retirada agendada com sucesso!', {
        description: `Rastreador ${data.rastreadorCodigo} será retirado pelo vistoriador`,
      });
    },
    onError: (error: Error) => {
      console.error('[useCriarRetirada] Erro:', error);
      toast.error(error.message || 'Erro ao agendar retirada');
    },
  });
}

/**
 * Helper para verificar se um tipo de serviço é retirada
 */
export function isRetirada(tipo: string): boolean {
  return tipo === 'vistoria_retirada';
}

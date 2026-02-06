import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface BlacklistVeiculo {
  id: string;
  placa: string;
  chassi: string | null;
  motivo: string;
  justificativa: string | null;
  tipo_reprovacao: 'vistoria_reprovada' | 'proposta_reprovada' | 'associado_bloqueado';
  veiculo_id: string | null;
  associado_id: string | null;
  contrato_id: string | null;
  cotacao_id: string | null;
  adicionado_por: string | null;
  created_at: string;
  removido_em: string | null;
  removido_por: string | null;
  ativo: boolean;
  // Relações
  associado?: { nome: string; cpf: string } | null;
  adicionado_por_profile?: { nome: string } | null;
  removido_por_profile?: { nome: string } | null;
}

// Hook para listar veículos na blacklist
export function useBlacklistVeiculos(apenasAtivos = true) {
  return useQuery({
    queryKey: ['blacklist-veiculos', apenasAtivos],
    queryFn: async (): Promise<BlacklistVeiculo[]> => {
      let query = supabase
        .from('blacklist_veiculos')
        .select(`
          *,
          associado:associados(nome, cpf),
          adicionado_por_profile:profiles!blacklist_veiculos_adicionado_por_fkey(nome),
          removido_por_profile:profiles!blacklist_veiculos_removido_por_fkey(nome)
        `)
        .order('created_at', { ascending: false });

      if (apenasAtivos) {
        query = query.eq('ativo', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as BlacklistVeiculo[];
    },
  });
}

// Hook para verificar se uma placa está na blacklist
export function useVerificarBlacklist(placa: string | undefined) {
  return useQuery({
    queryKey: ['blacklist-check', placa],
    queryFn: async () => {
      if (!placa) return null;

      const { data, error } = await supabase
        .from('blacklist_veiculos')
        .select('id, motivo, tipo_reprovacao, created_at')
        .eq('placa', placa.toUpperCase().replace(/[^A-Z0-9]/g, ''))
        .eq('ativo', true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!placa,
  });
}

// Hook para adicionar veículo à blacklist
export function useAdicionarBlacklist() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      placa: string;
      chassi?: string;
      motivo: string;
      justificativa?: string;
      tipo_reprovacao: 'vistoria_reprovada' | 'proposta_reprovada' | 'associado_bloqueado';
      veiculo_id?: string;
      associado_id?: string;
      contrato_id?: string;
      cotacao_id?: string;
    }) => {
      const { error } = await supabase
        .from('blacklist_veiculos')
        .insert({
          placa: data.placa.toUpperCase().replace(/[^A-Z0-9]/g, ''),
          chassi: data.chassi,
          motivo: data.motivo,
          justificativa: data.justificativa,
          tipo_reprovacao: data.tipo_reprovacao,
          veiculo_id: data.veiculo_id,
          associado_id: data.associado_id,
          contrato_id: data.contrato_id,
          cotacao_id: data.cotacao_id,
          adicionado_por: profile?.id,
          ativo: true,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blacklist-veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['blacklist-check'] });
      toast.success('Veículo adicionado à blacklist');
    },
    onError: (error) => {
      console.error('Erro ao adicionar à blacklist:', error);
      toast.error('Erro ao adicionar veículo à blacklist');
    },
  });
}

// Hook para remover veículo da blacklist (marcar como inativo)
export function useRemoverBlacklist() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      id, 
      reverterVeiculo = false 
    }: { 
      id: string; 
      reverterVeiculo?: boolean;
    }) => {
      // Buscar dados da blacklist antes de remover (incluindo contrato e cotação)
      const { data: blacklistItem, error: fetchError } = await supabase
        .from('blacklist_veiculos')
        .select('veiculo_id, associado_id, contrato_id, cotacao_id')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Desativar na blacklist
      const { error } = await supabase
        .from('blacklist_veiculos')
        .update({
          ativo: false,
          removido_em: new Date().toISOString(),
          removido_por: profile?.id,
        })
        .eq('id', id);

      if (error) throw error;

      // Se solicitado reverter status do veículo (reset completo do processo)
      if (reverterVeiculo && blacklistItem?.veiculo_id) {
        // FALLBACK: Buscar contrato e cotação pelo associado se não existirem na blacklist
        let contratoId = blacklistItem.contrato_id;
        let cotacaoId = blacklistItem.cotacao_id;

        if (blacklistItem.associado_id && (!contratoId || !cotacaoId)) {
          const { data: contratosData } = await supabase
            .from('contratos')
            .select('id, cotacao_id')
            .eq('associado_id', blacklistItem.associado_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (contratosData) {
            contratoId = contratoId || contratosData.id;
            cotacaoId = cotacaoId || contratosData.cotacao_id;
          }
        }

        // 1. Reverter veículo para 'em_analise'
        const { error: veiculoError } = await supabase
          .from('veiculos')
          .update({ 
            status: 'em_analise',
            motivo_recusa_veiculo: null,
          })
          .eq('id', blacklistItem.veiculo_id);

        if (veiculoError) {
          console.error('Erro ao reverter status do veículo:', veiculoError);
        }

        // 2. Reverter associado para 'pendente_vistoria'
        if (blacklistItem.associado_id) {
          const { error: associadoError } = await supabase
            .from('associados')
            .update({ 
              status: 'pendente_vistoria' as any,
              bloqueado: false,
              motivo_bloqueio: null,
            })
            .eq('id', blacklistItem.associado_id);

          if (associadoError) {
            console.error('Erro ao reverter status do associado:', associadoError);
          }
        }

        // 3. Resetar contrato para rascunho (nova assinatura e pagamento obrigatórios)
        if (contratoId) {
          const { error: contratoError } = await supabase
            .from('contratos')
            .update({
              status: 'rascunho',
              // Limpar dados do Autentique (assinatura)
              autentique_documento_id: null,
              autentique_url: null,
              autentique_status: null,
              pdf_url: null,
              pdf_assinado_url: null,
              data_envio: null,
              data_visualizacao: null,
              data_assinatura: null,
              // Limpar dados de pagamento
              adesao_paga: false,
              adesao_paga_em: null,
              adesao_cobranca_id: null,
              // Limpar dados de aprovação
              aprovado_por: null,
              aprovado_em: null,
              observacao_aprovacao: null,
              // Limpar dados de vistoria
              vistoria_concluida_em: null,
              vistoria_id: null,
            })
            .eq('id', contratoId);

          if (contratoError) {
            console.error('Erro ao resetar contrato:', contratoError);
          }
        }

        // 4. Resetar cotação para aceita - aguardando vistoria
        if (cotacaoId) {
          const { error: cotacaoError } = await supabase
            .from('cotacoes')
            .update({
              status: 'aceita',
              status_contratacao: 'aguardando_vistoria',
              vistoria_concluida_em: null,
              vistoria_id: null,
            })
            .eq('id', cotacaoId);

          if (cotacaoError) {
            console.error('Erro ao resetar cotação:', cotacaoError);
          }
        }

        // 5. Limpar referência de vistoria_id na blacklist ANTES de excluir vistorias
        await supabase
          .from('blacklist_veiculos')
          .update({ vistoria_id: null })
          .eq('veiculo_id', blacklistItem.veiculo_id);

        // 6. Excluir vistorias antigas do veículo (para nova vistoria limpa)
        const { error: vistoriaError } = await supabase
          .from('vistorias')
          .delete()
          .eq('veiculo_id', blacklistItem.veiculo_id);

        if (vistoriaError) {
          console.error('Erro ao excluir vistorias antigas:', vistoriaError);
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['blacklist-veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['blacklist-check'] });
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['associados'] });
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      queryClient.invalidateQueries({ queryKey: ['propostas'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias'] });
      
      if (variables.reverterVeiculo) {
        toast.success('Veículo removido da blacklist e processo resetado para nova contratação');
      } else {
        toast.success('Veículo removido da blacklist');
      }
    },
    onError: (error) => {
      console.error('Erro ao remover da blacklist:', error);
      toast.error('Erro ao remover veículo da blacklist');
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type AcaoRecusa = 'reverter_recusa' | 'cancelar_contrato' | 'blacklist' | 'nova_vistoria';

export interface RecusaInstalador {
  id: string;
  status: string;
  decisao_instalador: string;
  ressalvas_instalador: string | null;
  fotos_ressalva: string[] | null;
  updated_at: string;
  veiculo_id: string;
  associado_id: string;
  profissional_id: string | null;
  tipo: string;
  associado_nome: string | null;
  veiculo_placa: string | null;
  veiculo_modelo: string | null;
  veiculo_marca: string | null;
  instalador_nome: string | null;
}

export function useRecusasInstalador() {
  return useQuery({
    queryKey: ['recusas-instalador'],
    queryFn: async () => {
      // Query servicos with decisao_instalador = 'negado'
      const { data, error } = await supabase
        .from('servicos')
        .select(`
          id, status, decisao_instalador, ressalvas_instalador, fotos_ressalva,
          updated_at, veiculo_id, associado_id, profissional_id, tipo,
          associados!inner(nome),
          veiculos!inner(placa, modelo, marca),
          profiles!servicos_profissional_id_fkey(nome)
        `)
        .eq('decisao_instalador', 'negado')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((s: any) => ({
        id: s.id,
        status: s.status,
        decisao_instalador: s.decisao_instalador,
        ressalvas_instalador: s.ressalvas_instalador,
        fotos_ressalva: s.fotos_ressalva,
        updated_at: s.updated_at,
        veiculo_id: s.veiculo_id,
        associado_id: s.associado_id,
        profissional_id: s.profissional_id,
        tipo: s.tipo,
        associado_nome: s.associados?.nome || null,
        veiculo_placa: s.veiculos?.placa || null,
        veiculo_modelo: s.veiculos?.modelo || null,
        veiculo_marca: s.veiculos?.marca || null,
        instalador_nome: s.profiles?.nome || null,
      })) as RecusaInstalador[];
    },
  });
}

export function useContagemRecusasPendentes() {
  return useQuery({
    queryKey: ['recusas-instalador-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('servicos')
        .select('id', { count: 'exact', head: true })
        .eq('decisao_instalador', 'negado')
        .eq('status', 'em_analise');

      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 60000,
  });
}

export function useResolverRecusa() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      servicoId: string;
      veiculoId: string;
      associadoId: string;
      placa: string;
      acao: AcaoRecusa;
      justificativa: string;
    }) => {
      const { servicoId, veiculoId, associadoId, placa, acao, justificativa } = params;
      const agora = new Date().toISOString();

      switch (acao) {
        case 'reverter_recusa': {
          // Reset service to agendada
          const { error } = await supabase
            .from('servicos')
            .update({
              status: 'agendada',
              decisao_instalador: null,
              ressalvas_instalador: null,
              fotos_ressalva: null,
              observacoes: `Recusa revertida: ${justificativa}`,
              updated_at: agora,
            })
            .eq('id', servicoId);
          if (error) throw error;

          await supabase.from('associados_historico').insert({
            associado_id: associadoId,
            tipo: 'recusa_revertida',
            descricao: `Recusa do instalador revertida. Instalação reagendada. Justificativa: ${justificativa}`,
            dados_novos: { servico_id: servicoId, acao, justificativa, resolvido_por: profile?.id },
            usuario_id: profile?.id,
          });
          break;
        }

        case 'cancelar_contrato': {
          // Cancel service
          await supabase
            .from('servicos')
            .update({ status: 'cancelada', observacoes: `Contrato cancelado após recusa: ${justificativa}`, updated_at: agora })
            .eq('id', servicoId);

          // Cancel associado
          await supabase
            .from('associados')
            .update({
              status: 'cancelado',
              motivo_cancelamento: `Veículo negado pelo instalador: ${justificativa}`,
              data_cancelamento: agora,
              cancelado_por: profile?.id,
              updated_at: agora,
            })
            .eq('id', associadoId);

          // Cancel active contracts
          await supabase
            .from('contratos')
            .update({ status: 'cancelado', updated_at: agora })
            .eq('associado_id', associadoId)
            .in('status', ['ativo', 'pendente']);

          await supabase.from('associados_historico').insert({
            associado_id: associadoId,
            tipo: 'contrato_cancelado_recusa',
            descricao: `Contrato cancelado após negação do instalador. Justificativa: ${justificativa}`,
            dados_novos: { servico_id: servicoId, acao, justificativa, resolvido_por: profile?.id },
            usuario_id: profile?.id,
          });
          break;
        }

        case 'blacklist': {
          // Add to blacklist
          await supabase.from('blacklist_veiculos').insert({
            placa: placa.toUpperCase().replace(/[^A-Z0-9]/g, ''),
            motivo: `Negado pelo instalador: ${justificativa}`,
            tipo_reprovacao: 'associado_bloqueado',
            veiculo_id: veiculoId,
            associado_id: associadoId,
            adicionado_por: profile?.id,
            ativo: true,
          });

          // Cancel service + associado + contracts
          await supabase
            .from('servicos')
            .update({ status: 'cancelada', observacoes: `Blacklist após recusa: ${justificativa}`, updated_at: agora })
            .eq('id', servicoId);

          await supabase
            .from('associados')
            .update({
              status: 'cancelado',
              motivo_cancelamento: `Blacklist - negado pelo instalador: ${justificativa}`,
              data_cancelamento: agora,
              cancelado_por: profile?.id,
              updated_at: agora,
            })
            .eq('id', associadoId);

          await supabase
            .from('contratos')
            .update({ status: 'cancelado', updated_at: agora })
            .eq('associado_id', associadoId)
            .in('status', ['ativo', 'pendente']);

          await supabase.from('associados_historico').insert({
            associado_id: associadoId,
            tipo: 'blacklist_recusa_instalador',
            descricao: `Veículo incluído na blacklist após negação do instalador. Justificativa: ${justificativa}`,
            dados_novos: { servico_id: servicoId, veiculo_id: veiculoId, placa, acao, justificativa, resolvido_por: profile?.id },
            usuario_id: profile?.id,
          });
          break;
        }

        case 'nova_vistoria': {
          // Cancel current service
          await supabase
            .from('servicos')
            .update({ status: 'cancelada', observacoes: `Nova vistoria solicitada: ${justificativa}`, updated_at: agora })
            .eq('id', servicoId);

          // Create new vistoria_entrada
          await supabase.from('servicos').insert({
            tipo: 'vistoria_entrada',
            status: 'pendente',
            veiculo_id: veiculoId,
            associado_id: associadoId,
            data_agendada: agora.split('T')[0],
            periodo: 'manha',
            observacoes: `Nova vistoria solicitada após recusa do instalador: ${justificativa}`,
          });

          await supabase.from('associados_historico').insert({
            associado_id: associadoId,
            tipo: 'nova_vistoria_recusa',
            descricao: `Nova vistoria solicitada após negação do instalador. Justificativa: ${justificativa}`,
            dados_novos: { servico_id: servicoId, acao, justificativa, resolvido_por: profile?.id },
            usuario_id: profile?.id,
          });
          break;
        }
      }

      return { sucesso: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recusas-instalador'] });
      queryClient.invalidateQueries({ queryKey: ['recusas-instalador-count'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      queryClient.invalidateQueries({ queryKey: ['associados'] });
      queryClient.invalidateQueries({ queryKey: ['blacklist-veiculos'] });
      toast.success('Decisão registrada com sucesso.');
    },
    onError: (error) => {
      console.error('Erro ao resolver recusa:', error);
      toast.error('Erro ao processar decisão');
    },
  });
}

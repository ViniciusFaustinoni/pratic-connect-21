import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface RessalvaMonitoramento {
  id: string;
  status: string;
  decisao_instalador: string;
  ressalvas_instalador: string | null;
  fotos_ressalva: string[] | null;
  checklist_data: Record<string, unknown> | null;
  updated_at: string;
  created_at: string;
  data_agendada: string;
  veiculo_id: string;
  associado_id: string;
  profissional_id: string | null;
  tipo: string;
  associado_nome: string | null;
  associado_cpf: string | null;
  associado_telefone: string | null;
  veiculo_placa: string | null;
  veiculo_modelo: string | null;
  veiculo_marca: string | null;
  instalador_nome: string | null;
}

export function useRessalvasPendentesMonitoramento() {
  return useQuery({
    queryKey: ['ressalvas-monitoramento'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('servicos')
        .select(`
          id, status, decisao_instalador, ressalvas_instalador, fotos_ressalva,
          checklist_data, updated_at, created_at, data_agendada, veiculo_id, 
          associado_id, profissional_id, tipo,
          associados!servicos_associado_id_fkey(nome, cpf, telefone),
          veiculos!servicos_veiculo_id_fkey(placa, modelo, marca),
          profiles!servicos_profissional_id_fkey(nome)
        `)
        .eq('decisao_instalador', 'pendente_monitoramento')
        .eq('status', 'em_analise')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((s: any) => ({
        id: s.id,
        status: s.status,
        decisao_instalador: s.decisao_instalador,
        ressalvas_instalador: s.ressalvas_instalador,
        fotos_ressalva: s.fotos_ressalva,
        checklist_data: s.checklist_data,
        updated_at: s.updated_at,
        created_at: s.created_at,
        data_agendada: s.data_agendada,
        veiculo_id: s.veiculo_id,
        associado_id: s.associado_id,
        profissional_id: s.profissional_id,
        tipo: s.tipo,
        associado_nome: s.associados?.nome || null,
        associado_cpf: s.associados?.cpf || null,
        associado_telefone: s.associados?.telefone || null,
        veiculo_placa: s.veiculos?.placa || null,
        veiculo_modelo: s.veiculos?.modelo || null,
        veiculo_marca: s.veiculos?.marca || null,
        instalador_nome: s.profiles?.nome || null,
      })) as RessalvaMonitoramento[];
    },
  });
}

export function useContagemRessalvasMonitoramento() {
  return useQuery({
    queryKey: ['ressalvas-monitoramento-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('servicos')
        .select('id', { count: 'exact', head: true })
        .eq('decisao_instalador', 'pendente_monitoramento')
        .eq('status', 'em_analise');

      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 60000,
  });
}

export function useDecidirRessalva() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      servicoId: string;
      veiculoId: string;
      associadoId: string;
      placa: string;
      decisao: 'aprovar' | 'declinar';
      justificativa?: string;
    }) => {
      const { servicoId, veiculoId, associadoId, placa, decisao, justificativa } = params;
      const agora = new Date().toISOString();

      if (decisao === 'aprovar') {
        // Aprovar: seguir para análise de cadastro
        const { error } = await supabase
          .from('servicos')
          .update({
            status: 'concluida',
            decisao_instalador: 'aprovado_ressalva',
            observacoes: `Ressalva aprovada pelo monitoramento${justificativa ? ': ' + justificativa : ''}`,
            updated_at: agora,
          })
          .eq('id', servicoId);
        if (error) throw error;

        // Atualizar veículo para ativo
        await supabase
          .from('veiculos')
          .update({ status: 'ativo', updated_at: agora })
          .eq('id', veiculoId);

        // Atualizar associado para em_analise (análise cadastral)
        const { data: associadoAtual } = await supabase
          .from('associados')
          .select('status')
          .eq('id', associadoId)
          .single();

        if (associadoAtual?.status !== 'ativo') {
          await supabase
            .from('associados')
            .update({ status: 'em_analise', updated_at: agora })
            .eq('id', associadoId)
            .in('status', ['pendente_vistoria', 'aguardando_instalacao']);
        }

        await supabase.from('associados_historico').insert({
          associado_id: associadoId,
          tipo: 'ressalva_aprovada_monitoramento',
          descricao: `Ressalva aprovada pelo monitoramento. Seguindo para análise cadastral.${justificativa ? ' Obs: ' + justificativa : ''}`,
          dados_novos: { servico_id: servicoId, decisao, aprovado_por: profile?.id },
          usuario_id: profile?.id,
        });
      } else {
        // Declinar: blacklist + cancelar
        await supabase.from('blacklist_veiculos').insert({
          placa: placa.toUpperCase().replace(/[^A-Z0-9]/g, ''),
          motivo: `Ressalva declinada pelo monitoramento${justificativa ? ': ' + justificativa : ''}`,
          tipo_reprovacao: 'associado_bloqueado',
          veiculo_id: veiculoId,
          associado_id: associadoId,
          adicionado_por: profile?.id,
          ativo: true,
        });

        await supabase
          .from('servicos')
          .update({
            status: 'cancelada',
            decisao_instalador: 'declinado_monitoramento',
            observacoes: `Ressalva declinada pelo monitoramento - blacklist${justificativa ? ': ' + justificativa : ''}`,
            updated_at: agora,
          })
          .eq('id', servicoId);

        await supabase
          .from('associados')
          .update({
            status: 'cancelado',
            motivo_cancelamento: `Ressalva declinada pelo monitoramento${justificativa ? ': ' + justificativa : ''}`,
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
          tipo: 'ressalva_declinada_monitoramento',
          descricao: `Ressalva declinada pelo monitoramento. Veículo incluído na blacklist.${justificativa ? ' Obs: ' + justificativa : ''}`,
          dados_novos: { servico_id: servicoId, veiculo_id: veiculoId, placa, decisao, declinado_por: profile?.id },
          usuario_id: profile?.id,
        });
      }

      return { sucesso: true, decisao };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['ressalvas-monitoramento'] });
      queryClient.invalidateQueries({ queryKey: ['ressalvas-monitoramento-count'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      queryClient.invalidateQueries({ queryKey: ['associados'] });
      queryClient.invalidateQueries({ queryKey: ['blacklist-veiculos'] });
      toast.success(
        result.decisao === 'aprovar'
          ? 'Ressalva aprovada! Seguindo para análise cadastral.'
          : 'Ressalva declinada. Veículo incluído na blacklist.'
      );
    },
    onError: (error) => {
      console.error('Erro ao decidir ressalva:', error);
      toast.error('Erro ao processar decisão');
    },
  });
}

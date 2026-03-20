import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ==============================
// Query: Instalações aguardando aprovação do monitoramento
// ==============================
export function useInstalacoesAguardandoAprovacao() {
  return useQuery({
    queryKey: ['instalacoes-aguardando-aprovacao-monitoramento'],
    queryFn: async () => {
      // Buscar serviços de instalação concluídos
      const { data: servicos, error } = await supabase
        .from('servicos')
        .select(`
          id,
          tipo,
          status,
          data_servico,
          concluido_em,
          profissional_id,
          veiculo_id,
          associado_id,
          instalacao_origem_id,
          observacoes,
          decisao_instalador,
          profissional:profissional_id(nome),
          veiculo:veiculo_id(placa, marca, modelo, ano_modelo, cobertura_roubo_furto, cobertura_total),
          associado:associado_id(nome, telefone, email, cpf, status)
        `)
        .eq('tipo', 'instalacao')
        .eq('status', 'concluida')
        .order('concluido_em', { ascending: true });

      if (error) throw error;

      // Filtrar: veículo com cobertura_roubo_furto = true e cobertura_total = false
      const pendentes = (servicos || []).filter((s: any) => {
        const v = s.veiculo;
        return v && v.cobertura_roubo_furto === true && v.cobertura_total === false;
      });

      return pendentes;
    },
    refetchInterval: 30000,
  });
}

// ==============================
// Stats
// ==============================
export function useAprovacaoMonitoramentoStats() {
  return useQuery({
    queryKey: ['aprovacao-monitoramento-stats'],
    queryFn: async () => {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const hojeISO = hoje.toISOString();

      // Aguardando = servicos concluidos com veículo sem cobertura_total
      const { data: pendentes } = await supabase
        .from('servicos')
        .select('id, veiculo:veiculo_id(cobertura_roubo_furto, cobertura_total)')
        .eq('tipo', 'instalacao')
        .eq('status', 'concluida');

      const aguardando = (pendentes || []).filter((s: any) => 
        s.veiculo?.cobertura_roubo_furto === true && s.veiculo?.cobertura_total === false
      ).length;

      // Aprovados hoje = histórico com tipo aprovação do monitoramento hoje
      const { count: aprovadosHoje } = await supabase
        .from('associados_historico')
        .select('id', { count: 'exact', head: true })
        .eq('tipo', 'protecao_360_aprovada_monitoramento')
        .gte('created_at', hojeISO);

      // Reprovados hoje
      const { count: reprovadosHoje } = await supabase
        .from('associados_historico')
        .select('id', { count: 'exact', head: true })
        .eq('tipo', 'protecao_360_reprovada_monitoramento')
        .gte('created_at', hojeISO);

      return {
        aguardando,
        aprovadosHoje: aprovadosHoje || 0,
        reprovadosHoje: reprovadosHoje || 0,
      };
    },
    refetchInterval: 30000,
  });
}

// ==============================
// Mutation: Aprovar instalação (ativa Proteção 360 + notifica)
// ==============================
interface AprovarData {
  servicoId: string;
  veiculoId: string;
  associadoId: string;
  observacoes?: string;
}

export function useAprovarInstalacaoMonitoramento() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: AprovarData) => {
      const agora = new Date().toISOString();

      // 1. Ativar cobertura total no veículo
      const { error: veiculoError } = await supabase
        .from('veiculos')
        .update({
          cobertura_total: true,
          updated_at: agora,
        })
        .eq('id', data.veiculoId);

      if (veiculoError) throw veiculoError;

      // 2. Ativar associado
      const { error: associadoError } = await supabase
        .from('associados')
        .update({
          status: 'ativo',
          data_ativacao: agora,
          updated_at: agora,
        })
        .eq('id', data.associadoId);

      if (associadoError) throw associadoError;

      // 3. Buscar cotação e contrato para atualizar
      const { data: servicoData } = await supabase
        .from('servicos')
        .select('instalacao_origem_id')
        .eq('id', data.servicoId)
        .single();

      // Tentar atualizar cotação via instalação
      if (servicoData?.instalacao_origem_id) {
        const { data: instalacao } = await supabase
          .from('instalacoes')
          .select('cotacao_id, contrato_id')
          .eq('id', servicoData.instalacao_origem_id)
          .single();

        if (instalacao?.cotacao_id) {
          await supabase
            .from('cotacoes')
            .update({ status_contratacao: 'ativo' })
            .eq('id', instalacao.cotacao_id);
        }

        if (instalacao?.contrato_id) {
          await supabase
            .from('contratos')
            .update({ status: 'ativo' })
            .eq('id', instalacao.contrato_id);
        }
      }

      // 4. Registrar histórico
      await supabase.from('associados_historico').insert({
        associado_id: data.associadoId,
        tipo: 'protecao_360_aprovada_monitoramento',
        descricao: `Proteção 360 aprovada pelo monitoramento${data.observacoes ? ` — ${data.observacoes}` : ''}`,
        dados_novos: {
          servico_id: data.servicoId,
          veiculo_id: data.veiculoId,
          aprovado_por: profile?.id,
        },
        usuario_id: profile?.id,
      });

      // 5. Enviar notificação de cobertura total ativada
      try {
        const { data: veiculoInfo } = await supabase
          .from('veiculos')
          .select('placa, marca, modelo')
          .eq('id', data.veiculoId)
          .single();

        await supabase.functions.invoke('notificar-cliente', {
          body: {
            tipo: 'cobertura_total_ativada',
            associado_id: data.associadoId,
            dados: {
              placa: veiculoInfo?.placa || '',
              marca: veiculoInfo?.marca || '',
              modelo: veiculoInfo?.modelo || '',
            },
          },
        });
      } catch (err) {
        console.warn('[aprovar-monitoramento] Erro ao notificar (não crítico):', err);
      }

      return { sucesso: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instalacoes-aguardando-aprovacao-monitoramento'] });
      queryClient.invalidateQueries({ queryKey: ['aprovacao-monitoramento-stats'] });
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['associados'] });
      toast.success('Proteção 360 ativada com sucesso! Associado notificado.');
    },
    onError: (error) => {
      console.error('Erro ao aprovar instalação:', error);
      toast.error('Erro ao aprovar instalação');
    },
  });
}

// ==============================
// Mutation: Reprovar instalação
// ==============================
interface ReprovarData {
  servicoId: string;
  veiculoId: string;
  associadoId: string;
  motivo: string;
}

export function useReprovarInstalacaoMonitoramento() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: ReprovarData) => {
      const agora = new Date().toISOString();

      // 1. Marcar serviço como reprovado
      const { error: servicoError } = await supabase
        .from('servicos')
        .update({
          status: 'reprovada_monitoramento',
          observacoes: `Reprovado pelo monitoramento: ${data.motivo}`,
          updated_at: agora,
        } as any)
        .eq('id', data.servicoId);

      if (servicoError) throw servicoError;

      // 2. Registrar histórico
      await supabase.from('associados_historico').insert({
        associado_id: data.associadoId,
        tipo: 'protecao_360_reprovada_monitoramento',
        descricao: `Proteção 360 reprovada pelo monitoramento — ${data.motivo}`,
        dados_novos: {
          servico_id: data.servicoId,
          veiculo_id: data.veiculoId,
          motivo: data.motivo,
          reprovado_por: profile?.id,
        },
        usuario_id: profile?.id,
      });

      return { sucesso: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instalacoes-aguardando-aprovacao-monitoramento'] });
      queryClient.invalidateQueries({ queryKey: ['aprovacao-monitoramento-stats'] });
      toast.success('Instalação reprovada. Coordenador será notificado.');
    },
    onError: (error) => {
      console.error('Erro ao reprovar instalação:', error);
      toast.error('Erro ao reprovar instalação');
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface InstalacaoCompleta {
  id: string;
  status: string;
  data_agendada: string | null;
  periodo: string | null;
  concluida_em: string | null;
  observacoes: string | null;
  associados: {
    id: string;
    nome: string;
    email: string;
    telefone: string;
    cpf: string;
    status: string;
  } | null;
  veiculos: {
    id: string;
    placa: string;
    marca: string | null;
    modelo: string | null;
    ano_modelo: number | null;
    cor: string | null;
    chassi: string | null;
    cobertura_total: boolean | null;
    cobertura_roubo_furto: boolean | null;
    status: string;
  } | null;
  rastreadores: {
    id: string;
    imei: string;
    codigo: string | null;
    numero_serie: string | null;
    plataforma: string | null;
    status: string;
    plataforma_device_id: string | null;
    plataforma_veiculo_id: string | null;
  } | null;
  instalador: {
    id: string;
    nome: string;
  } | null;
}

interface AtivarRastreadorParams {
  instalacaoId: string;
  veiculoId: string;
  associadoId: string;
  rastreadorId: string;
  imei: string;
}

/**
 * Hook para buscar dados de uma instalação completa para análise
 */
export function useInstalacaoParaAnalise(instalacaoId: string | undefined) {
  return useQuery({
    queryKey: ['instalacao-analise', instalacaoId],
    queryFn: async () => {
      if (!instalacaoId) return null;

      const { data, error } = await supabase
        .from('instalacoes')
        .select(`
          id,
          status,
          data_agendada,
          periodo,
          concluida_em,
          observacoes,
          associados (
            id, nome, email, telefone, cpf, status
          ),
          veiculos (
            id, placa, marca, modelo, ano_modelo, cor, chassi,
            cobertura_total, cobertura_roubo_furto, status
          ),
          rastreadores (
            id, imei, codigo, numero_serie, plataforma, status,
            plataforma_device_id, plataforma_veiculo_id
          ),
          instalador:profiles!instalacoes_instalador_id_fkey (id, nome)
        `)
        .eq('id', instalacaoId)
        .single();

      if (error) throw error;
      return data as InstalacaoCompleta;
    },
    enabled: !!instalacaoId,
  });
}

/**
 * Hook para buscar instalações aguardando ativação de rastreador
 */
export function useInstalacoesAguardandoAtivacao() {
  return useQuery({
    queryKey: ['instalacoes-aguardando-ativacao'],
    queryFn: async () => {
      // Buscar instalações concluídas onde o veículo tem cobertura_roubo_furto
      // mas NÃO tem cobertura_total (rastreador não ativado na plataforma)
      const { data, error } = await supabase
        .from('instalacoes')
        .select(`
          id,
          status,
          concluida_em,
          associados (id, nome, telefone),
          veiculos!inner (
            id, placa, marca, modelo, 
            cobertura_total, cobertura_roubo_furto, status
          ),
          rastreadores (id, imei, codigo, plataforma, status)
        `)
        .eq('status', 'concluida')
        .eq('veiculos.cobertura_roubo_furto', true)
        .eq('veiculos.cobertura_total', false)
        .order('concluida_em', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

/**
 * Hook para ativar rastreador na plataforma (Softruck, etc)
 */
export function useAtivarRastreadorPlataforma() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (params: AtivarRastreadorParams) => {
      const { instalacaoId, veiculoId, associadoId, rastreadorId, imei } = params;

      // 1. Buscar plataforma do rastreador
      const { data: rastreador, error: rastError } = await supabase
        .from('rastreadores')
        .select('plataforma')
        .eq('id', rastreadorId)
        .single();

      if (rastError) throw new Error('Erro ao buscar dados do rastreador');

      // 2. Buscar email do associado
      const { data: associado } = await supabase
        .from('associados')
        .select('email')
        .eq('id', associadoId)
        .single();

      // 3. Chamar Edge Function de ativação baseado na plataforma
      if (rastreador.plataforma === 'softruck') {
        const { data: result, error } = await supabase.functions.invoke('softruck-ativar-dispositivo', {
          body: {
            imei,
            veiculoId,
            associadoId,
            associadoEmail: associado?.email,
          },
        });

        if (error) throw error;
        if (!result.success) throw new Error(result.error || 'Erro ao ativar na Softruck');
      }

      // 4. Atualizar veículo com cobertura_total = true
      const { error: veicError } = await supabase
        .from('veiculos')
        .update({
          cobertura_total: true,
          status: 'ativo',
          updated_at: new Date().toISOString(),
        })
        .eq('id', veiculoId);

      if (veicError) throw veicError;

      // 5. Ativar associado
      const { error: assocError } = await supabase
        .from('associados')
        .update({
          status: 'ativo',
          data_ativacao: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', associadoId);

      if (assocError) throw assocError;

      // 6. Registrar no histórico
      await supabase.from('associados_historico').insert({
        associado_id: associadoId,
        tipo: 'ativacao',
        descricao: `Rastreador ativado manualmente na plataforma ${rastreador.plataforma}. Cobertura total liberada.`,
        dados_novos: {
          instalacao_id: instalacaoId,
          rastreador_id: rastreadorId,
          imei,
          plataforma: rastreador.plataforma,
          ativado_por: profile?.id,
        },
        usuario_id: profile?.id,
      });

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instalacao-analise'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes-aguardando-ativacao'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes'] });
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['associados'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores'] });
      toast.success('Rastreador ativado com sucesso! Cobertura total liberada.');
    },
    onError: (error) => {
      console.error('Erro ao ativar rastreador:', error);
      toast.error(`Erro ao ativar rastreador: ${error.message}`);
    },
  });
}

/**
 * Hook unificado para análise de vistoria completa
 */
export function useVistoriaCompletaAnalise(instalacaoId: string | undefined) {
  const instalacao = useInstalacaoParaAnalise(instalacaoId);
  const ativarMutation = useAtivarRastreadorPlataforma();

  const podeAtivar =
    instalacao.data?.status === 'concluida' &&
    instalacao.data?.rastreadores &&
    instalacao.data?.veiculos?.cobertura_roubo_furto === true &&
    instalacao.data?.veiculos?.cobertura_total !== true;

  const ativarRastreador = async () => {
    if (!instalacao.data || !instalacao.data.rastreadores) {
      toast.error('Dados incompletos para ativação');
      return;
    }

    await ativarMutation.mutateAsync({
      instalacaoId: instalacao.data.id,
      veiculoId: instalacao.data.veiculos!.id,
      associadoId: instalacao.data.associados!.id,
      rastreadorId: instalacao.data.rastreadores.id,
      imei: instalacao.data.rastreadores.imei,
    });
  };

  return {
    instalacao: instalacao.data,
    isLoading: instalacao.isLoading,
    error: instalacao.error,
    podeAtivar,
    ativarRastreador,
    isAtivando: ativarMutation.isPending,
  };
}

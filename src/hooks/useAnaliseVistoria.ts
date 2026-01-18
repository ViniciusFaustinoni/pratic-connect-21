import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VistoriaFoto {
  id: string;
  tipo: string;
  arquivo_url: string;
}

interface VistoriaCompleta {
  id: string;
  protocolo: string | null;
  tipo: string;
  status: string;
  km_atual: number | null;
  avarias: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  
  associado: {
    id: string;
    nome: string;
    cpf: string;
    email: string;
    telefone: string;
  } | null;
  
  veiculo: {
    id: string;
    marca: string;
    modelo: string;
    placa: string;
    chassi: string;
    ano_modelo: number;
    cor: string;
    valor_fipe: number;
  } | null;
  
  vistoriador: {
    id: string;
    nome: string;
  } | null;
  
  fotos: VistoriaFoto[];
}

interface DecisaoParams {
  vistoriaId: string;
  decisao: 'aprovada' | 'aprovada_com_ressalvas' | 'reprovada';
  observacoes?: string;
  ressalvas?: string;
  motivoReprovacao?: string;
  permitirNovaTentativa?: boolean;
}

export function useAnaliseVistoria(vistoriaId: string) {
  const queryClient = useQueryClient();

  // Buscar vistoria completa
  const { data: vistoria, isLoading, error } = useQuery({
    queryKey: ['vistoria-analise', vistoriaId],
    queryFn: async (): Promise<VistoriaCompleta | null> => {
      // Buscar vistoria com relacionamentos
      const { data: vistoriaData, error: vistoriaError } = await supabase
        .from('vistorias')
        .select(`
          id,
          protocolo,
          tipo,
          status,
          km_atual,
          avarias,
          observacoes,
          created_at,
          updated_at,
          associado:associados!vistorias_associado_id_fkey (
            id, nome, cpf, email, telefone
          ),
          veiculo:veiculos!vistorias_veiculo_id_fkey (
            id, marca, modelo, placa, chassi, ano_modelo, cor, valor_fipe
          ),
          vistoriador:profiles!vistorias_vistoriador_id_fkey (
            id, nome
          )
        `)
        .eq('id', vistoriaId)
        .single();

      if (vistoriaError) throw vistoriaError;

      // Buscar fotos da vistoria
      const { data: fotosData } = await supabase
        .from('vistoria_fotos')
        .select('id, tipo, arquivo_url')
        .eq('vistoria_id', vistoriaId);

      return {
        ...vistoriaData,
        associado: vistoriaData.associado as unknown as VistoriaCompleta['associado'],
        veiculo: vistoriaData.veiculo as unknown as VistoriaCompleta['veiculo'],
        vistoriador: vistoriaData.vistoriador as unknown as VistoriaCompleta['vistoriador'],
        fotos: (fotosData || []) as VistoriaFoto[],
      };
    },
    enabled: !!vistoriaId,
  });

  // Registrar decisão
  const registrarDecisao = useMutation({
    mutationFn: async (params: DecisaoParams) => {
      const { vistoriaId, decisao, observacoes, ressalvas, motivoReprovacao, permitirNovaTentativa } = params;

      // Buscar dados atuais da vistoria para o histórico
      const { data: vistoriaAtual } = await supabase
        .from('vistorias')
        .select('associado_id, veiculo_id')
        .eq('id', vistoriaId)
        .single();

      const userId = (await supabase.auth.getUser()).data.user?.id;

      // 1. Atualizar status da vistoria
      const updateData: Record<string, unknown> = {
        status: decisao,
        observacoes_analise: observacoes || null,
        analisado_por: userId,
        analisado_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (decisao === 'aprovada_com_ressalvas') {
        updateData.ressalvas = ressalvas;
        updateData.status = 'aprovada';
      }

      if (decisao === 'reprovada') {
        updateData.motivo_reprovacao = motivoReprovacao;
      }

      const { error: updateError } = await supabase
        .from('vistorias')
        .update(updateData)
        .eq('id', vistoriaId);

      if (updateError) throw updateError;

      // 2. Se APROVADA: criar instalação e atualizar associado
      if (decisao === 'aprovada' || decisao === 'aprovada_com_ressalvas') {
        // Criar instalação pendente
        if (vistoriaAtual?.associado_id && vistoriaAtual?.veiculo_id) {
          const { error: instalacaoError } = await supabase
            .from('instalacoes')
            .insert([{
              associado_id: vistoriaAtual.associado_id,
              veiculo_id: vistoriaAtual.veiculo_id,
              status: 'pendente',
            }]);

          if (instalacaoError) {
            console.error('Erro ao criar instalação:', instalacaoError);
          }

          // Atualizar status do associado
          await supabase
            .from('associados')
            .update({ status: 'aguardando_instalacao' })
            .eq('id', vistoriaAtual.associado_id);

          // Atualizar status do veículo
          await supabase
            .from('veiculos')
            .update({ status: 'instalacao_pendente' })
            .eq('id', vistoriaAtual.veiculo_id);
        }
      }

      // 3. Se REPROVADA e permitir nova tentativa: criar nova vistoria pendente
      if (decisao === 'reprovada' && permitirNovaTentativa) {
        await supabase.from('vistorias').insert({
          associado_id: vistoriaAtual?.associado_id,
          veiculo_id: vistoriaAtual?.veiculo_id,
          tipo: 'entrada',
          status: 'pendente',
        });
      }

      // 4. Registrar no histórico do associado (se tabela existir)
      try {
        await supabase.from('associados_historico').insert({
          associado_id: vistoriaAtual?.associado_id!,
          tipo: 'vistoria_analisada',
          descricao: `Vistoria ${decisao === 'reprovada' ? 'reprovada' : 'aprovada'}${ressalvas ? ' com ressalvas' : ''}`,
          dados_novos: {
            vistoria_id: vistoriaId,
            decisao,
            motivo: decisao === 'reprovada' ? motivoReprovacao : null,
            ressalvas: decisao === 'aprovada_com_ressalvas' ? ressalvas : null,
          },
          usuario_id: userId,
        });
      } catch {
        // Ignorar se tabela não existir ou erro
      }

      // 5. Disparar notificação (via edge function)
      await supabase.functions.invoke('notificar-cliente', {
        body: {
          tipo: decisao === 'reprovada' ? 'vistoria_reprovada' : 'vistoria_aprovada',
          associado_id: vistoriaAtual?.associado_id,
          dados: {
            vistoria_id: vistoriaId,
            motivo: motivoReprovacao,
            permitir_nova_tentativa: permitirNovaTentativa,
          },
        },
      }).catch(() => {}); // Ignorar se function não existir

      return { success: true, decisao };
    },
    onSuccess: (data) => {
      if (data.decisao === 'reprovada') {
        toast.success('Vistoria reprovada. Cliente notificado.');
      } else {
        toast.success('Vistoria aprovada! Instalação criada na fila.');
      }
      queryClient.invalidateQueries({ queryKey: ['vistoria-analise', vistoriaId] });
      queryClient.invalidateQueries({ queryKey: ['fila-vistorias'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar decisão: ' + error.message);
    },
  });

  return {
    vistoria,
    isLoading,
    error,
    registrarDecisao: registrarDecisao.mutate,
    isRegistrando: registrarDecisao.isPending,
  };
}

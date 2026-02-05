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
  endereco_latitude: number | null;
  endereco_longitude: number | null;
  
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

interface ProcessarVistoriaResponse {
  success: boolean;
  decisao?: string;
  instalacao_id?: string;
  nova_vistoria_id?: string;
  mensagem?: string;
  error?: string;
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
          endereco_latitude,
          endereco_longitude,
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
        endereco_latitude: vistoriaData.endereco_latitude,
        endereco_longitude: vistoriaData.endereco_longitude,
        associado: vistoriaData.associado as unknown as VistoriaCompleta['associado'],
        veiculo: vistoriaData.veiculo as unknown as VistoriaCompleta['veiculo'],
        vistoriador: vistoriaData.vistoriador as unknown as VistoriaCompleta['vistoriador'],
        fotos: (fotosData || []) as VistoriaFoto[],
      };
    },
    enabled: !!vistoriaId,
  });

  // Registrar decisão via Edge Function
  const registrarDecisao = useMutation({
    mutationFn: async (params: DecisaoParams): Promise<ProcessarVistoriaResponse> => {
      const { vistoriaId, decisao, observacoes, ressalvas, motivoReprovacao, permitirNovaTentativa } = params;

      // Buscar ID do usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Chamar edge function que centraliza toda a lógica
      const { data, error } = await supabase.functions.invoke<ProcessarVistoriaResponse>('processar-vistoria', {
        body: {
          vistoria_id: vistoriaId,
          decisao,
          analista_id: user.id,
          observacoes,
          ressalvas,
          motivo_reprovacao: motivoReprovacao,
          permitir_nova_tentativa: permitirNovaTentativa,
        },
      });

      if (error) {
        console.error('Erro ao invocar processar-vistoria:', error);
        throw new Error(error.message || 'Erro ao processar vistoria');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Erro desconhecido ao processar vistoria');
      }

      return data;
    },
    onSuccess: (data) => {
      if (data.decisao === 'reprovada') {
        toast.success('Vistoria reprovada. Cliente notificado.');
      } else {
        toast.success('Vistoria aprovada! Instalação criada na fila.');
      }
      
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['vistoria-analise', vistoriaId] });
      queryClient.invalidateQueries({ queryKey: ['fila-vistorias'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes'] });
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
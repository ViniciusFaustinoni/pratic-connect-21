import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/integrations/supabase/types';

type Associado = Tables<'associados'>;
type Veiculo = Tables<'veiculos'>;
type Sinistro = Tables<'sinistros'>;
type Chamado = Tables<'chamados_assistencia'>;
type Rastreador = Tables<'rastreadores'>;
type Documento = Tables<'documentos'>;

// Tipos para Boletos
export interface Boleto {
  id: string;
  competencia: string;
  competenciaMes: number;
  competenciaAno: number;
  dataVencimento: string;
  dataPagamento?: string;
  valorOriginal: number;
  valorFinal: number;
  valorPago?: number;
  valorDesconto?: number;
  valorJuros?: number;
  valorMulta?: number;
  status: 'pendente' | 'pago' | 'vencido' | 'cancelado' | 'processando';
  pixCopiaCola?: string;
  pixQrCode?: string;
  linhaDigitavel?: string;
  codigoBarras?: string;
  urlBoleto?: string;
  urlPdf?: string;
}

export interface BoletoHistorico {
  id: string;
  data: string;
  tipo: 'geracao' | 'envio' | 'visualizacao' | 'tentativa' | 'pagamento' | 'cancelamento';
  descricao: string;
}

export interface ResumoFinanceiro {
  totalPago: number;
  totalPendente: number;
  totalVencido: number;
  quantidadePago: number;
  quantidadePendente: number;
  quantidadeVencido: number;
}

export interface AssociadoWithRelations extends Associado {
  planos?: {
    id: string;
    codigo: string;
    nome: string;
    descricao?: string | null;
    tipo_uso: string;
    valor_adesao: number;
  } | null;
  contratos?: {
    id: string;
    numero: string;
    status: string;
    valor_mensal: number;
    valor_adesao: number;
    data_inicio: string;
    dia_vencimento?: number | null;
  } | null;
}

export function useMyAssociado() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-associado', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('associados')
        .select(`
          *,
          planos (
            id,
            codigo,
            nome,
            descricao,
            tipo_uso,
            valor_adesao
          ),
          contratos (
            id,
            numero,
            status,
            valor_mensal,
            valor_adesao,
            data_inicio,
            dia_vencimento
          )
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as AssociadoWithRelations | null;
    },
    enabled: !!user?.id,
  });
}

export function useMyVehicles() {
  const { data: associado } = useMyAssociado();

  return useQuery({
    queryKey: ['my-vehicles', associado?.id],
    queryFn: async () => {
      if (!associado?.id) return [];

      const { data, error } = await supabase
        .from('veiculos')
        .select('*')
        .eq('associado_id', associado.id)
        .eq('ativo', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Veiculo[];
    },
    enabled: !!associado?.id,
  });
}

export function useMyVehicleWithTracker() {
  const { data: vehicles } = useMyVehicles();
  const vehicleId = vehicles?.[0]?.id;

  return useQuery({
    queryKey: ['my-vehicle-tracker', vehicleId],
    queryFn: async () => {
      if (!vehicleId) return null;

      const { data, error } = await supabase
        .from('rastreadores')
        .select('*')
        .eq('veiculo_id', vehicleId)
        .maybeSingle();

      if (error) throw error;
      return data as Rastreador | null;
    },
    enabled: !!vehicleId,
  });
}

export function useMyDocumentos() {
  const { data: associado } = useMyAssociado();

  return useQuery({
    queryKey: ['my-documentos', associado?.id],
    queryFn: async () => {
      if (!associado?.id) return [];

      const { data, error } = await supabase
        .from('documentos')
        .select('*')
        .eq('associado_id', associado.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Documento[];
    },
    enabled: !!associado?.id,
  });
}

export function useMySinistros() {
  const { data: associado } = useMyAssociado();

  return useQuery({
    queryKey: ['my-sinistros', associado?.id],
    queryFn: async () => {
      if (!associado?.id) return [];

      const { data, error } = await supabase
        .from('sinistros')
        .select('*')
        .eq('associado_id', associado.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Sinistro[];
    },
    enabled: !!associado?.id,
  });
}

export function useMyChamados() {
  const { data: associado } = useMyAssociado();

  return useQuery({
    queryKey: ['my-chamados', associado?.id],
    queryFn: async () => {
      if (!associado?.id) return [];

      const { data, error } = await supabase
        .from('chamados_assistencia')
        .select('*')
        .eq('associado_id', associado.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Chamado[];
    },
    enabled: !!associado?.id,
  });
}

export function useChamado(id: string | undefined) {
  return useQuery({
    queryKey: ['chamado', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('chamados_assistencia')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as Chamado | null;
    },
    enabled: !!id,
  });
}

export function useMyPendingDocuments() {
  const { data: associado } = useMyAssociado();

  return useQuery({
    queryKey: ['my-pending-docs', associado?.id],
    queryFn: async () => {
      if (!associado?.id) return [];

      const { data, error } = await supabase
        .from('documentos')
        .select('*')
        .eq('associado_id', associado.id)
        .in('status', ['pendente', 'reprovado'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Documento[];
    },
    enabled: !!associado?.id,
  });
}

export function useUpdateAssociado() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: Partial<Associado>) => {
      if (!user?.id) throw new Error('Não autenticado');

      const { error } = await supabase
        .from('associados')
        .update(data)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-associado'] });
    },
  });
}

export function useMyBoletos() {
  const { data: associado } = useMyAssociado();

  return useQuery({
    queryKey: ['my-boletos', associado?.id],
    queryFn: async (): Promise<Boleto[]> => {
      if (!associado?.id) return [];

      // TODO: Substituir por chamada real ao Supabase quando tabela existir
      // Mock data para desenvolvimento
      const mockBoletos: Boleto[] = [
        {
          id: '1',
          competencia: 'Janeiro/2026',
          competenciaMes: 1,
          competenciaAno: 2026,
          dataVencimento: '10/01/2026',
          valorOriginal: 189.90,
          valorFinal: 189.90,
          status: 'pendente',
          pixCopiaCola: '00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-426614174000',
          linhaDigitavel: '23793.38128 60000.000003 00000.000400 1 84340000018990'
        },
        {
          id: '2',
          competencia: 'Dezembro/2025',
          competenciaMes: 12,
          competenciaAno: 2025,
          dataVencimento: '10/12/2025',
          dataPagamento: '08/12/2025',
          valorOriginal: 189.90,
          valorFinal: 189.90,
          valorPago: 189.90,
          status: 'pago'
        },
        {
          id: '3',
          competencia: 'Novembro/2025',
          competenciaMes: 11,
          competenciaAno: 2025,
          dataVencimento: '10/11/2025',
          dataPagamento: '05/11/2025',
          valorOriginal: 189.90,
          valorFinal: 189.90,
          valorPago: 189.90,
          status: 'pago'
        },
        {
          id: '4',
          competencia: 'Outubro/2025',
          competenciaMes: 10,
          competenciaAno: 2025,
          dataVencimento: '10/10/2025',
          dataPagamento: '10/10/2025',
          valorOriginal: 189.90,
          valorFinal: 189.90,
          valorPago: 189.90,
          status: 'pago'
        },
        {
          id: '5',
          competencia: 'Setembro/2025',
          competenciaMes: 9,
          competenciaAno: 2025,
          dataVencimento: '10/09/2025',
          dataPagamento: '12/09/2025',
          valorOriginal: 189.90,
          valorFinal: 195.50,
          valorPago: 195.50,
          status: 'pago'
        },
      ];

      return mockBoletos;
    },
    enabled: !!associado?.id,
  });
}

export function useMyBoleto(id: string | undefined) {
  const { data: boletos, isLoading } = useMyBoletos();
  
  const boleto = boletos?.find(b => b.id === id);
  
  // Mock de histórico para desenvolvimento
  const historico: BoletoHistorico[] = boleto ? [
    { id: '1', data: '02/01/2026 10:30', tipo: 'geracao', descricao: 'Boleto gerado automaticamente' },
    { id: '2', data: '02/01/2026 10:31', tipo: 'envio', descricao: 'Enviado por e-mail' },
    { id: '3', data: '03/01/2026 14:22', tipo: 'visualizacao', descricao: 'Boleto visualizado' },
    ...(boleto.status === 'pago' ? [
      { id: '4', data: boleto.dataPagamento || '', tipo: 'pagamento' as const, descricao: 'Pagamento confirmado via PIX' }
    ] : []),
    ...(boleto.status === 'cancelado' ? [
      { id: '5', data: '05/01/2026 09:00', tipo: 'cancelamento' as const, descricao: 'Boleto cancelado' }
    ] : [])
  ] : [];
  
  return {
    boleto,
    historico,
    isLoading,
    notFound: !isLoading && !boleto
  };
}

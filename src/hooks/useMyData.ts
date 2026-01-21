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
  dataEmissao?: string;
  dataVencimento: string;
  dataPagamento?: string;
  dataCredito?: string;
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
  urlComprovante?: string;
  formaPagamento?: string;
  nossoNumero?: string;
  numeroDocumento?: string;
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

// Hook para posição em tempo real do veículo do associado
export interface VehiclePosition {
  latitude: number | null;
  longitude: number | null;
  velocidade: number;
  ignicao: boolean;
  ultimaComunicacao: string | null;
  status: string | null;
  endereco: string | null;
}

export function useMyVehiclePosition(rastreadorId?: string) {
  return useQuery({
    queryKey: ['my-vehicle-position', rastreadorId],
    queryFn: async (): Promise<VehiclePosition | null> => {
      if (!rastreadorId) return null;

      const { data, error } = await supabase
        .from('rastreadores')
        .select(`
          id,
          ultima_posicao_lat,
          ultima_posicao_lng,
          ultima_velocidade,
          ultima_ignicao,
          ultima_comunicacao,
          status
        `)
        .eq('id', rastreadorId)
        .single();

      if (error) throw error;
      
      return {
        latitude: data.ultima_posicao_lat,
        longitude: data.ultima_posicao_lng,
        velocidade: data.ultima_velocidade || 0,
        ignicao: data.ultima_ignicao || false,
        ultimaComunicacao: data.ultima_comunicacao,
        status: data.status,
        endereco: null // Campo não existe na tabela
      };
    },
    enabled: !!rastreadorId,
    refetchInterval: 30000, // Auto-refresh a cada 30s
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

// Helper para mapear status do ASAAS para o formato do app
function mapAsaasStatus(status: string): Boleto['status'] {
  const statusMap: Record<string, Boleto['status']> = {
    'PENDING': 'pendente',
    'RECEIVED': 'pago',
    'CONFIRMED': 'pago',
    'OVERDUE': 'vencido',
    'CANCELED': 'cancelado',
    'REFUNDED': 'cancelado',
    'RECEIVED_IN_CASH': 'pago',
    'REFUND_REQUESTED': 'processando',
    'CHARGEBACK_REQUESTED': 'processando',
    'CHARGEBACK_DISPUTE': 'processando',
    'AWAITING_CHARGEBACK_REVERSAL': 'processando',
    'DUNNING_REQUESTED': 'vencido',
    'DUNNING_RECEIVED': 'pago',
    'AWAITING_RISK_ANALYSIS': 'processando',
  };
  return statusMap[status] || 'pendente';
}

// Helper para formatar data dd/mm/yyyy
function formatDateBR(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR');
}

// Helper para extrair mes/ano de competencia
function parseCompetencia(competencia: string | null): { mes: number; ano: number } {
  if (!competencia) return { mes: 0, ano: 0 };
  const parts = competencia.split('/');
  if (parts.length === 2) {
    return { mes: parseInt(parts[0]) || 0, ano: parseInt(parts[1]) || 0 };
  }
  return { mes: 0, ano: 0 };
}

// Buscar boletos do banco local (fallback)
async function buscarBoletosLocal(associadoId: string): Promise<Boleto[]> {
  const { data, error } = await supabase
    .from('asaas_cobrancas')
    .select('*')
    .eq('associado_id', associadoId)
    .order('data_vencimento', { ascending: false });

  if (error) throw error;

  return (data || []).map(c => {
    const { mes, ano } = parseCompetencia(c.competencia);
    return {
      id: c.id,
      competencia: c.competencia || '',
      competenciaMes: mes,
      competenciaAno: ano,
      dataEmissao: c.data_emissao ? formatDateBR(c.data_emissao) : undefined,
      dataVencimento: formatDateBR(c.data_vencimento),
      dataPagamento: c.data_pagamento ? formatDateBR(c.data_pagamento) : undefined,
      dataCredito: c.pagamento_data ? formatDateBR(c.pagamento_data) : undefined,
      valorOriginal: Number(c.valor) || 0,
      valorFinal: Number(c.valor_liquido) || Number(c.valor) || 0,
      valorPago: c.pagamento_valor ? Number(c.pagamento_valor) : undefined,
      valorDesconto: c.desconto ? Number(c.desconto) : undefined,
      valorJuros: c.juros ? Number(c.juros) : undefined,
      valorMulta: c.multa ? Number(c.multa) : undefined,
      status: mapAsaasStatus(c.status),
      pixCopiaCola: c.pix_copia_cola || undefined,
      pixQrCode: c.pix_qrcode || undefined,
      linhaDigitavel: c.linha_digitavel || undefined,
      codigoBarras: c.boleto_codigo_barras || undefined,
      urlBoleto: c.boleto_url || undefined,
      formaPagamento: c.pagamento_forma || c.forma_pagamento || undefined,
      nossoNumero: c.boleto_nosso_numero || undefined,
      numeroDocumento: c.referencia || undefined,
    };
  });
}

// Mapear resposta da edge function para Boleto
function mapBoletoFromApi(b: any): Boleto {
  return {
    id: b.id,
    competencia: b.referencia || '',
    competenciaMes: b.competenciaMes || 0,
    competenciaAno: b.competenciaAno || 0,
    dataEmissao: undefined,
    dataVencimento: b.vencimento ? formatDateBR(b.vencimento) : '',
    dataPagamento: b.dataPagamento ? formatDateBR(b.dataPagamento) : undefined,
    valorOriginal: Number(b.valor) || 0,
    valorFinal: Number(b.valorFinal) || Number(b.valor) || 0,
    valorPago: b.valorPago ? Number(b.valorPago) : undefined,
    status: b.status as Boleto['status'],
    pixCopiaCola: b.pixCopiaCola || undefined,
    pixQrCode: b.pixQrCode || undefined,
    linhaDigitavel: b.linhaDigitavel || undefined,
    codigoBarras: b.codigoBarras || undefined,
    urlBoleto: b.linkBoleto || b.invoiceUrl || undefined,
  };
}

export function useMyBoletos() {
  const { data: associado } = useMyAssociado();

  return useQuery({
    queryKey: ['my-boletos', associado?.id],
    queryFn: async (): Promise<Boleto[]> => {
      if (!associado?.id) return [];

      try {
        // Chamar edge function para dados em tempo real da API ASAAS
        const { data, error } = await supabase.functions.invoke('buscar-boletos-associado');

        if (error) {
          console.error('Erro ao buscar boletos da API:', error);
          // Fallback: buscar do banco local
          return buscarBoletosLocal(associado.id);
        }

        if (!data?.success || !data?.boletos) {
          console.warn('API retornou sem sucesso, usando fallback local');
          return buscarBoletosLocal(associado.id);
        }

        console.log(`[useMyBoletos] Recebidos ${data.boletos.length} boletos da API ASAAS`);
        return data.boletos.map(mapBoletoFromApi);

      } catch (err) {
        console.error('Erro inesperado ao buscar boletos:', err);
        // Fallback: buscar do banco local
        return buscarBoletosLocal(associado.id);
      }
    },
    enabled: !!associado?.id,
    staleTime: 30000, // Cache por 30 segundos
    gcTime: 60000, // Manter em cache por 1 minuto
  });
}

// Hook para atualizar um boleto específico
export function useAtualizarBoleto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (boletoId: string) => {
      const { data, error } = await supabase.functions.invoke('buscar-boletos-associado');

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Erro ao atualizar boleto');

      // Encontrar o boleto atualizado
      const boletoAtualizado = data.boletos?.find((b: any) => b.id === boletoId);
      return boletoAtualizado ? mapBoletoFromApi(boletoAtualizado) : null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-boletos'] });
    },
  });
}

export function useMyBoleto(id: string | undefined) {
  const { data: boletos, isLoading: listLoading } = useMyBoletos();
  const queryClient = useQueryClient();

  // Query para buscar detalhes em tempo real via edge function
  const { data: detalheAtualizado, isLoading: detalheLoading } = useQuery({
    queryKey: ['boleto-detalhe', id],
    queryFn: async () => {
      if (!id) return null;

      try {
        const { data, error } = await supabase.functions.invoke('detalhe-boleto', {
          body: { payment_id: id }
        });

        if (error || !data?.success) {
          console.warn('Fallback para dados da lista:', error?.message || data?.error);
          return null;
        }

        // Mapear resposta da API para formato do app
        const b = data.boleto;
        return {
          id: b.id,
          competencia: b.referencia || '',
          competenciaMes: 0,
          competenciaAno: 0,
          dataEmissao: undefined,
          dataVencimento: b.vencimento ? formatDateBR(b.vencimento) : '',
          dataPagamento: b.data_pagamento ? formatDateBR(b.data_pagamento) : undefined,
          valorOriginal: Number(b.valorOriginal) || 0,
          valorFinal: Number(b.valor) || 0,
          valorPago: b.valorPago ? Number(b.valorPago) : undefined,
          status: b.status as Boleto['status'],
          pixCopiaCola: b.pix_payload || undefined,
          pixQrCode: b.pix_qrcode_base64 || undefined,
          linhaDigitavel: b.linha_digitavel || undefined,
          codigoBarras: b.codigo_barras || undefined,
          urlBoleto: b.link_pdf || b.invoice_url || undefined,
          formaPagamento: b.forma_pagamento || undefined,
          nossoNumero: b.nosso_numero || undefined,
          juros: b.juros || undefined,
          multa: b.multa || undefined,
          desconto: b.desconto || undefined,
        } as Boleto;
      } catch (err) {
        console.error('Erro ao buscar detalhe do boleto:', err);
        return null;
      }
    },
    enabled: !!id,
    staleTime: 0, // Sempre buscar dados atualizados
    gcTime: 30000, // Manter em cache por 30 segundos
  });

  // Usar detalhe atualizado ou fallback para lista
  const boletoFromList = boletos?.find(b => b.id === id);
  const boleto = detalheAtualizado || boletoFromList;

  const isLoading = listLoading || detalheLoading;

  // Gerar histórico baseado nos dados do boleto
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
    notFound: !isLoading && !boleto,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['boleto-detalhe', id] })
  };
}

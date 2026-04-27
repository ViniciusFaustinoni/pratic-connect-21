import { useVeiculosApp } from './useAppAssociado';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CoberturaVeiculo {
  veiculoId: string;
  placa: string;
  modelo: string;
  marca: string;
  inadimplente: boolean;
  suspensaAutoVistoria?: boolean;
  temCoberturaRouboFurto: boolean;
  temCoberturaTotal: boolean;
  podeAssistencia: boolean;
  podeRastreamento: boolean;
  tiposSinistroPermitidos: string[];
}

/**
 * Hook para verificar as coberturas ativas do associado.
 * Cobertura principal é por veículo; benefícios adicionais suspensos globalmente
 * se qualquer veículo estiver inadimplente.
 */
export function useMinhasCoberturas() {
  const { data: veiculos, isLoading } = useVeiculosApp();
  const { user } = useAuth();

  // Buscar cobranças vencidas agrupadas por veiculo_id
  const { data: veiculosInadimplentes = [] } = useQuery({
    queryKey: ['app-inadimplencia-por-veiculo', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      // Get associado id
      const { data: assoc } = await supabase
        .from('associados')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!assoc) return [];

      const { data, error } = await supabase
        .from('cobrancas')
        .select('veiculo_id')
        .eq('associado_id', assoc.id)
        .in('status', ['vencido'])
        .not('veiculo_id', 'is', null);

      if (error) return [];
      return [...new Set((data || []).map(d => d.veiculo_id!))];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  // Buscar dados de carência do contrato ativo
  const { data: contratoCarencia } = useQuery({
    queryKey: ['app-contrato-carencia', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('contratos')
        .select('carencia_isenta, carencia_motivo_isencao')
        .eq('associado_id', user.id)
        .in('status', ['ativo'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  const carenciaIsenta = contratoCarencia?.carencia_isenta || false;
  const beneficiosAdicionaisSuspensos = veiculosInadimplentes.length > 0;

  // Build per-vehicle coverage
  const coberturasPorVeiculo: CoberturaVeiculo[] = (veiculos || []).map(v => {
    const inadimplente = veiculosInadimplentes.includes(v.id);
    // Cobertura suspensa por auto-vistoria (instalação não realizada no prazo)
    const suspensaAutoVistoria = (v as any).cobertura_suspensa === true
      && (v as any).cobertura_suspensa_motivo === 'Auto-vistoria sem instalação no prazo';
    const bloqueado = inadimplente || suspensaAutoVistoria;
    const temCoberturaRouboFurto = !bloqueado && (v.cobertura_roubo_furto || false);
    const temCoberturaTotal = !bloqueado && (v.cobertura_total || false);
    const podeAssistencia = temCoberturaTotal;
    const podeRastreamento = temCoberturaTotal && (v.rastreador_ativo || false);

    const tiposSinistroPermitidos: string[] = bloqueado
      ? []
      : ['colisao', 'roubo', 'furto', 'incendio', 'fenomeno_natural', 'vandalismo', 'outro'];

    return {
      veiculoId: v.id,
      placa: v.placa || '',
      modelo: v.modelo || '',
      marca: v.marca || '',
      inadimplente,
      suspensaAutoVistoria,
      temCoberturaRouboFurto,
      temCoberturaTotal,
      podeAssistencia,
      podeRastreamento,
      tiposSinistroPermitidos,
    } as CoberturaVeiculo;
  });

  // Backward compat: principal vehicle (first)
  const principal = coberturasPorVeiculo[0];
  const inadimplente = principal?.inadimplente || false;
  const suspensaAutoVistoria = principal?.suspensaAutoVistoria || false;
  const temCoberturaRouboFurto = principal?.temCoberturaRouboFurto || false;
  const temCoberturaTotal = principal?.temCoberturaTotal || false;
  const podeAssistencia = principal?.podeAssistencia || false;
  const podeRastreamento = principal?.podeRastreamento || false;
  const tiposSinistroPermitidos = principal?.tiposSinistroPermitidos || [];

  return {
    isLoading,
    inadimplente,
    suspensaAutoVistoria,
    carenciaIsenta,
    temCoberturaRouboFurto,
    temCoberturaTotal,
    podeAssistencia,
    podeRastreamento,
    tiposSinistroPermitidos,
    beneficiosAdicionaisSuspensos,
    coberturasPorVeiculo,
    mensagemCoberturaParcial: suspensaAutoVistoria
      ? 'Sua cobertura está suspensa porque o rastreador não foi instalado dentro do prazo após a auto-vistoria. Aguarde a liberação do nosso time de monitoramento para reagendar a vistoria/instalação.'
      : inadimplente
        ? 'A cobertura principal deste veículo está suspensa por inadimplência. Regularize para reativá-la.'
        : carenciaIsenta
          ? 'Suas coberturas estão ativas sem período de carência — origem: migração aprovada.'
          : temCoberturaRouboFurto && !temCoberturaTotal
            ? 'Sua cobertura atual é apenas para roubo e furto. Após a instalação do rastreador, você terá Proteção 360º incluindo assistência 24h.'
            : null,
  };
}

/**
 * Get coverage for a specific vehicle by id.
 */
export function useCoberturaVeiculo(veiculoId: string | undefined) {
  const { coberturasPorVeiculo, beneficiosAdicionaisSuspensos, isLoading } = useMinhasCoberturas();
  const cobertura = coberturasPorVeiculo.find(c => c.veiculoId === veiculoId);
  return { cobertura, beneficiosAdicionaisSuspensos, isLoading };
}

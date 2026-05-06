import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useInadimplenciaPrazos } from './useConteudosSistema';
import { useCarenciaDiasPadrao, useMultaRastreador, useMigracaoConfig } from './useConteudosSistema';
import { useInadimplenciaPorVeiculo, type InadimplenciaVeiculo } from './useInadimplenciaPorVeiculo';

export type StatusInadimplencia = 'adimplente' | 'regularizacao_simples' | 'revistoria_necessaria' | 'nova_adesao_obrigatoria';

export interface CoberturaPorVeiculo {
  veiculoId: string;
  placa: string;
  modelo: string;
  coberturasSuspensas: boolean;
  diasAtraso: number;
}

export interface CarenciaItem {
  nome: string;
  tipo: 'cobertura' | 'beneficio';
  carenciaTipo: string;
  dias: number;
  multiplicador?: number;
  inicio: string;
  fim: string;
  emCarencia: boolean;
}

export interface SituacaoAssociado {
  // Carência
  carenciaIsenta: boolean;
  carenciaMotivoIsencao: string | null;
  carenciaInicio: string | null;
  carenciaFim: string | null;
  emCarencia: boolean;
  carenciasItens: CarenciaItem[];

  // Inadimplência (geral - pior caso)
  diasAtraso: number;
  statusInadimplencia: StatusInadimplencia;

  // Coberturas
  coberturasSuspensas: boolean;

  // Per-vehicle
  coberturaPorVeiculo: CoberturaPorVeiculo[];
  veiculosInadimplentes: InadimplenciaVeiculo[];
  veiculosSuspensosOutroMotivo: InadimplenciaVeiculo[];
  beneficiosAdicionaisSuspensos: boolean;

  // Multa rastreador
  pendenciaRastreador: boolean;
  valorMultaRastreador: number;

  // Consultor
  consultorNome: string | null;
  consultorPontuacao: number | null;

  // Loading
  isLoading: boolean;
}

export function useAssociadoSituacao(associadoId: string | undefined, contratoId: string | undefined) {
  const { data: prazos, isLoading: isLoadingPrazos } = useInadimplenciaPrazos();
  const { data: carenciaDias } = useCarenciaDiasPadrao();
  const { data: multaRastreador } = useMultaRastreador();
  const { data: migracaoConfig } = useMigracaoConfig();
  const { inadimplenciaPorVeiculo, veiculosSuspensosOutroMotivo, algumVeiculoInadimplente, algumVeiculoComCoberturaSuspensa, beneficiosAdicionaisSuspensos, isLoading: isLoadingInadimplencia } = useInadimplenciaPorVeiculo(associadoId);

  // Fetch contrato details (carência fields)
  const { data: contrato, isLoading: isLoadingContrato } = useQuery({
    queryKey: ['contrato-situacao', contratoId],
    queryFn: async () => {
      if (!contratoId) return null;
      const { data, error } = await supabase
        .from('contratos')
        .select('tipo_entrada, data_carencia_inicio, data_carencia_fim, carencia_isenta, carencia_motivo_isencao, vendedor_id')
        .eq('id', contratoId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!contratoId,
  });

  // Fetch associado for pendencia_rastreador
  const { data: associado, isLoading: isLoadingAssociado } = useQuery({
    queryKey: ['associado-situacao', associadoId],
    queryFn: async () => {
      if (!associadoId) return null;
      const { data, error } = await supabase
        .from('associados')
        .select('pendencia_rastreador, vendedor_original_id, plano_id')
        .eq('id', associadoId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!associadoId,
  });

  // Fetch ALL benefits for the associado's plano
  const planoId = associado?.plano_id;
  const { data: carenciasBeneficios } = useQuery({
    queryKey: ['carencias-beneficios', planoId],
    queryFn: async () => {
      if (!planoId) return [];
      const { data, error } = await supabase
        .from('planos_beneficios')
        .select('benefit_id, benefits!inner(name, carencia_ativa, carencia_tipo, carencia_dias, carencia_multiplicador)')
        .eq('plano_id', planoId);
      if (error) throw error;
      return (data || []).map((row: any) => ({
        nome: row.benefits.name,
        tipo: 'beneficio' as const,
        carenciaAtiva: row.benefits.carencia_ativa || false,
        carenciaTipo: row.benefits.carencia_tipo || 'liberacao',
        dias: row.benefits.carencia_dias || 0,
        multiplicador: row.benefits.carencia_multiplicador,
      }));
    },
    enabled: !!planoId,
  });

  // Fetch ALL coberturas for the associado's plano
  const { data: carenciasCoberturas } = useQuery({
    queryKey: ['carencias-coberturas', planoId],
    queryFn: async () => {
      if (!planoId) return [];
      const { data, error } = await supabase
        .from('planos_coberturas')
        .select('cobertura_id, coberturas!inner(nome, carencia_ativa, carencia_tipo, carencia_dias, carencia_multiplicador)')
        .eq('plano_id', planoId);
      if (error) throw error;
      return (data || []).map((row: any) => ({
        nome: row.coberturas.nome,
        tipo: 'cobertura' as const,
        carenciaAtiva: row.coberturas.carencia_ativa || false,
        carenciaTipo: row.coberturas.carencia_tipo || 'liberacao',
        dias: row.coberturas.carencia_dias || 0,
        multiplicador: row.coberturas.carencia_multiplicador,
      }));
    },
    enabled: !!planoId,
  });

  // Consultor vinculado + pontuação
  const vendedorId = contrato?.vendedor_id || associado?.vendedor_original_id;
  const { data: consultorInfo } = useQuery({
    queryKey: ['consultor-pontuacao', vendedorId, contratoId],
    queryFn: async () => {
      if (!vendedorId) return null;
      const [profileRes, pontosRes] = await Promise.all([
        supabase.from('profiles').select('nome').eq('id', vendedorId).maybeSingle(),
        contratoId
          ? supabase.from('pontuacao_eventos').select('pontos').eq('vendedor_id', vendedorId).eq('contrato_id', contratoId).eq('estornado', false)
          : Promise.resolve({ data: null }),
      ]);
      const totalPontos = (pontosRes.data as any[])?.reduce((acc: number, e: any) => acc + (e.pontos || 0), 0) ?? null;
      return { nome: profileRes.data?.nome || null, pontuacao: totalPontos };
    },
    enabled: !!vendedorId,
  });

  const situacao = useMemo<SituacaoAssociado>(() => {
    const now = new Date();

    // Carência
    const carenciaIsenta = contrato?.carencia_isenta || false;
    const carenciaInicio = contrato?.data_carencia_inicio || null;
    const carenciaFim = contrato?.data_carencia_fim || null;
    const emCarencia = !carenciaIsenta && !!carenciaFim && new Date(carenciaFim) > now;

    // Inadimplência financeira — usa SOMENTE veículos com cobrança vencida.
    // Suspensão por não-instalação (e outros motivos não financeiros) NÃO entra
    // no cálculo de statusInadimplencia.
    const diasAtraso = inadimplenciaPorVeiculo.length > 0
      ? Math.max(...inadimplenciaPorVeiculo.map(v => v.diasAtraso))
      : 0;

    let statusInadimplencia: StatusInadimplencia = 'adimplente';
    if (diasAtraso > 0 && prazos) {
      if (diasAtraso <= prazos.prazoSemRevistoria) {
        statusInadimplencia = 'regularizacao_simples';
      } else if (diasAtraso <= prazos.prazoRevistoria) {
        statusInadimplencia = 'revistoria_necessaria';
      } else {
        statusInadimplencia = 'nova_adesao_obrigatoria';
      }
    }

    // coberturasSuspensas = qualquer veículo com cobertura suspensa (qualquer motivo)
    const coberturasSuspensas = algumVeiculoComCoberturaSuspensa;

    // Build per-vehicle coverage
    const coberturaPorVeiculo: CoberturaPorVeiculo[] = inadimplenciaPorVeiculo.map(v => ({
      veiculoId: v.veiculoId,
      placa: v.placa,
      modelo: v.modelo,
      coberturasSuspensas: true,
      diasAtraso: v.diasAtraso,
    }));

    // Build per-item carências
    // REGRA: só entram itens com `carencia_ativa = true` E `carencia_dias > 0`.
    // Itens sem carência configurada NÃO devem aparecer como "Em carência" só
    // porque o contrato tem uma carência geral preenchida — isso confundia o
    // associado/atendimento ao mostrar todos os benefícios/coberturas em carência
    // mesmo quando só "Vidros e Faróis" estava configurado com carência no plano.
    const allCarenciaItems = [...(carenciasBeneficios || []), ...(carenciasCoberturas || [])];
    const carenciasItens: CarenciaItem[] = (carenciaInicio && allCarenciaItems.length > 0)
      ? allCarenciaItems
          .filter(item => item.carenciaAtiva === true && (item.dias || 0) > 0)
          .map(item => {
            const inicio = new Date(carenciaInicio!);
            const fim = new Date(inicio);
            fim.setDate(fim.getDate() + item.dias);
            return {
              nome: item.nome,
              tipo: item.tipo,
              carenciaTipo: item.carenciaTipo,
              dias: item.dias,
              multiplicador: item.multiplicador,
              inicio: carenciaInicio!,
              fim: fim.toISOString().split('T')[0],
              emCarencia: fim > now,
            };
          })
      : [];

    return {
      carenciaIsenta,
      carenciaMotivoIsencao: contrato?.carencia_motivo_isencao || null,
      carenciaInicio,
      carenciaFim,
      emCarencia,
      carenciasItens,
      diasAtraso,
      statusInadimplencia,
      coberturasSuspensas,
      coberturaPorVeiculo,
      veiculosInadimplentes: inadimplenciaPorVeiculo,
      beneficiosAdicionaisSuspensos,
      pendenciaRastreador: associado?.pendencia_rastreador || false,
      valorMultaRastreador: multaRastreador || 400,
      consultorNome: consultorInfo?.nome || null,
      consultorPontuacao: consultorInfo?.pontuacao ?? null,
      isLoading: isLoadingPrazos || isLoadingContrato || isLoadingAssociado || isLoadingInadimplencia,
    };
  }, [contrato, associado, inadimplenciaPorVeiculo, algumVeiculoInadimplente, beneficiosAdicionaisSuspensos, prazos, multaRastreador, consultorInfo, carenciasBeneficios, carenciasCoberturas, isLoadingPrazos, isLoadingContrato, isLoadingAssociado, isLoadingInadimplencia]);

  return situacao;
}

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

export interface SituacaoAssociado {
  // Carência
  carenciaIsenta: boolean;
  carenciaMotivoIsencao: string | null;
  carenciaInicio: string | null;
  carenciaFim: string | null;
  emCarencia: boolean;

  // Inadimplência (geral - pior caso)
  diasAtraso: number;
  statusInadimplencia: StatusInadimplencia;

  // Coberturas
  coberturasSuspensas: boolean;

  // Per-vehicle
  coberturaPorVeiculo: CoberturaPorVeiculo[];
  veiculosInadimplentes: InadimplenciaVeiculo[];
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
  const { inadimplenciaPorVeiculo, algumVeiculoInadimplente, beneficiosAdicionaisSuspensos, isLoading: isLoadingInadimplencia } = useInadimplenciaPorVeiculo(associadoId);

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
        .select('pendencia_rastreador, vendedor_original_id')
        .eq('id', associadoId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!associadoId,
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

    // Inadimplência — use worst case from per-vehicle data
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

    // coberturasSuspensas = any vehicle is overdue (backward compat)
    const coberturasSuspensas = algumVeiculoInadimplente;

    // Build per-vehicle coverage
    const coberturaPorVeiculo: CoberturaPorVeiculo[] = inadimplenciaPorVeiculo.map(v => ({
      veiculoId: v.veiculoId,
      placa: v.placa,
      modelo: v.modelo,
      coberturasSuspensas: true,
      diasAtraso: v.diasAtraso,
    }));

    return {
      carenciaIsenta,
      carenciaMotivoIsencao: contrato?.carencia_motivo_isencao || null,
      carenciaInicio,
      carenciaFim,
      emCarencia,
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
  }, [contrato, associado, inadimplenciaPorVeiculo, algumVeiculoInadimplente, beneficiosAdicionaisSuspensos, prazos, multaRastreador, consultorInfo, isLoadingPrazos, isLoadingContrato, isLoadingAssociado, isLoadingInadimplencia]);

  return situacao;
}

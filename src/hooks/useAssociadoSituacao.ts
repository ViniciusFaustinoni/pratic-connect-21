import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useInadimplenciaPrazos } from './useConteudosSistema';
import { useCarenciaDiasPadrao, useMultaRastreador, useMigracaoConfig } from './useConteudosSistema';

export type StatusInadimplencia = 'adimplente' | 'regularizacao_simples' | 'revistoria_necessaria' | 'nova_adesao_obrigatoria';

export interface SituacaoAssociado {
  // Carência
  carenciaIsenta: boolean;
  carenciaMotivoIsencao: string | null;
  carenciaInicio: string | null;
  carenciaFim: string | null;
  emCarencia: boolean;

  // Inadimplência
  diasAtraso: number;
  statusInadimplencia: StatusInadimplencia;

  // Coberturas
  coberturasSuspensas: boolean;

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

  // Fetch dias de atraso (cobranças vencidas não pagas)
  const { data: diasAtraso = 0, isLoading: isLoadingCobrancas } = useQuery({
    queryKey: ['associado-dias-atraso', associadoId],
    queryFn: async () => {
      if (!associadoId) return 0;
      const { data, error } = await supabase
        .from('cobrancas')
        .select('data_vencimento')
        .eq('associado_id', associadoId)
        .in('status', ['vencido', 'aguardando_pagamento'])
        .order('data_vencimento', { ascending: true })
        .limit(1);
      if (error || !data?.length) return 0;
      const vencimento = new Date(data[0].data_vencimento);
      const hoje = new Date();
      const diff = Math.floor((hoje.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24));
      return Math.max(0, diff);
    },
    enabled: !!associadoId,
  });

  // Fetch consultor vinculado + pontuação
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

    // Inadimplência
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

    const coberturasSuspensas = statusInadimplencia !== 'adimplente';

    return {
      carenciaIsenta,
      carenciaMotivoIsencao: contrato?.carencia_motivo_isencao || null,
      carenciaInicio,
      carenciaFim,
      emCarencia,
      diasAtraso,
      statusInadimplencia,
      coberturasSuspensas,
      pendenciaRastreador: associado?.pendencia_rastreador || false,
      valorMultaRastreador: multaRastreador || 400,
      consultorNome: consultorInfo?.nome || null,
      consultorPontuacao: consultorInfo?.pontuacao ?? null,
      isLoading: isLoadingPrazos || isLoadingContrato || isLoadingAssociado || isLoadingCobrancas,
    };
  }, [contrato, associado, diasAtraso, prazos, multaRastreador, consultorInfo, isLoadingPrazos, isLoadingContrato, isLoadingAssociado, isLoadingCobrancas]);

  return situacao;
}

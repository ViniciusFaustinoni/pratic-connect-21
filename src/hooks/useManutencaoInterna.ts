/**
 * Hooks para gerenciamento de Manutenção Interna de Rastreadores (Processo 2)
 * 
 * Gerencia rastreadores que voltaram do campo e estão na bancada para triagem,
 * análise de plataforma, garantia ou descarte.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

// ============================================
// TIPOS
// ============================================

export type EtapaManutencaoInterna = 
  | 'aguardando_triagem'
  | 'em_triagem'
  | 'em_analise_plataforma'
  | 'em_garantia'
  | 'concluido_estoque'
  | 'descartado';

export const ETAPA_MANUTENCAO_INTERNA_LABELS: Record<EtapaManutencaoInterna, string> = {
  aguardando_triagem: 'Aguardando Triagem',
  em_triagem: 'Em Triagem',
  em_analise_plataforma: 'Análise Plataforma',
  em_garantia: 'Em Garantia',
  concluido_estoque: 'Devolvido ao Estoque',
  descartado: 'Descartado',
};

export const ETAPA_MANUTENCAO_INTERNA_COLORS: Record<EtapaManutencaoInterna, string> = {
  aguardando_triagem: 'bg-yellow-100 text-yellow-800',
  em_triagem: 'bg-purple-100 text-purple-800',
  em_analise_plataforma: 'bg-cyan-100 text-cyan-800',
  em_garantia: 'bg-indigo-100 text-indigo-800',
  concluido_estoque: 'bg-green-100 text-green-800',
  descartado: 'bg-gray-100 text-gray-600',
};

export interface ManutencaoInterna {
  id: string;
  rastreador_id: string;
  servico_origem_id: string | null;
  etapa: EtapaManutencaoInterna;
  diagnostico_inicial: string | null;
  defeito_identificado: string | null;
  encaminhado_para: string | null;
  data_encaminhamento: string | null;
  numero_protocolo_externo: string | null;
  laudo_externo: string | null;
  recuperavel: boolean | null;
  data_retorno: string | null;
  acao_tomada: string | null;
  resolvido_por: string | null;
  resolvido_em: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Joins
  rastreador?: {
    id: string;
    codigo: string;
    imei: string | null;
    plataforma: string;
  };
  servico_origem?: {
    id: string;
    protocolo: string | null;
    motivo_manutencao: string | null;
  };
  resolvido_por_profile?: {
    id: string;
    nome: string;
  };
}

export interface ManutencaoInternaMetricas {
  aguardandoTriagem: number;
  emTriagem: number;
  analisePlataforma: number;
  emGarantia: number;
  total: number;
}

// ============================================
// QUERIES
// ============================================

/**
 * Hook para listar todas as manutenções internas ativas
 */
export function useManutencaoInternaLista(etapaFiltro?: EtapaManutencaoInterna) {
  return useQuery({
    queryKey: ['manutencao-interna', etapaFiltro],
    queryFn: async () => {
      let query = supabase
        .from('rastreador_manutencao_interna')
        .select(`
          *,
          rastreador:rastreadores(id, codigo, imei, plataforma),
          servico_origem:servicos!rastreador_manutencao_interna_servico_origem_id_fkey(id, protocolo, motivo_manutencao),
          resolvido_por_profile:profiles!rastreador_manutencao_interna_resolvido_por_fkey(id, nome)
        `)
        .not('etapa', 'in', '("concluido_estoque","descartado")')
        .order('created_at', { ascending: false });

      if (etapaFiltro) {
        query = query.eq('etapa', etapaFiltro);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[useManutencaoInternaLista] Erro:', error);
        throw error;
      }

      return (data || []) as ManutencaoInterna[];
    },
  });
}

/**
 * Hook para métricas do painel de manutenção interna
 */
export function useManutencaoInternaMetricas() {
  return useQuery({
    queryKey: ['manutencao-interna-metricas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rastreador_manutencao_interna')
        .select('etapa')
        .not('etapa', 'in', '("concluido_estoque","descartado")');

      if (error) {
        console.error('[useManutencaoInternaMetricas] Erro:', error);
        throw error;
      }

      const metricas: ManutencaoInternaMetricas = {
        aguardandoTriagem: 0,
        emTriagem: 0,
        analisePlataforma: 0,
        emGarantia: 0,
        total: data?.length || 0,
      };

      (data || []).forEach((item: any) => {
        switch (item.etapa) {
          case 'aguardando_triagem':
            metricas.aguardandoTriagem++;
            break;
          case 'em_triagem':
            metricas.emTriagem++;
            break;
          case 'em_analise_plataforma':
            metricas.analisePlataforma++;
            break;
          case 'em_garantia':
            metricas.emGarantia++;
            break;
        }
      });

      return metricas;
    },
    refetchInterval: 30000,
  });
}

/**
 * Hook para buscar detalhe de uma manutenção interna
 */
export function useManutencaoInternaDetalhe(id: string | undefined) {
  return useQuery({
    queryKey: ['manutencao-interna-detalhe', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('rastreador_manutencao_interna')
        .select(`
          *,
          rastreador:rastreadores(id, codigo, imei, plataforma, numero_serie),
          servico_origem:servicos!rastreador_manutencao_interna_servico_origem_id_fkey(
            id, 
            protocolo, 
            motivo_manutencao,
            observacoes_analise,
            veiculo:veiculos(id, placa, marca, modelo),
            associado:associados(id, nome, telefone)
          ),
          resolvido_por_profile:profiles!rastreador_manutencao_interna_resolvido_por_fkey(id, nome)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as ManutencaoInterna;
    },
    enabled: !!id,
  });
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Hook para iniciar triagem de um rastreador
 */
export function useIniciarTriagem() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ manutencaoId }: { manutencaoId: string }) => {
      // Atualizar manutenção interna
      const { error: manutError } = await supabase
        .from('rastreador_manutencao_interna')
        .update({
          etapa: 'em_triagem',
          updated_at: new Date().toISOString(),
        })
        .eq('id', manutencaoId);

      if (manutError) throw manutError;

      // Atualizar status do rastreador
      const { data: manut } = await supabase
        .from('rastreador_manutencao_interna')
        .select('rastreador_id')
        .eq('id', manutencaoId)
        .single();

      if (manut?.rastreador_id) {
        await supabase
          .from('rastreadores')
          .update({ 
            status: 'triagem',
            updated_at: new Date().toISOString()
          })
          .eq('id', manut.rastreador_id);
      }

      return { manutencaoId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manutencao-interna'] });
      queryClient.invalidateQueries({ queryKey: ['manutencao-interna-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['lista-rastreadores'] });
      toast.success('Triagem iniciada');
    },
    onError: (error: Error) => {
      console.error('[useIniciarTriagem] Erro:', error);
      toast.error('Erro ao iniciar triagem');
    },
  });
}

/**
 * Hook para resolver internamente (na bancada)
 */
export function useResolverInterno() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      manutencaoId, 
      acaoTomada, 
      observacao 
    }: { 
      manutencaoId: string; 
      acaoTomada: string;
      observacao?: string;
    }) => {
      // Buscar rastreador_id
      const { data: manut } = await supabase
        .from('rastreador_manutencao_interna')
        .select('rastreador_id')
        .eq('id', manutencaoId)
        .single();

      if (!manut?.rastreador_id) throw new Error('Rastreador não encontrado');

      // Atualizar rastreador para estoque
      await supabase
        .from('rastreadores')
        .update({ 
          status: 'estoque',
          updated_at: new Date().toISOString()
        })
        .eq('id', manut.rastreador_id);

      // Registrar movimentação
      await supabase.from('estoque_movimentacoes').insert({
        tipo: 'retorno_estoque',
        quantidade: 1,
        status_anterior: 'triagem',
        status_novo: 'estoque',
        rastreador_id: manut.rastreador_id,
        observacoes: `Manutenção interna concluída: ${acaoTomada}`,
      });

      // Atualizar manutenção interna
      const { error: manutError } = await supabase
        .from('rastreador_manutencao_interna')
        .update({
          etapa: 'concluido_estoque',
          acao_tomada: acaoTomada,
          laudo_externo: observacao || null,
          resolvido_por: profile?.id,
          resolvido_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', manutencaoId);

      if (manutError) throw manutError;

      return { manutencaoId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manutencao-interna'] });
      queryClient.invalidateQueries({ queryKey: ['manutencao-interna-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['lista-rastreadores'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores-metricas'] });
      toast.success('Rastreador devolvido ao estoque');
    },
    onError: (error: Error) => {
      console.error('[useResolverInterno] Erro:', error);
      toast.error('Erro ao resolver internamente');
    },
  });
}

/**
 * Hook para encaminhar para plataforma (Rede Veículos / Softruck)
 */
export function useEncaminharPlataforma() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      manutencaoId, 
      plataforma,
      protocoloExterno,
      observacao,
    }: { 
      manutencaoId: string; 
      plataforma: string;
      protocoloExterno?: string;
      observacao?: string;
    }) => {
      // Buscar rastreador_id
      const { data: manut } = await supabase
        .from('rastreador_manutencao_interna')
        .select('rastreador_id')
        .eq('id', manutencaoId)
        .single();

      if (!manut?.rastreador_id) throw new Error('Rastreador não encontrado');

      // Atualizar rastreador
      await supabase
        .from('rastreadores')
        .update({ 
          status: 'em_analise_plataforma',
          updated_at: new Date().toISOString()
        })
        .eq('id', manut.rastreador_id);

      // Atualizar manutenção interna
      const { error: manutError } = await supabase
        .from('rastreador_manutencao_interna')
        .update({
          etapa: 'em_analise_plataforma',
          encaminhado_para: plataforma,
          numero_protocolo_externo: protocoloExterno || null,
          data_encaminhamento: new Date().toISOString(),
          diagnostico_inicial: observacao || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', manutencaoId);

      if (manutError) throw manutError;

      return { manutencaoId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manutencao-interna'] });
      queryClient.invalidateQueries({ queryKey: ['manutencao-interna-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['lista-rastreadores'] });
      toast.success('Encaminhado para análise da plataforma');
    },
    onError: (error: Error) => {
      console.error('[useEncaminharPlataforma] Erro:', error);
      toast.error('Erro ao encaminhar para plataforma');
    },
  });
}

/**
 * Hook para encaminhar para garantia (fornecedor)
 */
export function useEncaminharGarantia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      manutencaoId, 
      fornecedor,
      notaFiscal,
      observacao,
    }: { 
      manutencaoId: string; 
      fornecedor: string;
      notaFiscal?: string;
      observacao?: string;
    }) => {
      // Buscar rastreador_id
      const { data: manut } = await supabase
        .from('rastreador_manutencao_interna')
        .select('rastreador_id')
        .eq('id', manutencaoId)
        .single();

      if (!manut?.rastreador_id) throw new Error('Rastreador não encontrado');

      // Atualizar rastreador
      await supabase
        .from('rastreadores')
        .update({ 
          status: 'em_garantia',
          updated_at: new Date().toISOString()
        })
        .eq('id', manut.rastreador_id);

      // Atualizar manutenção interna
      const { error: manutError } = await supabase
        .from('rastreador_manutencao_interna')
        .update({
          etapa: 'em_garantia',
          encaminhado_para: fornecedor,
          numero_protocolo_externo: notaFiscal || null,
          data_encaminhamento: new Date().toISOString(),
          diagnostico_inicial: observacao || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', manutencaoId);

      if (manutError) throw manutError;

      return { manutencaoId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manutencao-interna'] });
      queryClient.invalidateQueries({ queryKey: ['manutencao-interna-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['lista-rastreadores'] });
      toast.success('Encaminhado para garantia');
    },
    onError: (error: Error) => {
      console.error('[useEncaminharGarantia] Erro:', error);
      toast.error('Erro ao encaminhar para garantia');
    },
  });
}

/**
 * Hook para registrar laudo externo (plataforma ou garantia)
 */
export function useRegistrarLaudo() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      manutencaoId, 
      laudo,
      recuperavel,
      acao, // 'estoque' | 'baixar' | 'triagem'
    }: { 
      manutencaoId: string; 
      laudo: string;
      recuperavel: boolean;
      acao: 'estoque' | 'baixar' | 'triagem';
    }) => {
      // Buscar rastreador_id
      const { data: manut } = await supabase
        .from('rastreador_manutencao_interna')
        .select('rastreador_id')
        .eq('id', manutencaoId)
        .single();

      if (!manut?.rastreador_id) throw new Error('Rastreador não encontrado');

      let novaEtapa: EtapaManutencaoInterna = 'em_triagem';
      let novoStatusRastreador = 'triagem';

      if (acao === 'estoque') {
        novaEtapa = 'concluido_estoque';
        novoStatusRastreador = 'estoque';
      } else if (acao === 'baixar') {
        novaEtapa = 'descartado';
        novoStatusRastreador = 'baixado';
      } else {
        novaEtapa = 'em_triagem';
        novoStatusRastreador = 'triagem';
      }

      // Atualizar rastreador - cast para tipo correto
      type DBStatus = 'estoque' | 'instalado' | 'manutencao' | 'retorno_base' | 'triagem' | 'em_analise_plataforma' | 'em_garantia' | 'baixado';
      await supabase
        .from('rastreadores')
        .update({ 
          status: novoStatusRastreador as DBStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', manut.rastreador_id);

      // Atualizar manutenção interna
      const updateData: Record<string, any> = {
        etapa: novaEtapa,
        laudo_externo: laudo,
        recuperavel,
        data_retorno: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (acao === 'estoque' || acao === 'baixar') {
        updateData.resolvido_por = profile?.id;
        updateData.resolvido_em = new Date().toISOString();
        updateData.acao_tomada = acao === 'estoque' ? 'Recuperado após laudo' : 'Descartado após laudo';
      }

      const { error: manutError } = await supabase
        .from('rastreador_manutencao_interna')
        .update(updateData)
        .eq('id', manutencaoId);

      if (manutError) throw manutError;

      return { manutencaoId, acao };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['manutencao-interna'] });
      queryClient.invalidateQueries({ queryKey: ['manutencao-interna-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['lista-rastreadores'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores-metricas'] });

      const msg = data.acao === 'estoque' 
        ? 'Rastreador devolvido ao estoque'
        : data.acao === 'baixar'
          ? 'Rastreador descartado'
          : 'Laudo registrado, volta para triagem';

      toast.success(msg);
    },
    onError: (error: Error) => {
      console.error('[useRegistrarLaudo] Erro:', error);
      toast.error('Erro ao registrar laudo');
    },
  });
}

/**
 * Hook para descartar rastreador (baixa definitiva)
 */
export function useDescartarRastreador() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      manutencaoId, 
      motivo,
    }: { 
      manutencaoId: string; 
      motivo: string;
    }) => {
      // Buscar rastreador_id
      const { data: manut } = await supabase
        .from('rastreador_manutencao_interna')
        .select('rastreador_id')
        .eq('id', manutencaoId)
        .single();

      if (!manut?.rastreador_id) throw new Error('Rastreador não encontrado');

      // Atualizar rastreador para baixado
      await supabase
        .from('rastreadores')
        .update({ 
          status: 'baixado',
          updated_at: new Date().toISOString()
        })
        .eq('id', manut.rastreador_id);

      // Registrar movimentação de baixa
      await supabase.from('estoque_movimentacoes').insert({
        tipo: 'baixa_manutencao',
        quantidade: 1,
        status_anterior: 'triagem',
        status_novo: 'baixado',
        rastreador_id: manut.rastreador_id,
        observacoes: `Descartado: ${motivo}`,
      });

      // Atualizar manutenção interna
      const { error: manutError } = await supabase
        .from('rastreador_manutencao_interna')
        .update({
          etapa: 'descartado',
          acao_tomada: `Descarte: ${motivo}`,
          resolvido_por: profile?.id,
          resolvido_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', manutencaoId);

      if (manutError) throw manutError;

      return { manutencaoId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manutencao-interna'] });
      queryClient.invalidateQueries({ queryKey: ['manutencao-interna-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['lista-rastreadores'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores-metricas'] });
      toast.warning('Rastreador descartado definitivamente');
    },
    onError: (error: Error) => {
      console.error('[useDescartarRastreador] Erro:', error);
      toast.error('Erro ao descartar rastreador');
    },
  });
}

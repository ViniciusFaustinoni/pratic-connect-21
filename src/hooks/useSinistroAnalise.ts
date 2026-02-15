import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ============================================
// INTERFACES
// ============================================

export interface SinistroAnaliseData {
  sinistro: any;
  documentos: any[];
  fotos: any[];
  historicoSinistro: any[];
  
  // Dados do veículo
  veiculo: any;
  veiculoHistorico: any[];
  sinistrosAnteriores: any[];
  
  // Rastreador
  rastreador: any | null;
  temRastreadorAtivo: boolean;
  
  // Dados do associado
  associado: any;
  contratoAtivo: any | null;
}

// ============================================
// HOOK PRINCIPAL
// ============================================

export function useSinistroAnalise(sinistroId: string | undefined) {
  const queryClient = useQueryClient();

  // Realtime: atualizar documentos automaticamente quando associado enviar pelo link público
  useEffect(() => {
    if (!sinistroId) return;

    const channel = supabase
      .channel(`sinistro-docs-${sinistroId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sinistro_documentos',
          filter: `sinistro_id=eq.${sinistroId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['sinistro-analise-documentos', sinistroId] });
          queryClient.invalidateQueries({ queryKey: ['sinistro-analise', sinistroId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sinistroId, queryClient]);

  // Query principal do sinistro com todas as relações
  const { data: sinistro, isLoading: loadingSinistro } = useQuery({
    queryKey: ['sinistro-analise', sinistroId],
    queryFn: async () => {
      if (!sinistroId) return null;
      
      const { data, error } = await supabase
        .from('sinistros')
        .select(`
          *,
          associado:associados(
            id, nome, cpf, telefone, whatsapp, email, status,
            logradouro, numero, bairro, cidade, uf, cep,
            data_nascimento, data_adesao, data_ativacao,
            plano:planos(id, nome)
          ),
          veiculo:veiculos(
            id, placa, marca, modelo, ano_modelo, cor, 
            chassi, renavam, valor_fipe, codigo_fipe
          ),
          analista:profiles!sinistros_analista_id_fkey(id, nome)
        `)
        .eq('id', sinistroId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!sinistroId,
  });

  // Documentos do sinistro
  const { data: documentos = [] } = useQuery({
    queryKey: ['sinistro-analise-documentos', sinistroId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sinistro_documentos')
        .select('*')
        .eq('sinistro_id', sinistroId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!sinistroId,
  });

  // Histórico do sinistro
  const { data: historicoSinistro = [] } = useQuery({
    queryKey: ['sinistro-analise-historico', sinistroId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sinistro_historico')
        .select('*, usuario:profiles!sinistro_historico_usuario_id_fkey(nome)')
        .eq('sinistro_id', sinistroId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!sinistroId,
  });

  // Rastreador do veículo
  const { data: rastreador } = useQuery({
    queryKey: ['sinistro-analise-rastreador', sinistro?.veiculo_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rastreadores')
        .select('id, codigo, plataforma, status, ultima_comunicacao, ultima_posicao_lat, ultima_posicao_lng')
        .eq('veiculo_id', sinistro!.veiculo_id)
        .eq('status', 'instalado')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!sinistro?.veiculo_id,
  });

  // Sinistros anteriores do mesmo veículo
  const { data: sinistrosAnteriores = [] } = useQuery({
    queryKey: ['sinistro-analise-anteriores', sinistro?.veiculo_id, sinistroId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sinistros')
        .select('id, protocolo, tipo, status, data_ocorrencia, created_at')
        .eq('veiculo_id', sinistro!.veiculo_id)
        .neq('id', sinistroId!)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!sinistro?.veiculo_id && !!sinistroId,
  });

  // Contrato ativo do associado
  const { data: contratoAtivo } = useQuery({
    queryKey: ['sinistro-analise-contrato', sinistro?.associado_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contratos')
        .select('*, plano:planos(id, nome)')
        .eq('associado_id', sinistro!.associado_id)
        .eq('status', 'ativo')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!sinistro?.associado_id,
  });

  // Histórico do veículo (instalações, desinstalações)
  const { data: veiculoHistorico = [] } = useQuery({
    queryKey: ['sinistro-analise-veiculo-historico', sinistro?.veiculo_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('associados_historico')
        .select('*')
        .eq('veiculo_id', sinistro!.veiculo_id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!sinistro?.veiculo_id,
  });

  // Link do evento (dados das etapas de auto-vistoria)
  const { data: linkEvento } = useQuery({
    queryKey: ['sinistro-analise-link-evento', sinistroId],
    queryFn: async () => {
      const { data } = await supabase
        .from('sinistro_evento_links' as any)
        .select('*')
        .eq('sinistro_id', sinistroId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
    enabled: !!sinistroId,
  });

  // Vistoria do regulador (dados completos da vistoria de evento)
  const { data: vistoriaEvento } = useQuery({
    queryKey: ['sinistro-analise-vistoria-evento', sinistroId],
    queryFn: async () => {
      const { data } = await supabase
        .from('vistorias_evento')
        .select('*')
        .eq('sinistro_id', sinistroId!)
        .order('concluida_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!sinistroId,
  });

  return {
    sinistro,
    documentos,
    historicoSinistro,
    rastreador,
    temRastreadorAtivo: rastreador?.status === 'instalado',
    sinistrosAnteriores,
    contratoAtivo,
    veiculoHistorico,
    linkEvento,
    vistoriaEvento,
    isLoading: loadingSinistro,
  };
}

// ============================================
// HOOK PARA LISTA DE SINISTROS PENDENTES
// ============================================

export function useSinistrosPendentes() {
  return useQuery({
    queryKey: ['sinistros-pendentes-analise'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sinistros')
        .select('id, protocolo, created_at')
        .eq('status', 'comunicado')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

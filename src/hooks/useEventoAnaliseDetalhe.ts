import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useEventoAnaliseDetalhe(sinistroId: string | undefined) {
  const sinistroQuery = useQuery({
    queryKey: ['evento-analise-detalhe', sinistroId],
    queryFn: async () => {
      if (!sinistroId) return null;

      const { data: sinistro, error } = await supabase
        .from('sinistros')
        .select(`
          *,
          associado:associados!sinistros_associado_id_fkey(
            id, nome, cpf, telefone, email, plano_id, created_at, status,
            plano:planos!associados_plano_id_fkey(id, nome, categoria)
          ),
          veiculo:veiculos!sinistros_veiculo_id_fkey(id, placa, marca, modelo, ano_modelo, cor, valor_fipe, chassi)
        `)
        .eq('id', sinistroId)
        .single();

      if (error) throw error;
      return sinistro as any;
    },
    enabled: !!sinistroId,
  });

  // Link do evento (dados das etapas)
  const linkQuery = useQuery({
    queryKey: ['evento-analise-link', sinistroId],
    queryFn: async () => {
      if (!sinistroId) return null;
      const { data: completado } = await supabase
        .from('sinistro_evento_links' as any)
        .select('*')
        .eq('sinistro_id', sinistroId)
        .eq('status', 'completado')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (completado) return completado as any;

      const { data: comDados } = await supabase
        .from('sinistro_evento_links' as any)
        .select('*')
        .eq('sinistro_id', sinistroId)
        .gte('etapa_atual', 2)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (comDados) return comDados as any;

      const { data, error } = await supabase
        .from('sinistro_evento_links' as any)
        .select('*')
        .eq('sinistro_id', sinistroId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as any;
    },
    enabled: !!sinistroId,
  });

  // Vistoria do regulador
  const vistoriaQuery = useQuery({
    queryKey: ['evento-analise-vistoria', sinistroId],
    queryFn: async () => {
      if (!sinistroId) return null;
      const { data, error } = await supabase
        .from('vistorias_evento' as any)
        .select('*')
        .eq('sinistro_id', sinistroId)
        .eq('status', 'concluida')
        .order('concluida_em', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as any;
    },
    enabled: !!sinistroId,
  });

  // Contadores: eventos anteriores
  const eventosAnterioresQuery = useQuery({
    queryKey: ['evento-analise-anteriores', sinistroId, sinistroQuery.data?.associado?.id],
    queryFn: async () => {
      const associadoId = sinistroQuery.data?.associado?.id;
      if (!associadoId) return 0;
      const { count } = await supabase
        .from('sinistros')
        .select('id', { count: 'exact', head: true })
        .eq('associado_id', associadoId)
        .neq('id', sinistroId!);
      return count || 0;
    },
    enabled: !!sinistroQuery.data?.associado?.id,
  });

  // Adimplência (última cobrança)
  const adimplenciaQuery = useQuery({
    queryKey: ['evento-analise-adimplencia', sinistroQuery.data?.associado?.id],
    queryFn: async () => {
      const associadoId = sinistroQuery.data?.associado?.id;
      if (!associadoId) return null;
      const { data } = await supabase
        .from('asaas_cobrancas')
        .select('status, data_vencimento')
        .eq('associado_id', associadoId)
        .order('data_vencimento', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!sinistroQuery.data?.associado?.id,
  });

  // Rastreador
  const rastreadorQuery = useQuery({
    queryKey: ['evento-analise-rastreador', sinistroQuery.data?.veiculo?.id],
    queryFn: async () => {
      const veiculoId = sinistroQuery.data?.veiculo?.id;
      if (!veiculoId) return null;
      const { data } = await supabase
        .from('instalacoes')
        .select('id, rastreador_id, status, rastreador:rastreadores!instalacoes_rastreador_id_fkey(id, modelo, numero_serie)')
        .eq('veiculo_id', veiculoId)
        .eq('status', 'concluida')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
    enabled: !!sinistroQuery.data?.veiculo?.id,
  });

  // Ressalvas do histórico do associado
  const ressalvasQuery = useQuery({
    queryKey: ['evento-analise-ressalvas', sinistroQuery.data?.associado?.id],
    queryFn: async () => {
      const associadoId = sinistroQuery.data?.associado?.id;
      if (!associadoId) return [];
      const { data } = await supabase
        .from('associados_historico')
        .select('id, descricao, created_at, dados_novos, usuario:profiles(nome)')
        .eq('associado_id', associadoId)
        .in('tipo', ['ressalva_registrada', 'ressalva_aprovada_monitoramento', 'ressalva_declinada_monitoramento'])
        .order('created_at', { ascending: false })
        .limit(20);
      return (data || []) as any[];
    },
    enabled: !!sinistroQuery.data?.associado?.id,
  });

  // Ressalvas de instalação do veículo
  const ressalvasInstalacaoQuery = useQuery({
    queryKey: ['evento-analise-ressalvas-instalacao', sinistroQuery.data?.veiculo?.id],
    queryFn: async () => {
      const veiculoId = sinistroQuery.data?.veiculo?.id;
      if (!veiculoId) return [];
      const { data } = await supabase
        .from('servicos')
        .select('id, ressalvas_instalador, fotos_ressalva, created_at, decisao_instalador')
        .eq('veiculo_id', veiculoId)
        .eq('decisao_instalador', 'aprovado_ressalva')
        .order('created_at', { ascending: false })
        .limit(10);
      return (data || []) as any[];
    },
    enabled: !!sinistroQuery.data?.veiculo?.id,
  });

  // Histórico resumido do associado (últimos 10 eventos)
  const historicoQuery = useQuery({
    queryKey: ['evento-analise-historico', sinistroQuery.data?.associado?.id],
    queryFn: async () => {
      const associadoId = sinistroQuery.data?.associado?.id;
      if (!associadoId) return [];
      const { data } = await supabase
        .from('associados_historico')
        .select('id, tipo, descricao, created_at, usuario:profiles(nome)')
        .eq('associado_id', associadoId)
        .order('created_at', { ascending: false })
        .limit(10);
      return (data || []) as any[];
    },
    enabled: !!sinistroQuery.data?.associado?.id,
  });

  return {
    sinistro: sinistroQuery.data,
    link: linkQuery.data,
    vistoria: vistoriaQuery.data,
    eventosAnteriores: eventosAnterioresQuery.data || 0,
    adimplencia: adimplenciaQuery.data,
    rastreador: rastreadorQuery.data,
    ressalvas: ressalvasQuery.data || [],
    ressalvasInstalacao: ressalvasInstalacaoQuery.data || [],
    historico: historicoQuery.data || [],
    isLoading: sinistroQuery.isLoading || linkQuery.isLoading || vistoriaQuery.isLoading,
  };
}

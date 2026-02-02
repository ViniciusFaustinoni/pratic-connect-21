import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AtivacaoContrato {
  id: string;
  numero: string;
  data_assinatura: string | null;
  data_ativacao: string | null;
  status: string;
  created_at: string;
  // Dados do cliente diretamente do contrato
  cliente_nome: string | null;
  cliente_telefone: string | null;
  // Dados do veículo do contrato
  veiculo_marca: string | null;
  veiculo_modelo: string | null;
  veiculo_placa: string | null;
  // IDs para SGA
  associado_id: string | null;
  // Pagamento de adesão
  adesao_paga: boolean;
  // Dados do veículo para SGA
  veiculo: {
    id: string;
    sincronizado_hinova: boolean;
    status_sga: string | null;
    codigo_hinova: number | null;
  } | null;
  // Dados do plano
  plano: {
    id: string;
    nome: string;
    coberturas: string[];
  } | null;
  lead: {
    id: string;
    nome: string;
    telefone: string | null;
    veiculo_marca: string | null;
    veiculo_modelo: string | null;
    veiculo_placa: string | null;
  } | null;
  vendedor: {
    id: string;
    nome: string | null;
  } | null;
  vistoria: {
    id: string;
    status: string;
    modalidade: 'autovistoria' | 'presencial' | null;
    data_aprovacao: string | null;
  } | null;
}

export type FiltroAtivacao = 'todos' | 'pendentes' | 'prontos' | 'ativados';

export function useAtivacoes(filtro: FiltroAtivacao = 'todos') {
  return useQuery({
    queryKey: ['ativacoes', filtro],
    queryFn: async (): Promise<AtivacaoContrato[]> => {
      // Buscar contratos - vendedor_id armazena profiles.id
      const { data: contratos, error } = await supabase
        .from('contratos')
        .select(`
          *,
          leads (id, nome, telefone, veiculo_marca, veiculo_modelo, veiculo_placa)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filtrar por status
      let filteredContratos = contratos || [];
      if (filtro === 'ativados') {
        filteredContratos = filteredContratos.filter(c => c.status === 'ativo');
      } else if (filtro !== 'todos') {
        // Incluir rascunho para visualizar contratos desde o início do fluxo
        filteredContratos = filteredContratos.filter(c => 
          ['rascunho', 'assinado', 'pendente', 'pendente_assinatura', 'enviado'].includes(c.status)
        );
      }

      // Buscar vendedores por profiles.id (contratos.vendedor_id armazena profiles.id)
      const vendedorIds = [...new Set(filteredContratos.map(c => c.vendedor_id).filter(Boolean))] as string[];
      let vendedoresMap = new Map<string, { id: string; nome: string | null }>();
      if (vendedorIds.length > 0) {
        const { data: vendedores } = await supabase
          .from('profiles')
          .select('id, nome')
          .in('id', vendedorIds);
        vendedores?.forEach(v => vendedoresMap.set(v.id, { id: v.id, nome: v.nome }));
      }

      // Buscar vistorias de entrada para cada associado
      const associadoIds = filteredContratos.map(c => c.associado_id).filter(Boolean) as string[];
      let vistoriasData: Array<{ id: string; status: string | null; modalidade: string | null; created_at: string; associado_id: string }> = [];
      if (associadoIds.length > 0) {
        const { data, error } = await supabase
          .from('vistorias')
          .select('id, status, modalidade, created_at, associado_id')
          .in('associado_id', associadoIds)
          .eq('tipo', 'entrada');
        
        if (error) {
          console.error('Erro ao buscar vistorias:', error);
        }
        vistoriasData = (data || []) as unknown as typeof vistoriasData;
      }

      const vistoriasMap = new Map(vistoriasData.map(v => [v.associado_id, v]));

      // Buscar veículos para cada associado (dados SGA)
      let veiculosData: Array<{ id: string; associado_id: string; sincronizado_hinova: boolean | null; status_sga: string | null; codigo_hinova: number | null }> = [];
      if (associadoIds.length > 0) {
        const { data, error } = await supabase
          .from('veiculos')
          .select('id, associado_id, sincronizado_hinova, status_sga, codigo_hinova')
          .in('associado_id', associadoIds);
        
        if (error) {
          console.error('Erro ao buscar veículos:', error);
        }
        veiculosData = (data || []) as unknown as typeof veiculosData;
      }

      const veiculosMap = new Map(veiculosData.map(v => [v.associado_id, v]));

      // Buscar planos para verificar cobertura
      const planoIds = [...new Set(filteredContratos.map(c => c.plano_id).filter(Boolean))] as string[];
      let planosData: Array<{ id: string; nome: string; coberturas: string[] | null }> = [];
      if (planoIds.length > 0) {
        const { data, error } = await supabase
          .from('planos')
          .select('id, nome, coberturas')
          .in('id', planoIds);
        
        if (error) {
          console.error('Erro ao buscar planos:', error);
        }
        planosData = (data || []) as unknown as typeof planosData;
      }

      const planosMap = new Map(planosData.map(p => [p.id, p]));

      // Montar resultado - buscar vendedor do mapa por profiles.id
      const result: AtivacaoContrato[] = filteredContratos.map((contrato: any) => {
        const lead = contrato.leads;
        const vendedor = contrato.vendedor_id ? vendedoresMap.get(contrato.vendedor_id) : null;
        const vistoria = contrato.associado_id ? vistoriasMap.get(contrato.associado_id) : null;
        const veiculo = contrato.associado_id ? veiculosMap.get(contrato.associado_id) : null;
        const plano = contrato.plano_id ? planosMap.get(contrato.plano_id) : null;

        return {
          id: contrato.id,
          numero: contrato.numero,
          data_assinatura: contrato.data_assinatura,
          data_ativacao: contrato.data_ativacao,
          status: contrato.status,
          created_at: contrato.created_at,
          // Dados do cliente e veículo do contrato
          cliente_nome: contrato.cliente_nome,
          cliente_telefone: contrato.cliente_telefone,
          veiculo_marca: contrato.veiculo_marca,
          veiculo_modelo: contrato.veiculo_modelo,
          veiculo_placa: contrato.veiculo_placa,
          // IDs para SGA
          associado_id: contrato.associado_id,
          // Pagamento de adesão
          adesao_paga: contrato.adesao_paga ?? false,
          // Dados do veículo para SGA
          veiculo: veiculo ? {
            id: veiculo.id,
            sincronizado_hinova: veiculo.sincronizado_hinova ?? false,
            status_sga: veiculo.status_sga,
            codigo_hinova: veiculo.codigo_hinova,
          } : null,
          // Dados do plano
          plano: plano ? {
            id: plano.id,
            nome: plano.nome,
            coberturas: plano.coberturas || [],
          } : null,
          lead: lead ? {
            id: lead.id,
            nome: lead.nome,
            telefone: lead.telefone,
            veiculo_marca: lead.veiculo_marca,
            veiculo_modelo: lead.veiculo_modelo,
            veiculo_placa: lead.veiculo_placa,
          } : null,
          vendedor: vendedor ? {
            id: vendedor.id,
            nome: vendedor.nome,
          } : null,
          vistoria: vistoria ? {
            id: vistoria.id,
            status: vistoria.status || '',
            modalidade: (vistoria.modalidade as 'autovistoria' | 'presencial') || null,
            data_aprovacao: vistoria.created_at,
          } : null,
        };
      });

      // Helper para verificar se vistoria está OK baseado na modalidade
      // CORREÇÃO: Tanto autovistoria quanto presencial consideram em_analise como "realizada"
      const isVistoriaOk = (vistoria: typeof result[0]['vistoria']) => {
        if (!vistoria) return false;
        // Para qualquer modalidade: em_analise ou aprovada são considerados OK para ativação
        return ['em_analise', 'aprovada'].includes(vistoria.status);
      };

      // Aplicar filtros de requisitos
      if (filtro === 'pendentes') {
        return result.filter(c => {
          const propostaAssinada = !!c.data_assinatura;
          const vistoriaOk = isVistoriaOk(c.vistoria);
          const requisitos = (propostaAssinada ? 1 : 0) + (vistoriaOk ? 1 : 0);
          return requisitos < 2 && c.status !== 'ativo';
        });
      }

      if (filtro === 'prontos') {
        return result.filter(c => {
          const propostaAssinada = !!c.data_assinatura;
          const vistoriaOk = isVistoriaOk(c.vistoria);
          return propostaAssinada && vistoriaOk && c.status !== 'ativo';
        });
      }

      return result;
    },
  });
}

export function useAtivarContrato() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contratoId: string) => {
      // 1. Buscar contrato para pegar associado_id
      const { data: contrato, error: fetchError } = await supabase
        .from('contratos')
        .select('associado_id')
        .eq('id', contratoId)
        .single();

      if (fetchError) throw fetchError;

      // 2. Atualizar contrato
      const { error: contratoError } = await supabase
        .from('contratos')
        .update({
          status: 'ativo',
          data_ativacao: new Date().toISOString(),
        })
        .eq('id', contratoId);

      if (contratoError) throw contratoError;

      // 3. Atualizar associado para ativo (se existir)
      if (contrato?.associado_id) {
        const { error: associadoError } = await supabase
          .from('associados')
          .update({
            status: 'ativo',
            data_adesao: new Date().toISOString().split('T')[0],
          })
          .eq('id', contrato.associado_id);

        if (associadoError) {
          console.error('Erro ao ativar associado:', associadoError);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ativacoes'] });
      queryClient.invalidateQueries({ queryKey: ['associados'] });
      toast.success('Contrato e associado ativados com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao ativar contrato:', error);
      toast.error('Erro ao ativar contrato');
    },
  });
}

export function useAtivacaoMetricas() {
  const { data: todos } = useAtivacoes('todos');
  const { data: prontos } = useAtivacoes('prontos');
  const { data: ativados } = useAtivacoes('ativados');

  const ativadosHoje = ativados?.filter(c => {
    if (!c.data_ativacao) return false;
    const hoje = new Date().toDateString();
    return new Date(c.data_ativacao).toDateString() === hoje;
  }).length || 0;

  const pendentes = todos?.filter(c => c.status !== 'ativo').length || 0;

  return {
    totalPendentes: pendentes,
    prontosParaAtivar: prontos?.length || 0,
    ativadosHoje,
    tempoMedio: 3, // Placeholder - calcular média real
  };
}

export function useExcluirAtivacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contratoId: string) => {
      // Usar Edge Function para exclusão robusta com service role
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Você precisa estar autenticado');
      }

      const response = await fetch(
        'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/delete-ativacao',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ contratoId }),
        }
      );

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao excluir ativação');
      }
      
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['ativacoes'] });
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias'] });
      queryClient.invalidateQueries({ queryKey: ['associados'] });
      toast.success(result.message || 'Ativação e registros relacionados excluídos com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao excluir ativação:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir ativação. Verifique suas permissões.');
    },
  });
}

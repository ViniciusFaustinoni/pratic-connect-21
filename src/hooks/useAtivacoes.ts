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
    data_aprovacao: string | null;
  } | null;
}

export type FiltroAtivacao = 'todos' | 'pendentes' | 'prontos' | 'ativados';

export function useAtivacoes(filtro: FiltroAtivacao = 'todos') {
  return useQuery({
    queryKey: ['ativacoes', filtro],
    queryFn: async (): Promise<AtivacaoContrato[]> => {
      // Buscar contratos
      const { data: contratos, error } = await supabase
        .from('contratos')
        .select('id, numero, data_assinatura, data_ativacao, status, created_at, lead_id, vendedor_id, associado_id')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filtrar por status
      let filteredContratos = contratos || [];
      if (filtro === 'ativados') {
        filteredContratos = filteredContratos.filter(c => c.status === 'ativo');
      } else if (filtro !== 'todos') {
        filteredContratos = filteredContratos.filter(c => 
          ['assinado', 'pendente', 'pendente_assinatura', 'enviado'].includes(c.status)
        );
      }

      // Buscar leads e vendedores
      const leadIds = filteredContratos.map(c => c.lead_id).filter(Boolean) as string[];
      const vendedorIds = filteredContratos.map(c => c.vendedor_id).filter(Boolean) as string[];
      const associadoIds = filteredContratos.map(c => c.associado_id).filter(Boolean) as string[];

      const [leadsRes, vendedoresRes] = await Promise.all([
        leadIds.length > 0 
          ? supabase.from('leads').select('id, nome, telefone, veiculo_marca, veiculo_modelo, veiculo_placa').in('id', leadIds)
          : { data: [] },
        vendedorIds.length > 0
          ? supabase.from('profiles').select('id, nome').in('id', vendedorIds)
          : { data: [] },
      ]);

      const leadsMap = new Map((leadsRes.data || []).map(l => [l.id, l]));
      const vendedoresMap = new Map((vendedoresRes.data || []).map(v => [v.id, v]));

      // Buscar vistorias de entrada para cada associado
      let vistoriasData: Array<{ id: string; status: string | null; created_at: string; associado_id: string }> = [];
      if (associadoIds.length > 0) {
        const { data } = await supabase
          .from('vistorias')
          .select('id, status, created_at, associado_id')
          .in('associado_id', associadoIds)
          .eq('tipo', 'entrada');
        vistoriasData = (data || []) as unknown as typeof vistoriasData;
      }
      
      const vistoriasMap = new Map(vistoriasData.map(v => [v.associado_id, v]));

      // Montar resultado
      const result: AtivacaoContrato[] = filteredContratos.map(contrato => {
        const lead = contrato.lead_id ? leadsMap.get(contrato.lead_id) : null;
        const vendedor = contrato.vendedor_id ? vendedoresMap.get(contrato.vendedor_id) : null;
        const vistoria = contrato.associado_id ? vistoriasMap.get(contrato.associado_id) : null;

        return {
          id: contrato.id,
          numero: contrato.numero,
          data_assinatura: contrato.data_assinatura,
          data_ativacao: contrato.data_ativacao,
          status: contrato.status,
          created_at: contrato.created_at,
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
            data_aprovacao: vistoria.created_at,
          } : null,
        };
      });

      // Aplicar filtros de requisitos
      if (filtro === 'pendentes') {
        return result.filter(c => {
          const propostaAssinada = !!c.data_assinatura;
          const vistoriaOk = c.vistoria?.status === 'aprovada';
          const requisitos = (propostaAssinada ? 1 : 0) + (vistoriaOk ? 1 : 0);
          return requisitos < 2 && c.status !== 'ativo';
        });
      }

      if (filtro === 'prontos') {
        return result.filter(c => {
          const propostaAssinada = !!c.data_assinatura;
          const vistoriaOk = c.vistoria?.status === 'aprovada';
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
      const { error } = await supabase
        .from('contratos')
        .update({
          status: 'ativo',
          data_ativacao: new Date().toISOString(),
        })
        .eq('id', contratoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ativacoes'] });
      toast.success('Contrato ativado com sucesso!');
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

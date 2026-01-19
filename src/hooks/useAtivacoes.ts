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
      // Buscar contratos com dados do cliente
      const { data: contratos, error } = await supabase
        .from('contratos')
        .select(`
          id, numero, data_assinatura, data_ativacao, status, created_at, 
          lead_id, vendedor_id, associado_id,
          cliente_nome, cliente_telefone,
          veiculo_marca, veiculo_modelo, veiculo_placa
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
      let vistoriasData: Array<{ id: string; status: string | null; modalidade: string | null; created_at: string; associado_id: string }> = [];
      if (associadoIds.length > 0) {
        const { data } = await supabase
          .from('vistorias')
          .select('id, status, modalidade, created_at, associado_id')
          .in('associado_id', associadoIds)
          .in('tipo', ['entrada', 'instalacao'] as any);
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
          // Dados do cliente e veículo do contrato
          cliente_nome: contrato.cliente_nome,
          cliente_telefone: contrato.cliente_telefone,
          veiculo_marca: contrato.veiculo_marca,
          veiculo_modelo: contrato.veiculo_modelo,
          veiculo_placa: contrato.veiculo_placa,
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
      const isVistoriaOk = (vistoria: typeof result[0]['vistoria']) => {
        if (!vistoria) return false;
        const isAutovistoria = vistoria.modalidade === 'autovistoria';
        // Autovistoria: em_analise ou aprovada são válidos para ativação
        // Presencial: apenas aprovada
        if (isAutovistoria) {
          return ['em_analise', 'aprovada'].includes(vistoria.status);
        }
        return vistoria.status === 'aprovada';
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
      // 1. Buscar dados do contrato para obter IDs relacionados
      const { data: contrato, error: fetchError } = await supabase
        .from('contratos')
        .select('autentique_documento_id, cotacao_id, associado_id')
        .eq('id', contratoId)
        .single();
      
      if (fetchError) throw fetchError;

      // 2. Cancelar documento no Autentique (se existir)
      if (contrato?.autentique_documento_id) {
        try {
          const { error: autentiqueError } = await supabase.functions.invoke('autentique-cancel', {
            body: { 
              documentId: contrato.autentique_documento_id,
              contratoId: contratoId 
            }
          });
          
          if (autentiqueError) {
            console.warn('Erro ao cancelar no Autentique:', autentiqueError);
            // Continuar mesmo com erro (documento pode já ter sido cancelado)
          }
        } catch (e) {
          console.warn('Falha ao comunicar com Autentique:', e);
        }
      }

      // 3. Excluir cobranças Asaas vinculadas
      await supabase
        .from('asaas_cobrancas')
        .delete()
        .eq('contrato_id', contratoId);
      
      // 4. Excluir cobranças antigas
      await supabase
        .from('cobrancas')
        .delete()
        .eq('contrato_id', contratoId);
      
      // 5. Excluir histórico do contrato
      await supabase
        .from('contratos_historico')
        .delete()
        .eq('contrato_id', contratoId);
      
      // 6. Excluir vistorias vinculadas ao contrato
      await supabase
        .from('vistorias')
        .delete()
        .eq('contrato_id', contratoId);

      // 7. Excluir histórico do associado (se existir)
      if (contrato?.associado_id) {
        await supabase
          .from('associados_historico')
          .delete()
          .eq('associado_id', contrato.associado_id);
      }

      // 8. Excluir documentos do contrato
      await supabase
        .from('contratos_documentos')
        .delete()
        .eq('contrato_id', contratoId);

      // 9. Excluir gastos/benefícios do contrato
      await supabase
        .from('gastos_beneficios')
        .delete()
        .eq('contrato_id', contratoId);

      // 10. Excluir documentos solicitados
      await supabase
        .from('documentos_solicitados')
        .delete()
        .eq('contrato_id', contratoId);

      // 11. Limpar referência na cotação ANTES de excluir o contrato
      if (contrato?.cotacao_id) {
        await supabase
          .from('cotacoes')
          .update({ contrato_gerado_id: null })
          .eq('id', contrato.cotacao_id);
      }

      // 12. Limpar referência no associado
      if (contrato?.associado_id) {
        await supabase
          .from('associados')
          .update({ contrato_id: null })
          .eq('id', contrato.associado_id);
      }
      
      // 13. Excluir o contrato
      const { error: contratoError } = await supabase
        .from('contratos')
        .delete()
        .eq('id', contratoId);
        
      if (contratoError) throw contratoError;

      // 14. Excluir cotação vinculada (se existir)
      if (contrato?.cotacao_id) {
        await supabase
          .from('cotacoes')
          .delete()
          .eq('id', contrato.cotacao_id);
      }

      // 10. Excluir associado vinculado (se existir e não tiver outros contratos)
      if (contrato?.associado_id) {
        // Verificar se associado tem outros contratos
        const { count } = await supabase
          .from('contratos')
          .select('*', { count: 'exact', head: true })
          .eq('associado_id', contrato.associado_id);
        
        if (count === 0) {
          // Excluir vistorias do associado
          await supabase
            .from('vistorias')
            .delete()
            .eq('associado_id', contrato.associado_id);
          
          // Excluir associado
          await supabase
            .from('associados')
            .delete()
            .eq('id', contrato.associado_id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ativacoes'] });
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias'] });
      queryClient.invalidateQueries({ queryKey: ['associados'] });
      toast.success('Ativação e registros relacionados excluídos com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao excluir ativação:', error);
      toast.error('Erro ao excluir ativação. Verifique suas permissões.');
    },
  });
}

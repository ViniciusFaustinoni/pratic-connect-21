import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { SinistroTerceiro, SinistroTerceiroDocumento, LimiteCoberturaTerceiros } from '@/types/terceiros';

// Buscar terceiros de um sinistro
export function useTerceiros(sinistroId: string | undefined) {
  return useQuery({
    queryKey: ['sinistro-terceiros', sinistroId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sinistro_terceiros')
        .select('*')
        .eq('sinistro_id', sinistroId!)
        .order('numero_sequencial', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as SinistroTerceiro[];
    },
    enabled: !!sinistroId,
  });
}

// Buscar documentos de um terceiro
export function useTerceiroDocumentos(terceiroId: string | undefined) {
  return useQuery({
    queryKey: ['terceiro-documentos', terceiroId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sinistro_terceiro_documentos')
        .select('*')
        .eq('terceiro_id', terceiroId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as SinistroTerceiroDocumento[];
    },
    enabled: !!terceiroId,
  });
}

// Buscar limites de cobertura
export function useLimiteCobertura(associadoId: string | undefined, sinistroId: string | undefined) {
  return useQuery({
    queryKey: ['limite-cobertura-terceiros', associadoId, sinistroId],
    queryFn: async () => {
      if (!associadoId) return null;

      // 1. Buscar plano do associado via contrato ativo
      const { data: contrato } = await supabase
        .from('contratos')
        .select('plano_id, plano:planos(id, nome, limite_terceiros, cota_terceiros, cota_terceiros_isento)')
        .eq('associado_id', associadoId)
        .eq('status', 'ativo')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const plano = (contrato as any)?.plano;
      if (!plano) return null;

      // 2. Verificar cota dobrada — reincidência 12 meses
      const umAnoAtras = new Date();
      umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1);

      const { count: sinistrosRecentes } = await supabase
        .from('sinistros')
        .select('id', { count: 'exact', head: true })
        .eq('associado_id', associadoId)
        .neq('id', sinistroId || '')
        .in('tipo', ['colisao'])
        .not('status', 'in', '(cancelado,negado,reprovado)')
        .gte('data_ocorrencia', umAnoAtras.toISOString());

      // 3. Verificar primeiros 120 dias de filiação
      const { data: associado } = await supabase
        .from('associados')
        .select('data_ativacao, data_adesao')
        .eq('id', associadoId)
        .maybeSingle();

      const dataAtivacao = associado?.data_ativacao || associado?.data_adesao;
      let primeiros120Dias = false;
      if (dataAtivacao) {
        const diffMs = Date.now() - new Date(dataAtivacao).getTime();
        primeiros120Dias = diffMs < 120 * 24 * 60 * 60 * 1000;
      }

      const reincidente = (sinistrosRecentes || 0) > 0;
      const cotaDobrada = reincidente || primeiros120Dias;
      const motivo = reincidente
        ? 'Reincidência em 12 meses'
        : primeiros120Dias
          ? 'Primeiros 120 dias de filiação'
          : undefined;

      // 4. Buscar total consumido (orçamentos dos terceiros deste sinistro)
      const { data: terceiros } = await supabase
        .from('sinistro_terceiros')
        .select('orcamento_valor')
        .eq('sinistro_id', sinistroId!)
        .not('culpa', 'eq', 'terceiro_culpado');

      const totalConsumido = (terceiros || []).reduce(
        (sum, t: any) => sum + (t.orcamento_valor || 0), 0
      );

      const limiteTerceiros = plano.limite_terceiros || 0;
      const cotaBase = plano.cota_terceiros || 0;
      const cotaIsento = plano.cota_terceiros_isento || false;

      return {
        plano_nome: plano.nome,
        limite_total: limiteTerceiros,
        cota_associado: cotaIsento ? 0 : (cotaDobrada ? cotaBase * 2 : cotaBase),
        cota_isento: cotaIsento,
        cota_dobrada: cotaDobrada && !cotaIsento,
        motivo_cota_dobrada: motivo,
        total_consumido: totalConsumido,
        disponivel: limiteTerceiros - totalConsumido,
      } as LimiteCoberturaTerceiros;
    },
    enabled: !!associadoId && !!sinistroId,
  });
}

// Cadastrar terceiro
export function useCadastrarTerceiro() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dados: {
      sinistro_id: string;
      nome: string;
      cpf: string;
      telefone: string;
      whatsapp: string;
      email?: string;
      veiculo_placa: string;
      veiculo_marca: string;
      veiculo_modelo: string;
      veiculo_ano: string;
      veiculo_cor: string;
      veiculo_fipe?: number;
      culpa: string;
      parentesco: boolean;
      parentesco_descricao?: string;
      tipo_dano: string;
      observacoes?: string;
    }) => {
      // Buscar próximo número sequencial
      const { data: existentes } = await supabase
        .from('sinistro_terceiros')
        .select('numero_sequencial')
        .eq('sinistro_id', dados.sinistro_id)
        .order('numero_sequencial', { ascending: false })
        .limit(1);

      const proximoSeq = ((existentes?.[0] as any)?.numero_sequencial || 0) + 1;

      const { data, error } = await supabase
        .from('sinistro_terceiros')
        .insert({
          ...dados,
          numero_sequencial: proximoSeq,
          status: 'cadastrado',
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Marcar sinistro como tem_terceiro
      await supabase
        .from('sinistros')
        .update({ tem_terceiro: true } as any)
        .eq('id', dados.sinistro_id);

      return data;
    },
    onSuccess: (_, vars) => {
      toast.success('Terceiro cadastrado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['sinistro-terceiros', vars.sinistro_id] });
      queryClient.invalidateQueries({ queryKey: ['sinistro', vars.sinistro_id] });
    },
    onError: (err: any) => {
      toast.error('Erro ao cadastrar terceiro: ' + err.message);
    },
  });
}

// Excluir terceiro
export function useExcluirTerceiro() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ terceiroId, sinistroId }: { terceiroId: string; sinistroId: string }) => {
      const { error } = await supabase
        .from('sinistro_terceiros')
        .delete()
        .eq('id', terceiroId);
      if (error) throw error;

      // Verificar se ainda há terceiros
      const { count } = await supabase
        .from('sinistro_terceiros')
        .select('id', { count: 'exact', head: true })
        .eq('sinistro_id', sinistroId);

      if ((count || 0) === 0) {
        await supabase
          .from('sinistros')
          .update({ tem_terceiro: false } as any)
          .eq('id', sinistroId);
      }
    },
    onSuccess: (_, vars) => {
      toast.success('Terceiro removido');
      queryClient.invalidateQueries({ queryKey: ['sinistro-terceiros', vars.sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistro', vars.sinistroId] });
    },
    onError: (err: any) => {
      toast.error('Erro ao remover terceiro: ' + err.message);
    },
  });
}

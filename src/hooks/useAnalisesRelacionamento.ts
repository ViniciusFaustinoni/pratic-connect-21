/**
 * Fila Análises de Relacionamento — ingestão canônica
 *
 * A tabela `analises_relacionamento` é alimentada EXCLUSIVAMENTE por 3 triggers
 * no banco, todos via helper `fn_criar_analise_relacionamento`:
 *
 * 1. trg_analise_relacionamento_cancelamento_voluntario
 *    → tabela: contratos
 *    → disparo: UPDATE de autentique_cancelamento_assinado_em (NULL → not null)
 *    → tipo: cancelamento_voluntario
 *
 * 2. trg_analise_relacionamento_troca
 *    → tabela: solicitacoes_troca_titularidade
 *    → disparo: UPDATE de termo_cancelamento_assinado_em (NULL → not null)
 *    → tipo: troca_titularidade
 *
 * 3. trg_analise_relacionamento_substituicao
 *    → tabela: solicitacoes_substituicao_placa
 *    → disparo: UPDATE de termo_cancelamento_assinado_em (NULL → not null)
 *    → tipo: substituicao
 *
 * EXCEÇÃO controlada (06/06/26): a tela de Substituição (Cadastro › Processos)
 * chama `fn_criar_analise_relacionamento` direto do frontend quando o consultor
 * marca "assumir responsabilidade" por débito em aberto, antes mesmo do termo
 * ser assinado. É o único ponto de inserção frontend permitido e usa a mesma
 * função SECURITY DEFINER, mantendo idempotência por (origem_tabela='substituicoes_veiculo', origem_id).
 *
 * Qualquer regressão na fila (silenciosa / vazia inesperadamente)
 * deve ser investigada primeiro nesses 3 triggers + fn_criar_analise_relacionamento.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type AnaliseRelacionamentoTipo =
  | 'troca_titularidade'
  | 'cancelamento_voluntario'
  | 'substituicao'
  | 'outro';

export type AnaliseRelacionamentoStatus = 'pendente' | 'em_andamento' | 'resolvido';

export interface AnaliseRelacionamento {
  id: string;
  tipo: AnaliseRelacionamentoTipo;
  status: AnaliseRelacionamentoStatus;
  associado_id: string | null;
  veiculo_id: string | null;
  contrato_id: string | null;
  origem_tabela: string;
  origem_id: string;
  termo_url: string | null;
  termo_assinado_em: string | null;
  assumido_por: string | null;
  assumido_em: string | null;
  resolvido_por: string | null;
  resolvido_em: string | null;
  justificativa: string | null;
  documento_comprobatorio_url: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export const TIPO_CFG: Record<
  AnaliseRelacionamentoTipo,
  { label: string; cls: string }
> = {
  troca_titularidade: {
    label: 'Troca de Titularidade',
    cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  },
  cancelamento_voluntario: {
    label: 'Cancelamento Voluntário',
    cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  },
  substituicao: {
    label: 'Substituição de Veículo',
    cls: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
  },
  outro: {
    label: 'Outro',
    cls: 'bg-muted text-muted-foreground border-border',
  },
};

export const STATUS_CFG: Record<
  AnaliseRelacionamentoStatus,
  { label: string; cls: string }
> = {
  pendente: {
    label: 'Pendente',
    cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  },
  em_andamento: {
    label: 'Em Andamento',
    cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  },
  resolvido: {
    label: 'Resolvido',
    cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  },
};

interface ListFilters {
  status?: AnaliseRelacionamentoStatus | 'todos';
  tipo?: AnaliseRelacionamentoTipo | 'todos';
  busca?: string;
}

export function useAnalisesRelacionamento(filters: ListFilters = {}) {
  return useQuery({
    queryKey: ['analises-relacionamento', filters],
    queryFn: async () => {
      let q = (supabase as any)
        .from('analises_relacionamento')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (filters.status && filters.status !== 'todos') {
        q = q.eq('status', filters.status);
      }
      if (filters.tipo && filters.tipo !== 'todos') {
        q = q.eq('tipo', filters.tipo);
      }

      const { data, error } = await q;
      if (error) throw error;

      const rows = (data || []) as AnaliseRelacionamento[];
      const termo = filters.busca?.trim().toLowerCase();
      if (!termo) return rows;
      return rows.filter((r) => {
        const meta = r.metadata || {};
        return (
          String(meta.associado_nome || '').toLowerCase().includes(termo) ||
          String(meta.associado_cpf || '').toLowerCase().includes(termo) ||
          String(meta.placa || '').toLowerCase().includes(termo)
        );
      });
    },
    staleTime: 30_000,
  });
}

export function useAssumirAnalise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;
      const { error } = await (supabase as any)
        .from('analises_relacionamento')
        .update({
          status: 'em_andamento',
          assumido_por: userId,
          assumido_em: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Caso assumido');
      qc.invalidateQueries({ queryKey: ['analises-relacionamento'] });
    },
    onError: (e: any) => toast.error('Erro ao assumir caso: ' + (e?.message || e)),
  });
}

interface ResolverInput {
  id: string;
  justificativa: string;
  documentoUrl: string | null;
  associadoId: string | null;
  tipo: AnaliseRelacionamentoTipo;
  placa?: string | null;
}

export function useResolverAnalise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ResolverInput) => {
      if (!input.justificativa || input.justificativa.trim().length < 10) {
        throw new Error('Justificativa deve ter pelo menos 10 caracteres');
      }
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      const { error } = await (supabase as any)
        .from('analises_relacionamento')
        .update({
          status: 'resolvido',
          resolvido_por: userId,
          resolvido_em: new Date().toISOString(),
          justificativa: input.justificativa.trim(),
          documento_comprobatorio_url: input.documentoUrl,
        })
        .eq('id', input.id);
      if (error) throw error;

      if (input.associadoId) {
        const tipoLabel = TIPO_CFG[input.tipo]?.label || input.tipo;
        const placa = input.placa ? ` (placa ${input.placa})` : '';
        await (supabase as any).from('associados_historico').insert({
          associado_id: input.associadoId,
          tipo: 'analise_relacionamento_resolvida',
          acao: 'concluir',
          descricao: `Análise de Relacionamento resolvida: ${tipoLabel}${placa}`,
          usuario_id: userId,
          metadata: {
            analise_id: input.id,
            tipo: input.tipo,
            justificativa: input.justificativa.trim(),
            documento_url: input.documentoUrl,
          },
        });
      }
    },
    onSuccess: () => {
      toast.success('Caso marcado como resolvido');
      qc.invalidateQueries({ queryKey: ['analises-relacionamento'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao resolver caso'),
  });
}

export interface UltimaAnaliseInfo {
  createdAt: string;
  diasDesde: number;
  total30d: number;
}

export function useUltimaAnaliseRecebida() {
  return useQuery<UltimaAnaliseInfo | null>({
    queryKey: ['ultima-analise-recebida'],
    queryFn: async () => {
      const [ultimo, total] = await Promise.all([
        (supabase as any)
          .from('analises_relacionamento')
          .select('created_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        (supabase as any)
          .from('analises_relacionamento')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
      ]);

      if (ultimo.error) throw ultimo.error;
      if (!ultimo.data) return null; // tabela vazia → sem chip

      const createdAt: string = ultimo.data.created_at;
      const diasDesde = Math.floor(
        (Date.now() - new Date(createdAt).getTime()) / 86400000
      );

      return {
        createdAt,
        diasDesde,
        total30d: total.count ?? 0,
      };
    },
    staleTime: 60_000,
  });
}

export async function uploadAnexoRelacionamento(
  analiseId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop() || 'bin';
  const path = `${analiseId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('relacionamento-anexos')
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from('relacionamento-anexos').getPublicUrl(path);
  // Bucket é privado; geramos signed URL p/ leitura
  const { data: signed } = await supabase.storage
    .from('relacionamento-anexos')
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  return signed?.signedUrl || data.publicUrl;
}

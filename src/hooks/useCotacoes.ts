import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import type { StatusCotacao } from '@/types/vendas';
import { registrarLog } from './useAuditLog';
import { isUniqueViolation } from '@/lib/errors';

type Cotacao = Tables<'cotacoes'>;
type CotacaoInsert = TablesInsert<'cotacoes'>;
type CotacaoUpdate = TablesUpdate<'cotacoes'>;

// Gera número único para cotação: COT-YYYYMMDD-HHMMSSMMM-XXX
function gerarNumeroCotacao(): string {
  const now = new Date();
  const ano = now.getFullYear();
  const mes = String(now.getMonth() + 1).padStart(2, '0');
  const dia = String(now.getDate()).padStart(2, '0');
  const hora = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const seg = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  
  return `COT-${ano}${mes}${dia}-${hora}${min}${seg}${ms}-${random}`;
}

export interface PlanoComparacao {
  id: string;
  nome: string;
  codigo?: string;
  valorMensal: number;
  valorAdesao?: number;
  coberturas?: string[];
  naoInclui?: string[];
  coberturaFipe?: number;
  cota?: string;
  cotaPercentual?: number;
  cotaMinima?: number;
  cotaDesagio?: number;
  cotaMinimaDesagio?: number;
  adicionalMensal?: number;
  anoMinimo?: number;
  alertaDesagio?: string;
  coberturasRemovidas?: string[];
}

export interface DadosExtrasCotacao {
  planos_comparacao?: PlanoComparacao[];
  [key: string]: unknown;
}

export interface CotacaoWithRelations extends Omit<Cotacao, 'dados_extras'> {
  leads?: Tables<'leads'> | null;
  planos?: Tables<'planos'> | null;
  vendedor?: {
    id: string;
    nome: string;
    email: string;
  } | null;
  contrato?: {
    id: string;
    numero: string;
    status: string;
    adesao_paga?: boolean;
    associados?: { id: string; status: string } | null;
  } | null;
  instalacoes?: { id: string; status: string; data_agendada: string | null }[];
  dados_extras?: DadosExtrasCotacao | null;
}

export interface UseCotacoesOptions {
  vendedorId?: string;
  viewScope?: 'own' | 'team' | 'all';
  searchTerm?: string;
}

export interface CotacoesFunilCounts {
  total: number;
  em_andamento_total: number;
  finalizadas_total: number;
  rascunho: number;
  enviada: number;
  escolhendo_plano: number;
  enviando_documentos: number;
  em_analise: number;
  assinando_contrato: number;
  pagando_taxa: number;
  agendando_vistoria: number;
  concluido: number;
  perdida: number;
}

/**
 * Contadores do funil calculados no servidor via RPC `cotacoes_funil_counts`.
 * Permite mostrar totais reais sem trazer todas as linhas para o cliente.
 */
export function useCotacoesFunilCounts(options?: UseCotacoesOptions) {
  const search = (options?.searchTerm || '').trim();
  const effectiveScope: 'own' | 'team' | 'all' =
    options?.viewScope === 'all' || options?.viewScope === 'team' ? options.viewScope : 'own';
  const effectiveVendedorId = effectiveScope === 'own' ? options?.vendedorId : null;

  return useQuery({
    queryKey: ['cotacoes', 'funil-counts', effectiveScope, effectiveVendedorId, search],
    queryFn: async (): Promise<CotacoesFunilCounts> => {
      const { data, error } = await supabase.rpc('cotacoes_funil_counts', {
        p_vendedor_id: effectiveVendedorId,
        p_view_scope: effectiveScope,
        p_search: search || null,
      });
      if (error) throw error;
      const v = (data || {}) as Partial<CotacoesFunilCounts>;
      return {
        total: v.total ?? 0,
        em_andamento_total: v.em_andamento_total ?? 0,
        finalizadas_total: v.finalizadas_total ?? 0,
        rascunho: v.rascunho ?? 0,
        enviada: v.enviada ?? 0,
        escolhendo_plano: v.escolhendo_plano ?? 0,
        enviando_documentos: v.enviando_documentos ?? 0,
        em_analise: v.em_analise ?? 0,
        assinando_contrato: v.assinando_contrato ?? 0,
        pagando_taxa: v.pagando_taxa ?? 0,
        agendando_vistoria: v.agendando_vistoria ?? 0,
        concluido: v.concluido ?? 0,
        perdida: v.perdida ?? 0,
      };
    },
    placeholderData: keepPreviousData,
    staleTime: 1000 * 30,
  });
}

// Status que compõem cada aba da tela de Cotações.
// IMPORTANTE: enum status_cotacao só tem rascunho/enviada/aceita/recusada/expirada.
const STATUS_EM_ANDAMENTO_LIST = ['rascunho', 'enviada'];
const STATUS_FINALIZADAS_LIST = ['aceita', 'recusada', 'expirada'];

type CotacoesStatusGroup = 'em_andamento' | 'finalizadas' | 'all';

export interface UseCotacoesPaginadasOptions extends UseCotacoesOptions {
  page?: number;
  pageSize?: number;
  statusGroup?: CotacoesStatusGroup;
}

async function fetchCotacoesCore(params: {
  effectiveScope: 'own' | 'team' | 'all';
  effectiveVendedorId?: string;
  search: string;
  page?: number;
  pageSize?: number;
  statusGroup?: CotacoesStatusGroup;
}) {
  const { effectiveScope, effectiveVendedorId, search, page, pageSize, statusGroup } = params;

  let query = supabase
    .from('cotacoes')
    .select(
      `
        id, numero, status, status_contratacao, created_at, updated_at,
        vendedor_id, lead_id, plano_id, token_publico,
        cliente_nome, nome_solicitante, telefone1_solicitante, telefone2_solicitante, email_solicitante,
        veiculo_placa, veiculo_marca, veiculo_modelo, veiculo_ano, valor_fipe,
        valor_mensalidade, valor_adesao, tipo_entrada, dados_extras,
        substituida_por_cotacao_id, motivo_substituicao,
        leads:leads!fk_cotacoes_lead_id(id, nome, telefone, email),
        planos:planos!plano_id(id, nome, codigo),
        contrato:contratos!contratos_cotacao_id_fkey(
          id, numero, status, adesao_paga,
          associados:associados!fk_contratos_associado(id, status)
        ),
        instalacoes:instalacoes!instalacoes_cotacao_id_fkey(id, status, data_agendada)
      `,
      pageSize ? { count: 'exact' } : undefined
    )
    .order('created_at', { ascending: false });

  // Escopo "own": filtra explicitamente por vendedor logado.
  if (effectiveScope === 'own' && effectiveVendedorId) {
    query = query.eq('vendedor_id', effectiveVendedorId);
  }

  // Filtro server-side por aba (Em Andamento / Finalizadas).
  // Em Andamento: status nos transitórios E status_contratacao != 'concluido'.
  // Finalizadas: status terminal OU status_contratacao = 'concluido'.
  if (statusGroup === 'em_andamento') {
    query = query.in('status', STATUS_EM_ANDAMENTO_LIST as any).neq('status_contratacao', 'concluido');
  } else if (statusGroup === 'finalizadas') {
    query = query.or(
      `status.in.(${STATUS_FINALIZADAS_LIST.join(',')}),status_contratacao.eq.concluido`
    );
  }

  if (search) {
    const safe = search.replace(/[,()]/g, '');
    const like = `%${safe}%`;

    const { data: leadsMatch } = await supabase
      .from('leads')
      .select('id')
      .or([`nome.ilike.${like}`, `telefone.ilike.${like}`, `email.ilike.${like}`].join(','))
      .limit(500);
    const leadIds = (leadsMatch || []).map((l: any) => l.id).filter(Boolean);

    const orParts = [
      `numero.ilike.${like}`,
      `veiculo_placa.ilike.${like}`,
      `veiculo_marca.ilike.${like}`,
      `veiculo_modelo.ilike.${like}`,
      `nome_solicitante.ilike.${like}`,
      `telefone1_solicitante.ilike.${like}`,
      `telefone2_solicitante.ilike.${like}`,
      `email_solicitante.ilike.${like}`,
    ];
    if (leadIds.length > 0) {
      orParts.push(`lead_id.in.(${leadIds.join(',')})`);
    }
    query = query.or(orParts.join(','));
  }

  if (pageSize) {
    const p = Math.max(1, page ?? 1);
    const from = (p - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);
  } else {
    query = query.limit(1000);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  // Buscar vendedores em lote
  const vendedorIds = Array.from(
    new Set((data || []).map((c: any) => c.vendedor_id).filter(Boolean))
  );
  const vendedoresMap = new Map<string, any>();
  if (vendedorIds.length > 0) {
    const { data: vendedores } = await supabase
      .from('profiles')
      .select('user_id, nome, email, whatsapp, full_name')
      .in('user_id', vendedorIds);
    (vendedores || []).forEach((v: any) => vendedoresMap.set(v.user_id, v));
  }

  const mapped = (data || []).map((cotacao: any) => {
    const v = cotacao.vendedor_id ? vendedoresMap.get(cotacao.vendedor_id) : null;
    return {
      ...cotacao,
      vendedor: v
        ? { id: v.user_id, nome: v.nome, email: v.email, whatsapp: v.whatsapp, full_name: v.full_name || v.nome }
        : null,
      profiles: v ? { full_name: v.full_name || v.nome, whatsapp: v.whatsapp } : null,
      contrato: Array.isArray(cotacao.contrato) ? cotacao.contrato[0] || null : cotacao.contrato || null,
    };
  }) as CotacaoWithRelations[];

  return { data: mapped, count: count ?? mapped.length };
}

export function useCotacoes(options?: UseCotacoesOptions) {
  const search = (options?.searchTerm || '').trim();
  const effectiveScope: 'own' | 'team' | 'all' =
    options?.viewScope === 'all' || options?.viewScope === 'team' ? options.viewScope : 'own';
  const effectiveVendedorId = effectiveScope === 'own' ? options?.vendedorId : undefined;

  return useQuery({
    queryKey: ['cotacoes', effectiveScope, effectiveVendedorId, search],
    queryFn: async () => {
      const { data } = await fetchCotacoesCore({
        effectiveScope,
        effectiveVendedorId,
        search,
      });
      return data;
    },
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 1,
  });
}

/**
 * Versão paginada server-side via .range() + count: 'exact'.
 * Permite renderizar a lista de cotações sem trazer tudo para o cliente.
 * Os contadores de funil/aba devem vir de useCotacoesFunilCounts (RPC).
 */
export function useCotacoesPaginadas(options: UseCotacoesPaginadasOptions) {
  const search = (options.searchTerm || '').trim();
  const effectiveScope: 'own' | 'team' | 'all' =
    options.viewScope === 'all' || options.viewScope === 'team' ? options.viewScope : 'own';
  const effectiveVendedorId = effectiveScope === 'own' ? options.vendedorId : undefined;
  const page = Math.max(1, options.page ?? 1);
  const pageSize = options.pageSize ?? 50;
  const statusGroup = options.statusGroup ?? 'all';

  return useQuery({
    queryKey: [
      'cotacoes',
      'paginadas',
      effectiveScope,
      effectiveVendedorId,
      search,
      statusGroup,
      page,
      pageSize,
    ],
    queryFn: () =>
      fetchCotacoesCore({
        effectiveScope,
        effectiveVendedorId,
        search,
        page,
        pageSize,
        statusGroup,
      }),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 30,
  });
}


export function useCotacao(id: string | undefined) {
  return useQuery({
    queryKey: ['cotacoes', id],
    queryFn: async () => {
      if (!id) throw new Error('ID é obrigatório');
      
      const { data, error } = await supabase
        .from('cotacoes')
        .select(`
          *,
          leads:leads!fk_cotacoes_lead_id(*),
          planos:planos!plano_id(*),
          contrato:contratos!contratos_cotacao_id_fkey(
            id, 
            numero, 
            status,
            adesao_paga,
            associados:associados!fk_contratos_associado(id, status)
          )
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      // Buscar vendedor separadamente
      let vendedor = null;
      if (data.vendedor_id) {
        const { data: v } = await supabase
          .from('profiles')
          .select('user_id, nome, email')
          .eq('user_id', data.vendedor_id)
          .single();
        vendedor = v ? { id: v.user_id, nome: v.nome, email: v.email } : null;
      }
      
      // Garantir que contrato seja objeto ou null (não array)
      const contrato = Array.isArray(data.contrato) 
        ? data.contrato[0] || null 
        : data.contrato || null;
      
      return { ...data, vendedor, contrato } as CotacaoWithRelations;
    },
    enabled: !!id,
  });
}

export function useCreateCotacao() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (cotacao: Omit<CotacaoInsert, 'numero'>) => {
      // Validação: vendedor_id é obrigatório para garantir visibilidade via RLS
      if (!cotacao.vendedor_id) {
        throw new Error('vendedor_id é obrigatório para criar cotações');
      }
      
      // Gera token público para link do cliente
      const tokenPublico = crypto.randomUUID().replace(/-/g, '') + 
                          crypto.randomUUID().replace(/-/g, '').slice(0, 32);

      // Tenta inserir até 2x se houver colisão de número (23505)
      let lastError: unknown = null;
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        const { data, error } = await supabase
          .from('cotacoes')
          .insert({
            ...cotacao,
            numero: gerarNumeroCotacao(),
            token_publico: tokenPublico,
          })
          .select()
          .single();

        if (!error) return data as Cotacao;
        lastError = error;

        // Só faz retry se for colisão de unique (numero)
        if (!isUniqueViolation(error)) break;
        console.warn('[useCreateCotacao] Conflito de número da cotação, regenerando e tentando novamente...', error);
      }
      throw lastError;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      registrarLog({
        acao: 'criar',
        modulo: 'cotacoes',
        descricao: `Cotação ${data.numero} criada`,
        entidade_id: data.id,
        dados_novos: { numero: data.numero, status: data.status },
      });
    },
  });
}

export function useUpdateCotacao() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: CotacaoUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('cotacoes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Cotacao;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      queryClient.invalidateQueries({ queryKey: ['cotacoes', data.id] });
      registrarLog({
        acao: 'editar',
        modulo: 'cotacoes',
        descricao: `Cotação ${data.numero} atualizada`,
        entidade_id: data.id,
      });
    },
  });
}

// Hook para reenviar cotação (atualiza updated_at)
export function useReenviarCotacao() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('cotacoes')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Cotacao;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      queryClient.invalidateQueries({ queryKey: ['cotacoes', data.id] });
      toast.success('Cotação reenviada com sucesso!');
      registrarLog({
        acao: 'enviar',
        modulo: 'cotacoes',
        descricao: `Cotação ${data.numero} reenviada`,
        entidade_id: data.id,
      });
    },
    onError: () => {
      toast.error('Erro ao reenviar cotação');
    },
  });
}

// Hook para atualizar status
export function useAtualizarStatusCotacao() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusCotacao }) => {
      const { data, error } = await supabase
        .from('cotacoes')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Cotacao;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      queryClient.invalidateQueries({ queryKey: ['cotacoes', data.id] });
      toast.success('Status atualizado!');
      registrarLog({
        acao: 'editar',
        modulo: 'cotacoes',
        descricao: `Status da cotação ${data.numero} alterado para ${data.status}`,
        entidade_id: data.id,
        dados_novos: { status: data.status },
      });
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });
}

// Hook para aceitar cotação e gerar contrato
export function useAceitarCotacaoEGerarContrato() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ cotacaoId, vendedorId }: { cotacaoId: string; vendedorId?: string }) => {
      // 1. Atualizar status da cotação para 'aceita'
      const { error: updateError } = await supabase
        .from('cotacoes')
        .update({ status: 'aceita' })
        .eq('id', cotacaoId);
      
      if (updateError) throw updateError;
      
      // 2. Chamar edge function para gerar contrato
      const { data, error: fnError } = await supabase.functions.invoke('contrato-gerar', {
        body: { cotacao_id: cotacaoId, vendedor_id: vendedorId },
      });
      
      if (fnError) throw fnError;
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      queryClient.invalidateQueries({ queryKey: ['ativacoes'] });
      toast.success('Cotação aceita e contrato gerado com sucesso!');
      registrarLog({
        acao: 'aprovar',
        modulo: 'cotacoes',
        descricao: 'Cotação aceita e contrato gerado',
      });
    },
    onError: (error: Error) => {
      console.error('Erro ao aceitar cotação:', error);
      toast.error('Erro ao aceitar cotação: ' + error.message);
    },
  });
}

// Hook combinado para actions
export function useCotacaoActions() {
  const reenviar = useReenviarCotacao();
  const atualizarStatus = useAtualizarStatusCotacao();
  
  return {
    reenviarCotacao: reenviar.mutate,
    atualizarStatus: atualizarStatus.mutate,
    isReenviando: reenviar.isPending,
    isAtualizando: atualizarStatus.isPending,
  };
}

// Hook para duplicar cotação (com fluxo de correção: excluir ou substituir a original)
export interface DuplicarCotacaoParams {
  cotacaoId: string;
  motivo?: string;
  acaoOriginal?: 'excluir' | 'manter' | 'none';
}

export function useDuplicarCotacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: string | DuplicarCotacaoParams) => {
      const cotacaoId = typeof params === 'string' ? params : params.cotacaoId;
      const motivo = typeof params === 'string' ? undefined : params.motivo;
      // CORREÇÃO RAIZ (sumiço de cotações na tela do consultor):
      // O fluxo comercial NUNCA deve excluir fisicamente a cotação original.
      // Antes, "duplicar -> excluir" removia o registro do banco, o número
      // sumia da listagem do consultor e da auditoria. Agora forçamos sempre
      // o comportamento "manter como substituída" — a original permanece no
      // banco com substituida_por_cotacao_id apontando para a nova.
      const acaoOriginal: 'manter' | 'none' =
        typeof params === 'string'
          ? 'none'
          : params.acaoOriginal === 'manter' || params.acaoOriginal === 'excluir'
            ? 'manter'
            : (params.acaoOriginal ?? 'none');

      // Buscar cotação original
      const { data: original, error: fetchError } = await supabase
        .from('cotacoes')
        .select('*')
        .eq('id', cotacaoId)
        .single();

      if (fetchError) throw fetchError;
      if (!original) throw new Error('Cotação não encontrada');

      // Remover campos que serão gerados novamente
      const {
        id,
        numero,
        created_at,
        updated_at,
        substituida_por_cotacao_id,
        motivo_substituicao,
        token_publico,
        ...cotacaoData
      } = original as any;

      // Gera token público novo para a duplicata
      const tokenPublico = crypto.randomUUID().replace(/-/g, '') +
                          crypto.randomUUID().replace(/-/g, '').slice(0, 32);

      // Atribuir vendedor_id ao usuário atual (ex.: gestor corrigindo cotação alheia)
      const { data: { user } } = await supabase.auth.getUser();
      const novoVendedorId = user?.id ?? cotacaoData.vendedor_id;

      const { data: nova, error } = await supabase
        .from('cotacoes')
        .insert({
          ...cotacaoData,
          vendedor_id: novoVendedorId,
          numero: gerarNumeroCotacao(),
          status: 'rascunho',
          token_publico: tokenPublico,
        })
        .select()
        .single();

      if (error) throw error;

      // Pós-processamento na original — sempre "manter como substituída".
      // Exclusão física via fluxo de duplicação foi removida (causa raiz do
      // sumiço de cotações da tela do consultor).
      if (acaoOriginal === 'manter') {
        await supabase
          .from('cotacoes')
          .update({
            status: 'recusada',
            substituida_por_cotacao_id: nova.id,
            motivo_substituicao: motivo ?? null,
          })
          .eq('id', cotacaoId);
      }

      return { ...nova, _originalId: cotacaoId, _acaoOriginal: acaoOriginal, _motivo: motivo };
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      toast.success('Cotação duplicada com sucesso!');

      const acao = data._acaoOriginal as 'manter' | 'none';
      if (acao === 'manter') {
        registrarLog({
          acao: 'duplicar',
          modulo: 'cotacoes',
          descricao: `Cotação substituída por ${data.numero}. Motivo: ${data._motivo ?? '—'}`,
          entidade_id: data._originalId,
          dados_novos: { nova_cotacao_id: data.id, motivo: data._motivo },
        });
      }

      registrarLog({
        acao: 'duplicar',
        modulo: 'cotacoes',
        descricao: `Cotação duplicada: ${data.numero}`,
        entidade_id: data.id,
      });
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Erro ao duplicar cotação');
    },
  });
}

// Hook para excluir cotação (usa Edge Function para exclusão cascata completa)
export function useExcluirCotacao() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ cotacaoId, motivo }: { cotacaoId: string; motivo?: string }) => {
      console.log('[useExcluirCotacao] Iniciando exclusão:', cotacaoId);
      
      const { data, error } = await supabase.functions.invoke('delete-cotacao', {
        body: { cotacaoId, motivo },
      });
      
      if (error) {
        console.error('[useExcluirCotacao] Erro na Edge Function:', {
          message: error.message,
          name: error.name,
          context: error,
        });
        throw new Error(error.message || 'Erro ao excluir cotação');
      }
      
      console.log('[useExcluirCotacao] Resposta da Edge Function:', data);
      
      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao excluir cotação');
      }
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias-mapa'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['agendamentos-base'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      toast.success(data?.message || 'Cotação excluída com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao excluir cotação:', error);
      toast.error(error.message || 'Erro ao excluir cotação');
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// As tabelas ads_* ainda nao estao no types.ts gerado (entram apos aplicar a
// migration e regenerar tipos). Ate la, usamos um client com tipagem solta.
const sb = supabase as any;

export interface FocoAdsResumo {
  messaging: { gasto: number; conversas: number; custoPorConversa: number | null };
  lead: { gasto: number; leads: number; custoPorLead: number | null };
  gastoTotal: number;
  dias: number;
}

export interface AnuncioLinha {
  entidade_id: string;
  anuncio_externo: string | null;
  plataforma: string;
  nome: string;
  objetivo: string;
  gasto: number;
  conversas: number;
  leads: number;
  custoPorConversa: number | null;
  custoPorLead: number | null;
  effective_status: string | null;
}

export interface Achado {
  id: string;
  analise_id: string;
  severidade: 'baixa' | 'media' | 'alta' | 'critica';
  tipo: string;
  entidade_tipo: string | null;
  entidade_id: string | null;
  titulo: string;
  descricao: string | null;
  evidencia: Record<string, unknown> | null;
  sugestao: string | null;
  acao_sugerida: Record<string, unknown> | null;
  created_at: string;
}

function dataCorte(dias: number): string {
  return new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
}

/** KPIs agregados do periodo, SEGMENTADOS messaging vs lead (nunca somados cru). */
export function useFocoAdsResumo(dias = 7) {
  return useQuery<FocoAdsResumo>({
    queryKey: ['foco-ads-resumo', dias],
    queryFn: async () => {
      const { data, error } = await sb
        .from('ads_insights_diarios')
        .select('objetivo_norm, gasto, conversas, leads')
        .eq('entidade_tipo', 'anuncio')
        .gte('data', dataCorte(dias));
      if (error) throw error;

      const m = { gasto: 0, conversas: 0 };
      const l = { gasto: 0, leads: 0 };
      for (const r of data ?? []) {
        if (r.objetivo_norm === 'messaging') {
          m.gasto += Number(r.gasto || 0);
          m.conversas += Number(r.conversas || 0);
        } else if (r.objetivo_norm === 'lead') {
          l.gasto += Number(r.gasto || 0);
          l.leads += Number(r.leads || 0);
        }
      }
      return {
        messaging: {
          gasto: m.gasto,
          conversas: m.conversas,
          custoPorConversa: m.conversas > 0 ? m.gasto / m.conversas : null,
        },
        lead: {
          gasto: l.gasto,
          leads: l.leads,
          custoPorLead: l.leads > 0 ? l.gasto / l.leads : null,
        },
        gastoTotal: m.gasto + l.gasto,
        dias,
      };
    },
  });
}

/** Tabela por anuncio no periodo. */
export function useFocoAdsAnuncios(dias = 7) {
  return useQuery<AnuncioLinha[]>({
    queryKey: ['foco-ads-anuncios', dias],
    queryFn: async () => {
      const [{ data: ins, error: e1 }, { data: ans, error: e2 }] = await Promise.all([
        sb.from('ads_insights_diarios')
          .select('entidade_id, plataforma, objetivo_norm, gasto, conversas, leads')
          .eq('entidade_tipo', 'anuncio')
          .gte('data', dataCorte(dias)),
        sb.from('ads_anuncios').select('id, nome, effective_status, anuncio_externo'),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;

      const nomes = new Map<string, any>((ans ?? []).map((a: any) => [a.id, a]));
      const agg = new Map<string, AnuncioLinha>();
      for (const r of ins ?? []) {
        const meta = nomes.get(r.entidade_id);
        const cur = agg.get(r.entidade_id) ?? {
          entidade_id: r.entidade_id,
          anuncio_externo: meta?.anuncio_externo ?? null,
          plataforma: r.plataforma ?? 'meta',
          nome: meta?.nome ?? r.entidade_id,
          objetivo: r.objetivo_norm,
          gasto: 0, conversas: 0, leads: 0,
          custoPorConversa: null, custoPorLead: null,
          effective_status: meta?.effective_status ?? null,
        };
        cur.gasto += Number(r.gasto || 0);
        cur.conversas += Number(r.conversas || 0);
        cur.leads += Number(r.leads || 0);
        agg.set(r.entidade_id, cur);
      }
      return [...agg.values()]
        .map((a) => ({
          ...a,
          custoPorConversa: a.conversas > 0 ? a.gasto / a.conversas : null,
          custoPorLead: a.leads > 0 ? a.gasto / a.leads : null,
        }))
        .sort((a, b) => b.gasto - a.gasto);
    },
  });
}

export interface CampanhaLinha {
  campanha_id: string;
  campanha_externa: string | null;
  plataforma: string;
  nome: string;
  objetivo: string;
  status: string | null;
  gasto: number;
  conversas: number;
  leads: number;
}

/** Campanhas com gasto agregado (somando os insights dos anuncios via hierarquia). */
export function useFocoAdsCampanhas(dias = 7) {
  return useQuery<CampanhaLinha[]>({
    queryKey: ['foco-ads-campanhas', dias],
    queryFn: async () => {
      const [camps, conjs, ans, ins, contas] = await Promise.all([
        sb.from('ads_campanhas').select('id, campanha_externa, nome, objetivo_norm, status, conta_id'),
        sb.from('ads_conjuntos').select('id, campanha_id'),
        sb.from('ads_anuncios').select('id, conjunto_id'),
        sb.from('ads_insights_diarios')
          .select('entidade_id, gasto, conversas, leads')
          .eq('entidade_tipo', 'anuncio')
          .gte('data', dataCorte(dias)),
        sb.from('ads_contas').select('id, plataforma'),
      ]);
      if (camps.error) throw camps.error;

      const contaPlat = new Map<string, string>((contas.data ?? []).map((c: any) => [c.id, c.plataforma]));
      const conjToCamp = new Map<string, string>((conjs.data ?? []).map((c: any) => [c.id, c.campanha_id]));
      const adToCamp = new Map<string, string>(
        (ans.data ?? []).map((a: any) => [a.id, conjToCamp.get(a.conjunto_id) as string]).filter(([, c]) => !!c),
      );

      const agg = new Map<string, { gasto: number; conversas: number; leads: number }>();
      for (const r of ins.data ?? []) {
        const campId = adToCamp.get(r.entidade_id);
        if (!campId) continue;
        const cur = agg.get(campId) ?? { gasto: 0, conversas: 0, leads: 0 };
        cur.gasto += Number(r.gasto || 0);
        cur.conversas += Number(r.conversas || 0);
        cur.leads += Number(r.leads || 0);
        agg.set(campId, cur);
      }

      return (camps.data ?? [])
        .map((c: any) => {
          const a = agg.get(c.id) ?? { gasto: 0, conversas: 0, leads: 0 };
          return {
            campanha_id: c.id,
            campanha_externa: c.campanha_externa ?? null,
            plataforma: contaPlat.get(c.conta_id) ?? 'meta',
            nome: c.nome ?? c.campanha_externa ?? c.id,
            objetivo: c.objetivo_norm,
            status: c.status ?? null,
            gasto: a.gasto, conversas: a.conversas, leads: a.leads,
          } as CampanhaLinha;
        })
        .sort((x: CampanhaLinha, y: CampanhaLinha) => y.gasto - x.gasto);
    },
  });
}

/** Achados da analise mais recente. */
export function useFocoAdsAchados() {
  return useQuery<Achado[]>({
    queryKey: ['foco-ads-achados'],
    queryFn: async () => {
      const { data: analise } = await sb
        .from('ads_analises')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!analise?.id) return [];
      const { data, error } = await sb
        .from('ads_achados')
        .select('*')
        .eq('analise_id', analise.id)
        .order('severidade', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Achado[];
    },
  });
}

/** Dispara a sincronizacao de leitura da Meta (Onda 1). */
export function useSincronizarMeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dias = 7) => {
      const { data, error } = await sb.functions.invoke('ads-meta-sync', { body: { dias } });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['foco-ads-resumo'] });
      qc.invalidateQueries({ queryKey: ['foco-ads-anuncios'] });
    },
  });
}

/** Dispara a sincronizacao de leitura do Google Ads (Onda 4). */
export function useSincronizarGoogle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dias = 7) => {
      const { data, error } = await sb.functions.invoke('ads-google-sync', { body: { dias } });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['foco-ads-resumo'] });
      qc.invalidateQueries({ queryKey: ['foco-ads-anuncios'] });
    },
  });
}

/** Dispara a analise de IA (Onda 2). */
export function useGerarAnalise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dias = 7) => {
      const { data, error } = await sb.functions.invoke('ads-ia-analise', { body: { dias } });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['foco-ads-achados'] }),
  });
}

export interface AcaoProposta {
  id: string;
  plataforma: string;
  tipo: 'pausar' | 'reativar' | 'ajustar_verba' | 'duplicar';
  entidade_tipo: string;
  entidade_id: string | null;
  entidade_externa_id: string;
  payload_proposto: Record<string, unknown>;
  justificativa_ia: string | null;
  status: 'proposta' | 'aprovada' | 'rejeitada' | 'executando' | 'executada' | 'falha' | 'revertida';
  created_at: string;
}

const TIPO_LABEL: Record<AcaoProposta['tipo'], string> = {
  pausar: 'Pausar',
  reativar: 'Reativar',
  ajustar_verba: 'Ajustar verba',
  duplicar: 'Duplicar',
};

export function rotuloTipoAcao(t: AcaoProposta['tipo']): string {
  return TIPO_LABEL[t] ?? t;
}

/** Lista as acoes propostas (fila de aprovacao). */
export function useAcoesPropostas() {
  return useQuery<AcaoProposta[]>({
    queryKey: ['foco-ads-acoes'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('ads_acoes_propostas')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as AcaoProposta[];
    },
  });
}

/**
 * Decide uma acao: 'aprovar' (executa na Meta via edge function, exige
 * foco_ads.executar) ou 'rejeitar' (nao executa, exige foco_ads.aprovar).
 */
export function useDecidirAcao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { acaoId: string; decisao: 'aprovar' | 'rejeitar'; comentario?: string }) => {
      const { data, error } = await sb.functions.invoke('ads-executar-acao', {
        body: { acao_id: args.acaoId, decisao: args.decisao, comentario: args.comentario ?? null },
      });
      if (error) throw error;
      if (data && data.ok === false) throw new Error(data.error || 'Falha na operação');
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['foco-ads-acoes'] }),
  });
}

export interface Automacao {
  id: string;
  nome: string;
  plataforma: 'meta' | 'google' | 'todas';
  gatilho: 'custo_conversa' | 'custo_lead' | 'with_issues';
  modo: 'sinalizar' | 'executar';
  ativo: boolean;
  notificar: boolean;
  acao_tipo: 'pausar' | 'reativar' | 'ajustar_verba' | 'duplicar';
  ultima_execucao_em: string | null;
}

/** Lista as automacoes de guarda-corpo (Onda 5). */
export function useAutomacoes() {
  return useQuery<Automacao[]>({
    queryKey: ['foco-ads-automacoes'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('ads_automacoes')
        .select('*')
        .order('nome', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Automacao[];
    },
  });
}

/** Atualiza uma automacao (ligar/desligar a flag, mudar modo/notificar). */
export function useAtualizarAutomacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; patch: Partial<Pick<Automacao, 'ativo' | 'modo' | 'notificar'>> }) => {
      const { error } = await sb.from('ads_automacoes').update(args.patch).eq('id', args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['foco-ads-automacoes'] }),
  });
}

export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

/** Envia o histórico de chat ao copiloto IA (Opus 4.8 + tool-use). */
export function useChatCopiloto() {
  return useMutation({
    mutationFn: async (messages: ChatMsg[]): Promise<string> => {
      const { data, error } = await sb.functions.invoke('ads-ia-chat', { body: { messages } });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data.error || 'Falha no copiloto');
      return data.resposta as string;
    },
  });
}

export interface NovaAcaoManual {
  plataforma: string;
  tipo: 'pausar' | 'reativar' | 'ajustar_verba' | 'duplicar';
  entidade_tipo: 'campanha' | 'conjunto' | 'anuncio';
  entidade_id: string | null;
  entidade_externa_id: string;
  nome?: string;
  /** Para ajustar_verba: nova verba diaria em reais. */
  daily_budget?: number;
}

/**
 * Cria uma ACAO PROPOSTA manual (edicao direta pelo usuario). NAO executa —
 * apenas registra a proposta (status 'proposta') para aprovacao + execucao.
 */
export function useCriarAcaoManual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (acao: NovaAcaoManual) => {
      if (!acao.entidade_externa_id) {
        throw new Error('Sem ID externo da entidade — rode a sincronização primeiro.');
      }
      const payload: Record<string, unknown> = {};
      if (acao.tipo === 'ajustar_verba') {
        if (!acao.daily_budget || acao.daily_budget <= 0) throw new Error('Informe uma verba diária válida.');
        payload.daily_budget = acao.daily_budget;
      }
      const { data: { user } } = await sb.auth.getUser();
      const rotulo: Record<string, string> = {
        pausar: 'Pausar', reativar: 'Reativar', ajustar_verba: 'Ajustar verba', duplicar: 'Duplicar',
      };
      const { error } = await sb.from('ads_acoes_propostas').insert({
        plataforma: acao.plataforma,
        tipo: acao.tipo,
        entidade_tipo: acao.entidade_tipo,
        entidade_id: acao.entidade_id,
        entidade_externa_id: acao.entidade_externa_id,
        payload_proposto: payload,
        justificativa_ia: `Edição manual: ${rotulo[acao.tipo]}${acao.nome ? ` — ${acao.nome}` : ''}`,
        status: 'proposta',
        criado_por: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['foco-ads-acoes'] }),
  });
}

/**
 * Cria uma ACAO PROPOSTA a partir de um achado. NAO executa nada na Meta —
 * apenas registra a proposta (status 'proposta') para futura aprovacao (Onda 3).
 */
export function useCriarAcaoProposta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (achado: Achado) => {
      const acao = (achado.acao_sugerida ?? {}) as any;
      const { data: { user } } = await sb.auth.getUser();
      const { error } = await sb.from('ads_acoes_propostas').insert({
        plataforma: 'meta',
        tipo: acao.tipo ?? 'pausar',
        entidade_tipo: acao.entidade_tipo ?? achado.entidade_tipo ?? 'anuncio',
        entidade_id: achado.entidade_id,
        entidade_externa_id: acao.entidade_externa_id ?? achado.entidade_id ?? '',
        payload_proposto: acao,
        justificativa_ia: achado.titulo,
        achado_id: achado.id,
        status: 'proposta',
        criado_por: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['foco-ads-acoes'] }),
  });
}

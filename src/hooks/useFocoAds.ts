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
          .select('entidade_id, objetivo_norm, gasto, conversas, leads')
          .eq('entidade_tipo', 'anuncio')
          .gte('data', dataCorte(dias)),
        sb.from('ads_anuncios').select('id, nome, effective_status'),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;

      const nomes = new Map<string, any>((ans ?? []).map((a: any) => [a.id, a]));
      const agg = new Map<string, AnuncioLinha>();
      for (const r of ins ?? []) {
        const meta = nomes.get(r.entidade_id);
        const cur = agg.get(r.entidade_id) ?? {
          entidade_id: r.entidade_id,
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

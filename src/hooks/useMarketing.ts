import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
export interface CanalMarketing {
  id: string;
  nome: string;
  tipo: string;
  descricao?: string;
  custo_por_lead?: number;
  meta_leads_mes?: number;
  ativo: boolean;
  created_at: string;
}

export interface Campanha {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
  canal_id?: string | null;
  canal?: { id: string; nome: string; tipo: string } | null;
  data_inicio: string;
  data_fim?: string | null;
  orcamento_total?: number | null;
  orcamento_diario?: number | null;
  valor_gasto: number;
  meta_leads?: number | null;
  meta_conversoes?: number | null;
  meta_cpl?: number | null;
  publico_alvo?: string | null;
  regioes?: string[] | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  status: string;
  responsavel_id?: string | null;
  criado_por?: string | null;
  observacoes?: string | null;
  created_at: string;
}

export interface CampanhaMetrica {
  id: string;
  campanha_id: string;
  data: string;
  valor_gasto: number;
  impressoes: number;
  cliques: number;
  leads: number;
  conversoes: number;
  ctr?: number;
  cpl?: number;
  cpa?: number;
  taxa_conversao?: number;
}

export interface Indicacao {
  id: string;
  codigo: string;
  programa_id?: string;
  indicador_id?: string;
  indicador_nome?: string;
  indicador_telefone?: string;
  indicado_nome: string;
  indicado_telefone: string;
  indicado_email?: string;
  lead_id?: string;
  associado_id?: string;
  status: string;
  valor_recompensa?: number;
  data_recompensa?: string;
  recompensa_paga: boolean;
  data_indicacao: string;
  data_contato?: string;
  data_conversao?: string;
  observacoes?: string;
}

export interface ProgramaIndicacao {
  id: string;
  nome: string;
  descricao?: string;
  valor_indicador: number;
  valor_indicado?: number;
  tipo_recompensa?: string;
  limite_indicacoes_mes?: number;
  prazo_validade_dias: number;
  condicao_pagamento?: string;
  ativo: boolean;
  data_inicio?: string;
  data_fim?: string;
}

export interface UTM {
  id: string;
  utm_source: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  url_destino: string;
  url_completa?: string;
  url_curta?: string;
  campanha_id?: string;
  cliques: number;
  leads_gerados: number;
  ativo: boolean;
  created_at: string;
}

export interface MaterialMarketing {
  id: string;
  nome: string;
  tipo: string;
  arquivo_url?: string;
  thumbnail_url?: string;
  largura?: number;
  altura?: number;
  formato?: string;
  campanha_id?: string;
  downloads: number;
  status: string;
  created_at: string;
}

// ========== CANAIS ==========
export function useCanais() {
  return useQuery({
    queryKey: ['canais-marketing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('canais_marketing')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data as CanalMarketing[];
    },
  });
}

export function useCreateCanal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (canal: { nome: string; tipo: string; descricao?: string | null; custo_por_lead?: number | null; meta_leads_mes?: number | null }) => {
      const { data, error } = await supabase
        .from('canais_marketing')
        .insert(canal)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canais-marketing'] });
      toast.success('Canal criado com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar canal: ' + error.message);
    },
  });
}

export function useUpdateCanal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...canal }: Partial<CanalMarketing> & { id: string }) => {
      const { data, error } = await supabase
        .from('canais_marketing')
        .update({ ...canal, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canais-marketing'] });
      toast.success('Canal atualizado com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar canal: ' + error.message);
    },
  });
}

// ========== CAMPANHAS ==========
export function useCampanhas(filters?: { status?: string; canal_id?: string }) {
  return useQuery({
    queryKey: ['campanhas', filters],
    queryFn: async () => {
      let query = supabase
        .from('campanhas')
        .select('*, canal:canais_marketing(id, nome, tipo)')
        .order('created_at', { ascending: false });
      
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.canal_id) {
        query = query.eq('canal_id', filters.canal_id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Campanha[];
    },
  });
}

export function useCampanha(id: string) {
  return useQuery({
    queryKey: ['campanha', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campanhas')
        .select('*, canal:canais_marketing(id, nome, tipo)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Campanha;
    },
    enabled: !!id,
  });
}

export function useCampanhaMetricas(campanhaId: string) {
  return useQuery({
    queryKey: ['campanha-metricas', campanhaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campanhas_metricas')
        .select('*')
        .eq('campanha_id', campanhaId)
        .order('data', { ascending: false });
      if (error) throw error;
      return data as CampanhaMetrica[];
    },
    enabled: !!campanhaId,
  });
}

export function useCreateCampanha() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (campanha: { nome: string; tipo: string; data_inicio: string; canal_id?: string | null; data_fim?: string | null; orcamento_total?: number | null; meta_leads?: number | null; utm_source?: string | null; utm_medium?: string | null; utm_campaign?: string | null; observacoes?: string | null }) => {
      const { data, error } = await supabase
        .from('campanhas')
        .insert(campanha)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campanhas'] });
      toast.success('Campanha criada com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar campanha: ' + error.message);
    },
  });
}

export function useUpdateCampanha() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...campanha }: Partial<Campanha> & { id: string }) => {
      const { data, error } = await supabase
        .from('campanhas')
        .update({ ...campanha, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campanhas'] });
      toast.success('Campanha atualizada com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar campanha: ' + error.message);
    },
  });
}

// ========== INDICAÇÕES ==========
export function useIndicacoes(filters?: { status?: string }) {
  return useQuery({
    queryKey: ['indicacoes', filters],
    queryFn: async () => {
      let query = supabase
        .from('indicacoes')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Indicacao[];
    },
  });
}

export function useProgramaIndicacao() {
  return useQuery({
    queryKey: ['programa-indicacao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('programa_indicacao')
        .select('*')
        .eq('ativo', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ProgramaIndicacao | null;
    },
  });
}

export function useCreateIndicacao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (indicacao: { indicado_nome: string; indicado_telefone: string; indicador_nome?: string | null; indicador_telefone?: string | null; indicado_email?: string | null; observacoes?: string | null; programa_id?: string | null; valor_recompensa?: number | null }) => {
      const { data, error } = await supabase
        .from('indicacoes')
        .insert(indicacao)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['indicacoes'] });
      toast.success('Indicação registrada com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao registrar indicação: ' + error.message);
    },
  });
}

export function useUpdateIndicacao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...indicacao }: Partial<Indicacao> & { id: string }) => {
      const { data, error } = await supabase
        .from('indicacoes')
        .update({ ...indicacao, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['indicacoes'] });
      toast.success('Indicação atualizada com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar indicação: ' + error.message);
    },
  });
}

export function useRecompensarIndicacao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('indicacoes')
        .update({ 
          status: 'recompensado',
          recompensa_paga: true, 
          data_recompensa: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['indicacoes'] });
      toast.success('Recompensa registrada com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao registrar recompensa: ' + error.message);
    },
  });
}

// ========== UTMs ==========
export function useUTMs(campanhaId?: string) {
  return useQuery({
    queryKey: ['utms', campanhaId],
    queryFn: async () => {
      let query = supabase
        .from('utms')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (campanhaId) {
        query = query.eq('campanha_id', campanhaId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as UTM[];
    },
  });
}

export function useGerarUTM() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (utm: { url_destino: string; utm_source: string; utm_medium?: string; utm_campaign?: string; utm_content?: string; utm_term?: string; campanha_id?: string }) => {
      // Gerar URL completa
      const params = new URLSearchParams();
      if (utm.utm_source) params.append('utm_source', utm.utm_source);
      if (utm.utm_medium) params.append('utm_medium', utm.utm_medium);
      if (utm.utm_campaign) params.append('utm_campaign', utm.utm_campaign);
      if (utm.utm_content) params.append('utm_content', utm.utm_content);
      if (utm.utm_term) params.append('utm_term', utm.utm_term);
      
      const url_completa = `${utm.url_destino}${utm.url_destino?.includes('?') ? '&' : '?'}${params.toString()}`;
      
      const { data, error } = await supabase
        .from('utms')
        .insert({ 
          url_destino: utm.url_destino,
          utm_source: utm.utm_source,
          utm_medium: utm.utm_medium || null,
          utm_campaign: utm.utm_campaign || null,
          utm_content: utm.utm_content || null,
          utm_term: utm.utm_term || null,
          campanha_id: utm.campanha_id || null,
          url_completa,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['utms'] });
      toast.success('UTM gerada com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao gerar UTM: ' + error.message);
    },
  });
}

// ========== MATERIAIS ==========
export function useMateriais(campanhaId?: string) {
  return useQuery({
    queryKey: ['materiais-marketing', campanhaId],
    queryFn: async () => {
      let query = supabase
        .from('materiais_marketing')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (campanhaId) {
        query = query.eq('campanha_id', campanhaId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as MaterialMarketing[];
    },
  });
}

// ========== ESTATÍSTICAS ==========
export function useMarketingStats() {
  return useQuery({
    queryKey: ['marketing-stats'],
    queryFn: async () => {
      // Campanhas ativas
      const { count: campanhasAtivas } = await supabase
        .from('campanhas')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ativa');

      // Total de indicações do mês
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);
      
      const { count: indicacoesMes } = await supabase
        .from('indicacoes')
        .select('*', { count: 'exact', head: true })
        .gte('data_indicacao', inicioMes.toISOString());

      const { count: indicacoesConvertidas } = await supabase
        .from('indicacoes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'convertido')
        .gte('data_indicacao', inicioMes.toISOString());

      // Investimento total do mês
      const { data: metricas } = await supabase
        .from('campanhas_metricas')
        .select('valor_gasto, leads, conversoes')
        .gte('data', inicioMes.toISOString().split('T')[0]);

      const investimentoMes = metricas?.reduce((sum, m) => sum + (m.valor_gasto || 0), 0) || 0;
      const leadsMes = metricas?.reduce((sum, m) => sum + (m.leads || 0), 0) || 0;
      const conversoesMes = metricas?.reduce((sum, m) => sum + (m.conversoes || 0), 0) || 0;

      return {
        campanhasAtivas: campanhasAtivas || 0,
        indicacoesMes: indicacoesMes || 0,
        indicacoesConvertidas: indicacoesConvertidas || 0,
        investimentoMes,
        leadsMes,
        conversoesMes,
        cplMedio: leadsMes > 0 ? investimentoMes / leadsMes : 0,
        taxaConversao: leadsMes > 0 ? (conversoesMes / leadsMes) * 100 : 0,
      };
    },
  });
}

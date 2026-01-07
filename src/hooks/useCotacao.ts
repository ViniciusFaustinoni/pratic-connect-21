// ============================================
// HOOKS ESPECIALIZADOS PARA MÓDULO DE COTAÇÃO
// SGA Pratic 2.0 - Proteção Veicular
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import type {
  PlanoParaCotacao,
  FaixaPreco,
  CotacaoCompleta,
  ResultadoCotacao,
  TipoUso,
  StatusCotacaoExtended,
  CriarCotacaoPayload,
} from '@/types/cotacao';

// Tipo do status no banco (sem 'visualizada')
type StatusCotacaoDB = Database['public']['Tables']['cotacoes']['Row']['status'];

// ============================================
// FUNÇÕES DE MAPEAMENTO (BD → Interface)
// ============================================

function mapPlanoToInterface(data: any): PlanoParaCotacao {
  return {
    id: data.id,
    codigo: data.codigo,
    nome: data.nome,
    tipo_uso: data.tipo_uso as TipoUso,
    fipe_minimo: data.fipe_minima ? Number(data.fipe_minima) : null,
    fipe_maximo: data.fipe_maxima ? Number(data.fipe_maxima) : null,
    valor_adesao: Number(data.valor_adesao || 0),
    coberturas: data.coberturas || [],
    ativo: data.ativo,
    created_at: data.created_at,
  };
}

function mapFaixaToInterface(data: any): FaixaPreco {
  return {
    id: data.id,
    nome: data.nome || '',
    tipo_uso: data.tipo_uso as TipoUso,
    fipe_minimo: Number(data.fipe_de || 0),
    fipe_maximo: Number(data.fipe_ate || 0),
    valor_cota: Number(data.valor_cota || 0),
    taxa_administrativa: Number(data.taxa_administrativa || 0),
    valor_rastreamento: Number(data.valor_rastreamento || 0),
    valor_assistencia: Number(data.valor_assistencia || 0),
    vigencia_inicio: data.vigencia_inicio || '',
    vigencia_fim: data.vigencia_fim,
    ativo: data.ativo,
  };
}

// ============================================
// HOOK: BUSCAR PLANOS ATIVOS
// ============================================

export function usePlanosCotacao(tipoUso?: TipoUso) {
  return useQuery({
    queryKey: ['planos-cotacao', tipoUso],
    queryFn: async () => {
      let query = supabase
        .from('planos')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (tipoUso) {
        query = query.eq('tipo_uso', tipoUso);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(mapPlanoToInterface);
    },
  });
}

// ============================================
// HOOK: BUSCAR FAIXAS DE PREÇO
// ============================================

export function useFaixasPreco(tipoUso?: TipoUso) {
  return useQuery({
    queryKey: ['faixas-preco', tipoUso],
    queryFn: async () => {
      const hoje = new Date().toISOString().split('T')[0];
      
      let query = supabase
        .from('tabelas_preco')
        .select('*')
        .eq('ativo', true)
        .lte('vigencia_inicio', hoje)
        .order('fipe_de');

      if (tipoUso) {
        query = query.eq('tipo_uso', tipoUso);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filtrar faixas com vigência válida
      const faixasValidas = (data || []).filter(
        (f) => !f.vigencia_fim || f.vigencia_fim >= hoje
      );

      return faixasValidas.map(mapFaixaToInterface);
    },
  });
}

// ============================================
// FUNÇÃO: ENCONTRAR FAIXA POR VALOR FIPE
// ============================================

export function encontrarFaixaPreco(
  faixas: FaixaPreco[],
  valorFipe: number,
  tipoUso: TipoUso
): FaixaPreco | null {
  // Filtrar por tipo de uso
  const faixasTipo = faixas.filter((f) => f.tipo_uso === tipoUso);

  // Encontrar a faixa que contém o valor FIPE
  const faixa = faixasTipo.find(
    (f) => valorFipe >= f.fipe_minimo && valorFipe <= f.fipe_maximo
  );

  return faixa || null;
}

// ============================================
// FUNÇÃO: CALCULAR VALORES DA COTAÇÃO
// ============================================

export function calcularValoresCotacao(
  plano: PlanoParaCotacao,
  faixa: FaixaPreco,
  valorFipe: number
): ResultadoCotacao['valores'] {
  const valor_cota = faixa.valor_cota;
  const taxa_administrativa = faixa.taxa_administrativa;
  const valor_rastreamento = faixa.valor_rastreamento;
  const valor_assistencia = faixa.valor_assistencia;

  const valor_mensal =
    valor_cota + taxa_administrativa + valor_rastreamento + valor_assistencia;

  return {
    valor_fipe: valorFipe,
    valor_cota,
    taxa_administrativa,
    valor_rastreamento,
    valor_assistencia,
    valor_mensal,
    valor_adesao: plano.valor_adesao,
  };
}

// ============================================
// HOOK: CALCULAR COTAÇÃO
// ============================================

export function useCalcularCotacao() {
  const { data: planos, isLoading: loadingPlanos } = usePlanosCotacao();
  const { data: faixas, isLoading: loadingFaixas } = useFaixasPreco();

  const calcular = (
    valorFipe: number,
    tipoUso: TipoUso,
    planoId?: string
  ): ResultadoCotacao[] => {
    if (!planos || !faixas || valorFipe <= 0) return [];

    // Encontrar a faixa de preço
    const faixa = encontrarFaixaPreco(faixas, valorFipe, tipoUso);
    if (!faixa) {
      toast.error('Valor FIPE fora das faixas configuradas');
      return [];
    }

    // Filtrar planos pelo tipo de uso
    let planosDisponiveis = planos.filter((p) => p.tipo_uso === tipoUso);

    // Se especificou plano, filtrar
    if (planoId) {
      planosDisponiveis = planosDisponiveis.filter((p) => p.id === planoId);
    }

    // Calcular para cada plano
    return planosDisponiveis.map((plano) => ({
      plano,
      faixa,
      valores: calcularValoresCotacao(plano, faixa, valorFipe),
    }));
  };

  return {
    calcular,
    isReady: !!planos && !!faixas,
    isLoading: loadingPlanos || loadingFaixas,
    planos,
    faixas,
  };
}

// ============================================
// HOOK: LISTAR COTAÇÕES COM FILTROS
// ============================================

export function useCotacoesFiltradas(filtros?: {
  vendedor_id?: string;
  lead_id?: string;
  status?: StatusCotacaoExtended;
}) {
  return useQuery({
    queryKey: ['cotacoes-filtradas', filtros],
    queryFn: async () => {
      let query = supabase
        .from('cotacoes')
        .select(`
          *,
          lead:leads(id, nome, telefone, email),
          plano:planos(id, codigo, nome)
        `)
        .order('created_at', { ascending: false });

      if (filtros?.vendedor_id) {
        query = query.eq('vendedor_id', filtros.vendedor_id);
      }
      if (filtros?.lead_id) {
        query = query.eq('lead_id', filtros.lead_id);
      }
      if (filtros?.status) {
        // Filtrar apenas status válidos no BD
        const statusValido = filtros.status as StatusCotacaoDB;
        query = query.eq('status', statusValido);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Mapear para interface CotacaoCompleta
      return (data || []).map((item): CotacaoCompleta => ({
        id: item.id,
        numero: item.numero,
        lead_id: item.lead_id,
        plano_id: item.plano_id,
        vendedor_id: item.vendedor_id || '',
        veiculo_marca: item.veiculo_marca,
        veiculo_modelo: item.veiculo_modelo,
        veiculo_ano: item.veiculo_ano,
        veiculo_placa: undefined, // Campo não existe no BD
        codigo_fipe: item.codigo_fipe,
        valor_fipe: Number(item.valor_fipe),
        uso_aplicativo: false, // Campo virtual
        valor_cota: Number(item.valor_cota || 0),
        taxa_administrativa: Number(item.taxa_administrativa || 0),
        valor_rastreamento: Number(item.valor_rastreamento || 0),
        valor_assistencia: Number(item.valor_assistencia || 0),
        valor_mensal: Number(item.valor_total_mensal || 0),
        valor_adesao: Number(item.valor_adesao || 0),
        status: item.status as StatusCotacaoExtended,
        validade_dias: item.validade_dias || 7,
        created_at: item.created_at,
        updated_at: item.updated_at,
        lead: item.lead,
        plano: item.plano ? mapPlanoToInterface(item.plano) : undefined,
      }));
    },
  });
}

// ============================================
// HOOK: BUSCAR COTAÇÃO POR ID
// ============================================

export function useCotacaoDetalhe(id: string | undefined) {
  return useQuery({
    queryKey: ['cotacao-detalhe', id],
    queryFn: async () => {
      if (!id) throw new Error('ID não informado');

      const { data, error } = await supabase
        .from('cotacoes')
        .select(`
          *,
          lead:leads(id, nome, telefone, email, cpf),
          plano:planos(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      
      return {
        id: data.id,
        numero: data.numero,
        lead_id: data.lead_id,
        plano_id: data.plano_id,
        vendedor_id: data.vendedor_id || '',
        veiculo_marca: data.veiculo_marca,
        veiculo_modelo: data.veiculo_modelo,
        veiculo_ano: data.veiculo_ano,
        veiculo_placa: undefined,
        codigo_fipe: data.codigo_fipe,
        valor_fipe: Number(data.valor_fipe),
        uso_aplicativo: false,
        valor_cota: Number(data.valor_cota || 0),
        taxa_administrativa: Number(data.taxa_administrativa || 0),
        valor_rastreamento: Number(data.valor_rastreamento || 0),
        valor_assistencia: Number(data.valor_assistencia || 0),
        valor_mensal: Number(data.valor_total_mensal || 0),
        valor_adesao: Number(data.valor_adesao || 0),
        status: data.status as StatusCotacaoExtended,
        validade_dias: data.validade_dias || 7,
        created_at: data.created_at,
        updated_at: data.updated_at,
        lead: data.lead,
        plano: data.plano ? mapPlanoToInterface(data.plano) : undefined,
      } as CotacaoCompleta;
    },
    enabled: !!id,
  });
}

// ============================================
// HOOK: CRIAR COTAÇÃO
// ============================================

export function useCriarCotacao() {
  const queryClient = useQueryClient();
  const { calcular, isReady } = useCalcularCotacao();

  return useMutation({
    mutationFn: async (payload: CriarCotacaoPayload) => {
      if (!isReady) {
        throw new Error('Dados de planos/faixas ainda carregando');
      }

      // Determinar tipo de uso
      const tipoUso: TipoUso = payload.uso_aplicativo ? 'aplicativo' : 'particular';

      // Calcular valores
      const resultados = calcular(payload.valor_fipe, tipoUso, payload.plano_id);
      if (resultados.length === 0) {
        throw new Error('Não foi possível calcular a cotação. Verifique se o valor FIPE está dentro das faixas configuradas.');
      }

      const resultado = resultados[0];

      // Buscar vendedor logado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: perfil } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!perfil) throw new Error('Perfil não encontrado');

      // Gerar número da cotação
      const dataAtual = new Date();
      const numero = `COT-${dataAtual.getFullYear()}${String(dataAtual.getMonth() + 1).padStart(2, '0')}${String(dataAtual.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;

      // Inserir cotação
      const cotacaoData = {
        numero,
        lead_id: payload.lead_id,
        plano_id: payload.plano_id,
        vendedor_id: perfil.id,
        veiculo_marca: payload.veiculo_marca,
        veiculo_modelo: payload.veiculo_modelo,
        veiculo_ano: payload.veiculo_ano,
        codigo_fipe: payload.codigo_fipe,
        valor_fipe: payload.valor_fipe,
        valor_cota: resultado.valores.valor_cota,
        taxa_administrativa: resultado.valores.taxa_administrativa,
        valor_rastreamento: resultado.valores.valor_rastreamento,
        valor_assistencia: resultado.valores.valor_assistencia,
        valor_total_mensal: resultado.valores.valor_mensal,
        valor_adesao: resultado.valores.valor_adesao,
        status: 'rascunho' as const,
        validade_dias: 7,
      };

      const { data, error } = await supabase
        .from('cotacoes')
        .insert(cotacaoData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      queryClient.invalidateQueries({ queryKey: ['cotacoes-filtradas'] });
      toast.success('Cotação criada com sucesso!');
    },
    onError: (error) => {
      toast.error(`Erro ao criar cotação: ${error.message}`);
    },
  });
}

// ============================================
// HOOK: ATUALIZAR STATUS COTAÇÃO
// ============================================

export function useAtualizarStatusCotacaoV2() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: StatusCotacaoExtended;
    }) => {
      // Só permite status válidos do BD (exclui 'visualizada')
      const statusValido = status as StatusCotacaoDB;
      
      const { data, error } = await supabase
        .from('cotacoes')
        .update({ status: statusValido, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      queryClient.invalidateQueries({ queryKey: ['cotacoes-filtradas'] });
      queryClient.invalidateQueries({ queryKey: ['cotacao-detalhe', variables.id] });
      toast.success('Status atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar status'),
  });
}

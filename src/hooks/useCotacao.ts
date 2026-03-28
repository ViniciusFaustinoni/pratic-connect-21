// ============================================
// HOOKS ESPECIALIZADOS PARA MÓDULO DE COTAÇÃO
// SGA Pratic 2.0 - Proteção Veicular
// Modelo: Preço = Σ coberturas + Σ benefícios
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import type {
  PlanoParaCotacao,
  CotacaoCompleta,
  ResultadoCotacao,
  TipoUso,
  StatusCotacaoExtended,
  CriarCotacaoPayload,
} from '@/types/cotacao';
import { useConfigDecomposicao } from '@/hooks/useConteudosSistema';

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
    adicional_mensal: Number(data.adicional_mensal || 0),
    desconto_percentual: Number(data.desconto_percentual || 0),
    ativo: data.ativo,
    created_at: data.created_at,
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
// FUNÇÃO: CALCULAR VALORES DA COTAÇÃO
// ============================================

export function calcularValoresCotacao(
  plano: PlanoParaCotacao,
  valorMensalDireto: number,
  valorFipe: number,
  decomposicao?: { cota: number; admin: number; rastreamento: number; assistencia: number },
): ResultadoCotacao['valores'] {
  const decCota = decomposicao?.cota || 0.60;
  const decAdmin = decomposicao?.admin || 0.25;
  const decRastreamento = decomposicao?.rastreamento || 0.10;
  const decAssistencia = decomposicao?.assistencia || 0.05;

  const valor_cota = Math.round(valorMensalDireto * decCota * 100) / 100;
  const taxa_administrativa = Math.round(valorMensalDireto * decAdmin * 100) / 100;
  const valor_rastreamento = Math.round(valorMensalDireto * decRastreamento * 100) / 100;
  const valor_assistencia = Math.round(valorMensalDireto * decAssistencia * 100) / 100;

  return {
    valor_fipe: valorFipe,
    valor_cota,
    taxa_administrativa,
    valor_rastreamento,
    valor_assistencia,
    valor_mensal: valorMensalDireto,
    valor_adesao: Math.max(valorFipe * 0.01, 100),
  };
}

// ============================================
// HOOK: CALCULAR COTAÇÃO (novo modelo)
// ============================================

export function useCalcularCotacao() {
  const { data: planos, isLoading: loadingPlanos } = usePlanosCotacao();
  const { data: decomposicao } = useConfigDecomposicao();

  // Buscar coberturas vinculadas aos planos
  const { data: planoCoberturasData, isLoading: loadingCoberturas } = useQuery({
    queryKey: ['planos_coberturas_cotacao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos_coberturas')
        .select('plano_id, cobertura_id, coberturas:cobertura_id (valor)');
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Buscar benefícios vinculados aos planos
  const { data: planoBeneficiosData, isLoading: loadingBeneficios } = useQuery({
    queryKey: ['planos_beneficios_cotacao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos_beneficios')
        .select('plano_id, benefit_id, benefits:benefit_id (preco_sugerido)');
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const isLoading = loadingPlanos || loadingCoberturas || loadingBeneficios;
  const isReady = !!planos && !!planoCoberturasData && !!planoBeneficiosData;

  const calcular = (
    valorFipe: number,
    tipoUso: TipoUso,
    planoId?: string,
    regiao: string = 'rj',
    combustivel: string = 'gasolina',
  ): ResultadoCotacao[] => {
    if (!planos || !isReady || valorFipe <= 0) return [];

    const categoriaVeiculo = tipoUso === 'particular' ? 'passeio' : tipoUso;
    let planosDisponiveis = planos.filter((p) => {
      const cats: string[] = (p as any).categoria || [];
      if (!cats || cats.length === 0) {
        const tipoUsoBD = p.tipo_uso?.toLowerCase();
        if (tipoUso === 'particular') {
          return tipoUsoBD === 'particular' || tipoUsoBD === 'passeio';
        }
        return tipoUsoBD === tipoUso;
      }
      return cats.includes(categoriaVeiculo);
    });

    if (planoId) {
      const planoEspecifico = planos.filter((p) => p.id === planoId);
      if (planoEspecifico.length > 0) {
        planosDisponiveis = planoEspecifico;
      }
    }

    const resultados: ResultadoCotacao[] = [];

    for (const plano of planosDisponiveis) {
      // Soma coberturas
      const coberturasDoPlano = (planoCoberturasData || []).filter(pc => pc.plano_id === plano.id);
      const somaCoberturas = coberturasDoPlano.reduce((acc, pc) => {
        const valor = (pc as any).coberturas?.valor || 0;
        return acc + Number(valor);
      }, 0);

      // Soma benefícios
      const beneficiosDoPlano = (planoBeneficiosData || []).filter(pb => pb.plano_id === plano.id);
      const somaBeneficios = beneficiosDoPlano.reduce((acc, pb) => {
        const preco = (pb as any).benefits?.preco_sugerido || 0;
        return acc + Number(preco);
      }, 0);

      let valorMensal = somaCoberturas + somaBeneficios;

      // Aplicar adicional_mensal e desconto_percentual
      valorMensal += plano.adicional_mensal || 0;
      if (plano.desconto_percentual > 0) {
        valorMensal *= (1 - plano.desconto_percentual / 100);
      }

      if (valorMensal <= 0) continue;

      resultados.push({
        plano,
        faixa: null as any,
        valores: calcularValoresCotacao(plano, Math.round(valorMensal * 100) / 100, valorFipe, decomposicao),
      });
    }

    if (resultados.length === 0 && planosDisponiveis.length > 0) {
      if (valorFipe > 500000) {
        toast.error('Valor FIPE acima de R$ 500.000. Entre em contato para cotação especial.');
      } else {
        toast.error('Nenhum plano configurado com preços para este valor FIPE.');
      }
    }

    return resultados;
  };

  return {
    calcular,
    isReady,
    isLoading,
    planos,
    faixas: null,
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
          lead:leads!fk_cotacoes_lead_id(id, nome, telefone, email),
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
        const statusValido = filtros.status as StatusCotacaoDB;
        query = query.eq('status', statusValido);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return (data || []).map((item): CotacaoCompleta => ({
        id: item.id,
        numero: item.numero,
        lead_id: item.lead_id,
        plano_id: item.plano_id,
        vendedor_id: item.vendedor_id || '',
        veiculo_marca: item.veiculo_marca,
        veiculo_modelo: item.veiculo_modelo,
        veiculo_ano: item.veiculo_ano,
        veiculo_placa: undefined,
        codigo_fipe: item.codigo_fipe,
        valor_fipe: Number(item.valor_fipe),
        uso_aplicativo: false,
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
          lead:leads!fk_cotacoes_lead_id(id, nome, telefone, email, cpf),
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

      const tipoUso: TipoUso = payload.uso_aplicativo ? 'aplicativo' : 'particular';
      const resultados = calcular(payload.valor_fipe, tipoUso, payload.plano_id);
      
      if (resultados.length === 0) {
        const valorFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payload.valor_fipe);
        throw new Error(
          payload.valor_fipe > 500000
            ? `Valor FIPE (${valorFormatado}) acima do limite. Entre em contato para cotação especial.`
            : payload.valor_fipe <= 0
            ? 'Valor FIPE inválido. Verifique o valor do veículo.'
            : `Não foi possível calcular a cotação para o valor ${valorFormatado}. Verifique as faixas de preço configuradas.`
        );
      }

      const resultado = resultados[0];

      let vendedorId: string | null = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: perfil } = await supabase
            .from('profiles')
            .select('id')
            .eq('user_id', user.id)
            .single();
          if (perfil) vendedorId = perfil.id;
        }
      } catch (err) {
        console.warn('[useCriarCotacao] Erro ao obter vendedor:', err);
      }

      const dataAtual = new Date();
      const numero = `COT-${dataAtual.getFullYear()}${String(dataAtual.getMonth() + 1).padStart(2, '0')}${String(dataAtual.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;

      const cotacaoData = {
        numero,
        lead_id: payload.lead_id,
        plano_id: payload.plano_id,
        vendedor_id: vendedorId,
        veiculo_marca: payload.veiculo_marca,
        veiculo_modelo: payload.veiculo_modelo,
        veiculo_ano: payload.veiculo_ano,
        veiculo_placa: payload.veiculo_placa || null,
        codigo_fipe: payload.codigo_fipe,
        valor_fipe: payload.valor_fipe,
        valor_cota: resultado.valores.valor_cota,
        taxa_administrativa: resultado.valores.taxa_administrativa,
        valor_rastreamento: resultado.valores.valor_rastreamento,
        valor_assistencia: resultado.valores.valor_assistencia,
        valor_total_mensal: resultado.valores.valor_mensal,
        valor_adesao: payload.valor_adesao || resultado.valores.valor_adesao,
        status: 'rascunho' as const,
        validade_dias: 7,
        categoria: payload.categoria_veiculo,
        regiao: payload.regiao || null,
        nome_solicitante: payload.nome_solicitante || null,
        tipo_instalacao: payload.tipo_instalacao || null,
        indicador_id: payload.indicador_id || null,
        indicador_nome: payload.indicador_nome || null,
        associado_id: payload.associado_id || null,
        tipo_entrada: payload.tipo_entrada || null,
      };

      const { data, error } = await supabase
        .from('cotacoes')
        .insert(cotacaoData)
        .select()
        .single();

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      queryClient.invalidateQueries({ queryKey: ['cotacoes-filtradas'] });

      toast.success(`Cotação ${data.numero} criada com sucesso!`);

      return {
        ...data,
        cotacao: data,
        valores: resultado.valores,
        plano: resultado.plano,
      };
    },
  });
}

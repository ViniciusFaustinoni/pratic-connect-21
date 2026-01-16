import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calcularPrecoRegiao, type Regiao } from '@/data/planosPrecos';

// ============================================
// INTERFACES
// ============================================

export interface PlanoCotacao {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  linha: string | null;
  nivel: string | null;
  coberturas: string[];
  naoInclui: string[];
  coberturaFipe: number;
  cota: string;
  cotaPercentual: number;
  cotaMinima: number;
  valorMensal: number;
  valorAdesao: number;
  destaque: boolean;
  tag?: string;
  alertaDesagio?: string;
  adicionalMensal: number;
  // Detalhamento dos valores (para exibição)
  valorCota?: number;
  taxaAdministrativa?: number;
  valorRastreamento?: number;
  valorAssistencia?: number;
}

interface CalcularPlanosParams {
  valorFipe: number;
  valorAdicional?: number; // Valor de equipamentos/agregados
  regiao: string;
  combustivel?: string;
  categoria?: string;
  anoVeiculo?: number;
  tipoVeiculo?: 'carro' | 'moto';
  usoApp?: boolean; // Se true, mostra apenas planos de aplicativo. Se false, exclui planos de aplicativo.
}

// ============================================
// MAPEAMENTO DE REGIÃO
// ============================================

const mapearRegiao = (regiao: string): Regiao => {
  const mapa: Record<string, Regiao> = {
    'rio_de_janeiro': 'rj',
    'rj': 'rj',
    'regiao_lagos': 'lagos',
    'lagos': 'lagos',
    'sao_paulo': 'sp',
    'sp': 'sp',
    'interior_rj': 'rj',
    'interior_sp': 'sp',
  };
  return mapa[regiao.toLowerCase()] || 'rj';
};

// ============================================
// ADICIONAL POR NÍVEL (valores do banco ou padrão)
// ============================================

const ADICIONAL_NIVEL_PADRAO = {
  basic: 0,
  premium: 30,
  exclusive: 60,
};

// ============================================
// EXTRAÇÃO DO NÍVEL DO PLANO
// ============================================

const extrairNivel = (codigo: string): 'basic' | 'premium' | 'exclusive' | null => {
  const codigoLower = codigo?.toLowerCase() || '';
  if (codigoLower.includes('basic') || codigoLower.includes('basico')) return 'basic';
  if (codigoLower.includes('premium')) return 'premium';
  if (codigoLower.includes('exclusive')) return 'exclusive';
  return null;
};

// ============================================
// HOOK PRINCIPAL
// ============================================

export function usePlanosCotacao(params: CalcularPlanosParams) {
  // Buscar planos reais do banco de dados
  const { data: planosBanco, isLoading } = useQuery({
    queryKey: ['planos_cotacao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  // Buscar tabelas de preço do banco
  const { data: tabelasPreco } = useQuery({
    queryKey: ['tabelas_preco_cotacao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tabelas_preco')
        .select('*')
        .eq('ativo', true);
      
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const planos = useMemo<PlanoCotacao[]>(() => {
    const { valorFipe, valorAdicional = 0, regiao, combustivel = 'gasolina', categoria, anoVeiculo } = params;

    if (!valorFipe || valorFipe <= 0 || !planosBanco) {
      return [];
    }

    // Nota: valorAdicional não é usado para cálculo da cota/proteção
    // Ele é um acréscimo fixo na mensalidade final (somado no componente)

    const regiaoMapeada = mapearRegiao(regiao);
    const tipoVeiculo = params.tipoVeiculo || 'carro';
    const anoAtual = new Date().getFullYear();
    const anoVeiculoNum = anoVeiculo || anoAtual;

    // Encontrar faixa de preço aplicável usando apenas o Valor FIPE
    const faixaPreco = tabelasPreco?.find(
      f => valorFipe >= Number(f.fipe_de) && valorFipe <= Number(f.fipe_ate)
    );

    const planosCalculados: PlanoCotacao[] = [];

    for (const plano of planosBanco) {
      const linha = plano.linha?.toLowerCase() || null;
      const codigo = plano.codigo?.toLowerCase() || '';
      const tipoUsoPlano = plano.tipo_uso?.toLowerCase() || '';
      const categoriaPlano = plano.categoria?.toLowerCase() || '';

      // ================================================
      // FILTRO POR USO DO VEÍCULO (APLICATIVO vs PASSEIO)
      // ================================================
      const isPlanoAplicativo = tipoUsoPlano === 'aplicativo' || categoriaPlano === 'aplicativo';
      
      if (params.usoApp === true) {
        // Uso = Aplicativo: mostrar APENAS planos de aplicativo
        if (!isPlanoAplicativo) {
          continue;
        }
      } else if (params.usoApp === false) {
        // Uso = Passeio: EXCLUIR planos de aplicativo
        if (isPlanoAplicativo) {
          continue;
        }
      }
      // Se usoApp for undefined, não aplica filtro (mostra todos)

      // Filtrar motos - só podem usar planos ADVANCED
      if (tipoVeiculo === 'moto' && linha !== 'advanced') {
        continue;
      }

      // Carros não podem usar planos ADVANCED
      if (tipoVeiculo === 'carro' && linha === 'advanced') {
        continue;
      }

      // Verificar ano mínimo do plano
      const anoMinimo = plano.ano_minimo || plano.ano_minimo_veiculo || plano.ano_fabricacao_minimo || 0;
      if (anoMinimo > 0 && anoVeiculoNum < anoMinimo) {
        continue;
      }

      // Verificar FIPE dentro da faixa (usando apenas Valor FIPE)
      if (plano.fipe_minima && valorFipe < Number(plano.fipe_minima)) {
        continue;
      }
      if (plano.fipe_maxima && valorFipe > Number(plano.fipe_maxima)) {
        continue;
      }

      // Lançamento só para veículos do ano atual ou anterior
      if (linha === 'lancamento') {
        if (anoVeiculoNum < anoAtual - 1) {
          continue;
        }
      }

      // Calcular valor base da tabela de preços
      let valorBase: number | null = null;
      
      if (faixaPreco) {
        // Usar taxa_comercial como valor base da tabela de preços
        valorBase = Number(faixaPreco.taxa_comercial) || 0;
      }
      
      if (valorBase === null || valorBase === 0) {
        // Fallback: usar um valor padrão baseado no Valor FIPE
        valorBase = Math.round(valorFipe * 0.025 / 12); // ~2.5% ao ano / 12 meses
      }

      // Aplicar ajuste de região (Lagos e SP = 90% do RJ)
      valorBase = calcularPrecoRegiao(valorBase, regiaoMapeada);

      // Aplicar adicional por nível do plano (do banco ou calculado)
      const adicionalBanco = Number(plano.adicional_mensal) || 0;
      const nivel = plano.nivel || extrairNivel(codigo);
      const adicionalNivel = nivel ? (ADICIONAL_NIVEL_PADRAO[nivel as keyof typeof ADICIONAL_NIVEL_PADRAO] || 0) : 0;
      const valorMensal = valorBase + (adicionalBanco || adicionalNivel);

      // Usar valor de adesão do banco
      const valorAdesao = Number(plano.valor_adesao) || 199.90;

      // Cota de participação
      const cotaBase = Number(plano.cota_participacao) || 6;
      const cotaMinima = Number(plano.cota_minima) || 1200;
      let cotaPercentual = cotaBase;
      let cotaMinimaFinal = cotaMinima;

      // Ajustar cota para categoria aplicativo
      if (categoria === 'aplicativo') {
        cotaPercentual = Number(plano.cota_desagio) || 8;
        cotaMinimaFinal = Number(plano.cota_minima_desagio) || 3000;
      }

      // Montar string da cota
      const cotaString = `${cotaPercentual}% (mín R$ ${cotaMinimaFinal.toLocaleString('pt-BR')})`;

      // Coberturas do banco
      const coberturas = Array.isArray(plano.coberturas) 
        ? plano.coberturas 
        : [];

      // O que não está incluído (buscar do banco ou lista vazia)
      const naoInclui: string[] = [];

      // Determinar destaque
      const isDestaque = plano.destaque || 
                         codigo === 'select-premium' ||
                         codigo === 'select-basic';

      // Determinar tag
      let tag: string | undefined;
      if (codigo === 'select-premium' || codigo === 'select-basic') {
        tag = 'Recomendado';
      } else if (plano.destaque) {
        tag = 'Destaque';
      }

      // Alerta para categorias especiais
      let alertaDesagio: string | undefined;
      if (categoria === 'leilao' && !coberturas.some(c => 
        typeof c === 'string' && c.toLowerCase().includes('incêndio')
      )) {
        alertaDesagio = 'Veículo de leilão: sem cobertura de incêndio';
      } else if (categoria === 'chassi_remarcado') {
        alertaDesagio = 'Chassi remarcado: sujeito à análise de aceitação';
      }

      // Calcular valores detalhados (estimativa baseada no valorMensal)
      const valorCota = Math.round(valorMensal * 0.6 * 100) / 100;
      const taxaAdministrativa = Math.round(valorMensal * 0.25 * 100) / 100;
      const valorRastreamento = Math.round(valorMensal * 0.10 * 100) / 100;
      const valorAssistencia = Math.round(valorMensal * 0.05 * 100) / 100;

      planosCalculados.push({
        id: plano.id,
        codigo: plano.codigo,
        nome: plano.nome,
        descricao: plano.descricao || '',
        linha,
        nivel: nivel || null,
        coberturas: coberturas as string[],
        naoInclui,
        coberturaFipe: plano.cobertura_fipe || 100,
        cota: cotaString,
        cotaPercentual,
        cotaMinima: cotaMinimaFinal,
        valorMensal: Math.round(valorMensal * 100) / 100,
        valorAdesao: Math.round(valorAdesao * 100) / 100,
        destaque: isDestaque,
        tag,
        alertaDesagio,
        adicionalMensal: adicionalBanco || adicionalNivel,
        valorCota,
        taxaAdministrativa,
        valorRastreamento,
        valorAssistencia,
      });
    }

    // Ordenar: SELECT vem primeiro, depois por ordem do banco
    return planosCalculados.sort((a, b) => {
      if (a.linha === 'select' && b.linha !== 'select') return -1;
      if (a.linha !== 'select' && b.linha === 'select') return 1;
      
      if (a.linha === 'select' && b.linha === 'select') {
        const ordem = ['select-basic', 'select-premium', 'select-exclusive', 'select-one'];
        return ordem.indexOf(a.codigo) - ordem.indexOf(b.codigo);
      }
      
      return a.valorMensal - b.valorMensal;
    });
  }, [params, planosBanco, tabelasPreco]);

  return {
    planos,
    isLoading,
  };
}

export type { CalcularPlanosParams };

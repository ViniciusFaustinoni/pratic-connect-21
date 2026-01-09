import { useMemo } from 'react';
import {
  PLANOS_RESUMO,
  PRECOS_SELECT_RJ,
  PRECOS_MOTOS_RJ,
  PRECOS_ELETRICOS,
  ADICIONAL_NIVEL,
  calcularPrecoRegiao,
  type Regiao,
  type PlanoResumo,
} from '@/data/planosPrecos';

// ============================================
// INTERFACES
// ============================================

export interface PlanoOficial {
  id: string;
  idReal: string;
  codigo: string;
  nome: string;
  descricao: string;
  linha: string;
  nivel?: string;
  coberturas: string[];
  naoInclui: string[];
  coberturaFipe: number;
  cota: string;
  valorMensal: number;
  valorAdesao: number;
  destaque: boolean;
  tag?: string;
  cor: string;
  alertaDesagio?: string;
}

interface CalcularPlanosParams {
  valorFipe: number;
  regiao: string;
  combustivel?: string;
  categoria?: string;
  anoVeiculo?: number;
  tipoVeiculo?: 'carro' | 'moto';
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
  };
  return mapa[regiao.toLowerCase()] || 'rj';
};

// ============================================
// DESCRIÇÕES DOS PLANOS
// ============================================

const DESCRICOES_PLANOS: Record<string, string> = {
  'select-basic': 'Proteção essencial com as principais coberturas',
  'select-premium': 'Proteção ampliada com assistência completa',
  'select-exclusive': 'Proteção máxima com todos os benefícios',
  'select-one': 'Plano completo com cobertura unificada',
  'especial': 'Proteção para veículos com mais de 20 anos',
  'especial-plus': 'Proteção completa para veículos antigos',
  'lancamento-basic': 'Proteção para veículos 0km e seminovos',
  'lancamento-premium': 'Proteção ampliada para veículos novos',
  'lancamento-exclusive': 'Proteção máxima para veículos novos',
  'advanced': 'Proteção essencial para sua moto',
  'advanced-plus': 'Proteção completa para sua moto',
  'eletricos': 'Proteção especializada para veículos elétricos',
};

// ============================================
// O QUE NÃO ESTÁ INCLUÍDO POR PLANO
// ============================================

const NAO_INCLUI_POR_PLANO: Record<string, string[]> = {
  'select-basic': [
    '1000km Reboque',
    'Danos a Terceiros',
    'Vidros e Faróis',
    'Kit Gás',
    'Carro Reserva',
  ],
  'select-premium': [
    'Kit Gás',
    '100% FIPE APP',
    'Carro Reserva em roubo',
  ],
  'select-exclusive': [],
  'select-one': [],
  'especial': [
    'Colisão',
    'Incêndio',
    'Perda Total',
    'Alagamento',
    'Danos a Terceiros',
    'Vidros e Faróis',
  ],
  'especial-plus': [
    '1000km Reboque',
    'Danos a Terceiros',
    'Vidros e Faróis',
  ],
  'lancamento-basic': [
    '1000km Reboque',
    'Danos a Terceiros',
    'Vidros e Faróis',
    'Kit Gás',
    'Carro Reserva',
  ],
  'lancamento-premium': [
    'Kit Gás',
    '100% FIPE APP',
    'Carro Reserva em roubo',
  ],
  'lancamento-exclusive': [],
  'advanced': [
    'Colisão',
    'Danos a Terceiros',
    'Assistência 600km',
  ],
  'advanced-plus': [],
  'eletricos': [],
};

// ============================================
// CÁLCULO DO VALOR BASE
// ============================================

const calcularValorBase = (
  valorFipe: number,
  combustivel: string,
  linha: string
): number | null => {
  // Motos
  if (linha === 'advanced') {
    const faixa = PRECOS_MOTOS_RJ.find(
      f => valorFipe >= f.fipeMin && valorFipe <= f.fipeMax
    );
    return faixa?.advanced || null;
  }

  // Elétricos
  if (linha === 'eletricos') {
    const faixa = PRECOS_ELETRICOS.find(
      f => valorFipe >= f.fipeMin && valorFipe <= f.fipeMax
    );
    return faixa?.mensal || null;
  }

  // Carros (SELECT, ESPECIAL, LANÇAMENTO)
  const faixa = PRECOS_SELECT_RJ.find(
    f => valorFipe >= f.fipeMin && valorFipe <= f.fipeMax
  );

  if (!faixa) return null;

  // Diesel usa valor específico
  const isDiesel = combustivel?.toLowerCase().includes('diesel');
  return isDiesel ? faixa.diesel : faixa.gasolina;
};

// ============================================
// EXTRAÇÃO DO NÍVEL DO PLANO
// ============================================

const extrairNivel = (planoId: string): 'basic' | 'premium' | 'exclusive' | null => {
  if (planoId.includes('basic')) return 'basic';
  if (planoId.includes('premium')) return 'premium';
  if (planoId.includes('exclusive')) return 'exclusive';
  return null;
};

// ============================================
// CÁLCULO DA ADESÃO
// ============================================

const calcularAdesao = (valorFipe: number, categoria?: string): number => {
  // 1% do valor FIPE, mínimo R$ 100 (base) ou R$ 150 (volante)
  const percentual = valorFipe * 0.01;
  const minimo = 100;
  return Math.max(percentual, minimo);
};

// ============================================
// VERIFICAR SE PLANO É APLICÁVEL
// ============================================

const planoAplicavel = (
  plano: PlanoResumo,
  params: CalcularPlanosParams
): boolean => {
  const { anoVeiculo, tipoVeiculo, valorFipe, categoria } = params;
  const anoAtual = new Date().getFullYear();
  const anoMin = anoVeiculo || anoAtual;

  // Verificar ano mínimo do plano
  if (anoMin < plano.anoMinimo) {
    return false;
  }

  // Motos só podem usar planos ADVANCED
  if (tipoVeiculo === 'moto' && plano.linha !== 'advanced') {
    return false;
  }

  // Carros não podem usar planos ADVANCED
  if (tipoVeiculo === 'carro' && plano.linha === 'advanced') {
    return false;
  }

  // Elétricos só usam plano ELÉTRICOS
  if (plano.linha === 'eletricos') {
    // Por enquanto, não filtramos - o usuário pode escolher
    return false; // Desabilitar elétricos por padrão, só mostrar se detectado
  }

  // Lançamento só para veículos do ano atual ou anterior
  if (plano.linha === 'lancamento') {
    if (anoMin < anoAtual - 1) {
      return false;
    }
  }

  // Verificar se valor FIPE está na faixa coberta
  if (plano.linha === 'advanced') {
    const faixa = PRECOS_MOTOS_RJ.find(
      f => valorFipe >= f.fipeMin && valorFipe <= f.fipeMax
    );
    if (!faixa) return false;

    // Advanced+ não disponível para motos acima de R$ 33.000
    if (plano.id === 'advanced-plus' && faixa.advancedPlus === null) {
      return false;
    }
  } else {
    const faixa = PRECOS_SELECT_RJ.find(
      f => valorFipe >= f.fipeMin && valorFipe <= f.fipeMax
    );
    if (!faixa) return false;
  }

  return true;
};

// ============================================
// HOOK PRINCIPAL
// ============================================

export function usePlanosOficiais(params: CalcularPlanosParams) {
  const planos = useMemo<PlanoOficial[]>(() => {
    const { valorFipe, regiao, combustivel = 'gasolina', categoria, anoVeiculo } = params;

    if (!valorFipe || valorFipe <= 0) {
      return [];
    }

    const regiaoMapeada = mapearRegiao(regiao);
    const tipoVeiculo = params.tipoVeiculo || 'carro';

    const planosCalculados: PlanoOficial[] = [];

    for (const planoResumo of PLANOS_RESUMO) {
      // Verificar se o plano é aplicável
      if (!planoAplicavel(planoResumo, { ...params, tipoVeiculo })) {
        continue;
      }

      // Calcular valor base
      let valorBase = calcularValorBase(valorFipe, combustivel, planoResumo.linha);
      
      if (valorBase === null) {
        continue;
      }

      // Aplicar ajuste de região (Lagos e SP = 90% do RJ)
      valorBase = calcularPrecoRegiao(valorBase, regiaoMapeada);

      // Aplicar adicional por nível
      const nivel = extrairNivel(planoResumo.id);
      const adicionalNivel = nivel ? ADICIONAL_NIVEL[nivel] : 0;
      const valorMensal = valorBase + adicionalNivel;

      // Calcular adesão
      const valorAdesao = calcularAdesao(valorFipe, categoria);

      // Determinar cota de participação
      let cota = planoResumo.cotaPasesio || '6% (mín R$1.200)';
      if (categoria === 'aplicativo' && planoResumo.cotaApp) {
        cota = planoResumo.cotaApp;
      } else if (categoria === 'leilao' && planoResumo.cotaPasesioDesagio) {
        cota = planoResumo.cotaPasesioDesagio;
      }

      // Definir destaque
      const isDestaque = planoResumo.badge === 'Mais Popular' || 
                         planoResumo.id === 'select-premium' ||
                         planoResumo.destaque !== undefined;

      // Definir tag
      let tag = planoResumo.badge;
      if (planoResumo.id === 'select-premium') {
        tag = 'Recomendado';
      }

      planosCalculados.push({
        id: planoResumo.id,
        idReal: planoResumo.id,
        codigo: planoResumo.id.toUpperCase().replace(/-/g, '_'),
        nome: planoResumo.nome,
        descricao: DESCRICOES_PLANOS[planoResumo.id] || '',
        linha: planoResumo.linha,
        nivel: nivel || undefined,
        coberturas: planoResumo.beneficios,
        naoInclui: NAO_INCLUI_POR_PLANO[planoResumo.id] || [],
        coberturaFipe: planoResumo.coberturaFipe,
        cota,
        valorMensal: Math.round(valorMensal * 100) / 100,
        valorAdesao: Math.round(valorAdesao * 100) / 100,
        destaque: isDestaque,
        tag,
        cor: planoResumo.cor,
        alertaDesagio: categoria === 'leilao' ? planoResumo.alertaDesagio : undefined,
      });
    }

    // Ordenar: destaque primeiro, depois por valor
    return planosCalculados.sort((a, b) => {
      // SELECT vem primeiro
      if (a.linha === 'select' && b.linha !== 'select') return -1;
      if (a.linha !== 'select' && b.linha === 'select') return 1;
      
      // Dentro do SELECT: BASIC, PREMIUM, EXCLUSIVE
      if (a.linha === 'select' && b.linha === 'select') {
        const ordem = ['select-basic', 'select-premium', 'select-exclusive'];
        return ordem.indexOf(a.id) - ordem.indexOf(b.id);
      }
      
      // Por valor
      return a.valorMensal - b.valorMensal;
    });
  }, [params]);

  return {
    planos,
    isLoading: false,
  };
}

// ============================================
// EXPORTAÇÃO DO TIPO
// ============================================

export type { CalcularPlanosParams };

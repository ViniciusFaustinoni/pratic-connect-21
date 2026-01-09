// src/config/pricing.ts
// Sistema de precificação SGA Pratic 2.0

// ============================================
// TIPOS
// ============================================

export type Regiao = 'RJ' | 'LAGOS' | 'SP';
export type Combustivel = 'GASOLINA' | 'DIESEL';
export type Categoria = 'BASIC' | 'PREMIUM' | 'EXCLUSIVE';
export type FaixaFipe = '0-30' | '30-50' | '50-70' | '70-100' | '100-150' | '150-200' | '200+';
export type TipoUso = 'PASSEIO' | 'APLICATIVO';

export interface PrecoPlano {
  adesao: number;
  mensal: number;
}

// ============================================
// CIDADES POR REGIÃO
// ============================================

export const CIDADES_LAGOS: string[] = [
  'Araruama',
  'Armação dos Búzios',
  'Arraial do Cabo',
  'Cabo Frio',
  'Casimiro de Abreu',
  'Iguaba Grande',
  'Macaé',
  'Maricá',
  'Rio das Ostras',
  'São Pedro da Aldeia',
  'Saquarema',
  'Silva Jardim',
];

export const CIDADES_RJ: string[] = [
  'Rio de Janeiro',
  'Niterói',
  'São Gonçalo',
  'Duque de Caxias',
  'Nova Iguaçu',
  'Belford Roxo',
  'São João de Meriti',
  'Nilópolis',
  'Mesquita',
  'Magé',
  'Itaboraí',
  'Queimados',
  'Japeri',
  'Seropédica',
  'Paracambi',
  'Guapimirim',
  'Tanguá',
  'Petrópolis',
  'Teresópolis',
  'Nova Friburgo',
  'Campos dos Goytacazes',
  'Volta Redonda',
  'Barra Mansa',
  'Angra dos Reis',
  'Resende',
];

// ============================================
// TABELA LINHA SELECT — PROTEÇÃO COMPLETA
// ============================================

export const PRICING_SELECT: Record<Regiao, Record<Combustivel, Record<Categoria, Record<FaixaFipe, PrecoPlano>>>> = {
  RJ: {
    GASOLINA: {
      BASIC: {
        '0-30':    { adesao: 300, mensal: 129.90 },
        '30-50':   { adesao: 350, mensal: 149.90 },
        '50-70':   { adesao: 400, mensal: 169.90 },
        '70-100':  { adesao: 450, mensal: 189.90 },
        '100-150': { adesao: 500, mensal: 219.90 },
        '150-200': { adesao: 550, mensal: 249.90 },
        '200+':    { adesao: 600, mensal: 289.90 },
      },
      PREMIUM: {
        '0-30':    { adesao: 400, mensal: 169.90 },
        '30-50':   { adesao: 450, mensal: 199.90 },
        '50-70':   { adesao: 500, mensal: 229.90 },
        '70-100':  { adesao: 550, mensal: 259.90 },
        '100-150': { adesao: 600, mensal: 299.90 },
        '150-200': { adesao: 700, mensal: 349.90 },
        '200+':    { adesao: 800, mensal: 399.90 },
      },
      EXCLUSIVE: {
        '0-30':    { adesao: 500, mensal: 239.90 },
        '30-50':   { adesao: 550, mensal: 299.90 },
        '50-70':   { adesao: 650, mensal: 349.90 },
        '70-100':  { adesao: 750, mensal: 399.90 },
        '100-150': { adesao: 850, mensal: 449.90 },
        '150-200': { adesao: 950, mensal: 499.90 },
        '200+':    { adesao: 1100, mensal: 599.90 },
      },
    },
    DIESEL: {
      BASIC: {
        '0-30':    { adesao: 360, mensal: 155.90 },
        '30-50':   { adesao: 420, mensal: 179.90 },
        '50-70':   { adesao: 480, mensal: 203.90 },
        '70-100':  { adesao: 540, mensal: 227.90 },
        '100-150': { adesao: 600, mensal: 263.90 },
        '150-200': { adesao: 660, mensal: 299.90 },
        '200+':    { adesao: 720, mensal: 347.90 },
      },
      PREMIUM: {
        '0-30':    { adesao: 480, mensal: 203.90 },
        '30-50':   { adesao: 540, mensal: 239.90 },
        '50-70':   { adesao: 600, mensal: 275.90 },
        '70-100':  { adesao: 660, mensal: 311.90 },
        '100-150': { adesao: 720, mensal: 359.90 },
        '150-200': { adesao: 840, mensal: 419.90 },
        '200+':    { adesao: 960, mensal: 479.90 },
      },
      EXCLUSIVE: {
        '0-30':    { adesao: 600, mensal: 287.90 },
        '30-50':   { adesao: 660, mensal: 359.90 },
        '50-70':   { adesao: 780, mensal: 419.90 },
        '70-100':  { adesao: 900, mensal: 479.90 },
        '100-150': { adesao: 1020, mensal: 539.90 },
        '150-200': { adesao: 1140, mensal: 599.90 },
        '200+':    { adesao: 1320, mensal: 719.90 },
      },
    },
  },
  
  LAGOS: {
    GASOLINA: {
      BASIC: {
        '0-30':    { adesao: 330, mensal: 142.90 },
        '30-50':   { adesao: 385, mensal: 164.90 },
        '50-70':   { adesao: 440, mensal: 186.90 },
        '70-100':  { adesao: 495, mensal: 208.90 },
        '100-150': { adesao: 550, mensal: 241.90 },
        '150-200': { adesao: 605, mensal: 274.90 },
        '200+':    { adesao: 660, mensal: 318.90 },
      },
      PREMIUM: {
        '0-30':    { adesao: 440, mensal: 186.90 },
        '30-50':   { adesao: 495, mensal: 219.90 },
        '50-70':   { adesao: 550, mensal: 252.90 },
        '70-100':  { adesao: 605, mensal: 285.90 },
        '100-150': { adesao: 660, mensal: 329.90 },
        '150-200': { adesao: 770, mensal: 384.90 },
        '200+':    { adesao: 880, mensal: 439.90 },
      },
      EXCLUSIVE: {
        '0-30':    { adesao: 550, mensal: 263.90 },
        '30-50':   { adesao: 605, mensal: 329.90 },
        '50-70':   { adesao: 715, mensal: 384.90 },
        '70-100':  { adesao: 825, mensal: 439.90 },
        '100-150': { adesao: 935, mensal: 494.90 },
        '150-200': { adesao: 1045, mensal: 549.90 },
        '200+':    { adesao: 1210, mensal: 659.90 },
      },
    },
    DIESEL: {
      BASIC: {
        '0-30':    { adesao: 396, mensal: 171.40 },
        '30-50':   { adesao: 462, mensal: 197.90 },
        '50-70':   { adesao: 528, mensal: 224.30 },
        '70-100':  { adesao: 594, mensal: 250.70 },
        '100-150': { adesao: 660, mensal: 290.30 },
        '150-200': { adesao: 726, mensal: 329.90 },
        '200+':    { adesao: 792, mensal: 382.70 },
      },
      PREMIUM: {
        '0-30':    { adesao: 528, mensal: 224.30 },
        '30-50':   { adesao: 594, mensal: 263.90 },
        '50-70':   { adesao: 660, mensal: 303.50 },
        '70-100':  { adesao: 726, mensal: 343.10 },
        '100-150': { adesao: 792, mensal: 395.90 },
        '150-200': { adesao: 924, mensal: 461.90 },
        '200+':    { adesao: 1056, mensal: 527.90 },
      },
      EXCLUSIVE: {
        '0-30':    { adesao: 660, mensal: 316.70 },
        '30-50':   { adesao: 726, mensal: 395.90 },
        '50-70':   { adesao: 858, mensal: 461.90 },
        '70-100':  { adesao: 990, mensal: 527.90 },
        '100-150': { adesao: 1122, mensal: 593.90 },
        '150-200': { adesao: 1254, mensal: 659.90 },
        '200+':    { adesao: 1452, mensal: 791.90 },
      },
    },
  },
  
  SP: {
    GASOLINA: {
      BASIC: {
        '0-30':    { adesao: 345, mensal: 149.40 },
        '30-50':   { adesao: 402, mensal: 172.40 },
        '50-70':   { adesao: 460, mensal: 195.40 },
        '70-100':  { adesao: 517, mensal: 218.40 },
        '100-150': { adesao: 575, mensal: 252.90 },
        '150-200': { adesao: 632, mensal: 287.40 },
        '200+':    { adesao: 690, mensal: 333.40 },
      },
      PREMIUM: {
        '0-30':    { adesao: 460, mensal: 195.40 },
        '30-50':   { adesao: 517, mensal: 229.90 },
        '50-70':   { adesao: 575, mensal: 264.40 },
        '70-100':  { adesao: 632, mensal: 298.90 },
        '100-150': { adesao: 690, mensal: 344.90 },
        '150-200': { adesao: 805, mensal: 402.40 },
        '200+':    { adesao: 920, mensal: 459.90 },
      },
      EXCLUSIVE: {
        '0-30':    { adesao: 575, mensal: 275.90 },
        '30-50':   { adesao: 632, mensal: 344.90 },
        '50-70':   { adesao: 747, mensal: 402.40 },
        '70-100':  { adesao: 862, mensal: 459.90 },
        '100-150': { adesao: 977, mensal: 517.40 },
        '150-200': { adesao: 1092, mensal: 574.90 },
        '200+':    { adesao: 1265, mensal: 689.90 },
      },
    },
    DIESEL: {
      BASIC: {
        '0-30':    { adesao: 414, mensal: 179.30 },
        '30-50':   { adesao: 483, mensal: 206.90 },
        '50-70':   { adesao: 552, mensal: 234.50 },
        '70-100':  { adesao: 621, mensal: 262.10 },
        '100-150': { adesao: 690, mensal: 303.50 },
        '150-200': { adesao: 759, mensal: 344.90 },
        '200+':    { adesao: 828, mensal: 400.10 },
      },
      PREMIUM: {
        '0-30':    { adesao: 552, mensal: 234.50 },
        '30-50':   { adesao: 621, mensal: 275.90 },
        '50-70':   { adesao: 690, mensal: 317.30 },
        '70-100':  { adesao: 759, mensal: 358.70 },
        '100-150': { adesao: 828, mensal: 413.90 },
        '150-200': { adesao: 966, mensal: 482.90 },
        '200+':    { adesao: 1104, mensal: 551.90 },
      },
      EXCLUSIVE: {
        '0-30':    { adesao: 690, mensal: 331.10 },
        '30-50':   { adesao: 759, mensal: 413.90 },
        '50-70':   { adesao: 897, mensal: 482.90 },
        '70-100':  { adesao: 1035, mensal: 551.90 },
        '100-150': { adesao: 1173, mensal: 620.90 },
        '150-200': { adesao: 1311, mensal: 689.90 },
        '200+':    { adesao: 1518, mensal: 827.90 },
      },
    },
  },
};

// ============================================
// TABELA LINHA SELECT ONE — POR TIPO DE USO
// ============================================

export const PRICING_SELECT_ONE: Record<TipoUso, Record<Regiao, Record<FaixaFipe, PrecoPlano>>> = {
  PASSEIO: {
    RJ: {
      '0-30':    { adesao: 299, mensal: 129.90 },
      '30-50':   { adesao: 349, mensal: 149.90 },
      '50-70':   { adesao: 399, mensal: 169.90 },
      '70-100':  { adesao: 449, mensal: 189.90 },
      '100-150': { adesao: 499, mensal: 219.90 },
      '150-200': { adesao: 549, mensal: 249.90 },
      '200+':    { adesao: 599, mensal: 289.90 },
    },
    LAGOS: {
      '0-30':    { adesao: 329, mensal: 142.90 },
      '30-50':   { adesao: 384, mensal: 164.90 },
      '50-70':   { adesao: 439, mensal: 186.90 },
      '70-100':  { adesao: 494, mensal: 208.90 },
      '100-150': { adesao: 549, mensal: 241.90 },
      '150-200': { adesao: 604, mensal: 274.90 },
      '200+':    { adesao: 659, mensal: 318.90 },
    },
    SP: {
      '0-30':    { adesao: 344, mensal: 149.40 },
      '30-50':   { adesao: 401, mensal: 172.40 },
      '50-70':   { adesao: 459, mensal: 195.40 },
      '70-100':  { adesao: 516, mensal: 218.40 },
      '100-150': { adesao: 574, mensal: 252.90 },
      '150-200': { adesao: 631, mensal: 287.40 },
      '200+':    { adesao: 689, mensal: 333.40 },
    },
  },
  APLICATIVO: {
    RJ: {
      '0-30':    { adesao: 419, mensal: 181.90 },
      '30-50':   { adesao: 489, mensal: 209.90 },
      '50-70':   { adesao: 559, mensal: 237.90 },
      '70-100':  { adesao: 629, mensal: 265.90 },
      '100-150': { adesao: 699, mensal: 307.90 },
      '150-200': { adesao: 769, mensal: 349.90 },
      '200+':    { adesao: 839, mensal: 405.90 },
    },
    LAGOS: {
      '0-30':    { adesao: 461, mensal: 200.10 },
      '30-50':   { adesao: 538, mensal: 230.90 },
      '50-70':   { adesao: 615, mensal: 261.70 },
      '70-100':  { adesao: 692, mensal: 292.50 },
      '100-150': { adesao: 769, mensal: 338.70 },
      '150-200': { adesao: 846, mensal: 384.90 },
      '200+':    { adesao: 923, mensal: 446.50 },
    },
    SP: {
      '0-30':    { adesao: 482, mensal: 209.20 },
      '30-50':   { adesao: 561, mensal: 241.40 },
      '50-70':   { adesao: 643, mensal: 273.60 },
      '70-100':  { adesao: 722, mensal: 305.80 },
      '100-150': { adesao: 804, mensal: 354.10 },
      '150-200': { adesao: 883, mensal: 402.40 },
      '200+':    { adesao: 965, mensal: 466.80 },
    },
  },
};

// ============================================
// ADICIONAIS OPCIONAIS
// ============================================

export const ADICIONAIS = {
  vidros: {
    nome: 'Proteção de Vidros',
    descricao: 'Cobertura para para-brisa, vidros laterais e traseiro',
    valorMensal: 29.90,
  },
  carroReserva: {
    nome: 'Carro Reserva',
    descricao: '7 dias de carro reserva em caso de sinistro',
    valorMensal: 49.90,
  },
  guinchoIlimitado: {
    nome: 'Guincho Ilimitado',
    descricao: 'Sem limite de km para guincho',
    valorMensal: 19.90,
  },
  rastreamento: {
    nome: 'Rastreamento Premium',
    descricao: 'App com localização em tempo real',
    valorMensal: 14.90,
  },
};

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

export function detectarRegiao(cidade: string): Regiao {
  if (!cidade) return 'RJ';
  
  const cidadeNormalizada = cidade
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  
  const isLagos = CIDADES_LAGOS.some(c => 
    cidadeNormalizada.includes(
      c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    )
  );
  if (isLagos) return 'LAGOS';
  
  if (
    cidadeNormalizada.includes('sao paulo') || 
    cidadeNormalizada === 'sp' ||
    cidadeNormalizada.includes('guarulhos') ||
    cidadeNormalizada.includes('campinas') ||
    cidadeNormalizada.includes('santos') ||
    cidadeNormalizada.includes('osasco') ||
    cidadeNormalizada.includes('santo andre') ||
    cidadeNormalizada.includes('sao bernardo')
  ) {
    return 'SP';
  }
  
  return 'RJ';
}

export function detectarCombustivel(combustivel: string): Combustivel {
  if (!combustivel) return 'GASOLINA';
  
  const comb = combustivel.toLowerCase();
  if (comb.includes('diesel')) return 'DIESEL';
  
  return 'GASOLINA';
}

export function detectarFaixaFipe(valorFipe: number): FaixaFipe {
  if (!valorFipe || valorFipe <= 0) return '30-50';
  
  const valorEmMil = valorFipe / 1000;
  
  if (valorEmMil <= 30) return '0-30';
  if (valorEmMil <= 50) return '30-50';
  if (valorEmMil <= 70) return '50-70';
  if (valorEmMil <= 100) return '70-100';
  if (valorEmMil <= 150) return '100-150';
  if (valorEmMil <= 200) return '150-200';
  return '200+';
}

export function getLabelFaixaFipe(faixa: FaixaFipe): string {
  const labels: Record<FaixaFipe, string> = {
    '0-30': 'Até R$ 30 mil',
    '30-50': 'R$ 30 a 50 mil',
    '50-70': 'R$ 50 a 70 mil',
    '70-100': 'R$ 70 a 100 mil',
    '100-150': 'R$ 100 a 150 mil',
    '150-200': 'R$ 150 a 200 mil',
    '200+': 'Acima de R$ 200 mil',
  };
  return labels[faixa];
}

export function getDescricaoCategoria(categoria: Categoria): string {
  const descricoes: Record<Categoria, string> = {
    BASIC: 'Proteção essencial: Colisão, Roubo e Furto',
    PREMIUM: 'Proteção completa: Basic + Vidros + Assistência 24h + App',
    EXCLUSIVE: 'Proteção máxima: Premium + Carro Reserva + Guincho Ilimitado',
  };
  return descricoes[categoria];
}

// ============================================
// INTERFACE DE CÁLCULO
// ============================================

export interface CalculoCotacaoParams {
  valorFipe: number;
  cidade: string;
  combustivel: string;
  categoria: Categoria;
  usoAplicativo: boolean;
  linhaPreco: 'SELECT' | 'SELECT_ONE';
  desagio?: number;
  adicionaisSelecionados?: {
    vidros?: boolean;
    carroReserva?: boolean;
    guinchoIlimitado?: boolean;
    rastreamento?: boolean;
  };
}

export interface ResultadoCotacao {
  regiao: Regiao;
  faixaFipe: FaixaFipe;
  combustivel: Combustivel;
  categoria: Categoria;
  precoBase: PrecoPlano;
  desagio: number;
  valorAdicionais: number;
  precoFinal: PrecoPlano;
  detalhes: {
    linhaPreco: 'SELECT' | 'SELECT_ONE';
    usoAplicativo: boolean;
    adicionaisSelecionados: string[];
    labelFaixaFipe: string;
    descricaoCategoria: string;
  };
}

export function calcularCotacao(params: CalculoCotacaoParams): ResultadoCotacao {
  const regiao = detectarRegiao(params.cidade);
  const faixaFipe = detectarFaixaFipe(params.valorFipe);
  const combustivel = detectarCombustivel(params.combustivel);
  const desagio = Math.min(Math.max(params.desagio || 0, 0), 30);
  
  let precoBase: PrecoPlano;
  
  if (params.linhaPreco === 'SELECT_ONE') {
    const tipoUso: TipoUso = params.usoAplicativo ? 'APLICATIVO' : 'PASSEIO';
    precoBase = PRICING_SELECT_ONE[tipoUso][regiao][faixaFipe];
  } else {
    precoBase = PRICING_SELECT[regiao][combustivel][params.categoria][faixaFipe];
  }
  
  let valorAdicionais = 0;
  const adicionaisSelecionados: string[] = [];
  
  if (params.adicionaisSelecionados) {
    if (params.adicionaisSelecionados.vidros) {
      valorAdicionais += ADICIONAIS.vidros.valorMensal;
      adicionaisSelecionados.push(ADICIONAIS.vidros.nome);
    }
    if (params.adicionaisSelecionados.carroReserva) {
      valorAdicionais += ADICIONAIS.carroReserva.valorMensal;
      adicionaisSelecionados.push(ADICIONAIS.carroReserva.nome);
    }
    if (params.adicionaisSelecionados.guinchoIlimitado) {
      valorAdicionais += ADICIONAIS.guinchoIlimitado.valorMensal;
      adicionaisSelecionados.push(ADICIONAIS.guinchoIlimitado.nome);
    }
    if (params.adicionaisSelecionados.rastreamento) {
      valorAdicionais += ADICIONAIS.rastreamento.valorMensal;
      adicionaisSelecionados.push(ADICIONAIS.rastreamento.nome);
    }
  }
  
  const fatorDesconto = (100 - desagio) / 100;
  const precoFinal: PrecoPlano = {
    adesao: Math.round(precoBase.adesao * fatorDesconto * 100) / 100,
    mensal: Math.round((precoBase.mensal * fatorDesconto + valorAdicionais) * 100) / 100,
  };
  
  return {
    regiao,
    faixaFipe,
    combustivel,
    categoria: params.categoria,
    precoBase,
    desagio,
    valorAdicionais,
    precoFinal,
    detalhes: {
      linhaPreco: params.linhaPreco,
      usoAplicativo: params.usoAplicativo,
      adicionaisSelecionados,
      labelFaixaFipe: getLabelFaixaFipe(faixaFipe),
      descricaoCategoria: getDescricaoCategoria(params.categoria),
    },
  };
}

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function gerarTokenCotacao(): string {
  const uuid1 = crypto.randomUUID().replace(/-/g, '');
  const uuid2 = crypto.randomUUID().replace(/-/g, '');
  return (uuid1 + uuid2).substring(0, 64);
}

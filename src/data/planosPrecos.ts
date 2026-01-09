// ============================================
// DADOS DO GUIA DO CONSULTOR v11 - OUTUBRO 2025
// ============================================

export type Regiao = 'rj' | 'lagos' | 'sp';
export type TipoCombustivel = 'gasolina' | 'diesel';

// Interfaces
export interface FaixaPreco {
  fipeMin: number;
  fipeMax: number;
  gasolina: number;
  desagioGasolina: number;
  diesel: number;
  desagioDiesel: number;
}

export interface FaixaPrecoMoto {
  fipeMin: number;
  fipeMax: number;
  advanced: number;
  advancedPlus: number | null;
}

export interface FaixaPrecoEletrico {
  fipeMin: number;
  fipeMax: number;
  mensal: number;
}

export interface PlanoResumo {
  id: string;
  nome: string;
  badge?: string;
  coberturaFipe: number;
  anoMinimo: number;
  cotaPasesio: string;
  cotaPasesioDesagio?: string;
  cotaApp?: string;
  niveis?: string[];
  destaque?: string;
  cor: string;
}

export interface BeneficioNivel {
  nome: string;
  basic: boolean;
  premium: boolean;
  exclusive: boolean;
}

export interface TermoGlossario {
  termo: string;
  definicao: string;
}

export interface RegraImportante {
  titulo: string;
  icone: string;
  itens: string[];
}

export interface CotasTaxas {
  categoria: string;
  percentual: string;
  minimo: string;
  comDesagio?: string;
  minimoDesagio?: string;
}

// ============================================
// TABELA DE PREÇOS - LINHA SELECT (RIO DE JANEIRO)
// ============================================
export const PRECOS_SELECT_RJ: FaixaPreco[] = [
  { fipeMin: 0, fipeMax: 10000, gasolina: 81.90, desagioGasolina: 75.90, diesel: 116.90, desagioDiesel: 107.90 },
  { fipeMin: 10001, fipeMax: 15000, gasolina: 101.90, desagioGasolina: 92.90, diesel: 136.90, desagioDiesel: 123.40 },
  { fipeMin: 15001, fipeMax: 20000, gasolina: 112.40, desagioGasolina: 100.40, diesel: 147.40, desagioDiesel: 129.40 },
  { fipeMin: 20001, fipeMax: 25000, gasolina: 132.40, desagioGasolina: 117.40, diesel: 167.20, desagioDiesel: 144.70 },
  { fipeMin: 25001, fipeMax: 30000, gasolina: 143.90, desagioGasolina: 125.90, diesel: 177.70, desagioDiesel: 150.70 },
  { fipeMin: 30001, fipeMax: 35000, gasolina: 162.90, desagioGasolina: 141.90, diesel: 197.53, desagioDiesel: 166.03 },
  { fipeMin: 35001, fipeMax: 40000, gasolina: 173.40, desagioGasolina: 149.40, diesel: 208.00, desagioDiesel: 172.00 },
  { fipeMin: 40001, fipeMax: 45000, gasolina: 208.90, desagioGasolina: 181.90, diesel: 238.30, desagioDiesel: 197.80 },
  { fipeMin: 45001, fipeMax: 50000, gasolina: 218.90, desagioGasolina: 188.90, diesel: 253.20, desagioDiesel: 208.20 },
  { fipeMin: 50001, fipeMax: 55000, gasolina: 259.40, desagioGasolina: 226.40, diesel: 288.46, desagioDiesel: 238.96 },
  { fipeMin: 55001, fipeMax: 60000, gasolina: 274.40, desagioGasolina: 238.40, diesel: 305.85, desagioDiesel: 251.85 },
  { fipeMin: 60001, fipeMax: 65000, gasolina: 294.90, desagioGasolina: 255.90, diesel: 331.18, desagioDiesel: 272.68 },
  { fipeMin: 65001, fipeMax: 70000, gasolina: 311.40, desagioGasolina: 269.40, diesel: 344.10, desagioDiesel: 281.10 },
  { fipeMin: 70001, fipeMax: 75000, gasolina: 344.00, desagioGasolina: 299.00, diesel: 374.40, desagioDiesel: 306.90 },
  { fipeMin: 75001, fipeMax: 80000, gasolina: 360.90, desagioGasolina: 312.90, diesel: 389.30, desagioDiesel: 317.30 },
  { fipeMin: 80001, fipeMax: 85000, gasolina: 398.50, desagioGasolina: 347.50, diesel: 419.66, desagioDiesel: 343.16 },
  { fipeMin: 85001, fipeMax: 90000, gasolina: 416.40, desagioGasolina: 362.40, diesel: 434.60, desagioDiesel: 353.60 },
  { fipeMin: 90001, fipeMax: 95000, gasolina: 446.90, desagioGasolina: 389.90, diesel: 454.96, desagioDiesel: 369.46 },
  { fipeMin: 95001, fipeMax: 100000, gasolina: 477.40, desagioGasolina: 417.40, diesel: 485.40, desagioDiesel: 395.40 },
  { fipeMin: 100001, fipeMax: 105000, gasolina: 497.90, desagioGasolina: 434.90, diesel: 506.90, desagioDiesel: 412.40 },
  { fipeMin: 105001, fipeMax: 110000, gasolina: 508.40, desagioGasolina: 442.40, diesel: 522.40, desagioDiesel: 423.40 },
  { fipeMin: 110001, fipeMax: 115000, gasolina: 528.90, desagioGasolina: 459.90, diesel: 537.90, desagioDiesel: 434.40 },
  { fipeMin: 115001, fipeMax: 120000, gasolina: 539.90, desagioGasolina: 467.90, diesel: 553.90, desagioDiesel: 445.90 },
  { fipeMin: 120001, fipeMax: 125000, gasolina: 549.90, desagioGasolina: 477.90, diesel: 563.90, desagioDiesel: 455.90 },
  { fipeMin: 125001, fipeMax: 130000, gasolina: 569.90, desagioGasolina: 497.90, diesel: 583.90, desagioDiesel: 475.90 },
  { fipeMin: 130001, fipeMax: 135000, gasolina: 594.90, desagioGasolina: 522.90, diesel: 608.90, desagioDiesel: 500.90 },
  { fipeMin: 135001, fipeMax: 140000, gasolina: 619.90, desagioGasolina: 547.90, diesel: 633.90, desagioDiesel: 525.90 },
  { fipeMin: 140001, fipeMax: 145000, gasolina: 644.90, desagioGasolina: 572.90, diesel: 658.90, desagioDiesel: 550.90 },
  { fipeMin: 145001, fipeMax: 150000, gasolina: 669.90, desagioGasolina: 597.90, diesel: 683.90, desagioDiesel: 575.90 },
  { fipeMin: 150001, fipeMax: 155000, gasolina: 699.90, desagioGasolina: 627.90, diesel: 713.90, desagioDiesel: 605.90 },
  { fipeMin: 155001, fipeMax: 160000, gasolina: 729.90, desagioGasolina: 657.90, diesel: 743.90, desagioDiesel: 635.90 },
  { fipeMin: 160001, fipeMax: 165000, gasolina: 764.90, desagioGasolina: 692.90, diesel: 778.90, desagioDiesel: 670.90 },
  { fipeMin: 165001, fipeMax: 170000, gasolina: 799.90, desagioGasolina: 727.90, diesel: 813.90, desagioDiesel: 705.90 },
  { fipeMin: 170001, fipeMax: 175000, gasolina: 874.90, desagioGasolina: 802.90, diesel: 888.90, desagioDiesel: 780.90 },
  { fipeMin: 175001, fipeMax: 180000, gasolina: 909.90, desagioGasolina: 837.90, diesel: 923.90, desagioDiesel: 815.90 },
];

// Lagos e SP: 90% do valor RJ
export function calcularPrecoRegiao(precoRJ: number, regiao: Regiao): number {
  if (regiao === 'rj') return precoRJ;
  return Math.round(precoRJ * 0.90 * 100) / 100;
}

// ============================================
// TABELA DE PREÇOS - MOTOS (RIO DE JANEIRO)
// ============================================
export const PRECOS_MOTOS_RJ: FaixaPrecoMoto[] = [
  { fipeMin: 0, fipeMax: 6000, advanced: 113.70, advancedPlus: 133.70 },
  { fipeMin: 6001, fipeMax: 9000, advanced: 128.70, advancedPlus: 148.70 },
  { fipeMin: 9001, fipeMax: 12000, advanced: 148.70, advancedPlus: 168.70 },
  { fipeMin: 12001, fipeMax: 15000, advanced: 174.70, advancedPlus: 194.70 },
  { fipeMin: 15001, fipeMax: 18000, advanced: 198.70, advancedPlus: 218.70 },
  { fipeMin: 18001, fipeMax: 21000, advanced: 218.70, advancedPlus: 238.70 },
  { fipeMin: 21001, fipeMax: 24000, advanced: 268.70, advancedPlus: 288.70 },
  { fipeMin: 24001, fipeMax: 27000, advanced: 298.70, advancedPlus: 318.70 },
  { fipeMin: 27001, fipeMax: 30000, advanced: 333.70, advancedPlus: 353.70 },
  { fipeMin: 30001, fipeMax: 33000, advanced: 368.70, advancedPlus: 388.70 },
  { fipeMin: 33001, fipeMax: 36000, advanced: 403.70, advancedPlus: null },
  { fipeMin: 36001, fipeMax: 39000, advanced: 438.70, advancedPlus: null },
  { fipeMin: 39001, fipeMax: 41000, advanced: 473.70, advancedPlus: null },
  { fipeMin: 41001, fipeMax: 44000, advanced: 508.70, advancedPlus: null },
  { fipeMin: 44001, fipeMax: 47000, advanced: 543.70, advancedPlus: null },
  { fipeMin: 47001, fipeMax: 50000, advanced: 578.70, advancedPlus: null },
];

// ============================================
// TABELA DE PREÇOS - ELÉTRICOS
// ============================================
export const PRECOS_ELETRICOS: FaixaPrecoEletrico[] = [
  { fipeMin: 80001, fipeMax: 85000, mensal: 797.00 },
  { fipeMin: 85001, fipeMax: 90000, mensal: 832.80 },
  { fipeMin: 90001, fipeMax: 95000, mensal: 893.80 },
  { fipeMin: 95001, fipeMax: 100000, mensal: 954.80 },
  { fipeMin: 100001, fipeMax: 105000, mensal: 995.80 },
  { fipeMin: 105001, fipeMax: 110000, mensal: 1016.80 },
  { fipeMin: 110001, fipeMax: 115000, mensal: 1057.80 },
  { fipeMin: 115001, fipeMax: 120000, mensal: 1079.80 },
  { fipeMin: 120001, fipeMax: 125000, mensal: 1099.80 },
  { fipeMin: 125001, fipeMax: 130000, mensal: 1139.80 },
  { fipeMin: 130001, fipeMax: 135000, mensal: 1189.80 },
  { fipeMin: 135001, fipeMax: 140000, mensal: 1239.80 },
  { fipeMin: 140001, fipeMax: 145000, mensal: 1289.80 },
  { fipeMin: 145001, fipeMax: 150000, mensal: 1339.80 },
  { fipeMin: 150001, fipeMax: 155000, mensal: 1399.80 },
  { fipeMin: 155001, fipeMax: 160000, mensal: 1459.80 },
  { fipeMin: 160001, fipeMax: 165000, mensal: 1529.80 },
  { fipeMin: 165001, fipeMax: 170000, mensal: 1599.80 },
  { fipeMin: 170001, fipeMax: 175000, mensal: 1679.80 },
  { fipeMin: 175001, fipeMax: 180000, mensal: 1759.80 },
];

// ============================================
// BENEFÍCIOS POR NÍVEL (SELECT)
// ============================================
export const BENEFICIOS_NIVEL: BeneficioNivel[] = [
  { nome: 'Roubo e Furto', basic: true, premium: true, exclusive: true },
  { nome: 'Colisão', basic: true, premium: true, exclusive: true },
  { nome: 'Perda Total', basic: true, premium: true, exclusive: true },
  { nome: 'Incêndio', basic: true, premium: true, exclusive: true },
  { nome: 'Alagamento', basic: true, premium: true, exclusive: true },
  { nome: 'Chuva de Granizo', basic: true, premium: true, exclusive: true },
  { nome: 'Assistência 24h 400km', basic: true, premium: true, exclusive: true },
  { nome: 'Rastreador (>R$30mil)', basic: true, premium: true, exclusive: true },
  { nome: '1000km Reboque', basic: false, premium: true, exclusive: true },
  { nome: 'Danos Terceiros R$40mil', basic: false, premium: true, exclusive: true },
  { nome: 'Vidros e Faróis', basic: false, premium: true, exclusive: true },
  { nome: 'Reboque Excedente', basic: false, premium: true, exclusive: true },
  { nome: 'Kit Gás', basic: false, premium: false, exclusive: true },
  { nome: '100% FIPE APP + Carro Reserva', basic: false, premium: false, exclusive: true },
];

export const ADICIONAL_NIVEL = {
  basic: 0,
  premium: 30,
  exclusive: 60,
};

// ============================================
// BENEFÍCIOS POR NÍVEL (MOTOS)
// ============================================
export const BENEFICIOS_MOTOS = [
  { nome: 'Roubo e Furto', advanced: true, advancedPlus: true },
  { nome: 'Monitoramento (>R$9mil)', advanced: true, advancedPlus: true },
  { nome: 'Assistência 24h 400km', advanced: true, advancedPlus: true },
  { nome: 'Colisão (cota 10%)', advanced: false, advancedPlus: true },
  { nome: 'Danos Terceiros R$10mil', advanced: false, advancedPlus: true },
  { nome: 'Assistência 600km', advanced: false, advancedPlus: true },
];

// ============================================
// VEÍCULOS ACEITOS
// ============================================
export const VEICULOS_ACEITOS = {
  CHEVROLET: [
    'Agile', 'Astra', 'Celta', 'Cobalt', 'Corsa', 'Cruze', 'Meriva', 
    'Montana (até 2023)', 'Prisma', 'S10', 'Tracker (2009-2023)', 
    'Vectra', 'Vectra GT', 'Zafira', 'Onix', 'Spin', 'Classic', 'Joy'
  ],
  VW: [
    'Fox', 'Gol', 'Kombi', 'Polo', 'Saveiro', 'Spacefox', 'Voyage', 
    'Up', 'Crossfox', 'Space Cross', 'Golf (>2008)', 'Virtus (até 2023)', 
    'Jetta (>2009)', 'Parati', 'T-Cross (até 2023)', 'Nivus (até 2023)'
  ],
  FIAT: [
    'Doblo', 'Grand Siena', 'Idea', 'Linea', 'Palio', 'Punto', 'Siena', 
    'Strada', 'Uno', 'Palio Weekend', 'Mille', 'Mobi', 'Argo', 
    'Cronos (até 2023)', 'Fiorino', 'Ducato', 'Toro (até 2023)', 
    'Bravo', 'Pulse (até 2023)', 'Fastback (até 2023)'
  ],
  FORD: [
    'Ecosport', 'Fiesta', 'Focus (>2009)', 'Ka (Novo)', 'Ranger (>2006)'
  ],
  RENAULT: [
    'Clio', 'Kangoo', 'Logan', 'Sandero', 'Kwid', 'Duster (até 2023)', 
    'Master', 'Oroch (até 2019)', 'Captur (até 2019)'
  ],
  PEUGEOT: [
    '207 (todos)', '208', '2008 (até 2014)'
  ],
  TOYOTA: [
    'Etios', 'Corolla (2005-2023)', 'Yaris', 'Hilux (>2007)'
  ],
  HONDA: [
    'City (até 2023)', 'Civic', 'Fit', 'HR-V', 'WR-V', 'CRV (>2010)'
  ],
  NISSAN: [
    'Livina', 'March', 'Sentra', 'Tiida', 'Versa', 
    'Kicks (até 2023)', 'Frontier Flex (>2006)'
  ],
  HYUNDAI: [
    'HB20', 'HR Diesel', 'Tucson Flex', 'Creta (até 2021)', 'IX35'
  ],
  JEEP: [
    'Renegade Flex (até 2023)', 'Compass Flex (até 2023)'
  ],
  KIA: [
    'Sportage Flex (>2007)', 'Cerato (>2009)', 'Bongo'
  ],
  CITROEN: [
    'Aircross', 'C3 (até 2019)', 'C3 Picasso'
  ],
  MITSUBISHI: [
    'Pajero TR4', 'Triton L200', 'Lancer', 'ASX', 'L200 Sport (>2005)'
  ],
};

export const MOTOS_ACEITAS = {
  HONDA: 'Todos modelos nacionais (20 anos)',
  YAMAHA: 'Todos modelos nacionais (20 anos)',
  SHINERAY: 'Free 150 EFI (apenas Advanced)',
  BMW: 'Apenas Advanced',
  HAOJUE: 'Apenas Advanced',
  SUZUKI: 'Apenas Advanced',
};

// ============================================
// GLOSSÁRIO
// ============================================
export const GLOSSARIO: TermoGlossario[] = [
  {
    termo: 'ASSOCIADO',
    definicao: 'Membro da associação. Não usamos o termo "cliente".',
  },
  {
    termo: 'EVENTOS',
    definicao: 'Departamento responsável por indenizações, consertos e benefícios.',
  },
  {
    termo: 'COTA DE PARTICIPAÇÃO',
    definicao: 'Contribuição do associado no reparo. Calculada por categoria, plano e valor FIPE.',
  },
  {
    termo: 'TABELA FIPE',
    definicao: 'Preço médio de veículos no mercado nacional. Base para cálculos.',
  },
  {
    termo: 'PROPOSTA DE FILIAÇÃO',
    definicao: 'Documento principal com planos, benefícios e coberturas. 100% digital, assinatura em 1h.',
  },
  {
    termo: 'CONTRIBUIÇÃO MENSAL',
    definicao: 'Valor pago mensalmente à associação (não confundir com adesão).',
  },
  {
    termo: 'VISTORIA',
    definicao: 'Avaliação do veículo no ato da filiação (31 fotos + vídeo).',
  },
  {
    termo: 'TROCA DE TITULARIDADE',
    definicao: 'Transferência da proteção para novo proprietário (R$50 repasse + nova adesão).',
  },
  {
    termo: 'SUBSTITUIÇÃO DE PLACA',
    definicao: 'Transferência da proteção para outro veículo do mesmo associado.',
  },
  {
    termo: 'MIGRAÇÃO',
    definicao: 'Associado vindo de outra proteção. Requer 4 últimos comprovantes. Sem carência.',
  },
  {
    termo: 'DESÁGIO',
    definicao: 'Desconto para associados que colocam adesivo publicitário (10% na mensalidade).',
  },
];

// ============================================
// REGRAS IMPORTANTES
// ============================================
export const REGRAS_IMPORTANTES: RegraImportante[] = [
  {
    titulo: 'Ativação',
    icone: '⏰',
    itens: [
      'Roubo/Furto: 00h do 1º dia útil após vistoria',
      'Demais benefícios: 48h após vistoria/instalação',
    ],
  },
  {
    titulo: 'Rastreador Obrigatório',
    icone: '📍',
    itens: [
      'Carros >R$30.000',
      'Motos >R$9.000',
      'Plano Especial (todos)',
      'Veículos diesel',
    ],
  },
  {
    titulo: 'Instalação',
    icone: '🔧',
    itens: [
      'RJ: 48h úteis',
      'SP: 72h úteis',
    ],
  },
  {
    titulo: 'Adesão',
    icone: '💰',
    itens: [
      'Cálculo: 1% do valor FIPE',
      'Mínimo Base: R$100',
      'Mínimo Volante: R$150',
      'Repasse Volante: R$50',
    ],
  },
  {
    titulo: 'Inadimplência',
    icone: '⚠️',
    itens: [
      'Benefícios suspensos no vencimento',
      '5 dias para pagar sem revistoria',
      'Após 5 dias: revistoria obrigatória (app gratuito)',
      'Após 120 dias: nova adesão',
    ],
  },
  {
    titulo: 'Autorização Necessária',
    icone: '📧',
    itens: [
      'Veículos >R$120.000 (carros)',
      'Veículos >R$30.000 (motos)',
      'Email: cadastropraticcar@gmail.com',
    ],
  },
];

// ============================================
// COTAS E TAXAS
// ============================================
export const COTAS_TAXAS: CotasTaxas[] = [
  { categoria: 'Passeio', percentual: '6%', minimo: 'R$ 1.200', comDesagio: '8%', minimoDesagio: 'R$ 2.000' },
  { categoria: 'APP', percentual: '8%', minimo: 'R$ 3.000', comDesagio: '8%', minimoDesagio: 'R$ 3.000' },
  { categoria: 'Deságio', percentual: '8%', minimo: 'R$ 2.000' },
  { categoria: 'Motos', percentual: '10%', minimo: 'R$ 1.500' },
  { categoria: 'Diesel', percentual: '6%', minimo: 'R$ 2.500', comDesagio: '8%', minimoDesagio: 'R$ 2.500' },
  { categoria: 'Especial Plus', percentual: '10%', minimo: 'R$ 3.000' },
  { categoria: 'Lançamento', percentual: '10%', minimo: 'R$ 3.000' },
  { categoria: 'Elétricos', percentual: '10%', minimo: 'Sem mínimo' },
];

export const TAXAS_PROCEDIMENTOS = [
  { procedimento: 'Adesão padrão', taxa: 'R$ 350' },
  { procedimento: 'Substituição', taxa: 'R$ 50' },
  { procedimento: 'Revistoria', taxa: 'R$ 50' },
  { procedimento: 'Troca Titularidade', taxa: 'R$ 50' },
  { procedimento: 'Multa Rastreador', taxa: 'R$ 400' },
];

// ============================================
// BENEFÍCIOS ADICIONAIS (com categorias)
// ============================================
export const BENEFICIOS_ADICIONAIS_COMPLETO = [
  { categoria: 'Reboque', nome: '1000km Reboque', preco: 2.90, descricao: 'Amplia cobertura de reboque' },
  { categoria: 'Terceiros', nome: 'Danos Terceiros 15mil', preco: 12.90, descricao: 'Cobertura para danos a terceiros' },
  { categoria: 'Terceiros', nome: 'Danos Terceiros 70mil', preco: 20.00, descricao: 'Cobertura ampliada' },
  { categoria: 'Terceiros', nome: 'Danos Terceiros 100mil', preco: 40.00, descricao: 'Cobertura máxima' },
  { categoria: 'Vidros', nome: 'Vidros e Faróis', preco: 9.90, descricao: '60% do reparo (carência 120 dias)' },
  { categoria: 'Kit', nome: 'Kit Gás', preco: 9.90, descricao: 'Até R$2.200 em caso de roubo' },
  { categoria: 'Reboque', nome: 'Reboque Excedente', preco: 2.90, descricao: '2x/ano (intervalo 6 meses)' },
  { categoria: 'Combustível', nome: 'Clube Gás', preco: 10.00, descricao: 'Até 10% desconto combustível' },
  { categoria: 'Passageiros', nome: 'Proteção Passageiros', preco: 4.90, descricao: 'APP exclusivo' },
  { categoria: 'Rastreador', nome: 'Rastreador', preco: 30.00, descricao: 'Monitoramento em tempo real' },
  { categoria: 'Reserva', nome: 'Carro Reserva 7 dias', preco: 7.90, descricao: 'Reembolso locação' },
  { categoria: 'Reserva', nome: 'Carro Reserva 15 dias', preco: 15.90, descricao: 'Reembolso locação' },
  { categoria: 'Reserva', nome: 'Carro Reserva 30 dias', preco: 35.90, descricao: 'Reembolso até R$2.200' },
  { categoria: 'Combo', nome: '100% FIPE APP + Carro 30d', preco: 35.90, descricao: 'Combo exclusivo APP' },
];

// ============================================
// RESUMO DOS PLANOS (para cards da Visão Geral)
// ============================================
export const PLANOS_RESUMO: PlanoResumo[] = [
  {
    id: 'select',
    nome: 'SELECT',
    badge: 'Mais Popular',
    coberturaFipe: 100,
    anoMinimo: 2005,
    cotaPasesio: '6% (mín R$1.200)',
    cotaPasesioDesagio: '8% (mín R$2.000)',
    cotaApp: '8% (mín R$3.000)',
    niveis: ['Basic', 'Premium (+R$30)', 'Exclusive (+R$60)'],
    cor: 'from-blue-500 to-blue-600',
  },
  {
    id: 'select-one',
    nome: 'SELECT ONE',
    badge: 'Completo',
    coberturaFipe: 100,
    anoMinimo: 2005,
    cotaPasesio: '6% (mín R$1.200)',
    cotaPasesioDesagio: '8% (mín R$2.000)',
    cotaApp: '8% (mín R$3.000)',
    destaque: 'Tudo incluído (Danos 100mil, Kit Gás, Carro Reserva, Clube Gás)',
    cor: 'from-emerald-500 to-green-600',
  },
  {
    id: 'especial',
    nome: 'ESPECIAL',
    coberturaFipe: 80,
    anoMinimo: 2002,
    cotaPasesio: '—',
    destaque: 'Apenas Roubo/Furto + Assistência 400km. Rastreador obrigatório.',
    cor: 'from-orange-500 to-amber-600',
  },
  {
    id: 'especial-plus',
    nome: 'ESPECIAL PLUS',
    coberturaFipe: 80,
    anoMinimo: 2002,
    cotaPasesio: '10% (mín R$3.000)',
    destaque: 'Roubo/Furto + Colisão + PT + Incêndio + Alagamento',
    cor: 'from-amber-500 to-orange-600',
  },
  {
    id: 'lancamento',
    nome: 'LANÇAMENTO',
    badge: 'Veículos Novos',
    coberturaFipe: 100,
    anoMinimo: 2024,
    cotaPasesio: '10% (mín R$3.000)',
    niveis: ['Basic', 'Premium', 'Exclusive'],
    destaque: 'Sem alteração com deságio',
    cor: 'from-violet-500 to-purple-600',
  },
  {
    id: 'advanced',
    nome: 'ADVANCED (Motos)',
    coberturaFipe: 100,
    anoMinimo: 2005,
    cotaPasesio: '10% (mín R$1.500)',
    niveis: ['Advanced', 'Advanced+ (+Colisão 10% + Terceiros R$750)'],
    destaque: 'Honda e Yamaha (20 anos)',
    cor: 'from-red-500 to-rose-600',
  },
];

// ============================================
// COBERTURAS PRINCIPAIS (ícones)
// ============================================
export const COBERTURAS_ICONES = [
  { icone: '🔒', nome: 'Roubo e Furto', descricao: 'Indenização 60 dias úteis' },
  { icone: '💥', nome: 'Colisão', descricao: 'Análise 7 dias' },
  { icone: '🔥', nome: 'Incêndio', descricao: 'Cobertura total' },
  { icone: '💧', nome: 'Alagamento', descricao: 'Danos mecânicos/elétricos' },
  { icone: '🌨️', nome: 'Chuva de Granizo', descricao: 'Reparo de amassados' },
  { icone: '⚠️', nome: 'Perda Total', descricao: '>75% = indenização' },
  { icone: '🚗', nome: 'Danos a Terceiros', descricao: 'Até R$100mil' },
  { icone: '🪟', nome: 'Vidros e Faróis', descricao: '60% cobertura' },
  { icone: '🚚', nome: 'Assistência 24h', descricao: 'Nacional' },
  { icone: '📍', nome: 'Rastreador', descricao: 'Monitoramento 24h' },
];

// ============================================
// CONTATOS
// ============================================
export const CONTATOS = {
  cadastro: '21 98393-4083',
  comercial: '21 99129-6732',
  assistencia: '0800 980 0001',
};

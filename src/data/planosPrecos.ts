// ============================================
// DADOS DE REFERÊNCIA DO GUIA DO CONSULTOR v11
// Dados estáticos mantidos para referência e validação
// Os planos e tabelas de preços agora vêm do banco de dados
// ============================================

export type Regiao = 'rj' | 'lagos' | 'sp';
export type TipoCombustivel = 'gasolina' | 'diesel';

// Interfaces mantidas para compatibilidade
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
// FUNÇÃO DE AJUSTE DE REGIÃO
// Lagos e SP: 90% do valor RJ
// ============================================
export function calcularPrecoRegiao(precoRJ: number, regiao: Regiao): number {
  if (regiao === 'rj') return precoRJ;
  return Math.round(precoRJ * 0.90 * 100) / 100;
}

// ============================================
// VEÍCULOS ACEITOS (para validação de cadastro)
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
// BENEFÍCIOS ADICIONAIS (referência)
// ============================================
export const BENEFICIOS_ADICIONAIS_COMPLETO = [
  { categoria: 'Reboque', nome: '1000km Reboque', preco: 2.90, descricao: 'Amplia cobertura de reboque' },
  { categoria: 'Terceiros', nome: 'Danos Terceiros 15mil', preco: 12.90, descricao: 'Cobertura para danos a terceiros' },
  { categoria: 'Terceiros', nome: 'Danos Terceiros 70mil', preco: 20.00, descricao: 'Cobertura ampliada' },
  { categoria: 'Terceiros', nome: 'Danos Terceiros 100mil', preco: 40.00, descricao: 'Cobertura máxima' },
  { categoria: 'Vidros', nome: 'Vidros e Faróis', preco: 9.90, descricao: '60% do reparo (carência 120 dias)' },
  { categoria: 'Kit', nome: 'Kit Gás', preco: 9.90, descricao: 'Até R$2.200 em caso de roubo' },
  { categoria: 'Reboque', nome: 'Reboque Excedente', preco: 2.90, descricao: '1 utilização a cada 6 meses (máx 2x/ano)' },
  { categoria: 'Combustível', nome: 'Clube Gás', preco: 10.00, descricao: 'Até 10% desconto combustível' },
  { categoria: 'Passageiros', nome: 'Proteção Passageiros', preco: 4.90, descricao: 'APP exclusivo' },
  { categoria: 'Rastreador', nome: 'Rastreador', preco: 30.00, descricao: 'Monitoramento em tempo real' },
  { categoria: 'Reserva', nome: 'Carro Reserva 7 dias', preco: 7.90, descricao: 'Reembolso locação (somente em casos de colisão)' },
  { categoria: 'Reserva', nome: 'Carro Reserva 15 dias', preco: 15.90, descricao: 'Reembolso locação (somente em casos de colisão)' },
  { categoria: 'Reserva', nome: 'Carro Reserva 30 dias', preco: 35.90, descricao: 'Reembolso até R$2.200 (somente em casos de colisão)' },
  { categoria: 'Combo', nome: '100% FIPE APP + Carro 30d', preco: 35.90, descricao: 'Combo exclusivo APP (carro reserva somente em casos de colisão)' },
];

// ============================================
// COBERTURAS PRINCIPAIS (ícones para UI)
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

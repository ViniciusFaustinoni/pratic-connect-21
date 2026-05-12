// Configuração das fotos obrigatórias para autovistoria.
// Conjunto novo (mai/2026): 9 fotos por veículo, sem vídeo 360°.
//   1. Frente — placa + frente
//   2. Frente — placa + lateral esquerda (diagonal)
//   3. Frente — placa + lateral direita (diagonal)
//   4. Traseira — placa + frente
//   5. Traseira — placa + lateral esquerda (diagonal)
//   6. Traseira — placa + lateral direita (diagonal)
//   7. Chassi (gravado no veículo)
//   8. Motor
//   9. Painel com o veículo ligado
//
// As 6 primeiras passam por OCR de placa (`placa-ocr`) para garantir que a
// placa fotografada bate com a do veículo cadastrado.

export interface FotoAutovistoria {
  id: string;
  label: string;
  descricao?: string;
  ordem: number;
  instrucoes: string[];
  evitar: string[];
  dicaExtra?: string;
  categoria?: 'exterior_frente' | 'exterior_traseira' | 'identificacao' | 'interior';
  /** True quando a foto deve passar pelo OCR de placa. */
  validaPlaca?: boolean;
}

// Ids canônicos das 6 fotos de placa — usados pelos hooks/edge functions.
export const FOTOS_VALIDAR_PLACA = [
  'frente_centro',
  'frente_lateral_esquerda',
  'frente_lateral_direita',
  'traseira_centro',
  'traseira_lateral_esquerda',
  'traseira_lateral_direita',
] as const;

const fotosCarro: FotoAutovistoria[] = [
  {
    id: 'frente_centro',
    label: 'Frente — placa centralizada',
    descricao: 'Foto frontal do veículo com a placa nítida e centralizada.',
    ordem: 1,
    categoria: 'exterior_frente',
    validaPlaca: true,
    instrucoes: [
      'Posicione-se de frente para o veículo, a uns 2 metros de distância',
      'Mantenha a placa dianteira no centro do enquadramento',
      'Use luz natural ou ligue os faróis se estiver escuro',
    ],
    evitar: [
      'Foto angulada onde a placa fica deformada',
      'Reflexos ou sombras sobre a placa',
      'Distância muito grande deixando a placa pequena',
    ],
    dicaExtra: 'A placa será verificada automaticamente — capriche na nitidez.',
  },
  {
    id: 'frente_lateral_esquerda',
    label: 'Frente — diagonal lateral esquerda',
    descricao: 'Foto da frente em diagonal mostrando a lateral esquerda + a placa.',
    ordem: 2,
    categoria: 'exterior_frente',
    validaPlaca: true,
    instrucoes: [
      'Fique na diagonal frontal-esquerda do veículo (aprox. 45°)',
      'Enquadre a frente e toda a lateral esquerda',
      'A placa dianteira deve aparecer legível',
    ],
    evitar: [
      'Cortar a roda dianteira esquerda',
      'Placa cortada ou ilegível',
    ],
  },
  {
    id: 'frente_lateral_direita',
    label: 'Frente — diagonal lateral direita',
    descricao: 'Foto da frente em diagonal mostrando a lateral direita + a placa.',
    ordem: 3,
    categoria: 'exterior_frente',
    validaPlaca: true,
    instrucoes: [
      'Fique na diagonal frontal-direita do veículo (aprox. 45°)',
      'Enquadre a frente e toda a lateral direita',
      'A placa dianteira deve aparecer legível',
    ],
    evitar: [
      'Cortar a roda dianteira direita',
      'Placa cortada ou ilegível',
    ],
  },
  {
    id: 'traseira_centro',
    label: 'Traseira — placa centralizada',
    descricao: 'Foto traseira do veículo com a placa nítida e centralizada.',
    ordem: 4,
    categoria: 'exterior_traseira',
    validaPlaca: true,
    instrucoes: [
      'Posicione-se atrás do veículo, a uns 2 metros',
      'Mantenha a placa traseira no centro do enquadramento',
    ],
    evitar: [
      'Reflexos ou sujeira sobre a placa',
      'Foto muito angulada',
    ],
  },
  {
    id: 'traseira_lateral_esquerda',
    label: 'Traseira — diagonal lateral esquerda',
    descricao: 'Foto da traseira em diagonal mostrando a lateral esquerda + a placa.',
    ordem: 5,
    categoria: 'exterior_traseira',
    validaPlaca: true,
    instrucoes: [
      'Fique na diagonal traseira-esquerda (aprox. 45°)',
      'Enquadre a traseira e toda a lateral esquerda',
      'A placa traseira deve aparecer legível',
    ],
    evitar: [
      'Cortar a roda traseira esquerda',
      'Placa cortada ou ilegível',
    ],
  },
  {
    id: 'traseira_lateral_direita',
    label: 'Traseira — diagonal lateral direita',
    descricao: 'Foto da traseira em diagonal mostrando a lateral direita + a placa.',
    ordem: 6,
    categoria: 'exterior_traseira',
    validaPlaca: true,
    instrucoes: [
      'Fique na diagonal traseira-direita (aprox. 45°)',
      'Enquadre a traseira e toda a lateral direita',
      'A placa traseira deve aparecer legível',
    ],
    evitar: [
      'Cortar a roda traseira direita',
      'Placa cortada ou ilegível',
    ],
  },
  {
    id: 'chassi',
    label: 'Número do Chassi',
    descricao: 'Foto do número do chassi gravado no veículo (legível).',
    ordem: 7,
    categoria: 'identificacao',
    instrucoes: [
      'Localize o chassi (geralmente na base do para-brisa, lado do motorista)',
      'Aproxime a câmera para que TODOS os números fiquem legíveis',
      'Use flash se necessário para iluminar',
    ],
    evitar: [
      'Foto de longe onde não se lê os números',
      'Chassi sujo ou coberto',
      'Reflexos que atrapalhem a leitura',
    ],
    dicaExtra: 'O chassi será confrontado com o CRLV. Capriche na nitidez!',
  },
  {
    id: 'motor',
    label: 'Compartimento do Motor',
    descricao: 'Foto do compartimento do motor com o capô aberto.',
    ordem: 8,
    categoria: 'identificacao',
    instrucoes: [
      'Abra o capô completamente',
      'Enquadre o compartimento do motor por inteiro',
      'Mantenha boa iluminação e foco',
    ],
    evitar: [
      'Capô fechado ou parcialmente aberto',
      'Foto desfocada, escura ou tremida',
    ],
  },
  {
    id: 'painel_ligado',
    label: 'Painel com o veículo ligado',
    descricao: 'Foto do painel com o motor ligado mostrando hodômetro e luzes acesas.',
    ordem: 9,
    categoria: 'interior',
    instrucoes: [
      'Ligue o veículo (motor funcionando)',
      'Aguarde as luzes do painel se estabilizarem',
      'Enquadre o painel por completo, com o hodômetro legível',
    ],
    evitar: [
      'Veículo desligado (luzes apagadas)',
      'Reflexos do vidro do painel atrapalhando a leitura',
      'Hodômetro fora do enquadramento',
    ],
    dicaExtra: 'O painel deve estar com o veículo LIGADO — usado também para conferir a quilometragem.',
  },
];

const fotosMoto: FotoAutovistoria[] = [
  {
    id: 'frente_centro',
    label: 'Frente da moto — placa centralizada (se houver)',
    descricao: 'Foto frontal da moto. Algumas motos não têm placa dianteira — fotografe a frente da mesma forma.',
    ordem: 1,
    categoria: 'exterior_frente',
    validaPlaca: true,
    instrucoes: [
      'Posicione-se de frente para a moto, a uns 2 metros',
      'Enquadre toda a frente: farol, garfo dianteiro e roda',
    ],
    evitar: [
      'Reflexos no farol que atrapalhem o enquadramento',
      'Foto de muito perto cortando o veículo',
    ],
  },
  {
    id: 'frente_lateral_esquerda',
    label: 'Frente — diagonal lateral esquerda',
    descricao: 'Foto da frente em diagonal mostrando a lateral esquerda da moto.',
    ordem: 2,
    categoria: 'exterior_frente',
    validaPlaca: true,
    instrucoes: [
      'Fique na diagonal frontal-esquerda (aprox. 45°)',
      'Enquadre frente, tanque e parte da lateral esquerda',
    ],
    evitar: ['Cortar roda dianteira ou tanque'],
  },
  {
    id: 'frente_lateral_direita',
    label: 'Frente — diagonal lateral direita',
    descricao: 'Foto da frente em diagonal mostrando a lateral direita da moto.',
    ordem: 3,
    categoria: 'exterior_frente',
    validaPlaca: true,
    instrucoes: [
      'Fique na diagonal frontal-direita (aprox. 45°)',
      'Enquadre frente, tanque e parte da lateral direita',
    ],
    evitar: ['Cortar roda dianteira ou tanque'],
  },
  {
    id: 'traseira_centro',
    label: 'Traseira — placa centralizada',
    descricao: 'Foto traseira da moto com a placa nítida e centralizada.',
    ordem: 4,
    categoria: 'exterior_traseira',
    validaPlaca: true,
    instrucoes: [
      'Fique atrás da moto, a uns 2 metros',
      'A placa traseira deve estar no centro e legível',
    ],
    evitar: ['Reflexos ou sujeira sobre a placa'],
  },
  {
    id: 'traseira_lateral_esquerda',
    label: 'Traseira — diagonal lateral esquerda',
    descricao: 'Foto da traseira em diagonal mostrando a lateral esquerda + a placa.',
    ordem: 5,
    categoria: 'exterior_traseira',
    validaPlaca: true,
    instrucoes: [
      'Fique na diagonal traseira-esquerda (aprox. 45°)',
      'Enquadre traseira completa com a placa visível',
    ],
    evitar: ['Cortar a roda traseira', 'Placa ilegível'],
  },
  {
    id: 'traseira_lateral_direita',
    label: 'Traseira — diagonal lateral direita',
    descricao: 'Foto da traseira em diagonal mostrando a lateral direita + a placa.',
    ordem: 6,
    categoria: 'exterior_traseira',
    validaPlaca: true,
    instrucoes: [
      'Fique na diagonal traseira-direita (aprox. 45°)',
      'Enquadre traseira completa com a placa visível',
    ],
    evitar: ['Cortar a roda traseira', 'Placa ilegível'],
  },
  {
    id: 'chassi',
    label: 'Chassi da Moto',
    descricao: 'Foto do número do chassi gravado na moto.',
    ordem: 7,
    categoria: 'identificacao',
    instrucoes: [
      'Fotografe o chassi (geralmente no tubo do garfo dianteiro)',
      'Deixe os números legíveis e enquadrados',
      'Use flash se necessário',
    ],
    evitar: [
      'Foto desfocada ou com números ilegíveis',
      'Enquadramento cortando parte da numeração',
    ],
  },
  {
    id: 'motor',
    label: 'Motor da Moto',
    descricao: 'Foto aproximada do motor da moto.',
    ordem: 8,
    categoria: 'identificacao',
    instrucoes: [
      'Enquadre o motor por inteiro com boa iluminação',
      'Mantenha o foco nítido',
    ],
    evitar: [
      'Foto desfocada, escura ou tremida',
      'Enquadramento cortando partes do motor',
    ],
  },
  {
    id: 'painel_ligado',
    label: 'Painel com a moto ligada',
    descricao: 'Foto do painel/hodômetro com a moto ligada (luzes do painel acesas).',
    ordem: 9,
    categoria: 'interior',
    instrucoes: [
      'Ligue a moto (motor funcionando)',
      'Aguarde as luzes do painel se estabilizarem',
      'Enquadre o painel mostrando o hodômetro legível',
    ],
    evitar: [
      'Moto desligada (luzes apagadas)',
      'Reflexos atrapalhando a leitura do hodômetro',
    ],
    dicaExtra: 'O painel deve estar com a moto LIGADA — usado também para conferir a quilometragem.',
  },
];

export const FOTOS_AUTOVISTORIA_CARRO = fotosCarro;
export const FOTOS_AUTOVISTORIA_MOTO = fotosMoto;

// Tipos de veículo
export type TipoVeiculo = 'carro' | 'moto';

export function getFotosAutovistoria(tipo: TipoVeiculo): FotoAutovistoria[] {
  return tipo === 'moto' ? FOTOS_AUTOVISTORIA_MOTO : FOTOS_AUTOVISTORIA_CARRO;
}

export function isFotoComValidacaoPlaca(fotoId: string): boolean {
  return (FOTOS_VALIDAR_PLACA as readonly string[]).includes(fotoId);
}

// ===== INSTRUÇÕES DE VÍDEO 360° (deprecated — substituído pelas 9 fotos) =====
// Mantidos como stubs para evitar quebra de imports legados em telas que ainda
// referenciam as funções até serem atualizadas. Retornam dados vazios.

export interface InstrucaoVideo360 {
  passo: number;
  texto: string;
  destaque?: string;
}

/** @deprecated Vídeo 360° removido. Use as 9 fotos de `getFotosAutovistoria`. */
export function getInstrucoesVideo360(_tipo: TipoVeiculo): InstrucaoVideo360[] {
  return [];
}

/** @deprecated Vídeo 360° removido. */
export function getLabelVideo360(_tipo: TipoVeiculo): string {
  return '';
}

// ===== CONFIGURAÇÃO DE PERÍODOS PARA VISTORIA PRESENCIAL =====

// Tipos de período
export type Periodo = 'manha' | 'tarde';

// Configuração de cada período
export interface PeriodoConfig {
  id: Periodo;
  label: string;
  horarioInicio: string;
  horarioFim: string;
  icone: string;
}

// Períodos disponíveis
export const PERIODOS_DISPONIVEIS: PeriodoConfig[] = [
  { id: 'manha', label: 'Manhã', horarioInicio: '08:00', horarioFim: '12:00', icone: '☀️' },
  { id: 'tarde', label: 'Tarde', horarioInicio: '14:00', horarioFim: '18:00', icone: '🌅' },
];

// Limite máximo de vagas por período por dia
export const LIMITE_VAGAS_POR_PERIODO = 10;

/** @deprecated Agendamento agora é por PERÍODO (manhã/tarde). Use PERIODOS_DISPONIVEIS. */
export const HORARIOS_DISPONIVEIS = [
  '08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00',
];

/** @deprecated Agendamento agora é por PERÍODO (manhã/tarde). Use PERIODOS_DISPONIVEIS. */
export const HORARIOS_SABADO = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
];

// Função helper para verificar se é domingo (não sábado)
export const isDomingo = (date: Date): boolean => {
  return date.getDay() === 0; // 0 = domingo
};

// Função helper para verificar se é sábado
export const isSabado = (date: Date): boolean => {
  return date.getDay() === 6; // 6 = sábado
};

// Função para obter períodos disponíveis baseado no dia da semana
export const getPeriodosParaDia = (date: Date): PeriodoConfig[] => {
  if (isSabado(date)) {
    // Sábado: apenas manhã disponível
    return PERIODOS_DISPONIVEIS.filter(p => p.id === 'manha');
  }
  return PERIODOS_DISPONIVEIS;
};

/**
 * Filtra períodos disponíveis baseado na hora ATUAL
 * Se for a MESMA data que hoje, bloqueia períodos que já expiraram
 * Se for uma data FUTURA, retorna todos os períodos do dia
 */
export const getPeriodosDisponivelsPorHora = (date: Date): PeriodoConfig[] => {
  const periodosDodia = getPeriodosParaDia(date); // Já filtra sábado

  const hoje = new Date();
  const dataFormatada = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const hojeFormatada = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

  if (dataFormatada !== hojeFormatada) {
    return periodosDodia;
  }

  const horaAgora = `${String(hoje.getHours()).padStart(2, '0')}:${String(hoje.getMinutes()).padStart(2, '0')}`;

  return periodosDodia.filter(periodo => {
    return periodo.horarioInicio > horaAgora;
  });
};

/** @deprecated Use getPeriodosParaDia. Mantido apenas para compatibilidade com código legado. */
export const getHorariosParaDia = (date: Date): string[] => {
  if (isSabado(date)) return HORARIOS_SABADO;
  return HORARIOS_DISPONIVEIS;
};

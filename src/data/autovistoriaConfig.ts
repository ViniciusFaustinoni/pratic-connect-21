// Configuração das fotos obrigatórias para autovistoria.
// Conjunto enxuto (mai/2026):
//   1. Motor (compartimento do motor / bloco da moto)
//   2. Chassi gravado no veículo
//   + Vídeo 360° em volta do veículo terminando no PAINEL LIGADO
//     (motor funcionando, hodômetro visível) — obrigatório.

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

// Ids canônicos das fotos com OCR de placa (atualmente nenhum — validação de placa fica a cargo do CRLV/cadastro).
export const FOTOS_VALIDAR_PLACA = [] as const;

const fotosCarro: FotoAutovistoria[] = [
  {
    id: 'motor',
    label: 'Motor',
    descricao: 'Foto do compartimento do motor com o capô aberto.',
    ordem: 1,
    categoria: 'identificacao',
    instrucoes: [
      'Abra o capô e estabilize-o',
      'Enquadre todo o compartimento do motor',
      'Garanta boa iluminação — use flash se necessário',
    ],
    evitar: [
      'Foto parcial mostrando só uma parte do motor',
      'Capô fechando ou atrapalhando o enquadramento',
      'Sombras fortes sobre o bloco',
    ],
    dicaExtra: 'O motor é usado para confirmar o estado de conservação do veículo.',
  },
  {
    id: 'chassi',
    label: 'Número do Chassi',
    descricao: 'Foto do número do chassi gravado no veículo (legível).',
    ordem: 2,
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
];

const fotosMoto: FotoAutovistoria[] = [
  {
    id: 'motor',
    label: 'Motor da moto',
    descricao: 'Foto lateral do bloco do motor da moto.',
    ordem: 1,
    categoria: 'identificacao',
    instrucoes: [
      'Posicione-se ao lado da moto',
      'Enquadre o bloco do motor por inteiro',
      'Use boa iluminação',
    ],
    evitar: [
      'Foto desfocada ou muito de longe',
      'Sujeira excessiva escondendo o bloco',
    ],
  },
  {
    id: 'chassi',
    label: 'Chassi da Moto',
    descricao: 'Foto do número do chassi gravado na moto (legível).',
    ordem: 2,
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
    dicaExtra: 'O chassi será confrontado com o CRLV. Capriche na nitidez!',
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

// ===== INSTRUÇÕES DO VÍDEO 360° =====

export interface InstrucaoVideo360 {
  passo: number;
  texto: string;
  destaque?: string;
}

const instrucoesVideoCarro: InstrucaoVideo360[] = [
  { passo: 1, texto: 'Comece de FRENTE para o veículo, mostrando a placa dianteira.' },
  { passo: 2, texto: 'Caminhe pela LATERAL ESQUERDA, enquadrando toda a lateral.' },
  { passo: 3, texto: 'Mostre a TRASEIRA com a placa nítida e legível.' },
  { passo: 4, texto: 'Continue pela LATERAL DIREITA até voltar à frente.' },
  { passo: 5, texto: 'Abra a porta e LIGUE o veículo (motor funcionando).' },
  {
    passo: 6,
    texto: 'Aproxime a câmera do PAINEL com a moto/carro LIGADO, mostrando hodômetro e luzes acesas.',
    destaque: 'Painel ligado é OBRIGATÓRIO — comprova o funcionamento do veículo.',
  },
];

const instrucoesVideoMoto: InstrucaoVideo360[] = [
  { passo: 1, texto: 'Comece de FRENTE para a moto, enquadrando o farol.' },
  { passo: 2, texto: 'Caminhe pela LATERAL ESQUERDA mostrando tanque e motor.' },
  { passo: 3, texto: 'Mostre a TRASEIRA com a placa nítida.' },
  { passo: 4, texto: 'Continue pela LATERAL DIREITA até voltar à frente.' },
  { passo: 5, texto: 'LIGUE a moto (motor funcionando).' },
  {
    passo: 6,
    texto: 'Aproxime a câmera do PAINEL com a moto LIGADA, mostrando hodômetro e luzes acesas.',
    destaque: 'Painel ligado é OBRIGATÓRIO — comprova o funcionamento da moto.',
  },
];

export function getInstrucoesVideo360(tipo: TipoVeiculo): InstrucaoVideo360[] {
  return tipo === 'moto' ? instrucoesVideoMoto : instrucoesVideoCarro;
}

export function getLabelVideo360(_tipo: TipoVeiculo): string {
  return 'Vídeo 360° + painel ligado';
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

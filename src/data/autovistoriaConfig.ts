// Configuração das fotos obrigatórias para autovistoria
// Associado: 15 fotos (carro) | 7 fotos (moto) — fotos técnicas são do instalador

export interface FotoAutovistoria {
  id: string;
  label: string;
  descricao?: string;
  ordem: number;
  instrucoes: string[];
  evitar: string[];
  dicaExtra?: string;
  categoria?: string;
}

// CARROS (2 fotos - associado) + vídeo 360° obrigatório
export const FOTOS_AUTOVISTORIA_CARRO: FotoAutovistoria[] = [
  { 
    id: 'chassi', 
    label: 'Número do Chassi', 
    descricao: 'Foto do número do chassi gravado no veículo (legível)',
    ordem: 1,
    categoria: 'identificacao',
    instrucoes: [
      'Localize o chassi (geralmente na base do para-brisa, lado do motorista)',
      'Aproxime a câmera para que TODOS os números fiquem legíveis',
      'Use flash se necessário para iluminar',
      'O número deve aparecer por completo',
    ],
    evitar: [
      'Foto de longe onde não se lê os números',
      'Chassi sujo ou coberto',
      'Reflexos que atrapalhem a leitura',
    ],
    dicaExtra: 'O chassi será validado automaticamente com o CRLV. Capriche na nitidez!',
  },
  { 
    id: 'motor', 
    label: 'Foto do Motor', 
    descricao: 'Uma foto do compartimento do motor — qualquer ângulo serve. A equipe revisa depois.',
    ordem: 2,
    categoria: 'identificacao',
    instrucoes: [
      'Abra o capô (mesmo que parcialmente já está OK)',
      'Tire uma foto que mostre o motor',
      'Não precisa estar perfeita — qualquer foto do motor é aceita',
      'Se conseguir mostrar o número gravado, ótimo (mas é opcional)',
    ],
    evitar: [
      'Foto totalmente preta ou desfocada a ponto de não ver nada',
    ],
    dicaExtra: 'Não se preocupe com perfeição. Nossa equipe confere a foto manualmente depois.',
  },
];
// MOTOS (2 fotos) + vídeo 360° obrigatório
export const FOTOS_AUTOVISTORIA_MOTO: FotoAutovistoria[] = [
  { 
    id: 'chassi', 
    label: 'Chassi da Moto', 
    descricao: 'Foto do número do chassi gravado na moto',
    ordem: 1,
    categoria: 'identificacao',
    instrucoes: [
      'Fotografe o chassi (geralmente no tubo do garfo dianteiro)',
      'Tente deixar os números legíveis',
      'Use flash se necessário',
    ],
    evitar: [
      'Foto totalmente preta ou desfocada a ponto de não ver nada',
    ],
    dicaExtra: 'O chassi da moto geralmente está gravado no tubo do garfo dianteiro.',
  },
  { 
    id: 'motor', 
    label: 'Motor da Moto', 
    descricao: 'Uma foto do motor da moto — qualquer ângulo serve. A equipe revisa depois.',
    ordem: 2,
    categoria: 'identificacao',
    instrucoes: [
      'Tire uma foto que mostre o motor da moto',
      'Não precisa estar perfeita — qualquer foto do motor é aceita',
      'Se conseguir mostrar o número gravado, ótimo (mas é opcional)',
    ],
    evitar: [
      'Foto totalmente preta ou desfocada a ponto de não ver nada',
    ],
    dicaExtra: 'Não se preocupe com perfeição. Nossa equipe confere a foto manualmente depois.',
  },
];

// Tipos de veículo
export type TipoVeiculo = 'carro' | 'moto';

// Função para obter as fotos corretas baseado no tipo
export function getFotosAutovistoria(tipo: TipoVeiculo): FotoAutovistoria[] {
  return tipo === 'moto' ? FOTOS_AUTOVISTORIA_MOTO : FOTOS_AUTOVISTORIA_CARRO;
}

// ===== INSTRUÇÕES DE VÍDEO 360° POR TIPO DE VEÍCULO =====

export interface InstrucaoVideo360 {
  passo: number;
  texto: string; // pode conter HTML/JSX simples — renderizar com dangerouslySetInnerHTML NÃO
  destaque?: string; // parte em negrito
}

const INSTRUCOES_VIDEO_360_CARRO: InstrucaoVideo360[] = [
  { passo: 1, texto: 'Comece filmando a', destaque: 'frente do veículo com a placa visível' },
  { passo: 2, texto: 'Caminhe lentamente pela', destaque: 'lateral direita' },
  { passo: 3, texto: 'Filme a', destaque: 'traseira com a placa visível' },
  { passo: 4, texto: 'Continue pela', destaque: 'lateral esquerda até voltar à frente' },
  { passo: 5, texto: 'Entre no veículo e filme o', destaque: 'interior: bancos, forração e teto' },
  { passo: 6, texto: 'Ligue o veículo e filme o', destaque: 'painel ligado mostrando hodômetro e indicadores' },
  { passo: 7, texto: 'Filme o', destaque: 'compartimento do motor com o capô aberto' },
];

const INSTRUCOES_VIDEO_360_MOTO: InstrucaoVideo360[] = [
  { passo: 1, texto: 'Comece filmando a', destaque: 'frente da moto com a placa visível' },
  { passo: 2, texto: 'Caminhe lentamente pela', destaque: 'lateral direita da moto' },
  { passo: 3, texto: 'Filme a', destaque: 'traseira com a placa visível' },
  { passo: 4, texto: 'Continue pela', destaque: 'lateral esquerda até voltar à frente' },
  { passo: 5, texto: 'Ligue a moto e filme o', destaque: 'painel/hodômetro mostrando a quilometragem' },
  { passo: 6, texto: 'Aproxime e filme o', destaque: 'número do chassi (geralmente no tubo do garfo dianteiro)' },
  { passo: 7, texto: 'Filme o', destaque: 'motor mostrando o número gravado, se possível' },
];

export function getInstrucoesVideo360(tipo: TipoVeiculo): InstrucaoVideo360[] {
  return tipo === 'moto' ? INSTRUCOES_VIDEO_360_MOTO : INSTRUCOES_VIDEO_360_CARRO;
}

export function getLabelVideo360(tipo: TipoVeiculo): string {
  return tipo === 'moto' ? 'Vídeo 360° da Moto' : 'Vídeo 360° do Veículo';
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
  
  // Se for uma data futura (não é hoje), retornar todos os períodos do dia
  const hoje = new Date();
  const dataFormatada = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const hojeFormatada = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  
  if (dataFormatada !== hojeFormatada) {
    return periodosDodia;
  }
  
  // Se é hoje, filtrar períodos que ainda estão disponíveis
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

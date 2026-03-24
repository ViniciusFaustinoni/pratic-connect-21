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
    descricao: 'Foto do motor aberto mostrando o compartimento',
    ordem: 2,
    categoria: 'identificacao',
    instrucoes: [
      'Abra o capô completamente',
      'Fotografe o compartimento do motor por inteiro',
      'O número do motor deve estar visível (se possível)',
      'Boa iluminação é essencial',
    ],
    evitar: [
      'Capô parcialmente aberto',
      'Foto muito escura',
      'Motor coberto por objetos',
    ],
    dicaExtra: 'Se possível, localize e fotografe o número gravado no motor.',
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
      'Todos os números devem estar legíveis',
      'Use flash se necessário',
      'Boa iluminação é essencial',
    ],
    evitar: [
      'Chassi ilegível ou sujo',
      'Foto de longe sem detalhes',
      'Reflexos ou sombras nos números',
    ],
    dicaExtra: 'O chassi da moto geralmente está gravado no tubo do garfo dianteiro.',
  },
  { 
    id: 'motor', 
    label: 'Motor da Moto', 
    descricao: 'Foto do motor mostrando número do motor',
    ordem: 2,
    categoria: 'identificacao',
    instrucoes: [
      'Fotografe o motor mostrando o número gravado',
      'Aproxime a câmera para os números ficarem legíveis',
      'Mostre o motor e suas condições',
      'Boa iluminação é essencial',
    ],
    evitar: [
      'Motor muito sujo que esconda detalhes',
      'Foto escura ou desfocada',
      'Número do motor ilegível',
    ],
    dicaExtra: 'O número do motor geralmente está gravado na lateral do bloco.',
  },
];

// Tipos de veículo
export type TipoVeiculo = 'carro' | 'moto';

// Função para obter as fotos corretas baseado no tipo
export function getFotosAutovistoria(tipo: TipoVeiculo): FotoAutovistoria[] {
  return tipo === 'moto' ? FOTOS_AUTOVISTORIA_MOTO : FOTOS_AUTOVISTORIA_CARRO;
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

// Horários disponíveis para agendamento de vistoria (segunda a sexta) - LEGADO
export const HORARIOS_DISPONIVEIS = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
];

// Horários disponíveis para sábado (08:00 às 13:00) - LEGADO
export const HORARIOS_SABADO = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
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

// Função para obter horários disponíveis baseado na data (legado)
export const getHorariosParaDia = (date: Date): string[] => {
  if (isSabado(date)) {
    return HORARIOS_SABADO;
  }
  return HORARIOS_DISPONIVEIS;
};

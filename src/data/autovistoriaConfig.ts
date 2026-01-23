// Configuração das fotos obrigatórias para autovistoria

export interface FotoAutovistoria {
  id: string;
  label: string;
  descricao?: string;
  ordem: number;
  instrucoes: string[];
  evitar: string[];
  dicaExtra?: string;
}

// CARROS (15 fotos)
export const FOTOS_AUTOVISTORIA_CARRO: FotoAutovistoria[] = [
  { 
    id: 'selfie_veiculo', 
    label: 'Selfie com o Veículo ao Fundo', 
    descricao: 'Tire uma selfie com o veículo aparecendo atrás de você',
    ordem: 1,
    instrucoes: [
      'Posicione-se à frente do veículo',
      'Seu rosto deve aparecer claramente na foto',
      'O veículo deve estar visível ao fundo',
      'Mantenha boa iluminação no rosto',
    ],
    evitar: [
      'Óculos escuros ou bonés que cubram o rosto',
      'Fotos muito escuras ou com flash estourado',
      'Veículo cortado ou muito distante',
    ],
    dicaExtra: 'Esta foto comprova que você está presente no local da vistoria.',
  },
  { 
    id: 'frente', 
    label: 'Frente do Veículo', 
    descricao: 'Foto da frente do veículo, mostrando faróis e placa',
    ordem: 2,
    instrucoes: [
      'Posicione-se a 2-3 metros de distância',
      'Centralize o veículo na foto',
      'A placa dianteira deve estar legível',
      'Faróis e grade devem estar visíveis',
    ],
    evitar: [
      'Fotos muito de perto ou muito longe',
      'Veículo cortado na imagem',
      'Sombras cobrindo a placa',
    ],
  },
  { 
    id: 'traseira', 
    label: 'Traseira do Veículo', 
    descricao: 'Foto da traseira do veículo, mostrando lanternas e placa',
    ordem: 3,
    instrucoes: [
      'Posicione-se a 2-3 metros de distância',
      'Centralize a traseira na foto',
      'A placa traseira deve estar legível',
      'Lanternas e para-choque visíveis',
    ],
    evitar: [
      'Veículo muito próximo ou cortado',
      'Placa ilegível por reflexo ou distância',
      'Objetos bloqueando a visão',
    ],
  },
  { 
    id: 'lateral_direita', 
    label: 'Lateral Direita', 
    descricao: 'Foto da lateral direita completa do veículo',
    ordem: 4,
    instrucoes: [
      'Enquadre o veículo inteiro na horizontal',
      'Mantenha a câmera na altura da linha da cintura',
      'Mostre desde o para-choque dianteiro até o traseiro',
      'Todas as portas e janelas devem aparecer',
    ],
    evitar: [
      'Ângulo muito inclinado',
      'Veículo cortado nas extremidades',
      'Objetos ou pessoas na frente do veículo',
    ],
  },
  { 
    id: 'lateral_esquerda', 
    label: 'Lateral Esquerda', 
    descricao: 'Foto da lateral esquerda completa do veículo',
    ordem: 5,
    instrucoes: [
      'Enquadre o veículo inteiro na horizontal',
      'Mantenha a câmera na altura da linha da cintura',
      'Mostre desde o para-choque dianteiro até o traseiro',
      'Todas as portas e janelas devem aparecer',
    ],
    evitar: [
      'Ângulo muito inclinado',
      'Veículo cortado nas extremidades',
      'Sombras escurecendo detalhes',
    ],
  },
  { 
    id: 'odometro', 
    label: 'Odômetro (veículo ligado)', 
    descricao: 'Foto do painel com o odômetro visível (veículo ligado)',
    ordem: 6,
    instrucoes: [
      'LIGUE O VEÍCULO antes de fotografar',
      'A quilometragem (KM) deve estar visível e legível',
      'Aproxime a câmera focando no número do odômetro',
      'Certifique-se de que o display está bem iluminado',
    ],
    evitar: [
      'Painel apagado (veículo desligado)',
      'Reflexos no painel ou vidro',
      'Foto tremida ou fora de foco',
    ],
    dicaExtra: 'A quilometragem será identificada automaticamente pela nossa IA.',
  },
  { 
    id: 'painel', 
    label: 'Painel Completo', 
    descricao: 'Foto do painel do veículo mostrando todos os indicadores',
    ordem: 7,
    instrucoes: [
      'Mantenha o veículo ligado',
      'Fotografe o painel completo',
      'Velocímetro, conta-giros e indicadores devem aparecer',
      'Verifique se há luzes de advertência acesas',
    ],
    evitar: [
      'Flash que cause reflexo no vidro',
      'Foto parcial do painel',
      'Imagem muito escura ou clara',
    ],
  },
  { 
    id: 'chassi', 
    label: 'Número do Chassi', 
    descricao: 'Foto do número do chassi gravado no veículo',
    ordem: 8,
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
    dicaExtra: 'O chassi geralmente está visível olhando pelo para-brisa, no canto inferior esquerdo.',
  },
  { 
    id: 'motor', 
    label: 'Motor (capô aberto)', 
    descricao: 'Foto do motor com o capô aberto',
    ordem: 9,
    instrucoes: [
      'Abra o capô completamente',
      'Fotografe o motor por inteiro',
      'Mostre os componentes principais (bateria, filtro, etc.)',
      'Boa iluminação é importante',
    ],
    evitar: [
      'Motor muito sujo que esconda detalhes',
      'Foto escura ou com sombras fortes',
      'Apenas parte do motor aparecendo',
    ],
  },
  { 
    id: 'pneu_dianteiro_direito', 
    label: 'Sola do Pneu Dianteiro Direito', 
    descricao: 'Foto da sola do pneu dianteiro direito mostrando estado',
    ordem: 10,
    instrucoes: [
      'Fotografe a SOLA (banda de rodagem) do pneu',
      'Mostre os sulcos e o estado da borracha',
      'Aproxime para ver os detalhes do desgaste',
      'Vire o volante para facilitar a foto',
    ],
    evitar: [
      'Apenas a lateral do pneu',
      'Foto de longe sem detalhes',
      'Pneu sujo demais para ver a sola',
    ],
    dicaExtra: 'Vire o volante totalmente para a direita para expor melhor a sola do pneu.',
  },
  { 
    id: 'pneu_dianteiro_esquerdo', 
    label: 'Sola do Pneu Dianteiro Esquerdo', 
    descricao: 'Foto da sola do pneu dianteiro esquerdo mostrando estado',
    ordem: 11,
    instrucoes: [
      'Fotografe a SOLA (banda de rodagem) do pneu',
      'Mostre os sulcos e o estado da borracha',
      'Aproxime para ver os detalhes do desgaste',
      'Vire o volante para facilitar a foto',
    ],
    evitar: [
      'Apenas a lateral do pneu',
      'Foto de longe sem detalhes',
      'Pneu sujo demais para ver a sola',
    ],
    dicaExtra: 'Vire o volante totalmente para a esquerda para expor melhor a sola do pneu.',
  },
  { 
    id: 'pneu_traseiro_direito', 
    label: 'Sola do Pneu Traseiro Direito', 
    descricao: 'Foto da sola do pneu traseiro direito mostrando estado',
    ordem: 12,
    instrucoes: [
      'Fotografe a SOLA (banda de rodagem) do pneu',
      'Mostre os sulcos e o estado da borracha',
      'Aproxime para ver os detalhes do desgaste',
      'Abaixe-se para melhor ângulo',
    ],
    evitar: [
      'Apenas a lateral do pneu',
      'Foto de longe sem detalhes',
      'Pneu sujo demais para ver a sola',
    ],
  },
  { 
    id: 'pneu_traseiro_esquerdo', 
    label: 'Sola do Pneu Traseiro Esquerdo', 
    descricao: 'Foto da sola do pneu traseiro esquerdo mostrando estado',
    ordem: 13,
    instrucoes: [
      'Fotografe a SOLA (banda de rodagem) do pneu',
      'Mostre os sulcos e o estado da borracha',
      'Aproxime para ver os detalhes do desgaste',
      'Abaixe-se para melhor ângulo',
    ],
    evitar: [
      'Apenas a lateral do pneu',
      'Foto de longe sem detalhes',
      'Pneu sujo demais para ver a sola',
    ],
  },
  { 
    id: 'banco_dianteiro', 
    label: 'Banco Dianteiro', 
    descricao: 'Foto dos bancos dianteiros mostrando estado de conservação',
    ordem: 14,
    instrucoes: [
      'Abra a porta do motorista',
      'Fotografe os dois bancos dianteiros',
      'Mostre o estado do estofado (rasgos, manchas, etc.)',
      'Boa iluminação interna',
    ],
    evitar: [
      'Foto muito escura',
      'Apenas um banco aparecendo',
      'Objetos sobre os bancos',
    ],
  },
  { 
    id: 'banco_traseiro', 
    label: 'Banco Traseiro', 
    descricao: 'Foto do banco traseiro mostrando estado de conservação',
    ordem: 15,
    instrucoes: [
      'Abra a porta traseira',
      'Fotografe o banco traseiro completo',
      'Mostre o estado do estofado',
      'Boa iluminação interna',
    ],
    evitar: [
      'Foto muito escura',
      'Banco parcialmente visível',
      'Objetos cobrindo o banco',
    ],
    dicaExtra: 'Esta é a última foto! Após enviar, você poderá prosseguir para o pagamento.',
  },
];

// MOTOS (10 fotos)
export const FOTOS_AUTOVISTORIA_MOTO: FotoAutovistoria[] = [
  { 
    id: 'selfie_veiculo', 
    label: 'Selfie com a Moto ao Fundo', 
    descricao: 'Tire uma selfie com a moto aparecendo atrás de você',
    ordem: 1,
    instrucoes: [
      'Posicione-se ao lado ou à frente da moto',
      'Seu rosto deve aparecer claramente na foto',
      'A moto deve estar visível ao fundo',
      'Mantenha boa iluminação no rosto',
    ],
    evitar: [
      'Óculos escuros ou capacete',
      'Fotos muito escuras ou com flash estourado',
      'Moto cortada ou muito distante',
    ],
    dicaExtra: 'Esta foto comprova que você está presente no local da vistoria.',
  },
  { 
    id: 'frente', 
    label: 'Frente da Moto', 
    descricao: 'Foto da frente da moto, mostrando farol e placa',
    ordem: 2,
    instrucoes: [
      'Posicione-se a 1-2 metros de distância',
      'Centralize a moto na foto',
      'O farol e a placa devem estar visíveis',
      'Guidão e retrovisores aparecendo',
    ],
    evitar: [
      'Foto muito de perto ou muito longe',
      'Moto inclinada ou desequilibrada',
      'Placa ilegível',
    ],
  },
  { 
    id: 'traseira', 
    label: 'Traseira da Moto', 
    descricao: 'Foto da traseira da moto, mostrando lanterna e placa',
    ordem: 3,
    instrucoes: [
      'Posicione-se atrás da moto',
      'A placa traseira deve estar legível',
      'Lanterna e escapamento visíveis',
      'Banco e rabeta aparecendo',
    ],
    evitar: [
      'Placa ilegível',
      'Moto muito inclinada',
      'Foto desfocada',
    ],
  },
  { 
    id: 'lateral_direita', 
    label: 'Lateral Direita', 
    descricao: 'Foto da lateral direita completa da moto',
    ordem: 4,
    instrucoes: [
      'Enquadre a moto inteira',
      'Mantenha a câmera na altura do banco',
      'Mostre desde o farol até a lanterna',
      'Rodas, motor e carenagem visíveis',
    ],
    evitar: [
      'Moto cortada nas extremidades',
      'Ângulo muito inclinado',
      'Objetos na frente da moto',
    ],
  },
  { 
    id: 'lateral_esquerda', 
    label: 'Lateral Esquerda', 
    descricao: 'Foto da lateral esquerda completa da moto',
    ordem: 5,
    instrucoes: [
      'Enquadre a moto inteira',
      'Mantenha a câmera na altura do banco',
      'Mostre desde o farol até a lanterna',
      'Rodas, motor e carenagem visíveis',
    ],
    evitar: [
      'Moto cortada nas extremidades',
      'Ângulo muito inclinado',
      'Sombras fortes',
    ],
  },
  { 
    id: 'odometro', 
    label: 'Painel com Odômetro (ligado)', 
    descricao: 'Foto do painel com odômetro visível (moto ligada)',
    ordem: 6,
    instrucoes: [
      'LIGUE A MOTO antes de fotografar',
      'A quilometragem (KM) deve estar visível e legível',
      'Aproxime a câmera focando no odômetro',
      'Display bem iluminado',
    ],
    evitar: [
      'Painel apagado (moto desligada)',
      'Reflexos no painel',
      'Foto tremida ou fora de foco',
    ],
    dicaExtra: 'A quilometragem será identificada automaticamente pela nossa IA.',
  },
  { 
    id: 'chassi', 
    label: 'Número do Chassi', 
    descricao: 'Foto do número do chassi gravado na moto',
    ordem: 7,
    instrucoes: [
      'Localize o chassi (geralmente no tubo da direção)',
      'Aproxime a câmera para que TODOS os números fiquem legíveis',
      'Use flash se necessário',
      'O número deve aparecer por completo',
    ],
    evitar: [
      'Foto de longe onde não se lê os números',
      'Chassi sujo ou coberto',
      'Reflexos que atrapalhem a leitura',
    ],
    dicaExtra: 'O chassi da moto geralmente está gravado no tubo do garfo dianteiro.',
  },
  { 
    id: 'motor', 
    label: 'Motor', 
    descricao: 'Foto do motor da moto',
    ordem: 8,
    instrucoes: [
      'Fotografe o motor pelo lado',
      'Mostre o motor por inteiro',
      'Cilindro, cabeçote e cárter visíveis',
      'Boa iluminação',
    ],
    evitar: [
      'Motor muito sujo',
      'Foto escura',
      'Apenas parte do motor',
    ],
  },
  { 
    id: 'pneu_dianteiro', 
    label: 'Sola do Pneu Dianteiro', 
    descricao: 'Foto da sola do pneu dianteiro mostrando estado',
    ordem: 9,
    instrucoes: [
      'Fotografe a SOLA (banda de rodagem) do pneu',
      'Mostre os sulcos e o estado da borracha',
      'Aproxime para ver os detalhes do desgaste',
      'Abaixe-se para melhor ângulo',
    ],
    evitar: [
      'Apenas a lateral do pneu',
      'Foto de longe sem detalhes',
      'Pneu sujo demais',
    ],
  },
  { 
    id: 'pneu_traseiro', 
    label: 'Sola do Pneu Traseiro', 
    descricao: 'Foto da sola do pneu traseiro mostrando estado',
    ordem: 10,
    instrucoes: [
      'Fotografe a SOLA (banda de rodagem) do pneu',
      'Mostre os sulcos e o estado da borracha',
      'Aproxime para ver os detalhes do desgaste',
      'Abaixe-se para melhor ângulo',
    ],
    evitar: [
      'Apenas a lateral do pneu',
      'Foto de longe sem detalhes',
      'Pneu sujo demais',
    ],
    dicaExtra: 'Esta é a última foto! Após enviar, você poderá prosseguir para o pagamento.',
  },
];

// Tipos de veículo
export type TipoVeiculo = 'carro' | 'moto';

// Função para obter as fotos corretas baseado no tipo
export function getFotosAutovistoria(tipo: TipoVeiculo): FotoAutovistoria[] {
  return tipo === 'moto' ? FOTOS_AUTOVISTORIA_MOTO : FOTOS_AUTOVISTORIA_CARRO;
}

// Horários disponíveis para agendamento de vistoria (segunda a sexta)
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

// Horários disponíveis para sábado (08:00 às 13:00)
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

// Função para obter horários disponíveis baseado no dia da semana
export const getHorariosParaDia = (date: Date): string[] => {
  if (isSabado(date)) {
    return HORARIOS_SABADO;
  }
  return HORARIOS_DISPONIVEIS;
};

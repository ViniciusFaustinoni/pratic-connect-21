// Configuração das fotos obrigatórias para autovistoria
// Espelha as 31 fotos do instalador (vistoriaConfigCompleta.ts) excluindo local_rastreador

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

// CARROS (31 fotos - igual ao instalador, sem local_rastreador)
export const FOTOS_AUTOVISTORIA_CARRO: FotoAutovistoria[] = [
  // ===== 1. IDENTIFICAÇÃO E MOTOR (6 fotos) =====
  { 
    id: 'selfie_veiculo', 
    label: 'Selfie com o Veículo ao Fundo', 
    descricao: 'Tire uma selfie com o veículo aparecendo atrás de você',
    ordem: 1,
    categoria: 'identificacao_motor',
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
    id: 'chave', 
    label: 'Foto da Chave', 
    descricao: 'Fotografe a chave do veículo sobre uma superfície plana',
    ordem: 2,
    categoria: 'identificacao_motor',
    instrucoes: [
      'Coloque a chave sobre uma superfície plana e limpa',
      'Fotografe de cima mostrando a chave por inteiro',
      'Se tiver chave reserva, fotografe ambas',
      'Boa iluminação é importante',
    ],
    evitar: [
      'Chave na mão (dificulta ver detalhes)',
      'Foto desfocada',
      'Chave cortada na imagem',
    ],
  },
  { 
    id: 'chassi', 
    label: 'Número do Chassi', 
    descricao: 'Foto do número do chassi gravado no veículo (legível)',
    ordem: 3,
    categoria: 'identificacao_motor',
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
    id: 'capo_aberto_placa', 
    label: 'Capô Aberto com Placa', 
    descricao: 'Foto do veículo com capô aberto e placa visível',
    ordem: 4,
    categoria: 'identificacao_motor',
    instrucoes: [
      'Abra o capô completamente',
      'Posicione-se de frente para o veículo',
      'A placa dianteira DEVE estar legível na foto',
      'O capô aberto e a frente do carro devem aparecer',
    ],
    evitar: [
      'Placa ilegível ou cortada',
      'Foto muito de perto que corte o veículo',
      'Capô parcialmente aberto',
    ],
    dicaExtra: 'Esta foto vincula o motor ao veículo pela placa.',
  },
  { 
    id: 'motor', 
    label: 'Motor', 
    descricao: 'Foto do motor com o capô aberto',
    ordem: 5,
    categoria: 'identificacao_motor',
    instrucoes: [
      'Mantenha o capô aberto',
      'Fotografe o motor por inteiro de cima',
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
    id: 'bateria', 
    label: 'Foto da Bateria', 
    descricao: 'Foto da bateria do veículo com etiqueta visível',
    ordem: 6,
    categoria: 'identificacao_motor',
    instrucoes: [
      'Localize a bateria no compartimento do motor',
      'Fotografe a bateria de perto',
      'A etiqueta com marca e dados deve estar legível',
      'Mostre os terminais (positivo e negativo)',
    ],
    evitar: [
      'Bateria coberta por componentes',
      'Etiqueta ilegível',
      'Foto muito escura',
    ],
  },

  // ===== 2. EXTERIOR 360° (9 fotos) =====
  { 
    id: 'frente', 
    label: 'Frente do Veículo', 
    descricao: 'Foto centralizada da frente do veículo',
    ordem: 7,
    categoria: 'exterior_360',
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
    id: 'parabrisa', 
    label: 'Para-Brisa', 
    descricao: 'Foto do para-brisa mostrando adesivos e estado',
    ordem: 8,
    categoria: 'exterior_360',
    instrucoes: [
      'Fotografe o para-brisa de frente',
      'Mostre adesivos de inspeção, se houver',
      'O estado do vidro deve ser visível (trincas, etc.)',
      'Palhetas do limpador devem aparecer',
    ],
    evitar: [
      'Reflexos que impeçam ver o vidro',
      'Foto muito distante',
      'Para-brisa sujo demais',
    ],
  },
  { 
    id: 'frente_lateral_direita', 
    label: 'Frente Lateral Direita (c/ placa)', 
    descricao: 'Foto diagonal frente-direita do veículo com placa visível',
    ordem: 9,
    categoria: 'exterior_360',
    instrucoes: [
      'Posicione-se em ângulo de 45° à frente direita',
      'O veículo inteiro deve aparecer na foto',
      'A placa dianteira deve estar visível',
      'Distância de 3-4 metros',
    ],
    evitar: [
      'Veículo cortado',
      'Placa ilegível',
      'Outros veículos cobrindo a visão',
    ],
  },
  { 
    id: 'lateral_direita', 
    label: 'Lateral Direita Completa', 
    descricao: 'Foto da lateral direita completa do veículo',
    ordem: 10,
    categoria: 'exterior_360',
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
    id: 'traseira_lateral_direita', 
    label: 'Traseira Lateral Direita (c/ placa)', 
    descricao: 'Foto diagonal traseira-direita do veículo com placa visível',
    ordem: 11,
    categoria: 'exterior_360',
    instrucoes: [
      'Posicione-se em ângulo de 45° atrás à direita',
      'O veículo inteiro deve aparecer',
      'A placa traseira deve estar visível',
      'Distância de 3-4 metros',
    ],
    evitar: [
      'Veículo cortado',
      'Placa ilegível',
      'Objetos bloqueando a visão',
    ],
  },
  { 
    id: 'traseira', 
    label: 'Traseira Completa', 
    descricao: 'Foto da traseira do veículo, mostrando lanternas e placa',
    ordem: 12,
    categoria: 'exterior_360',
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
    id: 'traseira_lateral_esquerda', 
    label: 'Traseira Lateral Esquerda (c/ placa)', 
    descricao: 'Foto diagonal traseira-esquerda do veículo com placa visível',
    ordem: 13,
    categoria: 'exterior_360',
    instrucoes: [
      'Posicione-se em ângulo de 45° atrás à esquerda',
      'O veículo inteiro deve aparecer',
      'A placa traseira deve estar visível',
      'Distância de 3-4 metros',
    ],
    evitar: [
      'Veículo cortado',
      'Placa ilegível',
      'Sombras escurecendo detalhes',
    ],
  },
  { 
    id: 'lateral_esquerda', 
    label: 'Lateral Esquerda Completa', 
    descricao: 'Foto da lateral esquerda completa do veículo',
    ordem: 14,
    categoria: 'exterior_360',
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
    id: 'frente_lateral_esquerda', 
    label: 'Frente Lateral Esquerda (c/ placa)', 
    descricao: 'Foto diagonal frente-esquerda do veículo com placa visível',
    ordem: 15,
    categoria: 'exterior_360',
    instrucoes: [
      'Posicione-se em ângulo de 45° à frente esquerda',
      'O veículo inteiro deve aparecer na foto',
      'A placa dianteira deve estar visível',
      'Distância de 3-4 metros',
    ],
    evitar: [
      'Veículo cortado',
      'Placa ilegível',
      'Outros veículos cobrindo a visão',
    ],
  },

  // ===== 3. PNEUS (4 fotos) =====
  { 
    id: 'pneu_dianteiro_direito', 
    label: 'Sola do Pneu Dianteiro Direito', 
    descricao: 'Foto da sola do pneu dianteiro direito mostrando estado',
    ordem: 16,
    categoria: 'pneus',
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
    id: 'pneu_traseiro_direito', 
    label: 'Sola do Pneu Traseiro Direito', 
    descricao: 'Foto da sola do pneu traseiro direito mostrando estado',
    ordem: 17,
    categoria: 'pneus',
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
    ordem: 18,
    categoria: 'pneus',
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
    id: 'pneu_dianteiro_esquerdo', 
    label: 'Sola do Pneu Dianteiro Esquerdo', 
    descricao: 'Foto da sola do pneu dianteiro esquerdo mostrando estado',
    ordem: 19,
    categoria: 'pneus',
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

  // ===== 4. INTERIOR E ACESSÓRIOS (5 fotos) =====
  { 
    id: 'mala_aberta', 
    label: 'Mala Aberta (Porta-Malas)', 
    descricao: 'Foto do porta-malas aberto mostrando interior',
    ordem: 20,
    categoria: 'interior',
    instrucoes: [
      'Abra o porta-malas completamente',
      'Retire objetos pessoais se possível',
      'Fotografe mostrando todo o interior',
      'O tapete/forração do porta-malas deve aparecer',
    ],
    evitar: [
      'Porta-malas cheio de objetos',
      'Foto muito escura',
      'Apenas parte do porta-malas aparecendo',
    ],
  },
  { 
    id: 'estepe', 
    label: 'Estepe', 
    descricao: 'Foto do estepe (pneu reserva)',
    ordem: 21,
    categoria: 'interior',
    instrucoes: [
      'Levante o assoalho do porta-malas',
      'Fotografe o estepe de cima',
      'O estado do pneu deve ser visível',
      'Se não houver estepe, fotografe o espaço vazio',
    ],
    evitar: [
      'Estepe coberto por objetos',
      'Foto muito escura',
      'Foto desfocada',
    ],
    dicaExtra: 'Se o veículo não possui estepe (kit de reparo), fotografe o kit.',
  },
  { 
    id: 'chave_roda_macaco', 
    label: 'Chave de Roda e Macaco', 
    descricao: 'Foto da chave de roda e macaco juntos',
    ordem: 22,
    categoria: 'interior',
    instrucoes: [
      'Localize a chave de roda e o macaco',
      'Fotografe ambos juntos',
      'Os itens devem estar visíveis e identificáveis',
      'Se faltar algum, fotografe o que tiver',
    ],
    evitar: [
      'Itens sobrepostos que não se identifiquem',
      'Foto muito escura',
      'Itens parcialmente visíveis',
    ],
  },
  { 
    id: 'odometro', 
    label: 'Odômetro (Veículo Ligado)', 
    descricao: 'Foto do painel com o odômetro visível (veículo ligado)',
    ordem: 23,
    categoria: 'interior',
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
    id: 'painel_completo', 
    label: 'Painel Completo Frontal', 
    descricao: 'Foto do painel completo mostrando todos os indicadores',
    ordem: 24,
    categoria: 'interior',
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

  // ===== 5. BANCOS E FORRAÇÕES (7 fotos) =====
  { 
    id: 'banco_motorista', 
    label: 'Banco Dianteiro do Motorista', 
    descricao: 'Foto do banco do motorista mostrando estado de conservação',
    ordem: 25,
    categoria: 'bancos_forracoes',
    instrucoes: [
      'Abra a porta do motorista',
      'Fotografe o banco do motorista por completo',
      'Mostre o estado do estofado (rasgos, manchas, etc.)',
      'Boa iluminação interna',
    ],
    evitar: [
      'Foto muito escura',
      'Banco parcialmente visível',
      'Objetos sobre o banco',
    ],
  },
  { 
    id: 'banco_passageiro', 
    label: 'Banco Dianteiro do Passageiro', 
    descricao: 'Foto do banco do passageiro mostrando estado de conservação',
    ordem: 26,
    categoria: 'bancos_forracoes',
    instrucoes: [
      'Abra a porta do passageiro',
      'Fotografe o banco do passageiro por completo',
      'Mostre o estado do estofado',
      'Boa iluminação interna',
    ],
    evitar: [
      'Foto muito escura',
      'Banco parcialmente visível',
      'Objetos sobre o banco',
    ],
  },
  { 
    id: 'banco_traseiro', 
    label: 'Banco Traseiro', 
    descricao: 'Foto do banco traseiro mostrando estado de conservação',
    ordem: 27,
    categoria: 'bancos_forracoes',
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
  },
  { 
    id: 'forracao_porta_dianteira_esquerda', 
    label: 'Forração Porta Dianteira Esquerda', 
    descricao: 'Foto da forração interna da porta dianteira esquerda (motorista)',
    ordem: 28,
    categoria: 'bancos_forracoes',
    instrucoes: [
      'Abra a porta do motorista',
      'Fotografe a forração interna da porta',
      'Mostre o puxador, vidro elétrico e acabamento',
      'O estado geral deve ser visível',
    ],
    evitar: [
      'Foto muito escura',
      'Forração parcialmente visível',
      'Reflexos que atrapalhem',
    ],
  },
  { 
    id: 'forracao_porta_traseira_esquerda', 
    label: 'Forração Porta Traseira Esquerda', 
    descricao: 'Foto da forração interna da porta traseira esquerda',
    ordem: 29,
    categoria: 'bancos_forracoes',
    instrucoes: [
      'Abra a porta traseira esquerda',
      'Fotografe a forração interna da porta',
      'Mostre o acabamento e estado geral',
      'Boa iluminação',
    ],
    evitar: [
      'Foto muito escura',
      'Forração parcialmente visível',
      'Foto desfocada',
    ],
  },
  { 
    id: 'forracao_porta_traseira_direita', 
    label: 'Forração Porta Traseira Direita', 
    descricao: 'Foto da forração interna da porta traseira direita',
    ordem: 30,
    categoria: 'bancos_forracoes',
    instrucoes: [
      'Abra a porta traseira direita',
      'Fotografe a forração interna da porta',
      'Mostre o acabamento e estado geral',
      'Boa iluminação',
    ],
    evitar: [
      'Foto muito escura',
      'Forração parcialmente visível',
      'Foto desfocada',
    ],
  },
  { 
    id: 'forracao_porta_dianteira_direita', 
    label: 'Forração Porta Dianteira Direita', 
    descricao: 'Foto da forração interna da porta dianteira direita (passageiro)',
    ordem: 31,
    categoria: 'bancos_forracoes',
    instrucoes: [
      'Abra a porta do passageiro',
      'Fotografe a forração interna da porta',
      'Mostre o puxador, vidro elétrico e acabamento',
      'O estado geral deve ser visível',
    ],
    evitar: [
      'Foto muito escura',
      'Forração parcialmente visível',
      'Reflexos que atrapalhem',
    ],
    dicaExtra: 'Esta é a última foto! Após enviar, grave o vídeo 360° para concluir.',
  },
];

// MOTOS (7 fotos)
export const FOTOS_AUTOVISTORIA_MOTO: FotoAutovistoria[] = [
  { 
    id: 'frente', 
    label: 'Frente da Moto', 
    descricao: 'Foto da frente da moto, mostrando farol e placa',
    ordem: 1,
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
    ordem: 2,
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
    ordem: 3,
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
      'Sombras fortes',
    ],
  },
  { 
    id: 'painel_km', 
    label: 'Painel com KM visível', 
    descricao: 'Foto do painel com quilometragem visível (moto ligada)',
    ordem: 5,
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
    id: 'motor_chassi', 
    label: 'Motor / Chassi visível', 
    descricao: 'Foto do motor com o chassi visível',
    ordem: 6,
    instrucoes: [
      'Fotografe o motor mostrando o número do chassi',
      'O chassi geralmente está no tubo do garfo dianteiro',
      'Os números devem estar legíveis',
      'Boa iluminação é essencial',
    ],
    evitar: [
      'Motor muito sujo que esconda detalhes',
      'Chassi ilegível',
      'Foto escura ou desfocada',
    ],
    dicaExtra: 'O chassi da moto geralmente está gravado no tubo do garfo dianteiro.',
  },
  { 
    id: 'avarias', 
    label: 'Avarias (se houver)', 
    descricao: 'Fotografe qualquer avaria existente na moto',
    ordem: 7,
    instrucoes: [
      'Fotografe cada avaria de perto',
      'Mostre riscos, amassados ou peças quebradas',
      'Se não houver avarias, tire uma foto geral da moto',
      'Descreva a avaria ao enviar',
    ],
    evitar: [
      'Fotos de longe onde não se vê o dano',
      'Foto desfocada',
      'Ignorar avarias existentes',
    ],
    dicaExtra: 'Toda avaria deve ser fotografada e descrita. Se não houver, registre uma foto geral.',
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

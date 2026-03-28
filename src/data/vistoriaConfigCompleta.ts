import { 
  User, 
  Key, 
  Hash, 
  Wrench, 
  Settings, 
  Battery, 
  ArrowUp, 
  Square, 
  ArrowUpRight, 
  Circle, 
  ArrowRight, 
  ArrowDownRight, 
  ArrowDown, 
  Briefcase, 
  ArrowDownLeft, 
  ArrowLeft, 
  ArrowUpLeft, 
  Gauge, 
  LayoutDashboard,
  Armchair,
  DoorOpen,
  LucideIcon,
  MapPin
} from 'lucide-react';

export type TipoVeiculo = 'automovel' | 'moto';

export interface VistoriaFotoConfig {
  id: string;
  nome: string;
  icone: LucideIcon;
  categoria: string;
  ordem: number;
  visivelCliente?: boolean; // default true
  descricao?: string;
  instrucoes?: string[];
  evitar?: string[];
  dicaExtra?: string;
}

export interface VistoriaCategoriaConfig {
  id: string;
  nome: string;
  ordem: number;
  descricao?: string;
}

// =============================================
// CONFIGURAÇÃO PARA AUTOMÓVEIS (31 fotos + vídeo)
// =============================================

export const CATEGORIAS_VISTORIA_COMPLETA: VistoriaCategoriaConfig[] = [
  { id: 'identificacao_motor', nome: 'Identificação e Motor', ordem: 1, descricao: '6 fotos' },
  { id: 'exterior_360', nome: 'Exterior 360°', ordem: 2, descricao: '9 fotos - Giro completo' },
  { id: 'pneus', nome: 'Pneus', ordem: 3, descricao: '4 fotos - Sola dos pneus' },
  { id: 'interior', nome: 'Interior e Acessórios', ordem: 4, descricao: '5 fotos' },
  { id: 'bancos_forracoes', nome: 'Bancos e Forrações', ordem: 5, descricao: '7 fotos' },
  { id: 'instalacao', nome: 'Instalação', ordem: 6, descricao: 'Local do rastreador (oculto do cliente)' },
];

export const FOTOS_VISTORIA_COMPLETA: VistoriaFotoConfig[] = [
  // 1. Identificação e Motor (6 fotos)
  { 
    id: 'vistoriador_selfie', 
    nome: 'Selfie do Vistoriador (veículo ao fundo)', 
    icone: User, 
    categoria: 'identificacao_motor', 
    ordem: 1,
    descricao: 'Foto do vistoriador com o veículo visível atrás',
    instrucoes: [
      'Posicione-se a cerca de 2 metros do veículo',
      'O veículo deve aparecer ao fundo, de preferência mostrando a placa',
      'Fique de frente para a câmera, rosto bem visível',
      'Boa iluminação no rosto e no veículo',
    ],
    evitar: [
      'Selfie close-up sem o veículo ao fundo',
      'Fundo escuro ou contraluz forte',
      'Veículo cortado na foto',
    ],
  },
  { 
    id: 'chave', 
    nome: 'Foto da Chave', 
    icone: Key, 
    categoria: 'identificacao_motor', 
    ordem: 2,
    descricao: 'Chave do veículo em destaque',
    instrucoes: [
      'Segure a chave na mão ou coloque sobre superfície lisa',
      'A chave deve estar inteira e nítida na foto',
      'Se houver controle, mostre também',
    ],
    evitar: [
      'Foto desfocada',
      'Chave parcialmente visível',
    ],
  },
  { 
    id: 'chassi', 
    nome: 'Chassi (Legível)', 
    icone: Hash, 
    categoria: 'identificacao_motor', 
    ordem: 3,
    descricao: 'Numeração do chassi gravada no veículo',
    instrucoes: [
      'Localize a plaqueta do chassi (geralmente embaixo do para-brisa ou na coluna da porta)',
      'Aproxime a câmera até que todos os números estejam legíveis',
      'Use a lanterna do celular se necessário para melhor visualização',
    ],
    evitar: [
      'Foto de longe onde os números não aparecem',
      'Reflexo que impeça a leitura',
      'Foto tremida ou desfocada',
    ],
    dicaExtra: 'Em carros, o chassi fica no canto inferior do para-brisa (lado esquerdo) ou na coluna da porta do motorista.',
  },
  { 
    id: 'capo_aberto_placa', 
    nome: 'Capô Aberto com Placa', 
    icone: Wrench, 
    categoria: 'identificacao_motor', 
    ordem: 4,
    descricao: 'Capô totalmente aberto com a placa do veículo visível',
    instrucoes: [
      'Abra o capô completamente',
      'Posicione-se a 2-3 metros na frente do veículo',
      'A placa frontal deve estar legível na foto',
      'O motor deve aparecer com o capô aberto',
    ],
    evitar: [
      'Capô semi-aberto',
      'Placa ilegível ou cortada',
      'Foto muito de cima (ângulo ruim)',
    ],
  },
  { 
    id: 'motor', 
    nome: 'Motor', 
    icone: Settings, 
    categoria: 'identificacao_motor', 
    ordem: 5,
    descricao: 'Foto do motor do veículo',
    instrucoes: [
      'Com o capô aberto, fotografe o motor de cima',
      'O motor inteiro deve estar visível na foto',
      'Boa iluminação para identificar componentes',
    ],
    evitar: [
      'Foto escura sem detalhes visíveis',
      'Motor parcialmente coberto',
    ],
  },
  { 
    id: 'bateria', 
    nome: 'Foto da Bateria', 
    icone: Battery, 
    categoria: 'identificacao_motor', 
    ordem: 6,
    descricao: 'Bateria do veículo com etiqueta visível',
    instrucoes: [
      'Localize a bateria no compartimento do motor',
      'Fotografe de perto, mostrando a etiqueta/marca',
      'Se possível, mostre o estado dos polos (terminais)',
    ],
    evitar: [
      'Foto de longe onde não se vê a bateria',
      'Bateria coberta por outros componentes na foto',
    ],
  },

  // 2. Exterior 360° (9 fotos) - Em vídeo também
  { 
    id: 'frente', 
    nome: 'Frente', 
    icone: ArrowUp, 
    categoria: 'exterior_360', 
    ordem: 7,
    descricao: 'Parte frontal completa do veículo',
    instrucoes: [
      'Posicione-se a 3-4 metros de distância, bem centralizado na frente',
      'O veículo inteiro deve aparecer de ponta a ponta (para-choques completos)',
      'A placa frontal deve estar legível',
      'Tire a foto na altura do para-choque (não de cima)',
    ],
    evitar: [
      'Veículo cortado nas laterais',
      'Foto de muito longe ou muito perto',
      'Contraluz forte (sol atrás do veículo)',
    ],
  },
  { 
    id: 'parabrisa', 
    nome: 'Para-Brisa', 
    icone: Square, 
    categoria: 'exterior_360', 
    ordem: 8,
    descricao: 'Para-brisa dianteiro completo',
    instrucoes: [
      'Fotografe o para-brisa inteiro, incluindo as bordas',
      'Mostre se há trincas, lascas ou avarias',
      'A foto deve ser tirada de fora do veículo',
    ],
    evitar: [
      'Reflexo excessivo que impeça ver o vidro',
      'Foto parcial do para-brisa',
    ],
    dicaExtra: 'Se houver trinca ou avaria no vidro, tire uma foto adicional aproximada do defeito.',
  },
  { 
    id: 'frente_lateral_direita', 
    nome: 'Frente Lateral Direita (c/ placa)', 
    icone: ArrowUpRight, 
    categoria: 'exterior_360', 
    ordem: 9,
    descricao: 'Diagonal frontal direita com placa visível',
    instrucoes: [
      'Posicione-se na diagonal frontal direita, a 3-4 metros',
      'O veículo inteiro deve aparecer neste ângulo',
      'A placa deve estar visível e legível',
    ],
    evitar: [
      'Placa ilegível ou cortada',
      'Veículo cortado na foto',
      'Foto muito de cima ou de baixo',
    ],
  },
  { 
    id: 'lateral_direita', 
    nome: 'Lateral Direita completa', 
    icone: ArrowRight, 
    categoria: 'exterior_360', 
    ordem: 10,
    descricao: 'Lado direito completo do veículo',
    instrucoes: [
      'Posicione-se bem no centro do lado direito, a 3-4 metros',
      'O veículo deve aparecer inteiro, do para-choque dianteiro ao traseiro',
      'Tire a foto na altura da metade do veículo',
    ],
    evitar: [
      'Veículo cortado na frente ou atrás',
      'Foto inclinada ou torta',
      'Obstruções (outros carros, objetos) cobrindo o veículo',
    ],
  },
  { 
    id: 'traseira_lateral_direita', 
    nome: 'Traseira Lateral Direita (c/ placa)', 
    icone: ArrowDownRight, 
    categoria: 'exterior_360', 
    ordem: 11,
    descricao: 'Diagonal traseira direita com placa visível',
    instrucoes: [
      'Posicione-se na diagonal traseira direita, a 3-4 metros',
      'A placa traseira deve estar legível',
      'O veículo inteiro deve aparecer',
    ],
    evitar: [
      'Placa cortada ou ilegível',
      'Foto muito distante',
    ],
  },
  { 
    id: 'traseira', 
    nome: 'Traseira completa', 
    icone: ArrowDown, 
    categoria: 'exterior_360', 
    ordem: 12,
    descricao: 'Parte traseira completa do veículo',
    instrucoes: [
      'Posicione-se centralizado atrás do veículo, a 3-4 metros',
      'O veículo inteiro deve aparecer',
      'A placa traseira deve estar legível',
      'Tire na altura do para-choque traseiro',
    ],
    evitar: [
      'Veículo cortado nas laterais',
      'Placa ilegível',
      'Contraluz',
    ],
  },
  { 
    id: 'traseira_lateral_esquerda', 
    nome: 'Traseira Lateral Esquerda (c/ placa)', 
    icone: ArrowDownLeft, 
    categoria: 'exterior_360', 
    ordem: 13,
    descricao: 'Diagonal traseira esquerda com placa visível',
    instrucoes: [
      'Posicione-se na diagonal traseira esquerda, a 3-4 metros',
      'A placa traseira deve estar legível',
      'O veículo inteiro deve aparecer',
    ],
    evitar: [
      'Placa ilegível ou cortada',
      'Foto de muito longe',
    ],
  },
  { 
    id: 'lateral_esquerda', 
    nome: 'Lateral Esquerda completa', 
    icone: ArrowLeft, 
    categoria: 'exterior_360', 
    ordem: 14,
    descricao: 'Lado esquerdo completo do veículo',
    instrucoes: [
      'Posicione-se bem no centro do lado esquerdo, a 3-4 metros',
      'O veículo deve aparecer inteiro',
      'Tire a foto na altura da metade do veículo',
    ],
    evitar: [
      'Veículo cortado na frente ou atrás',
      'Obstruções cobrindo o veículo',
    ],
  },
  { 
    id: 'frente_lateral_esquerda', 
    nome: 'Frente Lateral Esquerda (c/ placa)', 
    icone: ArrowUpLeft, 
    categoria: 'exterior_360', 
    ordem: 15,
    descricao: 'Diagonal frontal esquerda com placa visível',
    instrucoes: [
      'Posicione-se na diagonal frontal esquerda, a 3-4 metros',
      'A placa deve estar visível e legível',
      'O veículo inteiro deve aparecer',
    ],
    evitar: [
      'Placa ilegível',
      'Veículo cortado',
    ],
  },

  // 3. Pneus (4 fotos)
  { 
    id: 'pneu_dianteiro_direito', 
    nome: 'Sola do Pneu dianteiro direito', 
    icone: Circle, 
    categoria: 'pneus', 
    ordem: 16,
    descricao: 'Banda de rodagem do pneu dianteiro direito',
    instrucoes: [
      'Aproxime a câmera da banda de rodagem (parte que encosta no chão)',
      'O sulco do pneu deve estar nítido e visível',
      'Se possível, coloque um objeto (moeda, caneta) para referência de profundidade',
    ],
    evitar: [
      'Foto do pneu inteiro sem detalhe da sola',
      'Foto desfocada ou escura',
      'Pneu com lama cobrindo os sulcos',
    ],
    dicaExtra: 'Se o pneu estiver careca ou com desgaste irregular, registre bem essa condição.',
  },
  { 
    id: 'pneu_traseiro_direito', 
    nome: 'Sola do Pneu traseiro direito', 
    icone: Circle, 
    categoria: 'pneus', 
    ordem: 17,
    descricao: 'Banda de rodagem do pneu traseiro direito',
    instrucoes: [
      'Aproxime a câmera da banda de rodagem',
      'O sulco do pneu deve estar nítido e visível',
    ],
    evitar: [
      'Foto do pneu inteiro sem detalhe da sola',
      'Foto desfocada',
    ],
  },
  { 
    id: 'pneu_traseiro_esquerdo', 
    nome: 'Sola do Pneu traseiro esquerdo', 
    icone: Circle, 
    categoria: 'pneus', 
    ordem: 18,
    descricao: 'Banda de rodagem do pneu traseiro esquerdo',
    instrucoes: [
      'Aproxime a câmera da banda de rodagem',
      'O sulco do pneu deve estar nítido e visível',
    ],
    evitar: [
      'Foto do pneu inteiro sem detalhe da sola',
      'Foto desfocada',
    ],
  },
  { 
    id: 'pneu_dianteiro_esquerdo', 
    nome: 'Sola do Pneu dianteiro esquerdo', 
    icone: Circle, 
    categoria: 'pneus', 
    ordem: 19,
    descricao: 'Banda de rodagem do pneu dianteiro esquerdo',
    instrucoes: [
      'Aproxime a câmera da banda de rodagem',
      'O sulco do pneu deve estar nítido e visível',
    ],
    evitar: [
      'Foto do pneu inteiro sem detalhe da sola',
      'Foto desfocada',
    ],
  },

  // 4. Interior e Acessórios (5 fotos)
  { 
    id: 'mala_aberta', 
    nome: 'Foto com a Mala aberta', 
    icone: Briefcase, 
    categoria: 'interior', 
    ordem: 20,
    descricao: 'Porta-malas aberto mostrando interior completo',
    instrucoes: [
      'Abra o porta-malas completamente',
      'Fotografe o interior de frente, a cerca de 1,5 metros',
      'O interior todo deve ser visível (forro, chão)',
    ],
    evitar: [
      'Porta-malas cheio de objetos que escondam o interior',
      'Foto de muito perto sem contexto',
    ],
  },
  { 
    id: 'estepe', 
    nome: 'Estepe', 
    icone: Circle, 
    categoria: 'interior', 
    ordem: 21,
    descricao: 'Pneu estepe do veículo',
    instrucoes: [
      'Localize o estepe (geralmente no porta-malas ou embaixo do veículo)',
      'Fotografe mostrando o estepe inteiro e seu estado',
      'Se não houver estepe, tire foto do local vazio',
    ],
    evitar: [
      'Foto escura sem detalhes',
    ],
    dicaExtra: 'Se o veículo não possuir estepe, registre isso na observação.',
  },
  { 
    id: 'chave_roda_macaco', 
    nome: 'Chave de Roda e Macaco', 
    icone: Wrench, 
    categoria: 'interior', 
    ordem: 22,
    descricao: 'Kit de ferramentas: chave de roda e macaco',
    instrucoes: [
      'Localize a chave de roda e o macaco',
      'Fotografe ambos juntos, de preferência lado a lado',
      'Se não houver, tire foto do compartimento vazio',
    ],
    evitar: [
      'Foto sem os itens identificáveis',
    ],
  },
  { 
    id: 'odometro', 
    nome: 'Odômetro (Painel ligado)', 
    icone: Gauge, 
    categoria: 'interior', 
    ordem: 23,
    descricao: 'Painel do veículo ligado mostrando quilometragem',
    instrucoes: [
      'LIGUE o veículo antes de tirar a foto',
      'Aproxime a câmera até o hodômetro estar completamente legível',
      'A quilometragem (KM) deve estar nítida e sem reflexo',
      'Se for digital, espere estabilizar antes de fotografar',
    ],
    evitar: [
      'Reflexo na tela ou vidro do painel',
      'Veículo desligado (painel apagado)',
      'Foto tremida ou desfocada',
      'Foto de longe onde não se lê o KM',
    ],
    dicaExtra: '⚠️ O veículo PRECISA estar LIGADO! A quilometragem será lida automaticamente pela IA.',
  },
  { 
    id: 'painel_completo', 
    nome: 'Painel Completo Frontal', 
    icone: LayoutDashboard, 
    categoria: 'interior', 
    ordem: 24,
    descricao: 'Visão geral do painel/interior frontal',
    instrucoes: [
      'Fotografe de dentro do banco traseiro ou da porta do motorista',
      'Todo o painel frontal deve aparecer (volante, central, ar-condicionado)',
      'O veículo deve estar ligado para mostrar luzes do painel',
    ],
    evitar: [
      'Foto muito de perto mostrando só uma parte',
      'Foto escura demais',
    ],
  },

  // 5. Bancos e Forrações (7 fotos)
  { 
    id: 'banco_motorista', 
    nome: 'Banco dianteiro do motorista', 
    icone: Armchair, 
    categoria: 'bancos_forracoes', 
    ordem: 25,
    descricao: 'Banco do motorista em detalhe',
    instrucoes: [
      'Abra a porta do motorista',
      'Fotografe o banco inteiro, mostrando assento e encosto',
      'Registre estado do estofamento (rasgos, manchas, desgaste)',
    ],
    evitar: [
      'Foto cortada do banco',
      'Banco coberto por objetos',
    ],
  },
  { 
    id: 'banco_passageiro', 
    nome: 'Banco dianteiro do passageiro', 
    icone: Armchair, 
    categoria: 'bancos_forracoes', 
    ordem: 26,
    descricao: 'Banco do passageiro em detalhe',
    instrucoes: [
      'Abra a porta do passageiro',
      'Fotografe o banco inteiro, mostrando assento e encosto',
      'Registre estado do estofamento',
    ],
    evitar: [
      'Foto cortada do banco',
      'Banco coberto por objetos',
    ],
  },
  { 
    id: 'banco_traseiro', 
    nome: 'Banco traseiro', 
    icone: Armchair, 
    categoria: 'bancos_forracoes', 
    ordem: 27,
    descricao: 'Banco traseiro completo',
    instrucoes: [
      'Abra a porta traseira',
      'Fotografe o banco traseiro inteiro',
      'Mostre o estado do estofamento',
    ],
    evitar: [
      'Foto de muito perto sem visão geral',
      'Objetos cobrindo o banco',
    ],
  },
  { 
    id: 'forracao_porta_dianteira_esquerda', 
    nome: 'Forração de porta dianteira esquerda', 
    icone: DoorOpen, 
    categoria: 'bancos_forracoes', 
    ordem: 28,
    descricao: 'Interior da porta dianteira esquerda (motorista)',
    instrucoes: [
      'Abra a porta do motorista',
      'Fotografe o revestimento interno da porta',
      'Mostre maçaneta, vidro elétrico e acabamentos',
    ],
    evitar: [
      'Foto escura sem detalhes',
      'Porta fechada ou semi-aberta',
    ],
  },
  { 
    id: 'forracao_porta_traseira_esquerda', 
    nome: 'Forração de porta traseira esquerda', 
    icone: DoorOpen, 
    categoria: 'bancos_forracoes', 
    ordem: 29,
    descricao: 'Interior da porta traseira esquerda',
    instrucoes: [
      'Abra a porta traseira esquerda',
      'Fotografe o revestimento interno da porta',
    ],
    evitar: [
      'Foto escura ou desfocada',
    ],
  },
  { 
    id: 'forracao_porta_traseira_direita', 
    nome: 'Forração de porta traseira direita', 
    icone: DoorOpen, 
    categoria: 'bancos_forracoes', 
    ordem: 30,
    descricao: 'Interior da porta traseira direita',
    instrucoes: [
      'Abra a porta traseira direita',
      'Fotografe o revestimento interno da porta',
    ],
    evitar: [
      'Foto escura ou desfocada',
    ],
  },
  { 
    id: 'forracao_porta_dianteira_direita', 
    nome: 'Forração de porta dianteira direita', 
    icone: DoorOpen, 
    categoria: 'bancos_forracoes', 
    ordem: 31,
    descricao: 'Interior da porta dianteira direita (passageiro)',
    instrucoes: [
      'Abra a porta do passageiro',
      'Fotografe o revestimento interno da porta',
      'Mostre maçaneta, vidro elétrico e acabamentos',
    ],
    evitar: [
      'Foto escura ou desfocada',
    ],
  },

  // 6. Instalação (1 foto - OCULTA DO CLIENTE)
  { 
    id: 'local_rastreador', 
    nome: 'Local de Instalação do Rastreador', 
    icone: MapPin, 
    categoria: 'instalacao', 
    ordem: 32, 
    visivelCliente: false,
    descricao: 'Foto do local onde o rastreador foi instalado',
    instrucoes: [
      'Fotografe o rastreador já instalado no local definitivo',
      'A foto deve mostrar claramente onde o dispositivo está',
      'Certifique-se que o rastreador está bem fixo antes de fotografar',
    ],
    evitar: [
      'Foto que revele claramente o local para terceiros',
      'Rastreador solto ou mal posicionado',
    ],
  },
];

// =============================================
// CONFIGURAÇÃO PARA MOTOS (12 fotos + vídeo)
// =============================================

export const CATEGORIAS_VISTORIA_MOTO: VistoriaCategoriaConfig[] = [
  { id: 'veiculo', nome: 'Fotos do Veículo (Refazer)', ordem: 1, descricao: '7 fotos - Mesmas da autovistoria' },
  { id: 'rastreador', nome: 'Fotos Técnicas do Rastreador', ordem: 2, descricao: '3 fotos' },
];

export const FOTOS_VISTORIA_MOTO: VistoriaFotoConfig[] = [
  // 1. Fotos do veículo - refazer todas da autovistoria (7 fotos)
  { 
    id: 'frente', 
    nome: 'Frente', 
    icone: ArrowUp, 
    categoria: 'veiculo', 
    ordem: 1,
    descricao: 'Parte frontal completa da moto',
    instrucoes: [
      'Posicione-se a 2-3 metros de distância, bem centralizado na frente',
      'A moto inteira deve aparecer, do guidão à roda dianteira',
      'A placa (se frontal) deve estar legível',
    ],
    evitar: [
      'Moto cortada na foto',
      'Contraluz forte',
    ],
  },
  { 
    id: 'traseira', 
    nome: 'Traseira', 
    icone: ArrowDown, 
    categoria: 'veiculo', 
    ordem: 2,
    descricao: 'Parte traseira completa da moto',
    instrucoes: [
      'Posicione-se a 2-3 metros, centralizado atrás da moto',
      'A placa traseira deve estar legível',
      'Rabeta e lanternas visíveis',
    ],
    evitar: [
      'Placa ilegível',
      'Moto cortada',
    ],
  },
  { 
    id: 'lateral_direita', 
    nome: 'Lateral Direita', 
    icone: ArrowRight, 
    categoria: 'veiculo', 
    ordem: 3,
    descricao: 'Lado direito completo da moto',
    instrucoes: [
      'Posicione-se a 2-3 metros no lado direito',
      'A moto inteira deve aparecer de ponta a ponta',
      'Tire na altura do assento',
    ],
    evitar: [
      'Moto cortada nas extremidades',
      'Obstruções na frente',
    ],
  },
  { 
    id: 'lateral_esquerda', 
    nome: 'Lateral Esquerda', 
    icone: ArrowLeft, 
    categoria: 'veiculo', 
    ordem: 4,
    descricao: 'Lado esquerdo completo da moto',
    instrucoes: [
      'Posicione-se a 2-3 metros no lado esquerdo',
      'A moto inteira deve aparecer',
    ],
    evitar: [
      'Moto cortada',
      'Obstruções',
    ],
  },
  { 
    id: 'painel_km', 
    nome: 'Painel com KM atual', 
    icone: Gauge, 
    categoria: 'veiculo', 
    ordem: 5,
    descricao: 'Painel da moto ligada mostrando quilometragem',
    instrucoes: [
      'LIGUE a moto antes de tirar a foto',
      'Aproxime a câmera até a quilometragem estar completamente legível',
      'Sem reflexo no visor',
    ],
    evitar: [
      'Moto desligada (painel apagado)',
      'Reflexo que impeça leitura',
      'Foto tremida',
    ],
    dicaExtra: '⚠️ A moto PRECISA estar LIGADA para o painel mostrar a quilometragem!',
  },
  { 
    id: 'motor_chassi', 
    nome: 'Motor / Chassi', 
    icone: Settings, 
    categoria: 'veiculo', 
    ordem: 6,
    descricao: 'Motor e número do chassi da moto',
    instrucoes: [
      'Fotografe o motor mostrando a numeração do chassi',
      'O número deve estar legível na foto',
      'Use lanterna se necessário',
    ],
    evitar: [
      'Numeração ilegível',
      'Foto de longe',
    ],
    dicaExtra: 'O chassi da moto geralmente fica gravado no cabeçote (pescoço) da moto.',
  },
  { 
    id: 'avarias', 
    nome: 'Avarias novas (se houver)', 
    icone: Wrench, 
    categoria: 'veiculo', 
    ordem: 7,
    descricao: 'Registre qualquer avaria, risco ou dano na moto',
    instrucoes: [
      'Se houver avarias, tire fotos aproximadas de cada uma',
      'Se NÃO houver avarias, tire uma foto geral mostrando bom estado',
      'Foque em riscos, amassados, peças quebradas ou faltantes',
    ],
    evitar: [
      'Ignorar avarias existentes',
    ],
    dicaExtra: 'Se não houver avarias, uma foto geral da moto em bom estado é suficiente.',
  },

  // 2. Fotos técnicas do rastreador (3 fotos)
  { 
    id: 'local_rastreador', 
    nome: 'Local exato da instalação', 
    icone: MapPin, 
    categoria: 'rastreador', 
    ordem: 8, 
    visivelCliente: false,
    descricao: 'Local onde o rastreador foi instalado na moto',
    instrucoes: [
      'Fotografe o rastreador já instalado no local definitivo',
      'Mostre a fixação e o posicionamento do dispositivo',
    ],
    evitar: [
      'Rastreador solto ou mal fixado',
    ],
  },
  { 
    id: 'codigo_rastreador', 
    nome: 'Código do rastreador visível', 
    icone: Hash, 
    categoria: 'rastreador', 
    ordem: 9, 
    visivelCliente: false,
    descricao: 'Código/IMEI do rastreador legível',
    instrucoes: [
      'Fotografe a etiqueta com o código/IMEI do rastreador',
      'O número deve estar completamente legível',
      'Aproxime o suficiente para ler todos os dígitos',
    ],
    evitar: [
      'Código cortado ou ilegível',
      'Foto desfocada',
    ],
  },
  { 
    id: 'teste_comunicacao', 
    nome: 'Teste de comunicação (online)', 
    icone: Settings, 
    categoria: 'rastreador', 
    ordem: 10, 
    visivelCliente: false,
    descricao: 'Print/foto mostrando o rastreador online na plataforma',
    instrucoes: [
      'Abra a plataforma de rastreamento no celular ou computador',
      'Verifique se o rastreador está mostrando como ONLINE',
      'Tire um print/foto da tela mostrando status online',
    ],
    evitar: [
      'Rastreador offline na foto',
      'Tela ilegível',
    ],
    dicaExtra: 'Aguarde alguns minutos após a instalação para o rastreador conectar à rede.',
  },
];

// =============================================
// FUNÇÕES HELPER PARA TIPO DE VEÍCULO
// =============================================

// Obter categorias por tipo de veículo
export function getCategoriasByTipoVeiculo(tipo: TipoVeiculo): VistoriaCategoriaConfig[] {
  return tipo === 'moto' ? CATEGORIAS_VISTORIA_MOTO : CATEGORIAS_VISTORIA_COMPLETA;
}

// Obter fotos por tipo de veículo
export function getFotosByTipoVeiculo(tipo: TipoVeiculo): VistoriaFotoConfig[] {
  return tipo === 'moto' ? FOTOS_VISTORIA_MOTO : FOTOS_VISTORIA_COMPLETA;
}

// Agrupar fotos por categoria (dinâmico por tipo)
export function agruparFotosPorCategoriaCompleta(tipo: TipoVeiculo = 'automovel') {
  const categorias = getCategoriasByTipoVeiculo(tipo);
  const fotos = getFotosByTipoVeiculo(tipo);
  return categorias.map(categoria => ({
    ...categoria,
    fotos: fotos.filter(foto => foto.categoria === categoria.id).sort((a, b) => a.ordem - b.ordem),
  }));
}

// Total de fotos obrigatórias (por tipo)
export function getTotalFotosObrigatorias(tipo: TipoVeiculo): number {
  const fotos = getFotosByTipoVeiculo(tipo);
  return fotos.filter(f => f.categoria !== 'instalacao' && f.categoria !== 'rastreador').length;
}

// Keywords que indicam motocicleta no modelo
const MOTO_KEYWORDS = [
  'moto', 'motocicleta', 'ciclomotor', 'triciclo', 'scooter',
  'nxr', 'bros', 'cg ', 'cg-', 'cb ', 'cb-', 'cbr', 'pcx', 'biz', 'pop',
  'titan', 'fan', 'xre', 'lander', 'tenere', 'crosser', 'fazer', 'ybr',
  'neo', 'fluo', 'burgman', 'intruder', 'yes', 'gsr', 'v-strom', 'factor',
  'dl ', 'crf', 'sahara', 'twister', 'hornet', 'africa twin', 'ninja',
  'z900', 'z800', 'z750', 'z400', 'versys', 'vulcan', 'next', ' riva',
  'citycom', 'maxsym', 'boulevard', 'bandit', 'hayabusa', 'gsxr', 'gsx',
  'elite', 'adv', 'sh ', 'sh-', 'lead', 'xadv', 'x-adv', 'transalp',
  'nmax', 'xtz', 'xj6', 'mt-', 'mt ', 'crypton',
  'duke', 'apache', 'jet', 'kansas', 'mirage', 'horizon',
];

// Detectar tipo de veículo — FALLBACK síncrono apenas por keywords de modelo.
export function detectarTipoVeiculo(
  tipoVeiculoStr?: string | null,
  modelo?: string | null,
  _marca?: string | null
): TipoVeiculo {
  if (tipoVeiculoStr) {
    const normalized = tipoVeiculoStr.toLowerCase();
    if (normalized.includes('moto') || normalized.includes('motocicleta') || normalized.includes('ciclomotor') || normalized.includes('triciclo')) {
      return 'moto';
    }
  }

  if (modelo) {
    const modeloLower = ` ${modelo.toLowerCase()} `;
    if (MOTO_KEYWORDS.some(kw => modeloLower.includes(kw))) {
      return 'moto';
    }
  }

  return 'automovel';
}

// =============================================
// FUNÇÕES PARA FILTRAR RASTREADOR/INSTALAÇÃO
// =============================================

export function getCategoriasFiltradas(
  tipo: TipoVeiculo, 
  incluirInstalacao: boolean
): VistoriaCategoriaConfig[] {
  const categorias = getCategoriasByTipoVeiculo(tipo);
  if (!incluirInstalacao) {
    return categorias.filter(c => c.id !== 'instalacao' && c.id !== 'rastreador');
  }
  return categorias;
}

export function getFotosFiltradas(
  tipo: TipoVeiculo,
  incluirInstalacao: boolean
): VistoriaFotoConfig[] {
  const fotos = getFotosByTipoVeiculo(tipo);
  if (!incluirInstalacao) {
    return fotos.filter(f => f.categoria !== 'instalacao' && f.categoria !== 'rastreador');
  }
  return fotos;
}

export function agruparFotosFiltradas(tipo: TipoVeiculo, incluirInstalacao: boolean) {
  const categorias = getCategoriasFiltradas(tipo, incluirInstalacao);
  const fotos = getFotosFiltradas(tipo, incluirInstalacao);
  return categorias.map(categoria => ({
    ...categoria,
    fotos: fotos.filter(foto => foto.categoria === categoria.id).sort((a, b) => a.ordem - b.ordem),
  }));
}

// Constantes legadas para compatibilidade
export const TOTAL_FOTOS_OBRIGATORIAS = FOTOS_VISTORIA_COMPLETA.filter(f => f.categoria !== 'instalacao').length;
export const IDS_FOTOS_OBRIGATORIAS = FOTOS_VISTORIA_COMPLETA.filter(f => f.categoria !== 'instalacao').map(f => f.id);

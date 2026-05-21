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
  Sun,
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
  opcional?: boolean; // default false — quando true, não bloqueia a finalização
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
// FEATURE FLAG POR DATA — ROTEIRO V2
// =============================================
//
// Vistorias criadas a partir deste timestamp usam o roteiro V2
// (reorganização carro + 5 fotos novas na moto, motor_chassi desmembrado).
// Vistorias mais antigas usam o LEGACY (snapshot congelado) — preserva
// laudos históricos, alinhamento de IDs em vistoria_fotos antigas e
// `motor_chassi` reconhecido por aliases.
//
// Helper canônico: passe sempre `criadoEm` (vistoria.created_at ou
// cotacao.created_at). Quando ausente → assume V2 (vistoria nova).
export const VISTORIA_ROTEIRO_V2_AT = '2026-05-21T00:00:00Z';

function usarRoteiroV2(criadoEm?: string): boolean {
  if (!criadoEm) return true;
  try {
    return new Date(criadoEm).getTime() >= new Date(VISTORIA_ROTEIRO_V2_AT).getTime();
  } catch {
    return true;
  }
}

// =============================================
// CATEGORIAS — CARRO
// =============================================

// LEGACY: categorias originais (roteiro + instalacao)
const CATEGORIAS_VISTORIA_COMPLETA_LEGACY: VistoriaCategoriaConfig[] = [
  { id: 'roteiro', nome: 'Roteiro de Fotos', ordem: 1, descricao: '31 fotos - Sequência horária contínua' },
  { id: 'instalacao', nome: 'Instalação', ordem: 2, descricao: 'Local do rastreador (oculto do cliente)' },
];

// V2: identificação → motor compartimento → volta externa → porta-malas → bancos/forrações → operacionais → instalação
const CATEGORIAS_VISTORIA_COMPLETA_V2: VistoriaCategoriaConfig[] = [
  { id: 'identificacao', nome: '1. Identificação Inicial', ordem: 1, descricao: 'Vistoriador, chave e chassi' },
  { id: 'motor_compartimento', nome: '2. Compartimento do Motor', ordem: 2, descricao: 'Capô aberto, motor e bateria' },
  { id: 'volta_externa', nome: '3. Volta Externa (360°)', ordem: 3, descricao: 'Frente → laterais → traseira (com solas de pneu)' },
  { id: 'porta_malas', nome: '4. Porta-Malas', ordem: 4, descricao: 'Mala aberta, estepe e ferramentas' },
  { id: 'bancos_forracoes', nome: '5. Bancos e Forrações', ordem: 5, descricao: 'Bancos e revestimentos internos das portas' },
  { id: 'operacionais', nome: '6. Itens Operacionais', ordem: 6, descricao: 'Painel completo e odômetro com motor ligado' },
  { id: 'instalacao', nome: '7. Instalação', ordem: 7, descricao: 'Local do rastreador (oculto do cliente)' },
];

// =============================================
// FOTOS — CARRO (31 + instalação)
// =============================================

// Definições reutilizadas (mesmos IDs, mesmas descrições — só categoria/ordem mudam entre LEGACY e V2)

const FOTO_CARRO_VISTORIADOR_SELFIE: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'vistoriador_selfie',
  nome: 'Selfie do Vistoriador (veículo ao fundo)',
  icone: User,
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
};

const FOTO_CARRO_CHAVE: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'chave',
  nome: 'Foto da Chave',
  icone: Key,
  opcional: true,
  descricao: 'Chave do veículo em destaque (opcional — pode pular se o cliente não tiver a chave em mãos)',
  instrucoes: [
    'Segure a chave na mão ou coloque sobre superfície lisa',
    'A chave deve estar inteira e nítida na foto',
    'Se houver controle, mostre também',
  ],
  evitar: ['Foto desfocada', 'Chave parcialmente visível'],
};

const FOTO_CARRO_CHASSI: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'chassi',
  nome: 'Chassi (Legível)',
  icone: Hash,
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
};

const FOTO_CARRO_CAPO_PLACA: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'capo_aberto_placa',
  nome: 'Capô Aberto com Placa',
  icone: Wrench,
  descricao: 'Capô totalmente aberto com a placa do veículo visível',
  instrucoes: [
    'Abra o capô completamente',
    'Posicione-se a 2-3 metros na frente do veículo',
    'A placa frontal deve estar legível na foto',
    'O motor deve aparecer com o capô aberto',
  ],
  evitar: ['Capô semi-aberto', 'Placa ilegível ou cortada', 'Foto muito de cima (ângulo ruim)'],
};

const FOTO_CARRO_MOTOR: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'motor',
  nome: 'Motor',
  icone: Settings,
  descricao: 'Foto do motor do veículo',
  instrucoes: [
    'Com o capô aberto, fotografe o motor de cima',
    'O motor inteiro deve estar visível na foto',
    'Boa iluminação para identificar componentes',
  ],
  evitar: ['Foto escura sem detalhes visíveis', 'Motor parcialmente coberto'],
};

const FOTO_CARRO_BATERIA: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'bateria',
  nome: 'Foto da Bateria',
  icone: Battery,
  descricao: 'Bateria do veículo com etiqueta visível',
  instrucoes: [
    'Localize a bateria no compartimento do motor',
    'Fotografe de perto, mostrando a etiqueta/marca',
    'Se possível, mostre o estado dos polos (terminais)',
  ],
  evitar: ['Foto de longe onde não se vê a bateria', 'Bateria coberta por outros componentes na foto'],
};

const FOTO_CARRO_FRENTE: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'frente', nome: 'Frente', icone: ArrowUp,
  descricao: 'Parte frontal completa do veículo',
  instrucoes: [
    'Posicione-se a 3-4 metros de distância, bem centralizado na frente',
    'O veículo inteiro deve aparecer de ponta a ponta (para-choques completos)',
    'A placa frontal deve estar legível',
    'Tire a foto na altura do para-choque (não de cima)',
  ],
  evitar: ['Veículo cortado nas laterais', 'Foto de muito longe ou muito perto', 'Contraluz forte (sol atrás do veículo)'],
};

const FOTO_CARRO_PARABRISA: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'parabrisa', nome: 'Para-Brisa', icone: Square,
  descricao: 'Para-brisa dianteiro completo',
  instrucoes: [
    'Fotografe o para-brisa inteiro, incluindo as bordas',
    'Mostre se há trincas, lascas ou avarias',
    'A foto deve ser tirada de fora do veículo',
  ],
  evitar: ['Reflexo excessivo que impeça ver o vidro', 'Foto parcial do para-brisa'],
  dicaExtra: 'Se houver trinca ou avaria no vidro, tire uma foto adicional aproximada do defeito.',
};

const FOTO_CARRO_FRENTE_LAT_DIR: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'frente_lateral_direita', nome: 'Frente Lateral Direita (c/ placa)', icone: ArrowUpRight,
  descricao: 'Diagonal frontal direita com placa visível',
  instrucoes: [
    'Posicione-se na diagonal frontal direita, a 3-4 metros',
    'O veículo inteiro deve aparecer neste ângulo',
    'A placa deve estar visível e legível',
  ],
  evitar: ['Placa ilegível ou cortada', 'Veículo cortado na foto', 'Foto muito de cima ou de baixo'],
};

const FOTO_CARRO_PNEU_DD: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'pneu_dianteiro_direito', nome: 'Sola do Pneu dianteiro direito', icone: Circle,
  descricao: 'Banda de rodagem do pneu dianteiro direito',
  instrucoes: [
    'Aproxime a câmera da banda de rodagem (parte que encosta no chão)',
    'O sulco do pneu deve estar nítido e visível',
    'Se possível, coloque um objeto (moeda, caneta) para referência de profundidade',
  ],
  evitar: ['Foto do pneu inteiro sem detalhe da sola', 'Foto desfocada ou escura', 'Pneu com lama cobrindo os sulcos'],
  dicaExtra: 'Se o pneu estiver careca ou com desgaste irregular, registre bem essa condição.',
};

const FOTO_CARRO_LAT_DIR: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'lateral_direita', nome: 'Lateral Direita completa', icone: ArrowRight,
  descricao: 'Lado direito completo do veículo',
  instrucoes: [
    'Posicione-se bem no centro do lado direito, a 3-4 metros',
    'O veículo deve aparecer inteiro, do para-choque dianteiro ao traseiro',
    'Tire a foto na altura da metade do veículo',
  ],
  evitar: ['Veículo cortado na frente ou atrás', 'Foto inclinada ou torta', 'Obstruções (outros carros, objetos) cobrindo o veículo'],
};

const FOTO_CARRO_PNEU_TD: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'pneu_traseiro_direito', nome: 'Sola do Pneu traseiro direito', icone: Circle,
  descricao: 'Banda de rodagem do pneu traseiro direito',
  instrucoes: ['Aproxime a câmera da banda de rodagem', 'O sulco do pneu deve estar nítido e visível'],
  evitar: ['Foto do pneu inteiro sem detalhe da sola', 'Foto desfocada'],
};

const FOTO_CARRO_TRAS_LAT_DIR: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'traseira_lateral_direita', nome: 'Traseira Lateral Direita (c/ placa)', icone: ArrowDownRight,
  descricao: 'Diagonal traseira direita com placa visível',
  instrucoes: [
    'Posicione-se na diagonal traseira direita, a 3-4 metros',
    'A placa traseira deve estar legível',
    'O veículo inteiro deve aparecer',
  ],
  evitar: ['Placa cortada ou ilegível', 'Foto muito distante'],
};

const FOTO_CARRO_TRASEIRA: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'traseira', nome: 'Traseira completa', icone: ArrowDown,
  descricao: 'Parte traseira completa do veículo',
  instrucoes: [
    'Posicione-se centralizado atrás do veículo, a 3-4 metros',
    'O veículo inteiro deve aparecer',
    'A placa traseira deve estar legível',
    'Tire na altura do para-choque traseiro',
  ],
  evitar: ['Veículo cortado nas laterais', 'Placa ilegível', 'Contraluz'],
};

const FOTO_CARRO_TRAS_LAT_ESQ: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'traseira_lateral_esquerda', nome: 'Traseira Lateral Esquerda (c/ placa)', icone: ArrowDownLeft,
  descricao: 'Diagonal traseira esquerda com placa visível',
  instrucoes: [
    'Posicione-se na diagonal traseira esquerda, a 3-4 metros',
    'A placa traseira deve estar legível',
    'O veículo inteiro deve aparecer',
  ],
  evitar: ['Placa ilegível ou cortada', 'Foto de muito longe'],
};

const FOTO_CARRO_PNEU_TE: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'pneu_traseiro_esquerdo', nome: 'Sola do Pneu traseiro esquerdo', icone: Circle,
  descricao: 'Banda de rodagem do pneu traseiro esquerdo',
  instrucoes: ['Aproxime a câmera da banda de rodagem', 'O sulco do pneu deve estar nítido e visível'],
  evitar: ['Foto do pneu inteiro sem detalhe da sola', 'Foto desfocada'],
};

const FOTO_CARRO_LAT_ESQ: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'lateral_esquerda', nome: 'Lateral Esquerda completa', icone: ArrowLeft,
  descricao: 'Lado esquerdo completo do veículo',
  instrucoes: [
    'Posicione-se bem no centro do lado esquerdo, a 3-4 metros',
    'O veículo deve aparecer inteiro',
    'Tire a foto na altura da metade do veículo',
  ],
  evitar: ['Veículo cortado na frente ou atrás', 'Obstruções cobrindo o veículo'],
};

const FOTO_CARRO_PNEU_DE: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'pneu_dianteiro_esquerdo', nome: 'Sola do Pneu dianteiro esquerdo', icone: Circle,
  descricao: 'Banda de rodagem do pneu dianteiro esquerdo',
  instrucoes: ['Aproxime a câmera da banda de rodagem', 'O sulco do pneu deve estar nítido e visível'],
  evitar: ['Foto do pneu inteiro sem detalhe da sola', 'Foto desfocada'],
};

const FOTO_CARRO_FRENTE_LAT_ESQ: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'frente_lateral_esquerda', nome: 'Frente Lateral Esquerda (c/ placa)', icone: ArrowUpLeft,
  descricao: 'Diagonal frontal esquerda com placa visível',
  instrucoes: [
    'Posicione-se na diagonal frontal esquerda, a 3-4 metros',
    'A placa deve estar visível e legível',
    'O veículo inteiro deve aparecer',
  ],
  evitar: ['Placa ilegível', 'Veículo cortado'],
};

const FOTO_CARRO_MALA: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'mala_aberta', nome: 'Foto com a Mala aberta', icone: Briefcase,
  descricao: 'Porta-malas aberto mostrando interior completo',
  instrucoes: [
    'Abra o porta-malas completamente',
    'Fotografe o interior de frente, a cerca de 1,5 metros',
    'O interior todo deve ser visível (forro, chão)',
  ],
  evitar: ['Porta-malas cheio de objetos que escondam o interior', 'Foto de muito perto sem contexto'],
};

const FOTO_CARRO_ESTEPE: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'estepe', nome: 'Estepe', icone: Circle,
  descricao: 'Pneu estepe do veículo',
  instrucoes: [
    'Localize o estepe (geralmente no porta-malas ou embaixo do veículo)',
    'Fotografe mostrando o estepe inteiro e seu estado',
    'Se não houver estepe, tire foto do local vazio',
  ],
  evitar: ['Foto escura sem detalhes'],
  dicaExtra: 'Se o veículo não possuir estepe, registre isso na observação.',
};

const FOTO_CARRO_CHAVE_RODA: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'chave_roda_macaco', nome: 'Chave de Roda e Macaco', icone: Wrench,
  descricao: 'Kit de ferramentas: chave de roda e macaco',
  instrucoes: [
    'Localize a chave de roda e o macaco',
    'Fotografe ambos juntos, de preferência lado a lado',
    'Se não houver, tire foto do compartimento vazio',
  ],
  evitar: ['Foto sem os itens identificáveis'],
};

const FOTO_CARRO_ODOMETRO: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'odometro', nome: 'Odômetro (Painel ligado)', icone: Gauge,
  descricao: 'Painel do veículo ligado mostrando quilometragem',
  instrucoes: [
    'LIGUE o veículo antes de tirar a foto',
    'Aproxime a câmera até o hodômetro estar completamente legível',
    'A quilometragem (KM) deve estar nítida e sem reflexo',
    'Se for digital, espere estabilizar antes de fotografar',
  ],
  evitar: ['Reflexo na tela ou vidro do painel', 'Veículo desligado (painel apagado)', 'Foto tremida ou desfocada', 'Foto de longe onde não se lê o KM'],
  dicaExtra: '⚠️ O veículo PRECISA estar LIGADO! A quilometragem será lida automaticamente pela IA.',
};

const FOTO_CARRO_PAINEL: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'painel_completo', nome: 'Painel Completo Frontal', icone: LayoutDashboard,
  descricao: 'Visão geral do painel/interior frontal',
  instrucoes: [
    'Fotografe de dentro do banco traseiro ou da porta do motorista',
    'Todo o painel frontal deve aparecer (volante, central, ar-condicionado)',
    'O veículo deve estar ligado para mostrar luzes do painel',
  ],
  evitar: ['Foto muito de perto mostrando só uma parte', 'Foto escura demais'],
};

const FOTO_CARRO_BANCO_MOTORISTA: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'banco_motorista', nome: 'Banco dianteiro do motorista', icone: Armchair,
  descricao: 'Banco do motorista em detalhe',
  instrucoes: ['Abra a porta do motorista', 'Fotografe o banco inteiro, mostrando assento e encosto', 'Registre estado do estofamento (rasgos, manchas, desgaste)'],
  evitar: ['Foto cortada do banco', 'Banco coberto por objetos'],
};

const FOTO_CARRO_BANCO_PASSAGEIRO: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'banco_passageiro', nome: 'Banco dianteiro do passageiro', icone: Armchair,
  descricao: 'Banco do passageiro em detalhe',
  instrucoes: ['Abra a porta do passageiro', 'Fotografe o banco inteiro, mostrando assento e encosto', 'Registre estado do estofamento'],
  evitar: ['Foto cortada do banco', 'Banco coberto por objetos'],
};

const FOTO_CARRO_BANCO_TRASEIRO: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'banco_traseiro', nome: 'Banco traseiro', icone: Armchair,
  descricao: 'Banco traseiro completo',
  instrucoes: ['Abra a porta traseira', 'Fotografe o banco traseiro inteiro', 'Mostre o estado do estofamento'],
  evitar: ['Foto de muito perto sem visão geral', 'Objetos cobrindo o banco'],
};

const FOTO_CARRO_FORRACAO_DE: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'forracao_porta_dianteira_esquerda', nome: 'Forração de porta dianteira esquerda', icone: DoorOpen,
  descricao: 'Interior da porta dianteira esquerda (motorista)',
  instrucoes: ['Abra a porta do motorista', 'Fotografe o revestimento interno da porta', 'Mostre maçaneta, vidro elétrico e acabamentos'],
  evitar: ['Foto escura sem detalhes', 'Porta fechada ou semi-aberta'],
};

const FOTO_CARRO_FORRACAO_TE: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'forracao_porta_traseira_esquerda', nome: 'Forração de porta traseira esquerda', icone: DoorOpen,
  descricao: 'Interior da porta traseira esquerda',
  instrucoes: ['Abra a porta traseira esquerda', 'Fotografe o revestimento interno da porta'],
  evitar: ['Foto escura ou desfocada'],
};

const FOTO_CARRO_FORRACAO_TD: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'forracao_porta_traseira_direita', nome: 'Forração de porta traseira direita', icone: DoorOpen,
  descricao: 'Interior da porta traseira direita',
  instrucoes: ['Abra a porta traseira direita', 'Fotografe o revestimento interno da porta'],
  evitar: ['Foto escura ou desfocada'],
};

const FOTO_CARRO_FORRACAO_DD: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'forracao_porta_dianteira_direita', nome: 'Forração de porta dianteira direita', icone: DoorOpen,
  descricao: 'Interior da porta dianteira direita (passageiro)',
  instrucoes: ['Abra a porta do passageiro', 'Fotografe o revestimento interno da porta', 'Mostre maçaneta, vidro elétrico e acabamentos'],
  evitar: ['Foto escura ou desfocada'],
};

const FOTO_CARRO_LOCAL_RAST: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'local_rastreador', nome: 'Local de Instalação do Rastreador', icone: MapPin,
  descricao: 'Foto do local onde o rastreador foi instalado',
  instrucoes: [
    'Fotografe o rastreador já instalado no local definitivo',
    'A foto deve mostrar claramente onde o dispositivo está',
    'Certifique-se que o rastreador está bem fixo antes de fotografar',
  ],
  evitar: ['Foto que revele claramente o local para terceiros', 'Rastreador solto ou mal posicionado'],
};

// ---------- LEGACY (snapshot pré-V2: tudo na categoria 'roteiro') ----------
const FOTOS_VISTORIA_COMPLETA_LEGACY: VistoriaFotoConfig[] = [
  { ...FOTO_CARRO_VISTORIADOR_SELFIE, categoria: 'roteiro', ordem: 1 },
  { ...FOTO_CARRO_CHAVE, categoria: 'roteiro', ordem: 2 },
  { ...FOTO_CARRO_CAPO_PLACA, categoria: 'roteiro', ordem: 3 },
  { ...FOTO_CARRO_MOTOR, categoria: 'roteiro', ordem: 4 },
  { ...FOTO_CARRO_BATERIA, categoria: 'roteiro', ordem: 5 },
  { ...FOTO_CARRO_FRENTE, categoria: 'roteiro', ordem: 6 },
  { ...FOTO_CARRO_PARABRISA, categoria: 'roteiro', ordem: 7 },
  { ...FOTO_CARRO_FRENTE_LAT_DIR, categoria: 'roteiro', ordem: 8 },
  { ...FOTO_CARRO_PNEU_DD, categoria: 'roteiro', ordem: 9 },
  { ...FOTO_CARRO_LAT_DIR, categoria: 'roteiro', ordem: 10 },
  { ...FOTO_CARRO_PNEU_TD, categoria: 'roteiro', ordem: 11 },
  { ...FOTO_CARRO_TRAS_LAT_DIR, categoria: 'roteiro', ordem: 12 },
  { ...FOTO_CARRO_TRASEIRA, categoria: 'roteiro', ordem: 13 },
  { ...FOTO_CARRO_MALA, categoria: 'roteiro', ordem: 14 },
  { ...FOTO_CARRO_ESTEPE, categoria: 'roteiro', ordem: 15 },
  { ...FOTO_CARRO_CHAVE_RODA, categoria: 'roteiro', ordem: 16 },
  { ...FOTO_CARRO_TRAS_LAT_ESQ, categoria: 'roteiro', ordem: 17 },
  { ...FOTO_CARRO_PNEU_TE, categoria: 'roteiro', ordem: 18 },
  { ...FOTO_CARRO_LAT_ESQ, categoria: 'roteiro', ordem: 19 },
  { ...FOTO_CARRO_PNEU_DE, categoria: 'roteiro', ordem: 20 },
  { ...FOTO_CARRO_FRENTE_LAT_ESQ, categoria: 'roteiro', ordem: 21 },
  { ...FOTO_CARRO_CHASSI, categoria: 'roteiro', ordem: 22 },
  { ...FOTO_CARRO_BANCO_MOTORISTA, categoria: 'roteiro', ordem: 23 },
  { ...FOTO_CARRO_ODOMETRO, categoria: 'roteiro', ordem: 24 },
  { ...FOTO_CARRO_PAINEL, categoria: 'roteiro', ordem: 25 },
  { ...FOTO_CARRO_FORRACAO_DE, categoria: 'roteiro', ordem: 26 },
  { ...FOTO_CARRO_FORRACAO_TE, categoria: 'roteiro', ordem: 27 },
  { ...FOTO_CARRO_BANCO_TRASEIRO, categoria: 'roteiro', ordem: 28 },
  { ...FOTO_CARRO_FORRACAO_TD, categoria: 'roteiro', ordem: 29 },
  { ...FOTO_CARRO_FORRACAO_DD, categoria: 'roteiro', ordem: 30 },
  { ...FOTO_CARRO_BANCO_PASSAGEIRO, categoria: 'roteiro', ordem: 31 },
  { ...FOTO_CARRO_LOCAL_RAST, categoria: 'instalacao', ordem: 32, visivelCliente: false },
];

// ---------- V2 (reorganização por blocos lógicos) ----------
const FOTOS_VISTORIA_COMPLETA_V2: VistoriaFotoConfig[] = [
  // 1. Identificação inicial
  { ...FOTO_CARRO_VISTORIADOR_SELFIE, categoria: 'identificacao', ordem: 1 },
  { ...FOTO_CARRO_CHAVE, categoria: 'identificacao', ordem: 2 },
  { ...FOTO_CARRO_CHASSI, categoria: 'identificacao', ordem: 3 },
  // 2. Compartimento do motor
  { ...FOTO_CARRO_CAPO_PLACA, categoria: 'motor_compartimento', ordem: 4 },
  { ...FOTO_CARRO_MOTOR, categoria: 'motor_compartimento', ordem: 5 },
  { ...FOTO_CARRO_BATERIA, categoria: 'motor_compartimento', ordem: 6 },
  // 3. Volta externa (frente → laterais → traseira, com solas de pneu intercaladas)
  { ...FOTO_CARRO_FRENTE, categoria: 'volta_externa', ordem: 7 },
  { ...FOTO_CARRO_PARABRISA, categoria: 'volta_externa', ordem: 8 },
  { ...FOTO_CARRO_FRENTE_LAT_DIR, categoria: 'volta_externa', ordem: 9 },
  { ...FOTO_CARRO_PNEU_DD, categoria: 'volta_externa', ordem: 10 },
  { ...FOTO_CARRO_LAT_DIR, categoria: 'volta_externa', ordem: 11 },
  { ...FOTO_CARRO_PNEU_TD, categoria: 'volta_externa', ordem: 12 },
  { ...FOTO_CARRO_TRAS_LAT_DIR, categoria: 'volta_externa', ordem: 13 },
  { ...FOTO_CARRO_TRASEIRA, categoria: 'volta_externa', ordem: 14 },
  { ...FOTO_CARRO_TRAS_LAT_ESQ, categoria: 'volta_externa', ordem: 15 },
  { ...FOTO_CARRO_PNEU_TE, categoria: 'volta_externa', ordem: 16 },
  { ...FOTO_CARRO_LAT_ESQ, categoria: 'volta_externa', ordem: 17 },
  { ...FOTO_CARRO_PNEU_DE, categoria: 'volta_externa', ordem: 18 },
  { ...FOTO_CARRO_FRENTE_LAT_ESQ, categoria: 'volta_externa', ordem: 19 },
  // 4. Porta-malas
  { ...FOTO_CARRO_MALA, categoria: 'porta_malas', ordem: 20 },
  { ...FOTO_CARRO_ESTEPE, categoria: 'porta_malas', ordem: 21 },
  { ...FOTO_CARRO_CHAVE_RODA, categoria: 'porta_malas', ordem: 22 },
  // 5. Bancos e forrações
  { ...FOTO_CARRO_BANCO_MOTORISTA, categoria: 'bancos_forracoes', ordem: 23 },
  { ...FOTO_CARRO_BANCO_PASSAGEIRO, categoria: 'bancos_forracoes', ordem: 24 },
  { ...FOTO_CARRO_BANCO_TRASEIRO, categoria: 'bancos_forracoes', ordem: 25 },
  { ...FOTO_CARRO_FORRACAO_DE, categoria: 'bancos_forracoes', ordem: 26 },
  { ...FOTO_CARRO_FORRACAO_TE, categoria: 'bancos_forracoes', ordem: 27 },
  { ...FOTO_CARRO_FORRACAO_TD, categoria: 'bancos_forracoes', ordem: 28 },
  { ...FOTO_CARRO_FORRACAO_DD, categoria: 'bancos_forracoes', ordem: 29 },
  // 6. Operacionais (painel + odômetro com motor ligado)
  { ...FOTO_CARRO_PAINEL, categoria: 'operacionais', ordem: 30 },
  { ...FOTO_CARRO_ODOMETRO, categoria: 'operacionais', ordem: 31 },
  // 7. Instalação (oculta do cliente)
  { ...FOTO_CARRO_LOCAL_RAST, categoria: 'instalacao', ordem: 32, visivelCliente: false },
];

// =============================================
// CATEGORIAS — MOTO
// =============================================

const CATEGORIAS_VISTORIA_MOTO_LEGACY: VistoriaCategoriaConfig[] = [
  { id: 'veiculo', nome: 'Fotos do Veículo (Refazer)', ordem: 1, descricao: '7 fotos - Mesmas da autovistoria' },
  { id: 'rastreador', nome: 'Fotos Técnicas do Rastreador', ordem: 2, descricao: '3 fotos' },
];

const CATEGORIAS_VISTORIA_MOTO_V2: VistoriaCategoriaConfig[] = [
  { id: 'identificacao', nome: '1. Identificação Inicial', ordem: 1, descricao: 'Vistoriador, chave e chassi' },
  { id: 'volta_externa', nome: '2. Volta Externa', ordem: 2, descricao: 'Frente → laterais → traseira (com motor e solas de pneu)' },
  { id: 'operacionais', nome: '3. Itens Operacionais', ordem: 3, descricao: 'Banco aberto, bateria e painel ligado' },
  { id: 'rastreador', nome: '4. Fotos Técnicas do Rastreador', ordem: 4, descricao: '3 fotos (oculto do cliente)' },
];

// =============================================
// FOTOS — MOTO
// =============================================

// Definições reutilizáveis moto
const FOTO_MOTO_FRENTE: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'frente', nome: 'Frente', icone: ArrowUp,
  descricao: 'Parte frontal completa da moto',
  instrucoes: [
    'Posicione-se a 2-3 metros de distância, bem centralizado na frente',
    'A moto inteira deve aparecer, do guidão à roda dianteira',
    'A placa (se frontal) deve estar legível',
  ],
  evitar: ['Moto cortada na foto', 'Contraluz forte'],
};

const FOTO_MOTO_TRASEIRA: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'traseira', nome: 'Traseira', icone: ArrowDown,
  descricao: 'Parte traseira completa da moto',
  instrucoes: [
    'Posicione-se a 2-3 metros, centralizado atrás da moto',
    'A placa traseira deve estar legível',
    'Rabeta e lanternas visíveis',
  ],
  evitar: ['Placa ilegível', 'Moto cortada'],
};

const FOTO_MOTO_LAT_DIR: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'lateral_direita', nome: 'Lateral Direita', icone: ArrowRight,
  descricao: 'Lado direito completo da moto',
  instrucoes: [
    'Posicione-se a 2-3 metros no lado direito',
    'A moto inteira deve aparecer de ponta a ponta',
    'Tire na altura do assento',
  ],
  evitar: ['Moto cortada nas extremidades', 'Obstruções na frente'],
};

const FOTO_MOTO_LAT_ESQ: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'lateral_esquerda', nome: 'Lateral Esquerda', icone: ArrowLeft,
  descricao: 'Lado esquerdo completo da moto',
  instrucoes: ['Posicione-se a 2-3 metros no lado esquerdo', 'A moto inteira deve aparecer'],
  evitar: ['Moto cortada', 'Obstruções'],
};

const FOTO_MOTO_PAINEL_LEGACY: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'painel_km', nome: 'Painel com KM atual', icone: Gauge,
  descricao: 'Painel da moto ligada mostrando quilometragem',
  instrucoes: [
    'LIGUE a moto antes de tirar a foto',
    'Aproxime a câmera até a quilometragem estar completamente legível',
    'Sem reflexo no visor',
  ],
  evitar: ['Moto desligada (painel apagado)', 'Reflexo que impeça leitura', 'Foto tremida'],
  dicaExtra: '⚠️ A moto PRECISA estar LIGADA para o painel mostrar a quilometragem!',
};

const FOTO_MOTO_MOTOR_CHASSI_LEGACY: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'motor_chassi', nome: 'Motor / Chassi', icone: Settings,
  descricao: 'Motor e número do chassi da moto',
  instrucoes: [
    'Fotografe o motor mostrando a numeração do chassi',
    'O número deve estar legível na foto',
    'Use lanterna se necessário',
  ],
  evitar: ['Numeração ilegível', 'Foto de longe'],
  dicaExtra: 'O chassi da moto geralmente fica gravado no cabeçote (pescoço) da moto.',
};

const FOTO_MOTO_AVARIAS: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'avarias', nome: 'Avarias novas (se houver)', icone: Wrench,
  opcional: true,
  descricao: 'Registre qualquer avaria, risco ou dano na moto',
  instrucoes: [
    'Se houver avarias, tire fotos aproximadas de cada uma',
    'Se NÃO houver avarias, tire uma foto geral mostrando bom estado',
    'Foque em riscos, amassados, peças quebradas ou faltantes',
  ],
  evitar: ['Ignorar avarias existentes'],
  dicaExtra: 'Se não houver avarias, uma foto geral da moto em bom estado é suficiente.',
};

// V2 novos itens moto
const FOTO_MOTO_VISTORIADOR_SELFIE: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'vistoriador_selfie', nome: 'Selfie do Vistoriador (moto ao fundo)', icone: User,
  descricao: 'Foto do vistoriador com a moto visível atrás',
  instrucoes: [
    'Posicione-se a cerca de 2 metros da moto',
    'A moto deve aparecer ao fundo, de preferência mostrando a placa',
    'Fique de frente para a câmera, rosto bem visível',
  ],
  evitar: ['Selfie close-up sem a moto ao fundo', 'Contraluz forte'],
};

const FOTO_MOTO_CHAVE: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'chave', nome: 'Foto da Chave', icone: Key,
  opcional: true,
  descricao: 'Chave da moto em destaque (opcional)',
  instrucoes: ['Segure a chave na mão ou coloque sobre superfície lisa', 'A chave deve estar inteira e nítida'],
  evitar: ['Foto desfocada'],
};

const FOTO_MOTO_CHASSI: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'chassi', nome: 'Chassi (Legível)', icone: Hash,
  descricao: 'Numeração do chassi da moto (geralmente no cabeçote/pescoço)',
  instrucoes: [
    'Localize a gravação do chassi no cabeçote da moto (pescoço)',
    'Aproxime até que todos os números estejam legíveis',
    'Use lanterna se necessário',
  ],
  evitar: ['Foto de longe', 'Reflexo que impeça leitura', 'Foto desfocada'],
  dicaExtra: 'O chassi da moto geralmente fica gravado no cabeçote (pescoço).',
};

const FOTO_MOTO_FAROL: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'farol', nome: 'Farol', icone: Sun,
  descricao: 'Farol dianteiro da moto',
  instrucoes: ['Fotografe o farol em destaque', 'Mostre o estado do conjunto óptico'],
  evitar: ['Reflexo excessivo', 'Foto cortada'],
};

const FOTO_MOTO_MOTOR_DIR: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'motor_direito', nome: 'Motor — lado direito', icone: Settings,
  descricao: 'Lado direito do motor (escapamento/cabeçote)',
  instrucoes: ['Fotografe o motor pelo lado direito', 'Mostre componentes visíveis (escape, carburador/injeção)'],
  evitar: ['Foto escura', 'Motor parcialmente coberto'],
};

const FOTO_MOTO_MOTOR_ESQ: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'motor_esquerdo', nome: 'Motor — lado esquerdo', icone: Settings,
  descricao: 'Lado esquerdo do motor',
  instrucoes: ['Fotografe o motor pelo lado esquerdo', 'Mostre componentes visíveis'],
  evitar: ['Foto escura', 'Motor parcialmente coberto'],
};

const FOTO_MOTO_PNEU_DIANT: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'sola_pneu_dianteiro', nome: 'Sola do Pneu Dianteiro', icone: Circle,
  opcional: true,
  descricao: 'Banda de rodagem do pneu dianteiro',
  instrucoes: ['Aproxime a câmera da banda de rodagem', 'O sulco deve estar nítido'],
  evitar: ['Foto do pneu inteiro sem detalhe da sola', 'Foto desfocada'],
};

const FOTO_MOTO_PNEU_TRAS: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'sola_pneu_traseiro', nome: 'Sola do Pneu Traseiro', icone: Circle,
  opcional: true,
  descricao: 'Banda de rodagem do pneu traseiro',
  instrucoes: ['Aproxime a câmera da banda de rodagem', 'O sulco deve estar nítido'],
  evitar: ['Foto do pneu inteiro sem detalhe da sola', 'Foto desfocada'],
};

const FOTO_MOTO_BANCO: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'banco', nome: 'Banco (aberto)', icone: Armchair,
  opcional: true,
  descricao: 'Banco da moto (abrir se possível para mostrar compartimento)',
  instrucoes: ['Abra o banco se possível', 'Mostre estado do estofamento e compartimento abaixo'],
  evitar: ['Foto escura', 'Foto cortada'],
};

const FOTO_MOTO_BATERIA_VAL: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'bateria_validade', nome: 'Bateria com validade', icone: Battery,
  opcional: true,
  descricao: 'Bateria da moto, com etiqueta de validade visível',
  instrucoes: ['Localize a bateria (geralmente sob o banco)', 'Fotografe mostrando etiqueta com data/validade'],
  evitar: ['Etiqueta ilegível', 'Foto escura'],
};

const FOTO_MOTO_PAINEL_V2: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'painel_odometro_ligado', nome: 'Painel com odômetro (motor ligado)', icone: Gauge,
  descricao: 'Painel da moto LIGADA mostrando a quilometragem',
  instrucoes: [
    'LIGUE a moto antes de tirar a foto',
    'Aproxime a câmera até a quilometragem estar completamente legível',
    'Sem reflexo no visor',
  ],
  evitar: ['Moto desligada (painel apagado)', 'Reflexo que impeça leitura', 'Foto tremida'],
  dicaExtra: '⚠️ A moto PRECISA estar LIGADA. A quilometragem será lida automaticamente pela IA.',
};

const FOTO_MOTO_LOCAL_RAST: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'local_rastreador', nome: 'Local exato da instalação', icone: MapPin,
  descricao: 'Local onde o rastreador foi instalado na moto',
  instrucoes: ['Fotografe o rastreador já instalado no local definitivo', 'Mostre a fixação e o posicionamento do dispositivo'],
  evitar: ['Rastreador solto ou mal fixado'],
};

const FOTO_MOTO_COD_RAST: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'codigo_rastreador', nome: 'Código do rastreador visível', icone: Hash,
  descricao: 'Código/IMEI do rastreador legível',
  instrucoes: ['Fotografe a etiqueta com o código/IMEI do rastreador', 'O número deve estar completamente legível', 'Aproxime o suficiente para ler todos os dígitos'],
  evitar: ['Código cortado ou ilegível', 'Foto desfocada'],
};

const FOTO_MOTO_TESTE_COM: Omit<VistoriaFotoConfig, 'categoria' | 'ordem'> = {
  id: 'teste_comunicacao', nome: 'Teste de comunicação (online)', icone: Settings,
  descricao: 'Print/foto mostrando o rastreador online na plataforma',
  instrucoes: [
    'Abra a plataforma de rastreamento no celular ou computador',
    'Verifique se o rastreador está mostrando como ONLINE',
    'Tire um print/foto da tela mostrando status online',
  ],
  evitar: ['Rastreador offline na foto', 'Tela ilegível'],
  dicaExtra: 'Aguarde alguns minutos após a instalação para o rastreador conectar à rede.',
};

// ---------- MOTO LEGACY (snapshot: 7 fotos veículo + 3 rastreador) ----------
const FOTOS_VISTORIA_MOTO_LEGACY: VistoriaFotoConfig[] = [
  { ...FOTO_MOTO_FRENTE, categoria: 'veiculo', ordem: 1 },
  { ...FOTO_MOTO_TRASEIRA, categoria: 'veiculo', ordem: 2 },
  { ...FOTO_MOTO_LAT_DIR, categoria: 'veiculo', ordem: 3 },
  { ...FOTO_MOTO_LAT_ESQ, categoria: 'veiculo', ordem: 4 },
  { ...FOTO_MOTO_PAINEL_LEGACY, categoria: 'veiculo', ordem: 5 },
  { ...FOTO_MOTO_MOTOR_CHASSI_LEGACY, categoria: 'veiculo', ordem: 6 },
  { ...FOTO_MOTO_AVARIAS, categoria: 'veiculo', ordem: 7 },
  { ...FOTO_MOTO_LOCAL_RAST, categoria: 'rastreador', ordem: 8, visivelCliente: false },
  { ...FOTO_MOTO_COD_RAST, categoria: 'rastreador', ordem: 9, visivelCliente: false },
  { ...FOTO_MOTO_TESTE_COM, categoria: 'rastreador', ordem: 10, visivelCliente: false },
];

// ---------- MOTO V2 (15 fotos + 3 rastreador) ----------
// motor_chassi DESMEMBRADO em chassi (id 3) + motor_direito (id 8) + motor_esquerdo (id 12).
// avarias permanece OPCIONAL (fora da contagem de obrigatórias).
const FOTOS_VISTORIA_MOTO_V2: VistoriaFotoConfig[] = [
  // 1. Identificação inicial
  { ...FOTO_MOTO_VISTORIADOR_SELFIE, categoria: 'identificacao', ordem: 1 },
  { ...FOTO_MOTO_CHAVE, categoria: 'identificacao', ordem: 2 },
  { ...FOTO_MOTO_CHASSI, categoria: 'identificacao', ordem: 3 },
  // 2. Volta externa
  { ...FOTO_MOTO_FRENTE, categoria: 'volta_externa', ordem: 4 },
  { ...FOTO_MOTO_FAROL, categoria: 'volta_externa', ordem: 5 },
  { ...FOTO_MOTO_LAT_DIR, categoria: 'volta_externa', ordem: 6 },
  { ...FOTO_MOTO_PNEU_DIANT, categoria: 'volta_externa', ordem: 7 },
  { ...FOTO_MOTO_MOTOR_DIR, categoria: 'volta_externa', ordem: 8 },
  { ...FOTO_MOTO_TRASEIRA, categoria: 'volta_externa', ordem: 9 },
  { ...FOTO_MOTO_PNEU_TRAS, categoria: 'volta_externa', ordem: 10 },
  { ...FOTO_MOTO_LAT_ESQ, categoria: 'volta_externa', ordem: 11 },
  { ...FOTO_MOTO_MOTOR_ESQ, categoria: 'volta_externa', ordem: 12 },
  // 3. Operacionais
  { ...FOTO_MOTO_BANCO, categoria: 'operacionais', ordem: 13 },
  { ...FOTO_MOTO_BATERIA_VAL, categoria: 'operacionais', ordem: 14 },
  { ...FOTO_MOTO_PAINEL_V2, categoria: 'operacionais', ordem: 15 },
  // Avarias (opcional, não conta nas 15 obrigatórias)
  { ...FOTO_MOTO_AVARIAS, categoria: 'volta_externa', ordem: 16 },
  // 4. Rastreador (oculto do cliente)
  { ...FOTO_MOTO_LOCAL_RAST, categoria: 'rastreador', ordem: 17, visivelCliente: false },
  { ...FOTO_MOTO_COD_RAST, categoria: 'rastreador', ordem: 18, visivelCliente: false },
  { ...FOTO_MOTO_TESTE_COM, categoria: 'rastreador', ordem: 19, visivelCliente: false },
];

// =============================================
// EXPORTS COMPATÍVEIS (V2 por padrão — "sem criadoEm" = vistoria nova)
// =============================================

/**
 * @deprecated Use `getFotosByTipoVeiculo(tipo, criadoEm)` para roteamento por data.
 * Mantido como atalho V2 para casos sem `criadoEm` disponível.
 */
export const FOTOS_VISTORIA_COMPLETA: VistoriaFotoConfig[] = FOTOS_VISTORIA_COMPLETA_V2;

/**
 * @deprecated Use `getFotosByTipoVeiculo(tipo, criadoEm)`.
 */
export const FOTOS_VISTORIA_MOTO: VistoriaFotoConfig[] = FOTOS_VISTORIA_MOTO_V2;

/**
 * @deprecated Use `getCategoriasByTipoVeiculo(tipo, criadoEm)`.
 */
export const CATEGORIAS_VISTORIA_COMPLETA: VistoriaCategoriaConfig[] = CATEGORIAS_VISTORIA_COMPLETA_V2;

/**
 * @deprecated Use `getCategoriasByTipoVeiculo(tipo, criadoEm)`.
 */
export const CATEGORIAS_VISTORIA_MOTO: VistoriaCategoriaConfig[] = CATEGORIAS_VISTORIA_MOTO_V2;

// =============================================
// HELPERS — TODOS COM criadoEm? PARA ROTEAR V2/LEGACY
// =============================================

export function getCategoriasByTipoVeiculo(tipo: TipoVeiculo, criadoEm?: string): VistoriaCategoriaConfig[] {
  const v2 = usarRoteiroV2(criadoEm);
  if (tipo === 'moto') return v2 ? CATEGORIAS_VISTORIA_MOTO_V2 : CATEGORIAS_VISTORIA_MOTO_LEGACY;
  return v2 ? CATEGORIAS_VISTORIA_COMPLETA_V2 : CATEGORIAS_VISTORIA_COMPLETA_LEGACY;
}

export function getFotosByTipoVeiculo(tipo: TipoVeiculo, criadoEm?: string): VistoriaFotoConfig[] {
  const v2 = usarRoteiroV2(criadoEm);
  if (tipo === 'moto') return v2 ? FOTOS_VISTORIA_MOTO_V2 : FOTOS_VISTORIA_MOTO_LEGACY;
  return v2 ? FOTOS_VISTORIA_COMPLETA_V2 : FOTOS_VISTORIA_COMPLETA_LEGACY;
}

export function agruparFotosPorCategoriaCompleta(tipo: TipoVeiculo = 'automovel', criadoEm?: string) {
  const categorias = getCategoriasByTipoVeiculo(tipo, criadoEm);
  const fotos = getFotosByTipoVeiculo(tipo, criadoEm);
  return categorias.map(categoria => ({
    ...categoria,
    fotos: fotos.filter(foto => foto.categoria === categoria.id).sort((a, b) => a.ordem - b.ordem),
  }));
}

export function getTotalFotosObrigatorias(tipo: TipoVeiculo, criadoEm?: string): number {
  const fotos = getFotosByTipoVeiculo(tipo, criadoEm);
  return fotos.filter(
    f => f.categoria !== 'instalacao' && f.categoria !== 'rastreador' && f.opcional !== true,
  ).length;
}

// Marcas exclusivamente automotivas — se a marca bater aqui, é carro independente do modelo.
const CARRO_BRANDS = new Set([
  'CHEVROLET', 'GM', 'GENERAL MOTORS',
  'VOLKSWAGEN', 'VW',
  'FIAT', 'FORD', 'TOYOTA', 'HYUNDAI', 'RENAULT', 'PEUGEOT',
  'CITROEN', 'CITROËN', 'JEEP', 'NISSAN', 'MITSUBISHI', 'KIA',
  'AUDI', 'MERCEDES-BENZ', 'MERCEDES', 'VOLVO', 'LAND ROVER', 'PORSCHE',
  'SUBARU', 'MAZDA', 'CHERY', 'CAOA', 'CAOA CHERY', 'RAM', 'DODGE',
  'JAGUAR', 'MINI', 'LEXUS', 'JAC', 'GWM', 'BYD', 'SMART', 'TROLLER', 'IVECO',
]);

const MOTO_BRANDS = new Set([
  'YAMAHA', 'HARLEY-DAVIDSON', 'HARLEY DAVIDSON', 'DUCATI', 'TRIUMPH',
  'KTM', 'APRILIA', 'MV AGUSTA', 'MOTO GUZZI', 'INDIAN', 'ROYAL ENFIELD',
  'HUSQVARNA', 'HUSABERG', 'BENELLI', 'CAGIVA', 'BIMOTA', 'BUELL',
  'DAFRA', 'KASINSKI', 'TRAXX', 'SHINERAY', 'HAOJUE', 'GARINNI', 'AVELLOZ',
  'BAJAJ', 'HERO', 'HONDA MOTOS', 'KYMCO', 'SYM', 'SANYANG', 'PIAGGIO',
  'VESPA', 'GAS GAS', 'BETA', 'DAYANG', 'DAYUN', 'DERBI', 'MALAGUTI',
  'NIU', 'AMAZONAS',
]);

const MOTO_KEYWORDS = [
  'moto', 'motocicleta', 'ciclomotor', 'triciclo', 'scooter',
  'nxr', 'bros', 'cg', 'cb', 'cbr', 'pcx', 'biz', 'pop', 'titan', 'fan',
  'xre', 'lander', 'tenere', 'crosser', 'crf', 'sahara', 'twister', 'hornet',
  'africa twin', 'transalp', 'elite', 'adv', 'sh', 'lead', 'xadv', 'x-adv',
  'fazer', 'ybr', 'neo', 'fluo', 'factor', 'next', 'riva', 'xtz', 'xj6',
  'crypton', 'nmax', 'xmax', 'aerox', 'tmax', 't-max', 'r3', 'r1', 'r6',
  'mt-03', 'mt03', 'mt-07', 'mt07', 'mt-09', 'mt09', 'mt-10', 'mt10',
  'fz15', 'fz25', 'fz-25', 'fz-15',
  'burgman', 'intruder', 'yes', 'gsr', 'v-strom', 'vstrom', 'gsxr',
  'gsx', 'gsx-r', 'gsx-s', 'gixxer', 'bandit', 'hayabusa', 'boulevard',
  'marauder', 'gn125', 'en125', 'sv650',
  'ninja', 'z900', 'z800', 'z750', 'z650', 'z400', 'z250', 'versys', 'vulcan',
  'citycom', 'maxsym', 'duke', 'apache', 'jet', 'kansas', 'mirage', 'horizon',
  'comet', 'rkv', 'tnt',
];

const MOTO_REGEX = new RegExp(
  '\\b(' + MOTO_KEYWORDS.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b',
  'i'
);

export function detectarTipoVeiculo(
  tipoVeiculoStr?: string | null,
  modelo?: string | null,
  marca?: string | null
): TipoVeiculo {
  if (tipoVeiculoStr) {
    const normalized = tipoVeiculoStr.toLowerCase();
    if (normalized.includes('moto') || normalized.includes('motocicleta') || normalized.includes('ciclomotor') || normalized.includes('triciclo')) {
      return 'moto';
    }
    if (normalized.includes('auto') || normalized.includes('camion') || normalized.includes('utilitario') || normalized.includes('utilitário')) {
      return 'automovel';
    }
  }

  if (marca) {
    const marcaNorm = marca.trim().toUpperCase();
    if (CARRO_BRANDS.has(marcaNorm)) return 'automovel';
    if (MOTO_BRANDS.has(marcaNorm)) return 'moto';
  }

  if (modelo && MOTO_REGEX.test(modelo)) return 'moto';

  return 'automovel';
}

// =============================================
// FILTROS — INSTALAÇÃO / RASTREADOR
// =============================================

export function getCategoriasFiltradas(
  tipo: TipoVeiculo,
  incluirInstalacao: boolean,
  criadoEm?: string,
): VistoriaCategoriaConfig[] {
  const categorias = getCategoriasByTipoVeiculo(tipo, criadoEm);
  if (!incluirInstalacao) {
    return categorias.filter(c => c.id !== 'instalacao' && c.id !== 'rastreador');
  }
  return categorias;
}

export function getFotosFiltradas(
  tipo: TipoVeiculo,
  incluirInstalacao: boolean,
  criadoEm?: string,
): VistoriaFotoConfig[] {
  const fotos = getFotosByTipoVeiculo(tipo, criadoEm);
  if (!incluirInstalacao) {
    return fotos.filter(f => f.categoria !== 'instalacao' && f.categoria !== 'rastreador');
  }
  return fotos;
}

export function agruparFotosFiltradas(tipo: TipoVeiculo, incluirInstalacao: boolean, criadoEm?: string) {
  const categorias = getCategoriasFiltradas(tipo, incluirInstalacao, criadoEm);
  const fotos = getFotosFiltradas(tipo, incluirInstalacao, criadoEm);
  return categorias.map(categoria => ({
    ...categoria,
    fotos: fotos.filter(foto => foto.categoria === categoria.id).sort((a, b) => a.ordem - b.ordem),
  }));
}

export function getFotosApenasInstalacao(tipo: TipoVeiculo, criadoEm?: string): VistoriaFotoConfig[] {
  return getFotosByTipoVeiculo(tipo, criadoEm).filter(
    f => f.categoria === 'instalacao' || f.categoria === 'rastreador',
  );
}

export function agruparFotosApenasInstalacao(tipo: TipoVeiculo, criadoEm?: string) {
  const categorias = getCategoriasByTipoVeiculo(tipo, criadoEm).filter(
    c => c.id === 'instalacao' || c.id === 'rastreador',
  );
  const fotos = getFotosApenasInstalacao(tipo, criadoEm);
  return categorias.map(categoria => ({
    ...categoria,
    fotos: fotos.filter(foto => foto.categoria === categoria.id).sort((a, b) => a.ordem - b.ordem),
  }));
}

// =============================================
// Constantes legadas — derivadas dos arrays V2
// =============================================
export const TOTAL_FOTOS_OBRIGATORIAS = FOTOS_VISTORIA_COMPLETA_V2.filter(
  f => f.categoria !== 'instalacao' && f.opcional !== true,
).length;

export const IDS_FOTOS_OBRIGATORIAS = FOTOS_VISTORIA_COMPLETA_V2.filter(
  f => f.categoria !== 'instalacao' && f.opcional !== true,
).map(f => f.id);

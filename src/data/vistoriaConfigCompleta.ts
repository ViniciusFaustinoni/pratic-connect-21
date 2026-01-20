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
  { id: 'vistoriador_selfie', nome: 'Selfie do Vistoriador (veículo ao fundo)', icone: User, categoria: 'identificacao_motor', ordem: 1 },
  { id: 'chave', nome: 'Foto da Chave', icone: Key, categoria: 'identificacao_motor', ordem: 2 },
  { id: 'chassi', nome: 'Chassi (Legível)', icone: Hash, categoria: 'identificacao_motor', ordem: 3 },
  { id: 'capo_aberto_placa', nome: 'Capô Aberto com Placa', icone: Wrench, categoria: 'identificacao_motor', ordem: 4 },
  { id: 'motor', nome: 'Motor', icone: Settings, categoria: 'identificacao_motor', ordem: 5 },
  { id: 'bateria', nome: 'Foto da Bateria', icone: Battery, categoria: 'identificacao_motor', ordem: 6 },

  // 2. Exterior 360° (9 fotos) - Em vídeo também
  { id: 'frente', nome: 'Frente', icone: ArrowUp, categoria: 'exterior_360', ordem: 7 },
  { id: 'parabrisa', nome: 'Para-Brisa', icone: Square, categoria: 'exterior_360', ordem: 8 },
  { id: 'frente_lateral_direita', nome: 'Frente Lateral Direita (c/ placa)', icone: ArrowUpRight, categoria: 'exterior_360', ordem: 9 },
  { id: 'lateral_direita', nome: 'Lateral Direita completa', icone: ArrowRight, categoria: 'exterior_360', ordem: 10 },
  { id: 'traseira_lateral_direita', nome: 'Traseira Lateral Direita (c/ placa)', icone: ArrowDownRight, categoria: 'exterior_360', ordem: 11 },
  { id: 'traseira', nome: 'Traseira completa', icone: ArrowDown, categoria: 'exterior_360', ordem: 12 },
  { id: 'traseira_lateral_esquerda', nome: 'Traseira Lateral Esquerda (c/ placa)', icone: ArrowDownLeft, categoria: 'exterior_360', ordem: 13 },
  { id: 'lateral_esquerda', nome: 'Lateral Esquerda completa', icone: ArrowLeft, categoria: 'exterior_360', ordem: 14 },
  { id: 'frente_lateral_esquerda', nome: 'Frente Lateral Esquerda (c/ placa)', icone: ArrowUpLeft, categoria: 'exterior_360', ordem: 15 },

  // 3. Pneus (4 fotos)
  { id: 'pneu_dianteiro_direito', nome: 'Sola do Pneu dianteiro direito', icone: Circle, categoria: 'pneus', ordem: 16 },
  { id: 'pneu_traseiro_direito', nome: 'Sola do Pneu traseiro direito', icone: Circle, categoria: 'pneus', ordem: 17 },
  { id: 'pneu_traseiro_esquerdo', nome: 'Sola do Pneu traseiro esquerdo', icone: Circle, categoria: 'pneus', ordem: 18 },
  { id: 'pneu_dianteiro_esquerdo', nome: 'Sola do Pneu dianteiro esquerdo', icone: Circle, categoria: 'pneus', ordem: 19 },

  // 4. Interior e Acessórios (5 fotos)
  { id: 'mala_aberta', nome: 'Foto com a Mala aberta', icone: Briefcase, categoria: 'interior', ordem: 20 },
  { id: 'estepe', nome: 'Estepe', icone: Circle, categoria: 'interior', ordem: 21 },
  { id: 'chave_roda_macaco', nome: 'Chave de Roda e Macaco', icone: Wrench, categoria: 'interior', ordem: 22 },
  { id: 'odometro', nome: 'Odômetro (Painel ligado)', icone: Gauge, categoria: 'interior', ordem: 23 },
  { id: 'painel_completo', nome: 'Painel Completo Frontal', icone: LayoutDashboard, categoria: 'interior', ordem: 24 },

  // 5. Bancos e Forrações (7 fotos)
  { id: 'banco_motorista', nome: 'Banco dianteiro do motorista', icone: Armchair, categoria: 'bancos_forracoes', ordem: 25 },
  { id: 'banco_passageiro', nome: 'Banco dianteiro do passageiro', icone: Armchair, categoria: 'bancos_forracoes', ordem: 26 },
  { id: 'banco_traseiro', nome: 'Banco traseiro', icone: Armchair, categoria: 'bancos_forracoes', ordem: 27 },
  { id: 'forracao_porta_dianteira_esquerda', nome: 'Forração de porta dianteira esquerda', icone: DoorOpen, categoria: 'bancos_forracoes', ordem: 28 },
  { id: 'forracao_porta_traseira_esquerda', nome: 'Forração de porta traseira esquerda', icone: DoorOpen, categoria: 'bancos_forracoes', ordem: 29 },
  { id: 'forracao_porta_traseira_direita', nome: 'Forração de porta traseira direita', icone: DoorOpen, categoria: 'bancos_forracoes', ordem: 30 },
  { id: 'forracao_porta_dianteira_direita', nome: 'Forração de porta dianteira direita', icone: DoorOpen, categoria: 'bancos_forracoes', ordem: 31 },

  // 6. Instalação (1 foto - OCULTA DO CLIENTE)
  { id: 'local_rastreador', nome: 'Local de Instalação do Rastreador', icone: MapPin, categoria: 'instalacao', ordem: 32, visivelCliente: false },
];

// =============================================
// CONFIGURAÇÃO PARA MOTOS (12 fotos + vídeo)
// =============================================

export const CATEGORIAS_VISTORIA_MOTO: VistoriaCategoriaConfig[] = [
  { id: 'identificacao_detalhes', nome: 'Identificação e Detalhes', ordem: 1, descricao: '6 fotos' },
  { id: 'exterior_360', nome: 'Exterior (Giro 360°)', ordem: 2, descricao: '4 fotos' },
  { id: 'pneus', nome: 'Pneus', ordem: 3, descricao: '2 fotos - Sola/Sulcos' },
  { id: 'instalacao', nome: 'Instalação', ordem: 4, descricao: 'Local do rastreador (oculto do cliente)' },
];

export const FOTOS_VISTORIA_MOTO: VistoriaFotoConfig[] = [
  // 1. Identificação e Detalhes (6 fotos)
  { id: 'vistoriador_selfie', nome: 'Selfie do Vistoriador (ao lado da moto)', icone: User, categoria: 'identificacao_detalhes', ordem: 1 },
  { id: 'chave', nome: 'Foto da Chave', icone: Key, categoria: 'identificacao_detalhes', ordem: 2 },
  { id: 'chassi', nome: 'Chassi (Nítido/Legível)', icone: Hash, categoria: 'identificacao_detalhes', ordem: 3 },
  { id: 'numero_motor', nome: 'Número do Motor (Nítido)', icone: Settings, categoria: 'identificacao_detalhes', ordem: 4 },
  { id: 'placa_traseira', nome: 'Placa Traseira (Legível)', icone: Square, categoria: 'identificacao_detalhes', ordem: 5 },
  { id: 'odometro', nome: 'Odômetro (Painel ligado com KM)', icone: Gauge, categoria: 'identificacao_detalhes', ordem: 6 },

  // 2. Exterior 360° (4 fotos)
  { id: 'frente', nome: 'Frente Completa', icone: ArrowUp, categoria: 'exterior_360', ordem: 7 },
  { id: 'lateral_direita', nome: 'Lateral Direita Completa', icone: ArrowRight, categoria: 'exterior_360', ordem: 8 },
  { id: 'traseira', nome: 'Traseira Completa (Rabeta/Lanterna)', icone: ArrowDown, categoria: 'exterior_360', ordem: 9 },
  { id: 'lateral_esquerda', nome: 'Lateral Esquerda Completa', icone: ArrowLeft, categoria: 'exterior_360', ordem: 10 },

  // 3. Pneus (2 fotos)
  { id: 'pneu_dianteiro', nome: 'Sola do Pneu Dianteiro', icone: Circle, categoria: 'pneus', ordem: 11 },
  { id: 'pneu_traseiro', nome: 'Sola do Pneu Traseiro', icone: Circle, categoria: 'pneus', ordem: 12 },

  // 4. Instalação (1 foto - OCULTA DO CLIENTE)
  { id: 'local_rastreador', nome: 'Local de Instalação do Rastreador', icone: MapPin, categoria: 'instalacao', ordem: 13, visivelCliente: false },
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
  return fotos.filter(f => f.categoria !== 'instalacao').length; // 31 para automóvel, 12 para moto
}

// Detectar tipo de veículo a partir de string
export function detectarTipoVeiculo(tipoVeiculoStr?: string | null): TipoVeiculo {
  if (!tipoVeiculoStr) return 'automovel';
  const normalized = tipoVeiculoStr.toLowerCase();
  if (normalized.includes('moto') || normalized.includes('motocicleta') || normalized.includes('ciclomotor') || normalized.includes('triciclo')) {
    return 'moto';
  }
  return 'automovel';
}

// Constantes legadas para compatibilidade
export const TOTAL_FOTOS_OBRIGATORIAS = FOTOS_VISTORIA_COMPLETA.filter(f => f.categoria !== 'instalacao').length; // 31

// IDs das fotos obrigatórias (automóvel)
export const IDS_FOTOS_OBRIGATORIAS = FOTOS_VISTORIA_COMPLETA.filter(f => f.categoria !== 'instalacao').map(f => f.id);
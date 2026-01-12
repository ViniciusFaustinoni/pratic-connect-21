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
  Lightbulb,
  LucideIcon
} from 'lucide-react';

export interface VistoriaFotoConfig {
  id: string;
  nome: string;
  icone: LucideIcon;
  categoria: string;
  ordem: number;
}

export interface VistoriaCategoriaConfig {
  id: string;
  nome: string;
  ordem: number;
}

// Categorias para Automóvel
export const CATEGORIAS_AUTOMOVEL: VistoriaCategoriaConfig[] = [
  { id: 'identificacao', nome: 'Identificação e Geral', ordem: 1 },
  { id: 'motor', nome: 'Motor e Capô', ordem: 2 },
  { id: 'exterior_frente', nome: 'Exterior - Frente', ordem: 3 },
  { id: 'exterior_lateral_direita', nome: 'Exterior - Lateral Direita', ordem: 4 },
  { id: 'exterior_traseira', nome: 'Exterior - Traseira', ordem: 5 },
  { id: 'exterior_lateral_esquerda', nome: 'Exterior - Lateral Esquerda', ordem: 6 },
  { id: 'interior_painel', nome: 'Interior - Painel', ordem: 7 },
  { id: 'interior_bancos', nome: 'Interior - Bancos e Forrações', ordem: 8 },
];

// Categorias para Moto
export const CATEGORIAS_MOTO: VistoriaCategoriaConfig[] = [
  { id: 'identificacao', nome: 'Identificação', ordem: 1 },
  { id: 'exterior', nome: 'Exterior', ordem: 2 },
  { id: 'motor', nome: 'Motor', ordem: 3 },
  { id: 'interior', nome: 'Interior', ordem: 4 },
  { id: 'pneus', nome: 'Pneus', ordem: 5 },
];

// Checklist de 30 fotos para Automóvel
export const FOTOS_AUTOMOVEL: VistoriaFotoConfig[] = [
  // Identificação e Geral (3 fotos)
  { id: 'vistoriador', nome: 'Foto do Vistoriador (veículo ao fundo)', icone: User, categoria: 'identificacao', ordem: 1 },
  { id: 'chave', nome: 'Foto da chave', icone: Key, categoria: 'identificacao', ordem: 2 },
  { id: 'chassi', nome: 'Chassi', icone: Hash, categoria: 'identificacao', ordem: 3 },
  
  // Motor e Capô (3 fotos)
  { id: 'capo_aberto', nome: 'Capô aberto c/ placa', icone: Wrench, categoria: 'motor', ordem: 4 },
  { id: 'motor', nome: 'Motor', icone: Settings, categoria: 'motor', ordem: 5 },
  { id: 'bateria', nome: 'Bateria', icone: Battery, categoria: 'motor', ordem: 6 },
  
  // Exterior - Frente (4 fotos)
  { id: 'frente', nome: 'Frente', icone: ArrowUp, categoria: 'exterior_frente', ordem: 7 },
  { id: 'parabrisa', nome: 'Para-Brisa', icone: Square, categoria: 'exterior_frente', ordem: 8 },
  { id: 'frente_lateral_direita', nome: 'Frente lateral direita c/ placa', icone: ArrowUpRight, categoria: 'exterior_frente', ordem: 9 },
  { id: 'pneu_dianteiro_direito', nome: 'Sola do pneu dianteiro direito', icone: Circle, categoria: 'exterior_frente', ordem: 10 },
  
  // Exterior - Lateral Direita (3 fotos)
  { id: 'lateral_direita', nome: 'Lateral direita', icone: ArrowRight, categoria: 'exterior_lateral_direita', ordem: 11 },
  { id: 'traseira_lateral_direita', nome: 'Traseira lateral direita c/ placa', icone: ArrowDownRight, categoria: 'exterior_lateral_direita', ordem: 12 },
  { id: 'pneu_traseiro_direito', nome: 'Sola do pneu traseiro direito', icone: Circle, categoria: 'exterior_lateral_direita', ordem: 13 },
  
  // Exterior - Traseira (4 fotos)
  { id: 'traseira', nome: 'Traseira', icone: ArrowDown, categoria: 'exterior_traseira', ordem: 14 },
  { id: 'mala_aberta', nome: 'Foto com a mala aberta', icone: Briefcase, categoria: 'exterior_traseira', ordem: 15 },
  { id: 'estepe', nome: 'Estepe', icone: Circle, categoria: 'exterior_traseira', ordem: 16 },
  { id: 'chave_roda_macaco', nome: 'Chave de roda e macaco', icone: Wrench, categoria: 'exterior_traseira', ordem: 17 },
  
  // Exterior - Lateral Esquerda (5 fotos)
  { id: 'traseira_lateral_esquerda', nome: 'Traseira lateral esquerda c/ placa', icone: ArrowDownLeft, categoria: 'exterior_lateral_esquerda', ordem: 18 },
  { id: 'pneu_traseiro_esquerdo', nome: 'Sola do pneu traseiro esquerdo', icone: Circle, categoria: 'exterior_lateral_esquerda', ordem: 19 },
  { id: 'lateral_esquerda', nome: 'Lateral esquerda', icone: ArrowLeft, categoria: 'exterior_lateral_esquerda', ordem: 20 },
  { id: 'frente_lateral_esquerda', nome: 'Frente lateral esquerda c/ placa', icone: ArrowUpLeft, categoria: 'exterior_lateral_esquerda', ordem: 21 },
  { id: 'pneu_dianteiro_esquerdo', nome: 'Sola do pneu dianteiro esquerdo', icone: Circle, categoria: 'exterior_lateral_esquerda', ordem: 22 },
  
  // Interior - Painel (2 fotos)
  { id: 'odometro', nome: 'Odômetro (veículo ligado)', icone: Gauge, categoria: 'interior_painel', ordem: 23 },
  { id: 'painel_completo', nome: 'Painel completo frontal', icone: LayoutDashboard, categoria: 'interior_painel', ordem: 24 },
  
  // Interior - Bancos e Forrações (7 fotos)
  { id: 'banco_motorista', nome: 'Banco dianteiro motorista', icone: Armchair, categoria: 'interior_bancos', ordem: 25 },
  { id: 'forracao_porta_dianteira_esquerda', nome: 'Forração de porta dianteira esquerda', icone: DoorOpen, categoria: 'interior_bancos', ordem: 26 },
  { id: 'forracao_porta_traseira_esquerda', nome: 'Forração de porta traseira esquerda', icone: DoorOpen, categoria: 'interior_bancos', ordem: 27 },
  { id: 'banco_traseiro', nome: 'Banco traseiro', icone: Armchair, categoria: 'interior_bancos', ordem: 28 },
  { id: 'forracao_porta_traseira_direita', nome: 'Forração de porta traseira direita', icone: DoorOpen, categoria: 'interior_bancos', ordem: 29 },
  { id: 'forracao_porta_dianteira_direita', nome: 'Forração de porta dianteira direita', icone: DoorOpen, categoria: 'interior_bancos', ordem: 30 },
  { id: 'banco_passageiro', nome: 'Banco direito passageiro', icone: Armchair, categoria: 'interior_bancos', ordem: 31 },
];

// Checklist de 14 fotos para Moto
export const FOTOS_MOTO: VistoriaFotoConfig[] = [
  // Identificação (5 fotos)
  { id: 'vistoriador', nome: 'Foto do Vistoriador (veículo ao fundo)', icone: User, categoria: 'identificacao', ordem: 1 },
  { id: 'farol', nome: 'Farol', icone: Lightbulb, categoria: 'identificacao', ordem: 2 },
  { id: 'frente', nome: 'Frente', icone: ArrowUp, categoria: 'identificacao', ordem: 3 },
  { id: 'chave', nome: 'Chave', icone: Key, categoria: 'identificacao', ordem: 4 },
  { id: 'chassi', nome: 'Chassi', icone: Hash, categoria: 'identificacao', ordem: 5 },
  
  // Exterior (3 fotos)
  { id: 'lateral_esquerda', nome: 'Lateral esquerda', icone: ArrowLeft, categoria: 'exterior', ordem: 6 },
  { id: 'lateral_direita', nome: 'Lateral direita', icone: ArrowRight, categoria: 'exterior', ordem: 7 },
  { id: 'traseira', nome: 'Traseira', icone: ArrowDown, categoria: 'exterior', ordem: 8 },
  
  // Motor (2 fotos)
  { id: 'motor_esquerdo', nome: 'Motor lado esquerdo', icone: Settings, categoria: 'motor', ordem: 9 },
  { id: 'motor_direito', nome: 'Motor lado direito', icone: Settings, categoria: 'motor', ordem: 10 },
  
  // Interior (2 fotos)
  { id: 'banco', nome: 'Banco', icone: Armchair, categoria: 'interior', ordem: 11 },
  { id: 'painel_odometro', nome: 'Painel com odômetro ligado', icone: Gauge, categoria: 'interior', ordem: 12 },
  
  // Pneus (2 fotos)
  { id: 'pneu_dianteiro', nome: 'Sola do pneu dianteiro', icone: Circle, categoria: 'pneus', ordem: 13 },
  { id: 'pneu_traseiro', nome: 'Sola do pneu traseiro', icone: Circle, categoria: 'pneus', ordem: 14 },
];

// Função para obter fotos por tipo de veículo
export function getFotosByTipoVeiculo(tipo: 'automovel' | 'moto'): VistoriaFotoConfig[] {
  return tipo === 'automovel' ? FOTOS_AUTOMOVEL : FOTOS_MOTO;
}

// Função para obter categorias por tipo de veículo
export function getCategoriasByTipoVeiculo(tipo: 'automovel' | 'moto'): VistoriaCategoriaConfig[] {
  return tipo === 'automovel' ? CATEGORIAS_AUTOMOVEL : CATEGORIAS_MOTO;
}

// Função para agrupar fotos por categoria
export function agruparFotosPorCategoria(fotos: VistoriaFotoConfig[], categorias: VistoriaCategoriaConfig[]) {
  return categorias.map(categoria => ({
    ...categoria,
    fotos: fotos.filter(foto => foto.categoria === categoria.id).sort((a, b) => a.ordem - b.ordem),
  }));
}

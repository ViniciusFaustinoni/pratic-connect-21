// ============================================
// CONFIGURAÇÃO DE FOTOS PARA REVISTORIA
// ============================================

export type TipoVeiculoRevistoria = 'carro' | 'moto';

export interface FotoConfig {
  id: string;
  label: string;
  descricao: string;
  instrucao: string;
  destaque?: boolean;
  ordem: number;
}

// FOTOS PARA CARRO (11 fotos)
export const FOTOS_CARRO: FotoConfig[] = [
  { 
    id: 'lateral_direita', 
    label: 'Lateral Direita', 
    descricao: 'Foto do lado direito completo, sem cortar',
    instrucao: 'Enquadre o veículo inteiro',
    ordem: 1
  },
  { 
    id: 'lateral_esquerda', 
    label: 'Lateral Esquerda', 
    descricao: 'Foto do lado esquerdo completo, sem cortar',
    instrucao: 'Enquadre o veículo inteiro',
    ordem: 2
  },
  { 
    id: 'capo_aberto', 
    label: 'Capô Aberto', 
    descricao: 'Capô aberto mostrando a placa do veículo',
    instrucao: 'A placa deve estar visível na foto',
    ordem: 3
  },
  { 
    id: 'mala_aberta', 
    label: 'Mala Aberta', 
    descricao: 'Porta-malas aberto mostrando a placa',
    instrucao: 'A placa deve estar visível na foto',
    ordem: 4
  },
  { 
    id: 'frente', 
    label: 'Frente do Veículo', 
    descricao: 'Parte frontal completa, sem cortar',
    instrucao: 'Enquadre o veículo inteiro com a placa visível',
    ordem: 5
  },
  { 
    id: 'traseira', 
    label: 'Traseira do Veículo', 
    descricao: 'Parte traseira completa, sem cortar',
    instrucao: 'Enquadre o veículo inteiro com a placa visível',
    ordem: 6
  },
  { 
    id: 'painel', 
    label: 'Painel (Veículo Ligado)', 
    descricao: 'Painel com o veículo LIGADO e acelerado',
    instrucao: '⚠️ Acelere ou movimente para o ponteiro do combustível sair do zero',
    destaque: true,
    ordem: 7
  },
  { 
    id: 'chassi', 
    label: 'Numeração do Chassi', 
    descricao: 'Número do chassi gravado no veículo',
    instrucao: 'Geralmente fica embaixo do banco do carona ou dentro do motor',
    ordem: 8
  },
  { 
    id: 'bancos', 
    label: 'Bancos (Frente e Trás)', 
    descricao: 'Foto mostrando os bancos dianteiros e traseiros',
    instrucao: 'Abra as portas para melhor visualização',
    ordem: 9
  },
  { 
    id: 'porta_motorista', 
    label: 'Porta Motorista (por dentro)', 
    descricao: 'Interior da porta do motorista',
    instrucao: 'Foto com a porta aberta, mostrando o interior',
    ordem: 10
  },
  { 
    id: 'porta_passageiro', 
    label: 'Porta Passageiro (por dentro)', 
    descricao: 'Interior da porta do passageiro',
    instrucao: 'Foto com a porta aberta, mostrando o interior',
    ordem: 11
  },
];

// FOTOS PARA MOTO (7 fotos)
export const FOTOS_MOTO: FotoConfig[] = [
  { 
    id: 'lateral_direita', 
    label: 'Lateral Direita', 
    descricao: 'Foto do lado direito completo, sem cortar',
    instrucao: 'Enquadre a moto inteira',
    ordem: 1
  },
  { 
    id: 'lateral_esquerda', 
    label: 'Lateral Esquerda', 
    descricao: 'Foto do lado esquerdo completo, sem cortar',
    instrucao: 'Enquadre a moto inteira',
    ordem: 2
  },
  { 
    id: 'frente', 
    label: 'Frente da Moto', 
    descricao: 'Parte frontal completa, sem cortar',
    instrucao: 'Enquadre a moto inteira',
    ordem: 3
  },
  { 
    id: 'traseira', 
    label: 'Traseira da Moto', 
    descricao: 'Parte traseira completa, sem cortar',
    instrucao: 'Placa deve estar visível',
    ordem: 4
  },
  { 
    id: 'painel', 
    label: 'Painel (Moto Ligada)', 
    descricao: 'Painel com a moto LIGADA',
    instrucao: '⚠️ Movimente a moto para o visor sair do zero',
    destaque: true,
    ordem: 5
  },
  { 
    id: 'chassi', 
    label: 'Numeração do Chassi', 
    descricao: 'Número do chassi gravado na moto',
    instrucao: 'Geralmente no cabeçote ou motor',
    ordem: 6
  },
  { 
    id: 'motor', 
    label: 'Motor (mais de perto)', 
    descricao: 'Foto aproximada do motor',
    instrucao: 'Mostre o motor em detalhe',
    ordem: 7
  },
];

// Helper para obter fotos por tipo
export const getFotosConfig = (tipo: TipoVeiculoRevistoria): FotoConfig[] => {
  return tipo === 'carro' ? FOTOS_CARRO : FOTOS_MOTO;
};

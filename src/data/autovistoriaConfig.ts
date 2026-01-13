// Configuração das fotos obrigatórias para autovistoria

export interface FotoAutovistoria {
  id: string;
  label: string;
  descricao?: string;
  ordem: number;
}

// CARROS (15 fotos)
export const FOTOS_AUTOVISTORIA_CARRO: FotoAutovistoria[] = [
  { id: 'selfie_veiculo', label: 'Selfie com o Veículo ao Fundo', descricao: 'Tire uma selfie com o veículo aparecendo atrás de você', ordem: 1 },
  { id: 'frente', label: 'Frente do Veículo', descricao: 'Foto da frente do veículo, mostrando faróis e placa', ordem: 2 },
  { id: 'traseira', label: 'Traseira do Veículo', descricao: 'Foto da traseira do veículo, mostrando lanternas e placa', ordem: 3 },
  { id: 'lateral_direita', label: 'Lateral Direita', descricao: 'Foto da lateral direita completa do veículo', ordem: 4 },
  { id: 'lateral_esquerda', label: 'Lateral Esquerda', descricao: 'Foto da lateral esquerda completa do veículo', ordem: 5 },
  { id: 'odometro', label: 'Odômetro (veículo ligado)', descricao: 'Foto do painel com o odômetro visível (veículo ligado)', ordem: 6 },
  { id: 'painel', label: 'Painel Completo', descricao: 'Foto do painel do veículo mostrando todos os indicadores', ordem: 7 },
  { id: 'chassi', label: 'Número do Chassi', descricao: 'Foto do número do chassi gravado no veículo', ordem: 8 },
  { id: 'motor', label: 'Motor (capô aberto)', descricao: 'Foto do motor com o capô aberto', ordem: 9 },
  { id: 'pneu_dianteiro_direito', label: 'Sola do Pneu Dianteiro Direito', descricao: 'Foto da sola do pneu dianteiro direito mostrando estado', ordem: 10 },
  { id: 'pneu_dianteiro_esquerdo', label: 'Sola do Pneu Dianteiro Esquerdo', descricao: 'Foto da sola do pneu dianteiro esquerdo mostrando estado', ordem: 11 },
  { id: 'pneu_traseiro_direito', label: 'Sola do Pneu Traseiro Direito', descricao: 'Foto da sola do pneu traseiro direito mostrando estado', ordem: 12 },
  { id: 'pneu_traseiro_esquerdo', label: 'Sola do Pneu Traseiro Esquerdo', descricao: 'Foto da sola do pneu traseiro esquerdo mostrando estado', ordem: 13 },
  { id: 'banco_dianteiro', label: 'Banco Dianteiro', descricao: 'Foto dos bancos dianteiros mostrando estado de conservação', ordem: 14 },
  { id: 'banco_traseiro', label: 'Banco Traseiro', descricao: 'Foto do banco traseiro mostrando estado de conservação', ordem: 15 },
];

// MOTOS (10 fotos)
export const FOTOS_AUTOVISTORIA_MOTO: FotoAutovistoria[] = [
  { id: 'selfie_veiculo', label: 'Selfie com a Moto ao Fundo', descricao: 'Tire uma selfie com a moto aparecendo atrás de você', ordem: 1 },
  { id: 'frente', label: 'Frente da Moto', descricao: 'Foto da frente da moto, mostrando farol e placa', ordem: 2 },
  { id: 'traseira', label: 'Traseira da Moto', descricao: 'Foto da traseira da moto, mostrando lanterna e placa', ordem: 3 },
  { id: 'lateral_direita', label: 'Lateral Direita', descricao: 'Foto da lateral direita completa da moto', ordem: 4 },
  { id: 'lateral_esquerda', label: 'Lateral Esquerda', descricao: 'Foto da lateral esquerda completa da moto', ordem: 5 },
  { id: 'odometro', label: 'Painel com Odômetro (ligado)', descricao: 'Foto do painel com odômetro visível (moto ligada)', ordem: 6 },
  { id: 'chassi', label: 'Número do Chassi', descricao: 'Foto do número do chassi gravado na moto', ordem: 7 },
  { id: 'motor', label: 'Motor', descricao: 'Foto do motor da moto', ordem: 8 },
  { id: 'pneu_dianteiro', label: 'Sola do Pneu Dianteiro', descricao: 'Foto da sola do pneu dianteiro mostrando estado', ordem: 9 },
  { id: 'pneu_traseiro', label: 'Sola do Pneu Traseiro', descricao: 'Foto da sola do pneu traseiro mostrando estado', ordem: 10 },
];

// Tipos de veículo
export type TipoVeiculo = 'carro' | 'moto';

// Função para obter as fotos corretas baseado no tipo
export function getFotosAutovistoria(tipo: TipoVeiculo): FotoAutovistoria[] {
  return tipo === 'moto' ? FOTOS_AUTOVISTORIA_MOTO : FOTOS_AUTOVISTORIA_CARRO;
}

// Horários disponíveis para agendamento de vistoria
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

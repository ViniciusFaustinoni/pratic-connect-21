// Tipos para o sistema unificado de serviços em rotas (instalações + vistorias)

export type TipoServico = 'instalacao' | 'vistoria' | 'vistoria_cotacao';

export type TipoVistoria = 'entrada' | 'saida' | 'sinistro' | 'periodica' | 'cancelamento' | 'manutencao';

export interface ServicoRota {
  id: string;
  tipo_servico: TipoServico;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_cep: string | null;
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  data_agendada: string | null;
  periodo: string | null;
  rota_id: string | null;
  associado_id: string | null;
  associado_nome: string | null;
  associado_telefone: string | null;
  veiculo_id: string | null;
  placa: string | null;
  marca: string | null;
  modelo: string | null;
  tipo_vistoria: TipoVistoria | null;
}

export interface BairroServico {
  bairro: string;
  cidade: string;
  totalInstalacoes: number;
  totalVistorias: number;
  total: number;
}

export interface DistribuicaoServico {
  instaladorId: string;
  instaladorNome: string;
  servicos: ServicoRota[];
}

// Labels para tipos de vistoria
export const TIPO_VISTORIA_LABELS: Record<TipoVistoria, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  sinistro: 'Sinistro',
  periodica: 'Periódica',
  cancelamento: 'Cancelamento',
  manutencao: 'Manutenção',
};

// Labels para tipo de serviço
export const TIPO_SERVICO_LABELS: Record<TipoServico, string> = {
  instalacao: 'Instalação',
  vistoria: 'Vistoria',
  vistoria_cotacao: 'Vistoria (Cotação)',
};

// Cores para tipo de serviço
export const TIPO_SERVICO_COLORS: Record<TipoServico, string> = {
  instalacao: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  vistoria: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  vistoria_cotacao: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
};

// Ícones para tipo de serviço (usar com lucide-react)
export const TIPO_SERVICO_ICONS: Record<TipoServico, string> = {
  instalacao: 'Wrench',
  vistoria: 'ClipboardCheck',
  vistoria_cotacao: 'FileSearch',
};

// Cores para tipos de vistoria
export const TIPO_VISTORIA_COLORS: Record<TipoVistoria, string> = {
  entrada: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  saida: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  sinistro: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  periodica: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
  cancelamento: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  manutencao: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
};

// Filtro de tipos para o formulário de rota
export interface FiltroTipoServico {
  instalacao: boolean;
  entrada: boolean;
  saida: boolean;
  sinistro: boolean;
  periodica: boolean;
  cancelamento: boolean;
  manutencao: boolean;
}

export const FILTRO_TIPO_SERVICO_DEFAULT: FiltroTipoServico = {
  instalacao: true,
  entrada: true,
  saida: true,
  sinistro: true,
  periodica: true,
  cancelamento: true,
  manutencao: true,
};

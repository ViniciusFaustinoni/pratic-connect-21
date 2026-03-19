export interface DadosProposta {
  // Dados do Lead/Cliente
  cliente: {
    nome: string;
    cpf: string;
    telefone: string;
    email: string;
    endereco?: string;
    cidade?: string;
    estado?: string;
  };
  
  // Dados do Veículo
  veiculo: {
    marca: string;
    modelo: string;
    ano: number;
    placa: string;
    cor?: string;
    valorFipe: number;
  };
  
  // Dados do Plano
  plano: {
    nome: string;
    coberturas: string[];
    valorAdesao: number;
    valorMensal: number;
    valorExtra?: number;
  };
  
  // Dados da Cotação
  cotacao: {
    numero: string;
    dataValidade: string;
    vendedor: string;
    observacoes?: string;
  };

  // Dados de Migração (quando aplicável)
  migracao?: {
    aprovada: boolean;
    associacaoOrigem: string;
    carenciaIsenta: boolean;
    dataAprovacao: string;
  };
}

export interface ConfiguracaoPDF {
  corPrimaria?: { r: number; g: number; b: number };
  corSecundaria?: { r: number; g: number; b: number };
  mostrarLogo?: boolean;
  mostrarQRCode?: boolean;
  templateUrl?: string;
}

// ============================================
// TYPES DO TERMO DE FILIAÇÃO — SGA Pratic 2.0
// ============================================

// ============= INTERFACES =============

export interface ClienteData {
  nome: string;
  cpf: string;
  rg?: string;
  rgOrgao?: string;
  dataNascimento?: string;
  estadoCivil?: string;
  profissao?: string;
  email: string;
  telefone: string;
  telefoneSecundario?: string;
  endereco: {
    cep: string;
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    estado: string;
  };
}

export interface VeiculoData {
  tipo: 'carro' | 'moto';
  marca: string;
  modelo: string;
  anoFab: number;
  anoMod: number;
  cor: string;
  placa: string;
  renavam: string;
  chassi: string;
  combustivel: string;
  valorFipe: number;
  codigoFipe: string;
  procedencia?: string;
  categoria?: string;
  tipoUso?: string;
  alienado?: boolean;
  financeira?: string;
}

export interface PlanoData {
  nome: string;
  codigo?: string;
  coberturas: string[];
  valorMensal: number;
  taxaAdesao: number;
  diaVencimento: number;
  cotaParticipacao?: number;
  cotaMinima?: number;
}

export interface IndicadorData {
  nome: string;
  cpf: string;
}

export interface EmpresaData {
  nome: string;
  razaoSocial?: string;
  cnpj: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone?: string;
  email?: string;
  lgpdEmail?: string;
}

export interface ContratoData {
  numero: string;
  valorAdesao: number;
  valorMensal: number;
  diaVencimento: number;
  dataInicio?: string;
  formaPagamento?: string;
}

export interface DadosTermoFiliacao {
  cliente: ClienteData;
  veiculo: VeiculoData;
  plano: PlanoData;
  contrato: ContratoData;
  empresa: EmpresaData;
  indicador?: IndicadorData;
}

// ============= FORMATADORES =============

/**
 * Formata CPF: 123.456.789-00
 */
export const formatCPF = (cpf: string | null | undefined): string => {
  if (!cpf) return "—";
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return cpf;
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

/**
 * Formata telefone: (11) 99999-8888 ou (11) 9999-8888
 */
export const formatPhone = (phone: string | null | undefined): string => {
  if (!phone) return "—";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  return phone;
};

/**
 * Formata CEP: 00000-000
 */
export const formatCEP = (cep: string | null | undefined): string => {
  if (!cep) return "—";
  const cleaned = cep.replace(/\D/g, "");
  if (cleaned.length !== 8) return cep;
  return cleaned.replace(/(\d{5})(\d{3})/, "$1-$2");
};

/**
 * Formata valor monetário: R$ 1.234,56
 */
export const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

/**
 * Formata data: DD/MM/AAAA
 */
export const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR");
  } catch {
    return dateStr;
  }
};

/**
 * Formata data por extenso: 04 de fevereiro de 2026
 */
export const formatDateExtended = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

// ============= LÓGICA DE NEGÓCIOS =============

/**
 * Verifica se o veículo é 0KM (sem placa)
 */
export const ehVeiculoZeroKm = (veiculo: VeiculoData): boolean => {
  return !veiculo.placa || 
    veiculo.placa === '' || 
    veiculo.placa.startsWith('000') ||
    veiculo.procedencia === 'Novo (zero km)';
};

/**
 * Verifica se o rastreador é obrigatório
 */
export const exigeRastreador = (veiculo: VeiculoData): { exige: boolean; motivo: string | null } => {
  // Diesel sempre exige
  if (veiculo.combustivel?.toLowerCase() === 'diesel') {
    return { exige: true, motivo: 'Veículo a diesel' };
  }
  
  // Carro > R$ 20.000
  if (veiculo.tipo === 'carro' && veiculo.valorFipe > 20000) {
    return { exige: true, motivo: 'Valor FIPE acima de R$ 20.000' };
  }
  
  // Moto > R$ 9.000
  if (veiculo.tipo === 'moto' && veiculo.valorFipe > 9000) {
    return { exige: true, motivo: 'Valor FIPE acima de R$ 9.000' };
  }
  
  return { exige: false, motivo: null };
};

/**
 * Calcula a cota de participação (% do valor FIPE)
 */
export const calcularCotaParticipacao = (
  valorFipe: number,
  percentual: number = 10
): number => {
  return (valorFipe * percentual) / 100;
};

/**
 * Calcula a data da primeira mensalidade
 */
export const calcularPrimeiraMensalidade = (diaVencimento: number): string => {
  const hoje = new Date();
  let ano = hoje.getFullYear();
  let mes = hoje.getMonth() + 1;
  
  if (hoje.getDate() >= diaVencimento - 5) {
    mes += 1;
  }
  
  if (mes > 12) {
    mes = 1;
    ano += 1;
  }
  
  const dia = String(diaVencimento).padStart(2, "0");
  const mesStr = String(mes).padStart(2, "0");
  
  return `${dia}/${mesStr}/${ano}`;
};

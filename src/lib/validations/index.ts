import { z } from 'zod';

// Funções de validação
export const validateCPF = (cpf: string): boolean => {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned[9])) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned[10])) return false;
  
  return true;
};

// Máscaras
export const maskCPF = (value: string): string => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .slice(0, 14);
};

export const maskTelefone = (value: string): string => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .slice(0, 15);
};

export const maskPlaca = (value: string): string => {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 7) {
    // Formato Mercosul ABC1D23 ou antigo ABC-1234
    if (/^[A-Z]{3}\d[A-Z]\d{2}$/.test(cleaned) || /^[A-Z]{3}\d{4}$/.test(cleaned)) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    }
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  }
  return cleaned.slice(0, 7).replace(/^([A-Z]{3})/, '$1-');
};

export const maskCEP = (value: string): string => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .slice(0, 9);
};

// CNPJ
export const maskCNPJ = (value: string): string => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})/, '$1-$2')
    .slice(0, 18);
};

export const validateCNPJ = (cnpj: string): boolean => {
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;
  
  let size = cleaned.length - 2;
  let numbers = cleaned.substring(0, size);
  const digits = cleaned.substring(size);
  let sum = 0;
  let pos = size - 7;
  
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;
  
  size = size + 1;
  numbers = cleaned.substring(0, size);
  sum = 0;
  pos = size - 7;
  
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return result === parseInt(digits.charAt(1));
};

export const maskCurrency = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  const amount = parseInt(numbers || '0', 10) / 100;
  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

export const parseCurrency = (value: string): number => {
  const numbers = value.replace(/\D/g, '');
  return parseInt(numbers || '0', 10) / 100;
};

// Schemas Zod
export const cpfSchema = z.string()
  .min(14, 'CPF inválido')
  .refine((val) => validateCPF(val), 'CPF inválido');

export const telefoneSchema = z.string()
  .min(14, 'Telefone inválido')
  .max(15, 'Telefone inválido');

export const emailSchema = z.string()
  .email('E-mail inválido')
  .or(z.literal(''));

export const placaSchema = z.string()
  .min(8, 'Placa inválida')
  .max(8, 'Placa inválida');

export const cepSchema = z.string()
  .min(9, 'CEP inválido')
  .max(9, 'CEP inválido');

// Schema de Lead
export const leadSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  telefone: telefoneSchema,
  email: emailSchema.optional(),
  cpf: z.string().optional().refine((val) => !val || val.length === 0 || validateCPF(val), 'CPF inválido'),
  veiculo_marca: z.string().optional(),
  veiculo_modelo: z.string().optional(),
  veiculo_ano: z.number().min(1900).max(new Date().getFullYear() + 1).optional().nullable(),
  veiculo_placa: z.string().optional(),
  veiculo_fipe: z.number().min(0).optional().nullable(),
  origem: z.enum(['indicacao', 'site', 'whatsapp', 'facebook', 'instagram', 'google', 'telefone', 'presencial', 'parceiro', 'outro', 'api']),
  observacoes: z.string().optional(),
});

// Schema de Cotação
export const cotacaoSchema = z.object({
  lead_id: z.string().uuid().optional().nullable(),
  plano_id: z.string().uuid('Selecione um plano'),
  valor_fipe: z.number().min(1, 'Valor FIPE é obrigatório'),
  valor_cota: z.number().min(0),
  taxa_administrativa: z.number().min(0),
  valor_rastreamento: z.number().min(0),
  valor_adesao: z.number().min(0),
  valor_total_mensal: z.number().min(0),
  validade_dias: z.number().min(1).max(30).default(7),
});

// Schema de Contrato
export const contratoSchema = z.object({
  cotacao_id: z.string().uuid().optional().nullable(),
  plano_id: z.string().uuid('Selecione um plano'),
  valor_adesao: z.number().min(0),
  valor_mensal: z.number().min(0),
  data_inicio: z.string(),
});

// Schema de Associado
export const associadoSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  cpf: cpfSchema,
  rg: z.string().optional(),
  data_nascimento: z.string().optional(),
  sexo: z.enum(['M', 'F']).optional().nullable(),
  estado_civil: z.string().optional(),
  profissao: z.string().optional(),
  email: z.string().email('E-mail inválido'),
  telefone: telefoneSchema,
  telefone_secundario: z.string().optional(),
  cep: cepSchema.optional().or(z.literal('')),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().length(2).optional(),
});

// Schema de Veículo
export const veiculoSchema = z.object({
  placa: placaSchema,
  marca: z.string().min(1, 'Marca é obrigatória'),
  modelo: z.string().min(1, 'Modelo é obrigatório'),
  ano_fabricacao: z.number().min(1900).max(new Date().getFullYear() + 1),
  ano_modelo: z.number().min(1900).max(new Date().getFullYear() + 2),
  cor: z.string().optional(),
  combustivel: z.string().optional(),
  chassi: z.string().optional(),
  renavam: z.string().optional(),
  codigo_fipe: z.string().optional(),
  valor_fipe: z.number().min(0).optional().nullable(),
});

export type LeadFormData = z.infer<typeof leadSchema>;
export type CotacaoFormData = z.infer<typeof cotacaoSchema>;
export type ContratoFormData = z.infer<typeof contratoSchema>;
export type AssociadoFormData = z.infer<typeof associadoSchema>;
export type VeiculoFormData = z.infer<typeof veiculoSchema>;

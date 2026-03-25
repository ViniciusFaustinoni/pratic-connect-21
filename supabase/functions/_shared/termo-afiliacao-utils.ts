// ============================================
// TERMO DE AFILIAÇÃO - UTILITÁRIOS
// ============================================

// ============= INTERFACES =============

export interface ClienteData {
  nome: string;
  cpf: string;
  rg?: string;
  rg_orgao?: string;
  cnh?: string;
  cnh_validade?: string;
  cnh_categoria?: string;
  data_nascimento?: string;
  estado_civil?: string;
  profissao?: string;
  email: string;
  telefone: string;
  telefone_secundario?: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
}

export interface RegraDepreciacaoData {
  flag: string;
  label: string;
  percentual: number;
  adicional?: boolean;
}

export interface VeiculoData {
  placa: string;
  chassi?: string;
  renavam?: string;
  marca: string;
  modelo: string;
  ano: number;
  ano_fabricacao?: number;
  cor?: string;
  combustivel?: string;
  categoria?: string;
  tipo_uso?: string;
  codigo_fipe?: string;
  valor_fipe: number;
  alienado?: boolean;
  financeira?: string;
  procedencia?: string;
  cambio?: string;
  portas?: number;
  uso_aplicativo?: boolean;
  leilao?: boolean;
  // Flags de depreciação
  flag_placa_vermelha?: boolean;
  flag_ex_taxi?: boolean;
  flag_taxi_ativo?: boolean;
  flag_chassi_remarcado?: boolean;
  flag_ex_ressarcido?: boolean;
  flag_avarias_vistoria?: boolean;
}

export interface PlanoData {
  nome: string;
  codigo?: string;
  tipo?: string;
  linha?: string;
  coberturas?: string[];
  cota_participacao?: number;
  cota_minima?: number;
  cobertura_fipe?: number;
  carencia?: string;
}

export type TipoOperacao = 'adesao' | 'migracao' | 'inclusao' | 'troca_titularidade' | 'reativacao' | 'substituicao_placa';

export interface ContratoData {
  numero: string;
  valor_adesao: number;
  valor_mensal: number;
  valor_adicional?: number;
  dia_vencimento: number;
  data_inicio?: string;
  forma_pagamento?: string;
  tipo_entrada?: TipoOperacao;
}

export interface EmpresaData {
  nome: string;
  razao_social?: string;
  cnpj: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone?: string;
  email?: string;
  lgpd_email?: string;
}

export interface RegrasVendaData {
  // Taxas e Adesão
  taxa_adesao_percentual_fipe: string;
  taxa_adesao_minimo_volante: string;
  taxa_adesao_minimo_base: string;
  taxa_repasse_volante: string;
  taxa_substituicao_placa: string;
  taxa_troca_titularidade: string;
  taxa_revistoria: string;
  multa_rastreador: string;
  // Migração
  migracao_comprovantes_exigidos: string;
  migracao_prazo_resposta_horas: string;
  migracao_canal_oficial: string;
  migracao_isentar_carencia: string;
  // Pontuação
  prazo_reativacao_dias: string;
  // Repasse Maior
  repasse_maior_pct_favoravel: string;
  repasse_maior_pct_reduzido: string;
  repasse_maior_valor_favoravel: string;
  repasse_maior_valor_reduzido: string;
  repasse_maior_corte_boletos: string;
}

export interface MigracaoData {
  associacao_origem: string;
  data_aprovacao: string;
  carencia_isenta: boolean;
  aprovada: boolean;
}

export interface SubstituicaoData {
  placa_anterior: string;
  modelo_anterior: string;
  fipe_anterior: number;
}

export interface TrocaTitularidadeData {
  titular_anterior: string;
  cenario: string;
  cenario_label: string;
}

export interface TermoAfiliacaoData {
  cliente: ClienteData;
  veiculo: VeiculoData;
  plano: PlanoData;
  contrato: ContratoData;
  empresa: EmpresaData;
  consultor?: { nome: string };
  configRastreador?: {
    fipeMinCarro: number;
    fipeMinMoto: number;
  };
  regrasVenda?: RegrasVendaData;
  regrasDepreciacao?: RegraDepreciacaoData[];
  migracao?: MigracaoData;
  substituicao?: SubstituicaoData;
  trocaTitularidade?: TrocaTitularidadeData;
  oficina?: OficinaData;
}

export interface OficinaData {
  nome: string;
  cnpj?: string;
  telefone?: string;
  whatsapp?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
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

// ============= CÁLCULOS =============

/**
 * Calcula a cota de participação (% do valor FIPE)
 */
export const calcularCotaParticipacao = (
  valorFipe: number | null | undefined,
  percentual: number | null | undefined
): number => {
  const fipe = valorFipe || 0;
  const pct = percentual || 10;
  return (fipe * pct) / 100;
};

/**
 * Calcula a data da primeira mensalidade baseado no dia de vencimento
 */
export const calcularPrimeiraMensalidade = (diaVencimento: number): string => {
  const hoje = new Date();
  let ano = hoje.getFullYear();
  let mes = hoje.getMonth() + 1; // próximo mês
  
  // Se estamos muito próximos do vencimento, vai para o mês seguinte
  if (hoje.getDate() >= diaVencimento - 5) {
    mes += 1;
  }
  
  // Ajustar virada de ano
  if (mes > 12) {
    mes = 1;
    ano += 1;
  }
  
  // Formatar como DD/MM/AAAA
  const dia = String(diaVencimento).padStart(2, "0");
  const mesStr = String(mes).padStart(2, "0");
  
  return `${dia}/${mesStr}/${ano}`;
};

/**
 * Gera número do termo no formato AAAA-NNNNNN
 */
export const gerarNumeroTermo = (numeroContrato: string): string => {
  const ano = new Date().getFullYear();
  // Extrai apenas números do contrato e pega os últimos 6 dígitos
  const numeros = numeroContrato.replace(/\D/g, "").slice(-6).padStart(6, "0");
  return `${ano}-${numeros}`;
};

// ============= MAPPERS =============

/**
 * Mapeia dados do contrato/cotação para a interface do template
 */
// ============= INFERÊNCIA =============

function inferirCambio(modelo: string | null | undefined): string {
  if (!modelo) return '—';
  const m = modelo.toUpperCase();
  // Manual patterns
  if (/\b(MANUAL|MECANICO|MECÂNICO|MT|MEC)\b/.test(m)) return 'Manual';
  // Automático patterns (FIPE names, common abbreviations)
  if (/\b(AUTOMATICO|AUTOMÁTICO|CVT|AT\b|AUT|TIPTRONIC|POWERSHIFT|DSG|S[\.\-]?TRONIC|I[\.\-]?MOTION|MULTITRONIC|STEPTRONIC|E[\.\-]?CVT|DIRECT[\.\-]?SHIFT|PDK|EDC|XTRONIC|LINEARTRONIC|SKYACTIV[\.\-]?DRIVE)\b/.test(m)) return 'Automático';
  // Additional patterns often found in FIPE model names
  if (/\bFLEX\s*(AUT|AT)\b/.test(m)) return 'Automático';
  if (/\bFLEX\s*(MEC|MT)\b/.test(m)) return 'Manual';
  // Pattern: "1.0 AT" or "2.0 AUT" anywhere in the string
  if (/\d\.\d\s*(AUT|AT)\b/.test(m)) return 'Automático';
  if (/\d\.\d\s*(MEC|MT)\b/.test(m)) return 'Manual';
  return '—';
}

function inferirPortas(categoria: string | null | undefined): number {
  if (!categoria) return 4;
  const c = categoria.toLowerCase();
  if (c.includes('moto') || c.includes('motocicleta') || c.includes('scooter') || c.includes('triciclo')) return 0;
  if (c.includes('coupe') || c.includes('cupê') || c.includes('esportivo') || c.includes('conversível') || c.includes('conversivel') || c.includes('roadster')) return 2;
  if (c.includes('utilitário') || c.includes('utilitario') || c.includes('van') || c.includes('furgão') || c.includes('furgao')) return 4;
  return 4;
}

function ehLeilao(categoria: string | null | undefined, procedencia?: string | null): boolean {
  if (!categoria && !procedencia) return false;
  const c = (categoria || '').toLowerCase();
  const p = (procedencia || '').toLowerCase();
  return c.includes('leilão') || c.includes('leilao') ||
         p.includes('leilão') || p.includes('leilao');
}

export function mapearDadosParaTemplate(
  contrato: any,
  plano: any,
  empresa: any,
  lead?: any,
  associado?: any,
  vendedorNome?: string | null,
  veiculoDB?: any,
): TermoAfiliacaoData {
  // Usar dados do associado se existir, senão do lead
  const cliente = associado || lead || {};
  const veiculo = lead || contrato || {};
  
  return {
    cliente: {
      nome: contrato.cliente_nome || cliente.nome || "",
      cpf: contrato.cliente_cpf || cliente.cpf || "",
      rg: contrato.cliente_rg || cliente.rg || "",
      rg_orgao: contrato.cliente_rg_orgao || cliente.rg_orgao || "",
      cnh: contrato.cliente_cnh || "",
      cnh_validade: contrato.cliente_cnh_validade || "",
      cnh_categoria: contrato.cliente_cnh_categoria || "",
      data_nascimento: contrato.cliente_data_nascimento || cliente.data_nascimento || "",
      estado_civil: contrato.cliente_estado_civil || cliente.estado_civil || "",
      profissao: contrato.cliente_profissao || cliente.profissao || "",
      email: contrato.cliente_email || cliente.email || "",
      telefone: contrato.cliente_telefone || cliente.telefone || "",
      telefone_secundario: contrato.cliente_telefone_secundario || cliente.telefone_secundario || "",
      logradouro: contrato.cliente_logradouro || cliente.logradouro || "",
      numero: contrato.cliente_numero || cliente.numero || "",
      complemento: contrato.cliente_complemento || cliente.complemento || "",
      bairro: contrato.cliente_bairro || cliente.bairro || "",
      cidade: contrato.cliente_cidade || cliente.cidade || "",
      uf: contrato.cliente_uf || cliente.uf || "",
      cep: contrato.cliente_cep || cliente.cep || "",
    },
    veiculo: {
      placa: contrato.veiculo_placa || veiculo.veiculo_placa || "",
      chassi: contrato.veiculo_chassi || veiculo.veiculo_chassi || "",
      renavam: contrato.veiculo_renavam || veiculo.veiculo_renavam || "",
      marca: contrato.veiculo_marca || veiculo.veiculo_marca || "",
      modelo: contrato.veiculo_modelo || veiculo.veiculo_modelo || "",
      ano: contrato.veiculo_ano || veiculo.veiculo_ano || 0,
      ano_fabricacao: contrato.veiculo_ano_fabricacao || veiculo.veiculo_ano_fabricacao || 0,
      cor: contrato.veiculo_cor || veiculo.veiculo_cor || "",
      combustivel: contrato.veiculo_combustivel || veiculo.veiculo_combustivel || "",
      categoria: contrato.veiculo_categoria || veiculo.veiculo_categoria || "Automóvel",
      tipo_uso: contrato.veiculo_tipo_uso || veiculo.veiculo_tipo_uso || "Particular",
      codigo_fipe: contrato.codigo_fipe || veiculo.codigo_fipe || "",
      valor_fipe: contrato.veiculo_valor_fipe || veiculo.veiculo_fipe || 0,
      alienado: contrato.veiculo_alienado || veiculo.veiculo_alienado || false,
      financeira: contrato.veiculo_financeira || veiculo.veiculo_financeira || "",
      procedencia: contrato.veiculo_procedencia || veiculo.veiculo_procedencia || "Usado de particular",
      cambio: inferirCambio(contrato.veiculo_modelo || veiculo.veiculo_modelo),
      portas: inferirPortas(contrato.veiculo_categoria || veiculo.veiculo_categoria),
      uso_aplicativo: contrato.uso_aplicativo || false,
      leilao: ehLeilao(contrato.veiculo_categoria || veiculo.veiculo_categoria, contrato.veiculo_procedencia || veiculo.veiculo_procedencia),
      // Flags de depreciação (vindas do registro do veículo no banco)
      flag_placa_vermelha: veiculoDB?.flag_placa_vermelha || false,
      flag_ex_taxi: veiculoDB?.flag_ex_taxi || false,
      flag_taxi_ativo: veiculoDB?.flag_taxi_ativo || false,
      flag_chassi_remarcado: veiculoDB?.flag_chassi_remarcado || false,
      flag_ex_ressarcido: veiculoDB?.flag_ex_ressarcido || false,
      flag_avarias_vistoria: veiculoDB?.flag_avarias_vistoria || false,
    },
    plano: {
      nome: plano?.nome || "Plano Padrão",
      codigo: plano?.codigo || "",
      tipo: plano?.tipo_uso || "Normal",
      linha: plano?.linha || "Normal",
      coberturas: plano?.coberturas || [],
      // Priorizar valores contextuais do contrato (ex: uso app tem cota diferente)
      cota_participacao: contrato.cota_participacao ?? plano?.cota_participacao ?? 6,
      cota_minima: contrato.cota_minima ?? plano?.cota_minima ?? 1200,
      cobertura_fipe: contrato.cobertura_fipe || plano?.cobertura_fipe || 100,
      carencia: plano?.carencia || "90 dias após instalação do rastreador",
    },
    contrato: {
      numero: contrato.numero || "",
      valor_adesao: contrato.valor_adesao || 0,
      valor_mensal: contrato.valor_mensal || 0,
      valor_adicional: contrato.valor_adicional || 0,
      dia_vencimento: contrato.dia_vencimento || 10,
      data_inicio: contrato.data_inicio || "",
      forma_pagamento: "Boleto Bancário",
      tipo_entrada: contrato.tipo_entrada || 'adesao',
    },
    empresa: {
      nome: empresa?.empresa_nome || "ABP PraticCar",
      razao_social: empresa?.empresa_razao_social || "Associação de Benefícios PraticCar",
      cnpj: empresa?.empresa_cnpj || "XX.XXX.XXX/0001-XX",
      logradouro: empresa?.empresa_logradouro || "Av. das Américas",
      numero: empresa?.empresa_numero || "19.005",
      bairro: empresa?.empresa_bairro || "Recreio dos Bandeirantes",
      cidade: empresa?.empresa_cidade || "Rio de Janeiro",
      uf: empresa?.empresa_uf || "RJ",
      cep: empresa?.empresa_cep || "22790-703",
      telefone: empresa?.empresa_telefone || "",
      email: empresa?.empresa_email || "",
      lgpd_email: empresa?.empresa_lgpd_email || "lgpd@praticcar.com.br",
    },
    consultor: vendedorNome ? { nome: vendedorNome } : undefined,
  };
}

/**
 * Busca configurações da empresa do banco de dados
 */
export async function buscarConfiguracoesEmpresa(supabase: any): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("configuracoes")
    .select("chave, valor")
    .like("chave", "empresa_%");
  
  if (error || !data) {
    console.warn("[termo-afiliacao] Erro ao buscar configs empresa:", error);
    return {};
  }
  
  const configs: Record<string, string> = {};
  for (const row of data) {
    configs[row.chave] = row.valor;
  }
  
  return configs;
}

// ============= REGRAS DE DEPRECIAÇÃO =============

const DEPRECIACOES_FALLBACK: RegraDepreciacaoData[] = [
  { flag: 'flag_placa_vermelha', label: 'Placa vermelha', percentual: 25 },
  { flag: 'flag_ex_taxi', label: 'Ex-táxi', percentual: 25 },
  { flag: 'flag_taxi_ativo', label: 'Táxi ativo', percentual: 25 },
  { flag: 'flag_chassi_remarcado', label: 'Chassi remarcado', percentual: 30 },
  { flag: 'flag_leilao', label: 'Veículo de leilão', percentual: 30 },
  { flag: 'flag_ex_ressarcido', label: 'Já indenizado anteriormente', percentual: 30 },
  { flag: 'flag_avarias_vistoria', label: 'Avarias pré-existentes (vistoria)', percentual: 20, adicional: true },
];

/**
 * Busca regras de depreciação da tabela configuracoes (chave: regras_depreciacao)
 */
export async function buscarRegrasDepreciacao(supabase: any): Promise<RegraDepreciacaoData[]> {
  try {
    const { data } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'regras_depreciacao')
      .maybeSingle();
    if (data?.valor) {
      const parsed = typeof data.valor === 'string' ? JSON.parse(data.valor) : data.valor;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    return DEPRECIACOES_FALLBACK;
  } catch (err) {
    console.warn('[termo-afiliacao] Erro ao buscar regras_depreciacao, usando fallback:', err);
    return DEPRECIACOES_FALLBACK;
  }
}

// ============= REGRAS DE VENDA =============

const CHAVES_CONFIGURACOES_REGRAS = [
  'taxa_adesao_percentual_fipe',
  'taxa_adesao_minimo_volante',
  'taxa_adesao_minimo_base',
  'taxa_repasse_volante',
  'taxa_substituicao_placa',
  'taxa_troca_titularidade',
  'taxa_revistoria',
  'multa_rastreador',
] as const;

const CHAVES_COMISSOES_REGRAS = [
  'migracao_comprovantes_exigidos',
  'migracao_prazo_resposta_horas',
  'migracao_canal_oficial',
  'migracao_isentar_carencia',
  'prazo_reativacao_dias',
  'repasse_maior_pct_favoravel',
  'repasse_maior_pct_reduzido',
  'repasse_maior_valor_favoravel',
  'repasse_maior_valor_reduzido',
  'repasse_maior_corte_boletos',
] as const;

export interface BuscarRegrasVendaResult {
  regras: RegrasVendaData | null;
  faltantes: string[];
}

/**
 * Busca todas as configurações de Regras de Venda de ambas as tabelas.
 * Retorna as regras prontas para injeção no template e a lista de chaves faltantes.
 */
export async function buscarRegrasVenda(supabase: any): Promise<BuscarRegrasVendaResult> {
  const faltantes: string[] = [];

  // 1. Buscar de configuracoes
  const { data: dataConf } = await supabase
    .from('configuracoes')
    .select('chave, valor')
    .in('chave', [...CHAVES_CONFIGURACOES_REGRAS]);

  const confMap: Record<string, string> = {};
  for (const row of (dataConf || [])) {
    confMap[row.chave] = row.valor;
  }

  // 2. Buscar de comissoes_parametros
  const { data: dataComissoes } = await supabase
    .from('comissoes_parametros')
    .select('chave, valor')
    .in('chave', [...CHAVES_COMISSOES_REGRAS]);

  const comMap: Record<string, string> = {};
  for (const row of (dataComissoes || [])) {
    comMap[row.chave] = row.valor;
  }

  // 3. Validar presença de todas as chaves
  for (const chave of CHAVES_CONFIGURACOES_REGRAS) {
    if (confMap[chave] == null) faltantes.push(`configuracoes.${chave}`);
  }
  for (const chave of CHAVES_COMISSOES_REGRAS) {
    if (comMap[chave] == null) faltantes.push(`comissoes_parametros.${chave}`);
  }

  if (faltantes.length > 0) {
    console.warn('[buscarRegrasVenda] Chaves faltantes:', faltantes);
    return { regras: null, faltantes };
  }

  return {
    regras: {
      taxa_adesao_percentual_fipe: confMap['taxa_adesao_percentual_fipe'],
      taxa_adesao_minimo_volante: confMap['taxa_adesao_minimo_volante'],
      taxa_adesao_minimo_base: confMap['taxa_adesao_minimo_base'],
      taxa_repasse_volante: confMap['taxa_repasse_volante'],
      taxa_substituicao_placa: confMap['taxa_substituicao_placa'],
      taxa_troca_titularidade: confMap['taxa_troca_titularidade'],
      taxa_revistoria: confMap['taxa_revistoria'],
      multa_rastreador: confMap['multa_rastreador'],
      migracao_comprovantes_exigidos: comMap['migracao_comprovantes_exigidos'],
      migracao_prazo_resposta_horas: comMap['migracao_prazo_resposta_horas'],
      migracao_canal_oficial: comMap['migracao_canal_oficial'],
      migracao_isentar_carencia: comMap['migracao_isentar_carencia'],
      prazo_reativacao_dias: comMap['prazo_reativacao_dias'],
      repasse_maior_pct_favoravel: comMap['repasse_maior_pct_favoravel'],
      repasse_maior_pct_reduzido: comMap['repasse_maior_pct_reduzido'],
      repasse_maior_valor_favoravel: comMap['repasse_maior_valor_favoravel'],
      repasse_maior_valor_reduzido: comMap['repasse_maior_valor_reduzido'],
      repasse_maior_corte_boletos: comMap['repasse_maior_corte_boletos'],
    },
    faltantes: [],
  };
}

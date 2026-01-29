/**
 * Utilitários para parsing e limpeza de dados de oficinas durante importação
 */

// Mapa de estados brasileiros para sigla UF
const ESTADOS_PARA_UF: Record<string, string> = {
  'ACRE': 'AC',
  'ALAGOAS': 'AL',
  'AMAPA': 'AP',
  'AMAZONAS': 'AM',
  'BAHIA': 'BA',
  'CEARA': 'CE',
  'DISTRITO FEDERAL': 'DF',
  'ESPIRITO SANTO': 'ES',
  'GOIAS': 'GO',
  'MARANHAO': 'MA',
  'MATO GROSSO': 'MT',
  'MATO GROSSO DO SUL': 'MS',
  'MINAS GERAIS': 'MG',
  'PARA': 'PA',
  'PARAIBA': 'PB',
  'PARANA': 'PR',
  'PERNAMBUCO': 'PE',
  'PIAUI': 'PI',
  'RIO DE JANEIRO': 'RJ',
  'RIO GRANDE DO NORTE': 'RN',
  'RIO GRANDE DO SUL': 'RS',
  'RONDONIA': 'RO',
  'RORAIMA': 'RR',
  'SANTA CATARINA': 'SC',
  'SAO PAULO': 'SP',
  'SERGIPE': 'SE',
  'TOCANTINS': 'TO',
};

// Lista de UFs válidas
const UFS_VALIDAS = Object.values(ESTADOS_PARA_UF);

export interface EnderecoParseado {
  logradouro: string;
  numero: string;
  bairro: string;
}

export interface OficinaImportRaw {
  tipo?: string;
  nome?: string;
  cnpj?: string;
  cep?: string;
  endereco?: string;
  telefone?: string;
  cidade?: string;
  estado?: string;
}

export interface OficinaImportProcessada {
  linha: number;
  valida: boolean;
  erros: string[];
  dados: {
    razao_social: string;
    nome_fantasia: string;
    cnpj: string;
    cep: string;
    logradouro: string;
    numero: string;
    bairro: string;
    telefone: string;
    cidade: string;
    estado: string;
    status: 'ativo';
    especialidades: string[];
  };
}

/**
 * Remove acentos de uma string
 */
function removerAcentos(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

/**
 * Limpa CNPJ removendo formatação
 */
export function limparCNPJ(cnpj: string | undefined | null): string {
  if (!cnpj) return '';
  return String(cnpj).replace(/\D/g, '');
}

/**
 * Valida se CNPJ tem 14 dígitos
 */
export function validarCNPJ(cnpj: string): boolean {
  const limpo = limparCNPJ(cnpj);
  if (limpo.length !== 14) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(limpo)) return false;
  
  return true;
}

/**
 * Limpa CEP removendo formatação
 */
export function limparCEP(cep: string | undefined | null): string {
  if (!cep) return '';
  return String(cep).replace(/\D/g, '');
}

/**
 * Limpa telefone removendo formatação
 */
export function limparTelefone(telefone: string | undefined | null): string {
  if (!telefone) return '';
  return String(telefone).replace(/\D/g, '');
}

/**
 * Limpa cidade removendo " CIDADE" do final e espaços extras
 */
export function limparCidade(cidade: string | undefined | null): string {
  if (!cidade) return '';
  return String(cidade)
    .replace(/\s*CIDADE$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Converte nome do estado ou UF para sigla UF
 */
export function parseEstado(estado: string | undefined | null): string {
  if (!estado) return '';
  
  // Remove " ESTADO" do final e normaliza
  const limpo = removerAcentos(String(estado))
    .replace(/\s*ESTADO$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Se já é uma UF válida, retorna
  if (UFS_VALIDAS.includes(limpo)) {
    return limpo;
  }
  
  // Tenta encontrar no mapa de estados
  const uf = ESTADOS_PARA_UF[limpo];
  if (uf) return uf;
  
  // Última tentativa: pegar primeiras 2 letras
  if (limpo.length >= 2) {
    const tentativa = limpo.substring(0, 2);
    if (UFS_VALIDAS.includes(tentativa)) {
      return tentativa;
    }
  }
  
  return limpo.substring(0, 2).toUpperCase();
}

/**
 * Parseia endereço no formato "RUA X, 123, BAIRRO"
 */
export function parseEndereco(endereco: string | undefined | null): EnderecoParseado {
  if (!endereco) {
    return { logradouro: '', numero: '', bairro: '' };
  }
  
  let enderecoLimpo = String(endereco);
  
  // Remove duplicatas tipo "ENDEREÇO: ..."
  if (enderecoLimpo.includes('ENDEREÇO:')) {
    enderecoLimpo = enderecoLimpo.split('ENDEREÇO:')[0];
  }
  
  enderecoLimpo = enderecoLimpo.trim();
  
  // Split por vírgula
  const partes = enderecoLimpo.split(',').map(p => p.trim());
  
  return {
    logradouro: partes[0] || '',
    numero: partes[1] || '',
    bairro: partes.slice(2).join(', ') || partes[2] || '',
  };
}

/**
 * Processa uma linha do Excel para formato de importação
 */
export function processarLinhaOficina(
  dados: OficinaImportRaw,
  linha: number
): OficinaImportProcessada {
  const erros: string[] = [];
  
  // Limpa e parseia dados
  const nome = String(dados.nome || '').trim();
  const cnpj = limparCNPJ(dados.cnpj);
  const cep = limparCEP(dados.cep);
  const telefone = limparTelefone(dados.telefone);
  const cidade = limparCidade(dados.cidade);
  const estado = parseEstado(dados.estado);
  const endereco = parseEndereco(dados.endereco);
  
  // Validações
  if (!nome || nome.length < 3) {
    erros.push('Nome/Razão Social é obrigatório (mín. 3 caracteres)');
  }
  
  if (!cnpj) {
    erros.push('CNPJ é obrigatório');
  } else if (!validarCNPJ(cnpj)) {
    erros.push('CNPJ inválido (deve ter 14 dígitos)');
  }
  
  if (!cidade) {
    erros.push('Cidade é obrigatória');
  }
  
  if (!estado || estado.length !== 2) {
    erros.push('Estado é obrigatório (UF com 2 caracteres)');
  }
  
  if (cep && cep.length !== 8) {
    erros.push('CEP deve ter 8 dígitos');
  }
  
  return {
    linha,
    valida: erros.length === 0,
    erros,
    dados: {
      razao_social: nome,
      nome_fantasia: nome,
      cnpj,
      cep,
      logradouro: endereco.logradouro,
      numero: endereco.numero,
      bairro: endereco.bairro,
      telefone,
      cidade,
      estado,
      status: 'ativo',
      especialidades: [],
    },
  };
}

/**
 * Verifica CNPJs duplicados dentro do array
 */
export function verificarDuplicadosNoArquivo(
  oficinas: OficinaImportProcessada[]
): OficinaImportProcessada[] {
  const cnpjsVistos = new Map<string, number>();
  
  return oficinas.map((oficina) => {
    const cnpj = oficina.dados.cnpj;
    
    if (cnpj) {
      const linhaAnterior = cnpjsVistos.get(cnpj);
      if (linhaAnterior !== undefined) {
        return {
          ...oficina,
          valida: false,
          erros: [...oficina.erros, `CNPJ duplicado no arquivo (linha ${linhaAnterior})`],
        };
      }
      cnpjsVistos.set(cnpj, oficina.linha);
    }
    
    return oficina;
  });
}

/**
 * Gera template Excel para download
 */
export function gerarTemplateOficinas(): Record<string, string>[] {
  return [
    {
      'Tipo': 'Oficina',
      'Nome': 'EXEMPLO AUTO CENTER LTDA',
      'CNPJ': '00.000.000/0001-00',
      'CEP': '00000-000',
      'Endereco': 'RUA EXEMPLO, 123, CENTRO',
      'Telefone': '(21) 99999-9999',
      'Cidade': 'RIO DE JANEIRO',
      'Estado': 'RJ',
    },
  ];
}

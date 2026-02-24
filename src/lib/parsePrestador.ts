export const TIPOS_SERVICO_VALIDOS = [
  "reboque", "pane_seca", "socorro_mecanico", "socorro_eletrico",
  "troca_pneu", "chaveiro", "bateria", "taxi", "hospedagem", "outro",
];

export const TIPOS_REBOQUE_VALIDOS = ["leve", "utilitario", "pesado"];

export interface PrestadorImport {
  razao_social: string;
  telefone: string;
  cidade: string;
  estado: string;
  tipos_servico: string[];
  nome_fantasia?: string;
  tipo_pessoa?: string;
  cnpj?: string;
  cpf?: string;
  whatsapp?: string;
  telefone_extra?: string;
  email?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  raio_atendimento_km?: number;
  tipos_reboque?: string[];
  banco?: string;
  agencia?: string;
  conta?: string;
  pix_tipo?: string;
  pix_chave?: string;
  valores?: ValorImport[];
}

export interface ValorImport {
  tipo_servico: string;
  tipo_reboque?: string | null;
  valor_saida?: number;
  valor_km?: number;
  km_franquia?: number;
  hr_trabalhada?: number;
  hr_parada?: number;
  diaria_base?: number;
}

export interface PrestadorValidado {
  dados: PrestadorImport;
  valido: boolean;
  erros: string[];
  linha: number;
}

export function validarPrestador(p: Record<string, unknown>, linha: number): PrestadorValidado {
  const erros: string[] = [];

  const razao_social = typeof p.razao_social === "string" ? p.razao_social.trim() : "";
  const telefone = typeof p.telefone === "string" ? p.telefone.trim() : "";
  const cidade = typeof p.cidade === "string" ? p.cidade.trim() : "";
  const estado = typeof p.estado === "string" ? p.estado.trim() : "";
  const tipos_servico = Array.isArray(p.tipos_servico) ? p.tipos_servico : [];

  if (!razao_social) erros.push("razao_social obrigatório");
  if (!telefone) erros.push("telefone obrigatório");
  if (!cidade) erros.push("cidade obrigatório");
  if (!estado) erros.push("estado obrigatório");
  if (tipos_servico.length === 0) erros.push("tipos_servico deve ter ao menos 1 item");

  for (const ts of tipos_servico) {
    if (!TIPOS_SERVICO_VALIDOS.includes(ts)) {
      erros.push(`tipo_servico inválido: ${ts}`);
    }
  }

  const tipos_reboque = Array.isArray(p.tipos_reboque) ? p.tipos_reboque : [];
  if (tipos_servico.includes("reboque") && tipos_reboque.length === 0) {
    erros.push("tipos_reboque obrigatório quando tem reboque");
  }
  for (const tr of tipos_reboque) {
    if (!TIPOS_REBOQUE_VALIDOS.includes(tr)) {
      erros.push(`tipo_reboque inválido: ${tr}`);
    }
  }

  const valores = Array.isArray(p.valores) ? p.valores as ValorImport[] : [];
  for (const v of valores) {
    if (!TIPOS_SERVICO_VALIDOS.includes(v.tipo_servico)) {
      erros.push(`Valor com tipo_servico inválido: ${v.tipo_servico}`);
    }
    if (!tipos_servico.includes(v.tipo_servico)) {
      erros.push(`Valor tipo_servico "${v.tipo_servico}" não está nos tipos_servico`);
    }
  }

  return {
    dados: {
      razao_social,
      telefone,
      cidade,
      estado,
      tipos_servico,
      nome_fantasia: typeof p.nome_fantasia === "string" ? p.nome_fantasia : undefined,
      tipo_pessoa: typeof p.tipo_pessoa === "string" ? p.tipo_pessoa : undefined,
      cnpj: typeof p.cnpj === "string" ? p.cnpj : undefined,
      cpf: typeof p.cpf === "string" ? p.cpf : undefined,
      whatsapp: typeof p.whatsapp === "string" ? p.whatsapp : undefined,
      telefone_extra: typeof p.telefone_extra === "string" ? p.telefone_extra : undefined,
      email: typeof p.email === "string" ? p.email : undefined,
      cep: typeof p.cep === "string" ? p.cep : undefined,
      logradouro: typeof p.logradouro === "string" ? p.logradouro : undefined,
      numero: typeof p.numero === "string" ? p.numero : undefined,
      bairro: typeof p.bairro === "string" ? p.bairro : undefined,
      raio_atendimento_km: typeof p.raio_atendimento_km === "number" ? p.raio_atendimento_km : undefined,
      tipos_reboque: tipos_reboque.length > 0 ? tipos_reboque : undefined,
      banco: typeof p.banco === "string" ? p.banco : undefined,
      agencia: typeof p.agencia === "string" ? p.agencia : undefined,
      conta: typeof p.conta === "string" ? p.conta : undefined,
      pix_tipo: typeof p.pix_tipo === "string" ? p.pix_tipo : undefined,
      pix_chave: typeof p.pix_chave === "string" ? p.pix_chave : undefined,
      valores: valores.length > 0 ? valores : undefined,
    },
    valido: erros.length === 0,
    erros,
    linha,
  };
}

export function parsePrestadoresJSON(jsonString: string): PrestadorValidado[] {
  const parsed = JSON.parse(jsonString);
  const lista = Array.isArray(parsed) ? parsed : parsed.prestadores;

  if (!Array.isArray(lista)) {
    throw new Error("JSON deve ser um array ou ter a chave 'prestadores' com um array");
  }

  return lista.map((item: Record<string, unknown>, index: number) => validarPrestador(item, index + 1));
}

// Parser do CSV de cobranças (SGA/Hinova ou export externo).
// Aceita TODOS os tipos e qualquer status (adimplente/inadimplente/pago/pendente).
// Cabeçalho mínimo: Nome, Matrícula. Demais colunas são opcionais e o parser
// reconhece variações comuns (cpf, valor, tipo, status, código de barras, placas, telefones, vencimento).

export interface BoletoCsv {
  placa: string;
  vencimento: string; // dd/mm/aaaa
  linha_digitavel: string;
  valor: number; // valor (R$); 0 quando não identificável
  tipo?: string; // mensalidade | taxa | adesao | outros (cru do CSV)
  status_origem?: string; // adimplente | inadimplente | pago | pendente | etc.
  link?: string; // URL da 2ª via Hinova (opcional)
}

/**
 * Extrai o valor monetário de um boleto a partir da linha digitável / código de barras.
 * - Boleto bancário Febraban (47 dígitos): valor está nas posições 38–47 (10 dígitos, 2 últimos = centavos).
 * - Arrecadação (48 dígitos, começa com 8): valor nas posições 5–15 (11 dígitos, 2 últimos = centavos).
 * Retorna 0 quando não consegue extrair.
 */
export function extrairValorBoleto(linhaDigitavel: string): number {
  if (!linhaDigitavel) return 0;
  const dig = linhaDigitavel.replace(/\D/g, '');
  try {
    if (dig.length === 47) {
      // Linha digitável de boleto bancário: campos com DV
      // Valor (10 dígitos) está nas posições 37..46 (zero-based)
      const raw = dig.slice(37, 47);
      const v = parseInt(raw, 10);
      if (Number.isFinite(v) && v > 0) return v / 100;
    }
    if (dig.length === 44) {
      // Código de barras de boleto bancário: valor nas posições 9..18
      const raw = dig.slice(9, 19);
      const v = parseInt(raw, 10);
      if (Number.isFinite(v) && v > 0) return v / 100;
    }
    if (dig.length === 48 && dig.startsWith('8')) {
      // Arrecadação
      const raw = dig.slice(4, 15);
      const v = parseInt(raw, 10);
      if (Number.isFinite(v) && v > 0) return v / 100;
    }
  } catch {
    // ignore
  }
  return 0;
}

export interface DestinatarioParsed {
  nome: string;
  primeiro_nome: string;
  matricula: string;
  cpf?: string; // opcional, quando coluna CPF está presente no CSV
  telefones_validos: string[]; // formato 55DDDNNNNNNNNN
  telefones_invalidos: string[]; // raw
  boletos: BoletoCsv[];
}

export interface ParseResultado {
  destinatarios: DestinatarioParsed[];
  total_linhas: number;
  total_associados: number;
  com_whatsapp: number;
  sem_whatsapp: number;
  total_telefones: number;
  total_boletos: number;
  valor_total: number;
  erros: string[];
}

// Cabeçalho mínimo obrigatório.
const COLUNAS_OBRIGATORIAS = ['nome', 'matricula'];

// Aliases de colunas opcionais (chave canônica → variantes aceitas no header).
const ALIASES: Record<string, string[]> = {
  cpf: ['cpf', 'cpf/cnpj', 'cpf cnpj', 'documento'],
  placas: ['placas', 'placa'],
  'telefone celular': ['telefone celular', 'celular', 'whatsapp'],
  telefone: ['telefone', 'telefone fixo', 'fone'],
  'data vencimento': ['data vencimento', 'vencimento', 'dt vencimento'],
  'codigo de barras': ['codigo de barras', 'linha digitavel', 'codigo barras', 'boleto'],
  valor: ['valor', 'valor boleto', 'valor cobranca', 'preco'],
  tipo: ['tipo', 'tipo cobranca', 'categoria', 'descricao'],
  status: ['status', 'situacao', 'status pagamento', 'status_pagamento'],
  link: [
    'link', 'link fatura', 'link da fatura', 'url fatura', 'url boleto',
    '2via', 'segunda via', 'link hinova',
    // Cabeçalhos do export padrão Hinova/SGA:
    '2a via boleto', '2via boleto', 'segunda via boleto', '2 via', '2 via boleto',
    'link 2 via', 'link 2via', 'link segunda via', '2a via', 'link da 2a via',
  ],
};

/**
 * Extrai a URL de um campo "Link" / "2ª Via Boleto".
 * Aceita:
 *  - URL crua: "https://short.hinova.com.br/v2/XXXX.pdf"
 *  - HTML anchor: '<a href="https://short.hinova.com.br/v2/XXXX.pdf" target="_blank">LINK</a>'
 *  - Texto contendo URL no meio
 * Retorna a primeira URL encontrada ou undefined.
 */
export function extrairUrlLink(raw: string): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  // 1. tag <a href="...">
  const hrefMatch = s.match(/href\s*=\s*["']([^"']+)["']/i);
  if (hrefMatch && /^https?:\/\//i.test(hrefMatch[1])) return hrefMatch[1].trim();
  // 2. URL crua direta
  if (/^https?:\/\//i.test(s)) return s.split(/\s+/)[0];
  // 3. URL embutida em texto
  const urlMatch = s.match(/https?:\/\/[^\s"'<>]+/i);
  if (urlMatch) return urlMatch[0];
  return undefined;
}

function normalizarHeader(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^\ufeff/, '')
    .trim();
}

// Parser CSV simples (suporta aspas duplas e BOM)
function parseCsvLinha(linha: string): string[] {
  const out: string[] = [];
  let cur = '';
  let dentroAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (dentroAspas && linha[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        dentroAspas = !dentroAspas;
      }
    } else if (c === ',' && !dentroAspas) {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

/**
 * Limpa e valida um telefone BR.
 * Retorna número formatado com 55 + DDD + 9XXXXXXXX (celular WhatsApp) ou null.
 */
export function classificarTelefone(raw: string): { valido: boolean; formatado: string | null } {
  if (!raw) return { valido: false, formatado: null };
  const num = raw.replace(/\D/g, '');
  if (!num) return { valido: false, formatado: null };
  // Bloqueia placeholders: todos zeros, todos 1, todos 9, ou um único dígito repetido
  if (/^(\d)\1+$/.test(num)) return { valido: false, formatado: null };

  // Remove código país se vier
  let local = num;
  if (local.startsWith('55') && local.length >= 12) local = local.slice(2);

  // Espera DDD + numero. Aceita 10 (fixo) ou 11 (celular) dígitos.
  if (local.length < 10 || local.length > 11) return { valido: false, formatado: null };

  const ddd = local.slice(0, 2);
  if (parseInt(ddd, 10) < 11 || parseInt(ddd, 10) > 99) return { valido: false, formatado: null };

  const restante = local.slice(2);

  // Bloqueia placeholders adicionais: número repetido (ex: 999999999, 111111111)
  if (/^(\d)\1+$/.test(restante)) return { valido: false, formatado: null };

  // Celular (WhatsApp) tem 9 dígitos começando com 9
  if (restante.length === 9 && restante.startsWith('9')) {
    return { valido: true, formatado: `55${ddd}${restante}` };
  }
  // Fixo (8 dígitos, começa 2-5) — descarta
  return { valido: false, formatado: null };
}

function parseDataVencimento(raw: string): string {
  // Mantém dd/mm/aaaa
  return raw.trim();
}

function extrairPlaca(raw: string): string {
  if (!raw) return '';
  // formato "PLACA|MATRICULA" ou só "PLACA". Pode vir multilinha (várias placas separadas por \n).
  const partes = raw
    .split(/[|\n\r]/)
    .map((p) => p.trim())
    .filter(Boolean);
  for (const p of partes) {
    // Placa real tem letra; matrícula é só número → ignora puramente numéricos
    if (/[A-Za-z]/.test(p)) return p.toUpperCase();
  }
  return '';
}

function primeiroNome(nomeCompleto: string): string {
  const partes = nomeCompleto.trim().split(/\s+/);
  if (!partes.length) return '';
  // Capitaliza
  const p = partes[0].toLowerCase();
  return p.charAt(0).toUpperCase() + p.slice(1);
}

export function parseCsvInadimplentes(conteudo: string): ParseResultado {
  const erros: string[] = [];
  const linhasRaw = conteudo
    .replace(/^\ufeff/, '')
    .split(/\r?\n/);

  // Mescla linhas de continuação: quando o CSV tem campo (ex: Placas) com quebra
  // de linha SEM aspas, o split acima quebra um registro em dois. A linha de
  // continuação não tem o número esperado de vírgulas e não começa com um nome
  // típico (texto antes da primeira vírgula sem dígito puro). Reanexamos.
  const linhas: string[] = [];
  for (const l of linhasRaw) {
    if (!l.trim()) continue;
    if (linhas.length === 0) { linhas.push(l); continue; }
    const virgulas = (l.match(/,/g) || []).length;
    // Linha de continuação típica: poucas vírgulas (placa quebrada tem 0–1) e
    // não começa com algo que pareça "Nome,Matrícula" (nome é texto+espaços
    // antes de vírgula seguida de dígitos).
    const pareceNovaLinha = /^[^,]+,\d+,/.test(l);
    if (!pareceNovaLinha && virgulas <= 5) {
      linhas[linhas.length - 1] = linhas[linhas.length - 1] + '\n' + l;
    } else {
      linhas.push(l);
    }
  }

  if (linhas.length < 2) {
    return {
      destinatarios: [],
      total_linhas: 0,
      total_associados: 0,
      com_whatsapp: 0,
      sem_whatsapp: 0,
      total_telefones: 0,
      total_boletos: 0,
      valor_total: 0,
      erros: ['CSV vazio ou sem dados.'],
    };
  }

  const headerRaw = parseCsvLinha(linhas[0]).map(normalizarHeader);
  // Resolve aliases → mapa canônico → índice da coluna no header.
  const idx: Record<string, number> = {};
  headerRaw.forEach((h, i) => {
    let canonico = h;
    for (const [canon, vars] of Object.entries(ALIASES)) {
      if (vars.includes(h)) { canonico = canon; break; }
    }
    if (!(canonico in idx)) idx[canonico] = i;
  });

  const faltando = COLUNAS_OBRIGATORIAS.filter((c) => !(c in idx));
  if (faltando.length) {
    return {
      destinatarios: [],
      total_linhas: 0,
      total_associados: 0,
      com_whatsapp: 0,
      sem_whatsapp: 0,
      total_telefones: 0,
      total_boletos: 0,
      valor_total: 0,
      erros: [`Colunas obrigatórias ausentes: ${faltando.join(', ')}. Mínimo: nome, matricula.`],
    };
  }

  // Helper para acessar coluna opcional sem dar undefined.
  const getCol = (cols: string[], canon: string): string => {
    const i = idx[canon];
    return i === undefined ? '' : (cols[i] || '');
  };

  // Parse de valor monetário em pt-BR ("1.234,56" → 1234.56).
  const parseValorBR = (raw: string): number => {
    if (!raw) return 0;
    const limpo = raw.replace(/[^\d,.\-]/g, '').replace(/\./g, '').replace(',', '.');
    const v = parseFloat(limpo);
    return Number.isFinite(v) ? v : 0;
  };

  const mapa = new Map<string, DestinatarioParsed>();
  let totalBoletos = 0;
  let descartadasColunas = 0;

  for (let i = 1; i < linhas.length; i++) {
    const cols = parseCsvLinha(linhas[i]);
    if (cols.length < 2) { descartadasColunas++; continue; }

    const nome = (cols[idx['nome']] || '').trim();
    const matricula = (cols[idx['matricula']] || '').trim();
    if (!nome || !matricula) continue;

    const cpf = getCol(cols, 'cpf').replace(/\D/g, '') || undefined;
    const placa = extrairPlaca(getCol(cols, 'placas'));
    const venc = parseDataVencimento(getCol(cols, 'data vencimento'));
    const linhaDig = getCol(cols, 'codigo de barras').trim();
    const valorCsv = parseValorBR(getCol(cols, 'valor'));
    const tipo = getCol(cols, 'tipo').trim() || undefined;
    const statusOrigem = getCol(cols, 'status').trim() || undefined;
    const linkRaw = getCol(cols, 'link').trim();
    const link = /^https?:\/\//i.test(linkRaw) ? linkRaw : undefined;

    // Aceita linha sem código de barras se houver vencimento OU valor.
    if (!linhaDig && !venc && valorCsv === 0) continue;

    const telCel = getCol(cols, 'telefone celular');
    const telFix = getCol(cols, 'telefone');

    const t1 = classificarTelefone(telCel);
    const t2 = classificarTelefone(telFix);

    const chave = matricula;
    let dest = mapa.get(chave);
    if (!dest) {
      dest = {
        nome,
        primeiro_nome: primeiroNome(nome),
        matricula,
        cpf,
        telefones_validos: [],
        telefones_invalidos: [],
        boletos: [],
      };
      const validos = new Set<string>();
      if (t1.formatado) validos.add(t1.formatado);
      if (t2.formatado) validos.add(t2.formatado);
      dest.telefones_validos = Array.from(validos);
      const invs: string[] = [];
      if (telCel.trim() && !t1.valido) invs.push(telCel.trim());
      if (telFix.trim() && !t2.valido) invs.push(telFix.trim());
      dest.telefones_invalidos = invs;
      mapa.set(chave, dest);
    } else if (!dest.cpf && cpf) {
      dest.cpf = cpf;
    }
    const valorFinal = valorCsv > 0 ? valorCsv : extrairValorBoleto(linhaDig);
    dest.boletos.push({
      placa,
      vencimento: venc,
      linha_digitavel: linhaDig,
      valor: valorFinal,
      tipo,
      status_origem: statusOrigem,
      link,
    });
    totalBoletos++;
  }

  const destinatarios = Array.from(mapa.values());
  const comWhats = destinatarios.filter((d) => d.telefones_validos.length > 0).length;
  const totalTel = destinatarios.reduce((s, d) => s + d.telefones_validos.length, 0);
  const valorTotal = destinatarios.reduce(
    (s, d) => s + d.boletos.reduce((bs, b) => bs + (b.valor || 0), 0),
    0,
  );

  if (descartadasColunas > 0) {
    erros.push(`${descartadasColunas} linha(s) descartada(s) por colunas insuficientes.`);
  }

  return {
    destinatarios,
    total_linhas: linhas.length - 1,
    total_associados: destinatarios.length,
    com_whatsapp: comWhats,
    sem_whatsapp: destinatarios.length - comWhats,
    total_telefones: totalTel,
    total_boletos: totalBoletos,
    valor_total: valorTotal,
    erros,
  };
}

/**
 * Monta o bloco multilinha que vai na variável {{2}} do template Meta.
 */
export function montarBlocoBoletos(boletos: BoletoCsv[]): string {
  return boletos
    .map((b) => {
      const placa = b.placa ? `Placa ${b.placa}` : 'Boleto';
      return `• ${placa} — venc. ${b.vencimento}\n  ${b.linha_digitavel}`;
    })
    .join('\n\n');
}

// Alias mantido para compat: o nome novo do parser é parseCsvCobrancas.
export const parseCsvCobrancas = parseCsvInadimplentes;


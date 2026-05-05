// Parser do CSV SGA/Hinova de inadimplentes.
// Cabeçalho esperado:
// Nome, Matrícula, Placas, Telefone Celular, Telefone, Data Vencimento, Data Vencimento Original, Codigo de Barras

export interface BoletoCsv {
  placa: string;
  vencimento: string; // dd/mm/aaaa
  linha_digitavel: string;
  valor: number; // extraído da linha digitável (R$); 0 quando não identificável
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

// Cabeçalho canônico (normalizado)
const COLUNAS_OBRIGATORIAS = [
  'nome',
  'matricula',
  'placas',
  'telefone celular',
  'telefone',
  'data vencimento',
  'codigo de barras',
];

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
  if (!num || /^0+$/.test(num)) return { valido: false, formatado: null };

  // Remove código país se vier
  let local = num;
  if (local.startsWith('55') && local.length >= 12) local = local.slice(2);

  // Espera DDD + numero. Aceita 10 (fixo) ou 11 (celular) dígitos.
  if (local.length < 10 || local.length > 11) return { valido: false, formatado: null };

  const ddd = local.slice(0, 2);
  if (parseInt(ddd, 10) < 11 || parseInt(ddd, 10) > 99) return { valido: false, formatado: null };

  const restante = local.slice(2);

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
  // formato "PLACA|MATRICULA" ou só "PLACA"
  const partes = raw.split('|').map((p) => p.trim()).filter(Boolean);
  for (const p of partes) {
    // Placa real tem letra; matrícula é só número
    if (/[A-Za-z]/.test(p)) return p.toUpperCase();
  }
  return partes[0] || '';
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
  const linhas = conteudo
    .replace(/^\ufeff/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);

  if (linhas.length < 2) {
    return {
      destinatarios: [],
      total_linhas: 0,
      total_associados: 0,
      com_whatsapp: 0,
      sem_whatsapp: 0,
      total_telefones: 0,
      total_boletos: 0,
      erros: ['CSV vazio ou sem dados.'],
    };
  }

  const header = parseCsvLinha(linhas[0]).map(normalizarHeader);
  const idx: Record<string, number> = {};
  header.forEach((h, i) => (idx[h] = i));

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
      erros: [`Colunas obrigatórias ausentes: ${faltando.join(', ')}`],
    };
  }

  const mapa = new Map<string, DestinatarioParsed>();
  let totalBoletos = 0;

  for (let i = 1; i < linhas.length; i++) {
    const cols = parseCsvLinha(linhas[i]);
    if (cols.length < header.length) continue;

    const nome = (cols[idx['nome']] || '').trim();
    const matricula = (cols[idx['matricula']] || '').trim();
    if (!nome || !matricula) continue;

    const placa = extrairPlaca(cols[idx['placas']] || '');
    const venc = parseDataVencimento(cols[idx['data vencimento']] || '');
    const linhaDig = (cols[idx['codigo de barras']] || '').trim();
    if (!linhaDig) continue;

    const telCel = cols[idx['telefone celular']] || '';
    const telFix = cols[idx['telefone']] || '';

    const t1 = classificarTelefone(telCel);
    const t2 = classificarTelefone(telFix);

    const chave = matricula;
    let dest = mapa.get(chave);
    if (!dest) {
      dest = {
        nome,
        primeiro_nome: primeiroNome(nome),
        matricula,
        telefones_validos: [],
        telefones_invalidos: [],
        boletos: [],
      };
      // adiciona telefones únicos
      const validos = new Set<string>();
      if (t1.formatado) validos.add(t1.formatado);
      if (t2.formatado) validos.add(t2.formatado);
      dest.telefones_validos = Array.from(validos);
      const invs: string[] = [];
      if (telCel.trim() && !t1.valido) invs.push(telCel.trim());
      if (telFix.trim() && !t2.valido) invs.push(telFix.trim());
      dest.telefones_invalidos = invs;
      mapa.set(chave, dest);
    }
    dest.boletos.push({ placa, vencimento: venc, linha_digitavel: linhaDig });
    totalBoletos++;
  }

  const destinatarios = Array.from(mapa.values());
  const comWhats = destinatarios.filter((d) => d.telefones_validos.length > 0).length;
  const totalTel = destinatarios.reduce((s, d) => s + d.telefones_validos.length, 0);

  return {
    destinatarios,
    total_linhas: linhas.length - 1,
    total_associados: destinatarios.length,
    com_whatsapp: comWhats,
    sem_whatsapp: destinatarios.length - comWhats,
    total_telefones: totalTel,
    total_boletos: totalBoletos,
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

// Mapping de variáveis Meta para o disparo do CSV de Cobrança.
// Compartilha o vocabulário com o edge `disparar-cobranca-csv-meta`.

export type VarSource =
  | 'nome'
  | 'primeiro_nome'
  | 'matricula'
  | 'valor_total'
  | 'lista_boletos'
  | 'placa_primeira'
  | 'vencimento_primeiro'
  | 'linha_digitavel_primeira'
  | 'valor_primeiro_boleto'
  | 'qtd_boletos'
  | 'texto_fixo';

export interface VarMappingEntry {
  source: VarSource;
  texto?: string; // só usado quando source === 'texto_fixo'
}

export type VarMapping = Record<string, VarMappingEntry>; // chave = '1','2',...

export const VAR_SOURCE_LABELS: Record<VarSource, string> = {
  nome: 'Nome completo',
  primeiro_nome: 'Primeiro nome',
  matricula: 'Matrícula',
  valor_total: 'Valor total (soma dos boletos)',
  lista_boletos: 'Lista de boletos agrupados',
  placa_primeira: 'Placa do 1º boleto',
  vencimento_primeiro: 'Vencimento do 1º boleto',
  linha_digitavel_primeira: 'Linha digitável do 1º boleto',
  valor_primeiro_boleto: 'Valor do 1º boleto',
  qtd_boletos: 'Quantidade de boletos',
  texto_fixo: 'Texto fixo (digitado pelo operador)',
};

/** Extrai índices de {{n}} preservando ordem de primeira ocorrência. */
export function parseVariaveisTemplate(...textos: (string | null | undefined)[]): string[] {
  const vistos = new Set<string>();
  const ordem: string[] = [];
  for (const t of textos) {
    if (!t) continue;
    const re = /\{\{\s*(\d+)\s*\}\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      const k = m[1];
      if (!vistos.has(k)) {
        vistos.add(k);
        ordem.push(k);
      }
    }
  }
  return ordem.sort((a, b) => Number(a) - Number(b));
}

/** Heurística inicial para o mapping com base no nome do template + variáveis presentes. */
export function sugerirMappingInicial(
  templateNome: string,
  vars: string[],
): VarMapping {
  const m: VarMapping = {};
  // Template canônico do projeto: {{1}}=nome, {{2}}=lista_boletos
  if (templateNome === 'cobranca_inadimplencia_pratic' || templateNome === 'cobranca_inadimplencia_pratic_v2') {
    if (vars.includes('1')) m['1'] = { source: 'primeiro_nome' };
    if (vars.includes('2')) m['2'] = { source: 'lista_boletos' };
    return m;
  }
  // Cobranca_mensalidade: {{1}}=nome {{2}}=referência {{3}}=venc
  // Heurística genérica:
  if (vars[0]) m[vars[0]] = { source: 'primeiro_nome' };
  if (vars[1]) m[vars[1]] = { source: 'valor_total' };
  if (vars[2]) m[vars[2]] = { source: 'vencimento_primeiro' };
  if (vars[3]) m[vars[3]] = { source: 'placa_primeira' };
  if (vars[4]) m[vars[4]] = { source: 'matricula' };
  if (vars[5]) m[vars[5]] = { source: 'linha_digitavel_primeira' };
  return m;
}

export interface DestinatarioPreview {
  nome: string;
  primeiro_nome?: string;
  matricula: string;
  boletos: Array<{
    placa?: string;
    vencimento?: string;
    linha_digitavel?: string;
    valor?: number;
    link?: string;
  }>;
}

function formatBRL(v: number): string {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function primeiroNome(s: string): string {
  const p = (s || '').trim().split(/\s+/)[0] || '';
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : 'Associado';
}

function formatarBoletoLinha(b: DestinatarioPreview['boletos'][number]): string {
  const placa = b.placa ? `Placa ${b.placa}` : 'Boleto';
  const linha = (b.linha_digitavel || '').replace(/\D/g, '');
  return `• ${placa} venc. ${b.vencimento || '-'} | ${linha}`;
}

/** Resolve o valor de UMA variável para um destinatário (preview UI). */
export function resolverValorVariavel(
  entry: VarMappingEntry,
  d: DestinatarioPreview,
): string {
  switch (entry.source) {
    case 'nome': return d.nome || '';
    case 'primeiro_nome': return d.primeiro_nome || primeiroNome(d.nome);
    case 'matricula': return d.matricula || '';
    case 'valor_total': {
      const total = (d.boletos || []).reduce((s, b) => s + (b.valor || 0), 0);
      return formatBRL(total);
    }
    case 'lista_boletos':
      return (d.boletos || []).map(formatarBoletoLinha).join(' ⏐ ');
    case 'placa_primeira': return d.boletos?.[0]?.placa || '';
    case 'vencimento_primeiro': return d.boletos?.[0]?.vencimento || '';
    case 'linha_digitavel_primeira':
      return (d.boletos?.[0]?.linha_digitavel || '').replace(/\D/g, '');
    case 'valor_primeiro_boleto':
      return formatBRL(d.boletos?.[0]?.valor || 0);
    case 'qtd_boletos': return String((d.boletos || []).length);
    case 'texto_fixo': return entry.texto || '';
  }
}

/** Renderiza o corpo do template trocando {{n}} pelos valores resolvidos. */
export function renderPreview(
  corpo: string,
  mapping: VarMapping,
  destinatario: DestinatarioPreview,
): string {
  return (corpo || '').replace(/\{\{\s*(\d+)\s*\}\}/g, (_m, k) => {
    const entry = mapping[String(k)];
    if (!entry) return `{{${k}}}`;
    return resolverValorVariavel(entry, destinatario);
  });
}

/** Validação: todo {{n}} presente no corpo precisa estar mapeado e (se texto_fixo) preenchido. */
export function validarMapping(vars: string[], mapping: VarMapping): { ok: boolean; faltando: string[] } {
  const faltando: string[] = [];
  for (const k of vars) {
    const e = mapping[k];
    if (!e) { faltando.push(k); continue; }
    if (e.source === 'texto_fixo' && !(e.texto || '').trim()) faltando.push(k);
  }
  return { ok: faltando.length === 0, faltando };
}

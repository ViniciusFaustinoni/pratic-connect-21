// deno-lint-ignore-file no-explicit-any
/**
 * Construção de payloads para os endpoints Hinova SGA.
 * Mantém a serialização e formatação de dados isolada do orquestrador
 * `sga-hinova-sync`, espelhando a documentação oficial v2.
 */

import type { FotoHinovaPayload } from './hinova-client.ts';

export interface AssociadoCtx {
  /** Código da conta bancária. Obrigatório APENAS quando a regional tem mais de uma conta. */
  codigo_conta?: number;
  codigo_regional?: number;
  codigo_cooperativa?: number;
  codigo_voluntario?: number;
  codigo_tipo_cobranca_recorrente?: number;
  codigo_como_conheceu?: number;
  codigo_profissao?: number;
  data_contrato_iso?: string | null;
}

export interface VeiculoCtx {
  codigo_associado: number;
  /** Código da conta bancária. Obrigatório APENAS quando a regional tem mais de uma conta. */
  codigo_conta?: number;
  codigo_voluntario: number;
  codigo_situacao?: number;
  codigo_cooperativa?: number;
  codigo_plano?: number;
  valor_mensalidade?: number;
  valor_adesao?: number;
  produtos?: Array<{ codigo_produto: number }>;
  tipo_veiculo: number;
  codigo_combustivel?: number | null;
  codigo_cor?: number | null;
  data_contrato_iso?: string | null;
}

// ============================================================
// Helpers de formatação
// ============================================================

export function cleanDigits(v: string | null | undefined): string {
  return (v || '').replace(/\D/g, '');
}

export function cleanAlphaNum(v: string | null | undefined): string {
  return (v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}

/** Hinova aceita "999..." sem formatação ou "(99) 99999-9999" — enviamos só dígitos. */
export function formatPhone(v: string | null | undefined): string {
  return cleanDigits(v);
}

/** Sexo — Hinova exige 'M' ou 'F'. Mapeia formas livres. */
export function normalizeSexo(v: string | null | undefined): 'M' | 'F' {
  const s = (v || '').trim().toUpperCase();
  if (s.startsWith('F')) return 'F';
  return 'M';
}

/** UF — passa sempre a sigla (Hinova aceita descrição ou sigla; sigla é mais robusta). */
export function normalizeUF(v: string | null | undefined): string {
  return (v || '').trim().toUpperCase().slice(0, 2);
}

const PLACA_PLACEHOLDER_REGEX = /^0KM[A-Z0-9]{5}$/i;
export function isPlacaPlaceholder(p: string | null | undefined): boolean {
  return !!p && PLACA_PLACEHOLDER_REGEX.test(p.trim());
}

export function placaParaSga(placa: string | null | undefined): string {
  if (!placa) return '';
  if (isPlacaPlaceholder(placa)) return '';
  return cleanAlphaNum(placa);
}

// ============================================================
// PAYLOAD: associado
// Doc: POST /associado/cadastrar
// ============================================================

export function buildAssociadoPayload(
  associado: any,
  ctx: AssociadoCtx,
): Record<string, unknown> {
  const cpf = cleanDigits(associado.cpf);
  const sexo = normalizeSexo(associado.sexo);
  const celular = formatPhone(associado.whatsapp || associado.telefone);
  const telefone = formatPhone(associado.telefone);

  const payload: Record<string, unknown> = {
    nome: (associado.nome || '').trim(),
    cpf,
    rg: associado.rg || '',
    data_nascimento: formatDateBR(associado.data_nascimento),
    sexo,
    logradouro: associado.logradouro || '',
    numero: associado.numero || 'S/N',
    bairro: associado.bairro || '',
    cidade: associado.cidade || '',
    estado: normalizeUF(associado.uf || associado.estado),
    cep: cleanDigits(associado.cep),
    dia_vencimento: associado.dia_vencimento || 10,
  };
  if (Number.isFinite(ctx.codigo_conta) && (ctx.codigo_conta as number) > 0) {
    payload.codigo_conta = ctx.codigo_conta;
  }

  // Opcionais — só envia se tiver valor real
  if (associado.complemento) payload.complemento = associado.complemento;
  if (associado.email) payload.email = String(associado.email).trim();
  if (associado.email_auxiliar) payload.email_auxiliar = String(associado.email_auxiliar).trim();
  if (telefone) payload.telefone = telefone;
  if (celular) payload.celular = celular;
  if (associado.orgao_expedidor_rg) payload.orgao_expedidor_rg = associado.orgao_expedidor_rg;
  if (associado.data_expedicao_rg) payload.data_expedicao_rg = formatDateBR(associado.data_expedicao_rg);
  if (associado.numero_cnh) payload.numero_cnh = associado.numero_cnh;
  if (associado.categoria_cnh) payload.categoria_cnh = associado.categoria_cnh;
  if (associado.data_vencimento_habilitacao) {
    payload.data_vencimento_habilitacao = formatDateBR(associado.data_vencimento_habilitacao);
  }
  if (associado.data_primeira_habilitacao) {
    payload.data_primeira_habilitacao = formatDateBR(associado.data_primeira_habilitacao);
  }

  if (ctx.codigo_regional) payload.codigo_regional = ctx.codigo_regional;
  if (ctx.codigo_cooperativa) payload.codigo_cooperativa = ctx.codigo_cooperativa;
  if (ctx.codigo_voluntario) payload.codigo_voluntario = ctx.codigo_voluntario;
  if (ctx.codigo_tipo_cobranca_recorrente) {
    // Doc usa `codigo_tipo_cobranca_recorrente` no GET, mas o POST aceita o mesmo.
    payload.codigo_tipo_cobranca_recorrente = ctx.codigo_tipo_cobranca_recorrente;
  }
  if (ctx.codigo_como_conheceu) payload.codigo_como_conheceu = ctx.codigo_como_conheceu;
  if (ctx.codigo_profissao) payload.codigo_profissao = ctx.codigo_profissao;
  if (ctx.data_contrato_iso) payload.data_contrato = formatDateBR(ctx.data_contrato_iso);

  payload.receber_whatsapp = celular ? 'Y' : 'N';

  return payload;
}

// ============================================================
// PAYLOAD: veículo
// Doc: POST /veiculo/cadastrar
// ============================================================

export function buildVeiculoPayload(
  veiculo: any,
  codigo_fipe: string,
  valor_fipe: number,
  ctx: VeiculoCtx,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    codigo_associado: ctx.codigo_associado,
    placa: placaParaSga(veiculo.placa),
    chassi: cleanAlphaNum(veiculo.chassi),
    renavam: cleanDigits(veiculo.renavam),
    ano_fabricacao: veiculo.ano_fabricacao || veiculo.ano_modelo,
    ano_modelo: veiculo.ano_modelo,
    codigo_fipe,
    valor_fipe,
    kilometragem: Number(veiculo.kilometragem) || 0,
    numero_motor: veiculo.numero_motor || '',
    dia_vencimento: veiculo.dia_vencimento || 10,
    codigo_tipo_veiculo: ctx.tipo_veiculo,
    codigo_voluntario: ctx.codigo_voluntario,
  };

  if (ctx.codigo_combustivel) payload.codigo_combustivel = ctx.codigo_combustivel;
  if (ctx.codigo_cor) payload.codigo_cor = ctx.codigo_cor;
  if (ctx.codigo_situacao) payload.codigo_situacao = ctx.codigo_situacao;
  if (ctx.codigo_cooperativa) payload.codigo_cooperativa = ctx.codigo_cooperativa;
  if (ctx.codigo_plano) payload.codigo_plano = ctx.codigo_plano;
  if (typeof ctx.valor_mensalidade === 'number') payload.valor_fixo = ctx.valor_mensalidade;
  if (typeof ctx.valor_adesao === 'number') payload.valor_adesao = ctx.valor_adesao;
  if (ctx.data_contrato_iso) payload.data_contrato = formatDateBR(ctx.data_contrato_iso);
  if (ctx.produtos && ctx.produtos.length > 0) payload.produtos = ctx.produtos;

  return payload;
}

// ============================================================
// PAYLOAD: fotos
// Doc: POST /veiculo/foto/cadastrar (lotes de até 50)
// ============================================================

export interface DocumentoEntrada {
  id: string;
  tipo: string | null;
  nome_arquivo: string | null;
  arquivo_url: string | null;
}

export function buildFotosPayload(
  documentos: DocumentoEntrada[],
  resolverCodigoTipo: (tipo: string) => number | null,
): { fotos: FotoHinovaPayload[]; descartadasSemLink: string[]; descartadasSemTipo: Array<{ id: string; tipo: string }> } {
  const fotos: FotoHinovaPayload[] = [];
  const descartadasSemLink: string[] = [];
  const descartadasSemTipo: Array<{ id: string; tipo: string }> = [];

  const aliasTipo = (t: string | null): string => {
    const s = (t || '').toLowerCase().trim();
    const aliases: Record<string, string> = {
      chassi: 'foto_chassi',
      motor: 'foto_motor',
      frente: 'foto_frontal_veiculo',
      frontal: 'foto_frontal_veiculo',
      traseira: 'foto_traseira_veiculo',
      lateral_esquerda: 'foto_lateral_esquerda',
      lateral_direita: 'foto_lateral_direita',
      odometro: 'foto_hodometro',
      hodometro: 'foto_hodometro',
      painel: 'foto_painel',
      km: 'foto_km',
    };
    return aliases[s] || s;
  };

  for (const doc of documentos) {
    if (!doc.arquivo_url) {
      descartadasSemLink.push(doc.id);
      continue;
    }
    const tipoNorm = aliasTipo(doc.tipo);
    const codigoTipo = resolverCodigoTipo(tipoNorm);
    if (!codigoTipo) {
      descartadasSemTipo.push({ id: doc.id, tipo: String(doc.tipo) });
      continue;
    }
    fotos.push({
      nome_arquivo: doc.nome_arquivo || `documento_${doc.id}.jpg`,
      codigo_tipo: codigoTipo,
      link: doc.arquivo_url,
    });
  }

  return { fotos, descartadasSemLink, descartadasSemTipo };
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

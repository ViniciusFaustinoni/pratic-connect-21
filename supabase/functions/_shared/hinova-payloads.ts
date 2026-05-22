// deno-lint-ignore-file no-explicit-any
/**
 * Construção de payloads para os endpoints Hinova SGA.
 * Mantém a serialização e formatação de dados isolada do orquestrador
 * `sga-hinova-sync`, espelhando a documentação oficial v2.
 */

import type { FotoHinovaPayload } from './hinova-client.ts';
import { resolverDiaVencimento } from './vencimento-utils.ts';

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
  /**
   * Dia de vencimento autoritativo (vem de `contratos.dia_vencimento`).
   * Quando presente, prevalece sobre `associado.dia_vencimento` (que pode
   * estar dessincronizado). Resolvido com regra 5/10/15/20/25/30.
   */
  dia_vencimento_contrato?: number | null;
}

export interface VeiculoCtx {
  codigo_associado: number;
  /** Código da conta bancária. Obrigatório APENAS quando a regional tem mais de uma conta. */
  codigo_conta?: number;
  codigo_voluntario: number;
  codigo_situacao?: number;
  codigo_cooperativa?: number;
  /**
   * Código do GRUPO de produto no Hinova (campo `codigo_grupo_produto` da doc oficial /veiculo/cadastrar).
   * O grupo já contém todas as coberturas e benefícios cadastrados no painel Hinova,
   * portanto NÃO enviamos array `produtos[]`.
   * Vem de `planos.codigo_sga_plano` (nome legado da coluna no banco).
   */
  codigo_grupo_produto?: number;
  valor_mensalidade?: number;
  valor_adesao?: number;
  tipo_veiculo: number;
  codigo_combustivel?: number | null;
  codigo_cor?: number | null;
  data_contrato_iso?: string | null;
  /** Categoria do veículo (Táxi, Leilão, Placa Vermelha, Ex-Táxi). Resolvido via hinova_mapeamentos tipo='categoria_veiculo'. */
  codigo_categoria_veiculo?: number;
  /** Valor FIPE protegido (R$). Doc oficial /veiculo/cadastrar — opcional. */
  valor_fipe_protegido?: number;
  /** % FIPE protegido (deságio). Vem de contratos.cobertura_fipe (ex: 70, 75, 100). */
  porcentagem_fipe_protegido?: number;
  /** Observação livre (ex: "Cadastro via Pratic Connect — contrato XYZ"). */
  observacao?: string;
  /**
   * Dia de vencimento autoritativo (vem de `contratos.dia_vencimento`).
   * Quando presente, prevalece sobre `veiculo.dia_vencimento`.
   */
  dia_vencimento_contrato?: number | null;
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
    // Prioriza o dia_vencimento do CONTRATO (fonte da verdade) — só usa
    // o do associado como fallback. resolverDiaVencimento garante valor
    // válido (5/10/15/20/25/30); nunca cai mais no antigo "|| 10" cego.
    dia_vencimento: resolverDiaVencimento(
      ctx.dia_vencimento_contrato ?? associado.dia_vencimento,
      ctx.data_contrato_iso,
    ).dia,
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

/**
 * Normaliza o codigo_fipe para o formato aceito pelo Hinova/SGA.
 *
 * Variantes em circulação no mercado FIPE:
 *   - "827144-5"  (canônico com dígito verificador)
 *   - "8271445"   (sem hífen)
 *   - "827144"    (sem dígito verificador)
 *
 * Vários tenants do Hinova só matcham o catálogo interno quando o código
 * chega no formato `NNNNNN-N`. Outros só com `NNNNNNN`. A função
 * preferencial retorna o formato canônico (com hífen) e a lista de
 * `alternativas` que `cadastrarVeiculoComFipeRetry` usa em fallback
 * quando o Hinova responde "O MODELO enviado não foi encontrado".
 */
export function variantesCodigoFipe(raw: string | null | undefined): string[] {
  const t = (raw ?? '').trim();
  if (!t) return [];
  const soDigitos = t.replace(/\D/g, '');
  if (!soDigitos) return [];
  // Formato canônico com hífen (último dígito é o verificador)
  const canonico = soDigitos.length > 1
    ? `${soDigitos.slice(0, -1)}-${soDigitos.slice(-1)}`
    : soDigitos;
  const semHifen = soDigitos;
  const semDigito = soDigitos.length > 1 ? soDigitos.slice(0, -1) : soDigitos;
  // Ordem: tenta primeiro o que o tenant local indicou (input original),
  // depois canônico, depois variantes.
  const lista = [t, canonico, semHifen, semDigito];
  const seen = new Set<string>();
  return lista.filter((x) => {
    const v = x.trim();
    if (!v || seen.has(v)) return false;
    seen.add(v);
    return true;
  });
}

export function buildVeiculoPayload(
  veiculo: any,
  codigo_fipe: string,
  valor_fipe: number,
  ctx: VeiculoCtx,
): Record<string, unknown> {
  const placaSga = placaParaSga(veiculo.placa);
  // RENAVAM: tratamos placeholders ("00000000000", string vazia) como ausentes.
  // Para 0KM (placa placeholder ou aguardando_placa_definitiva) o documento ainda
  // não foi emitido — OMITIMOS a chave para a Hinova não rejeitar como obrigatório.
  const renavamRaw = cleanDigits(veiculo.renavam);
  const renavamValido = !!renavamRaw && !/^0+$/.test(renavamRaw);
  const isZeroKm = !placaSga || veiculo.aguardando_placa_definitiva === true;
  const incluirRenavam = renavamValido && !isZeroKm
    ? { renavam: renavamRaw }
    : (renavamValido ? { renavam: renavamRaw } : {});
  const payload: Record<string, unknown> = {
    codigo_associado: ctx.codigo_associado,
    // Hinova doc: "Caso o veículo seja ZERO KM não necessário enviar ou enviar vazio".
    // Enviar string vazia faz a API responder "Já existe um veículo com a placa cadastrado".
    // Por isso OMITIMOS a chave inteira quando 0KM/placeholder.
    ...(placaSga ? { placa: placaSga } : {}),
    chassi: cleanAlphaNum(veiculo.chassi),
    ...incluirRenavam,
    ano_fabricacao: veiculo.ano_fabricacao || veiculo.ano_modelo,
    ano_modelo: veiculo.ano_modelo,
    codigo_fipe,
    valor_fipe,
    kilometragem: Number(veiculo.kilometragem) || 0,
    numero_motor: veiculo.numero_motor || '',
    dia_vencimento: resolverDiaVencimento(
      ctx.dia_vencimento_contrato ?? veiculo.dia_vencimento,
      ctx.data_contrato_iso,
    ).dia,
    codigo_tipo_veiculo: ctx.tipo_veiculo,
    codigo_voluntario: ctx.codigo_voluntario,
  };

  if (Number.isFinite(ctx.codigo_conta) && (ctx.codigo_conta as number) > 0) {
    payload.codigo_conta = ctx.codigo_conta;
  }
  if (ctx.codigo_combustivel) payload.codigo_combustivel = ctx.codigo_combustivel;
  if (ctx.codigo_cor) payload.codigo_cor = ctx.codigo_cor;
  // NÃO enviar `codigo_situacao` no cadastro: a Hinova rejeita códigos que não
  // existem na conta da regional (Parâmetros Inválidos: CODIGO_SITUACAO).
  // O default da conta é aplicado automaticamente. A transição
  // pendente→ativo é feita depois via /veiculo/alterar-situacao quando aplicável.
  if (ctx.codigo_cooperativa) payload.codigo_cooperativa = ctx.codigo_cooperativa;
  if (ctx.codigo_grupo_produto) payload.codigo_grupo_produto = ctx.codigo_grupo_produto;
  if (ctx.codigo_categoria_veiculo) payload.codigo_categoria_veiculo = ctx.codigo_categoria_veiculo;
  if (typeof ctx.valor_mensalidade === 'number') payload.valor_fixo = ctx.valor_mensalidade;
  if (typeof ctx.valor_adesao === 'number') payload.valor_adesao = ctx.valor_adesao;
  if (typeof ctx.valor_fipe_protegido === 'number' && ctx.valor_fipe_protegido > 0) {
    payload.valor_fipe_protegido = ctx.valor_fipe_protegido;
  }
  if (typeof ctx.porcentagem_fipe_protegido === 'number' && ctx.porcentagem_fipe_protegido > 0) {
    payload.porcentagem_fipe_protegido = ctx.porcentagem_fipe_protegido;
  }
  if (ctx.observacao && ctx.observacao.trim()) payload.observacao = ctx.observacao.trim();
  if (ctx.data_contrato_iso) payload.data_contrato = formatDateBR(ctx.data_contrato_iso);
  // NÃO enviamos `produtos[]`: o grupo (codigo_grupo_produto) já vincula
  // todas as coberturas e benefícios configurados no painel Hinova.

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
  /** Tabela/fonte de origem (para dedupe em sga_fotos_enviadas). */
  origem?: 'contratos_documentos' | 'vistoria_fotos' | 'avatar' | 'pdf_assinado';
  /** ID estável dentro da origem (uuid do documento/foto, ou identificador do avatar/termo). */
  origem_id?: string;
}

export interface FotoMeta {
  origem: string;
  origem_id: string;
  arquivo_url: string;
  codigo_tipo: number;
  nome_arquivo: string;
}

// Código Hinova de FOTO ADICIONAL (provisório, ver hinova_mapeamentos).
// Usado como fallback quando o tipo da foto não tem mapeamento explícito —
// evita que fotos da vistoria sumam silenciosamente no SGA (caso LTV3631).
const HINOVA_TIPO_FOTO_ADICIONAL = 15;

export function buildFotosPayload(
  documentos: DocumentoEntrada[],
  resolverCodigoTipo: (tipo: string) => number | null,
): {
  fotos: FotoHinovaPayload[];
  metas: FotoMeta[];
  descartadasSemLink: string[];
  descartadasSemTipo: Array<{ id: string; tipo: string }>;
  descartadasVideo: Array<{ id: string; arquivo_url: string }>;
  tiposFallback15: Array<{ id: string; tipo: string }>;
} {
  const fotos: FotoHinovaPayload[] = [];
  const metas: FotoMeta[] = [];
  const descartadasSemLink: string[] = [];
  const descartadasSemTipo: Array<{ id: string; tipo: string }> = [];
  const descartadasVideo: Array<{ id: string; arquivo_url: string }> = [];
  const tiposFallback15: Array<{ id: string; tipo: string }> = [];

  for (const doc of documentos) {
    if (!doc.arquivo_url) {
      descartadasSemLink.push(doc.id);
      continue;
    }
    if (isVideoLike(doc.arquivo_url, doc.tipo)) {
      descartadasVideo.push({ id: doc.id, arquivo_url: doc.arquivo_url });
      continue;
    }
    const tipoBruto = (doc.tipo == null ? '' : String(doc.tipo)).trim();
    if (!tipoBruto) {
      // Sem nada para classificar — preservamos como descarte para análise.
      descartadasSemTipo.push({ id: doc.id, tipo: String(doc.tipo) });
      continue;
    }
    const tipoNorm = aliasTipo(tipoBruto);
    let codigoTipo = resolverCodigoTipo(tipoNorm);
    if (!codigoTipo) {
      // Fallback: qualquer tipo desconhecido entra como FOTO ADICIONAL (15)
      // em vez de ser descartado. Ver mem://logic/integrations/sga-fotos-codigo-15-adicional.
      codigoTipo = HINOVA_TIPO_FOTO_ADICIONAL;
      tiposFallback15.push({ id: doc.id, tipo: tipoBruto });
    }
    const nome = doc.nome_arquivo || `documento_${doc.id}.jpg`;
    fotos.push({
      nome_arquivo: nome,
      codigo_tipo: codigoTipo,
      link: doc.arquivo_url,
    });
    metas.push({
      origem: doc.origem || 'desconhecida',
      origem_id: doc.origem_id || doc.id,
      arquivo_url: doc.arquivo_url,
      codigo_tipo: codigoTipo,
      nome_arquivo: nome,
    });
  }

  return { fotos, metas, descartadasSemLink, descartadasSemTipo, descartadasVideo, tiposFallback15 };
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

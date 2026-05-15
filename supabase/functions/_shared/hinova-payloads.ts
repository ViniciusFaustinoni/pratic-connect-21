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
    dia_vencimento: veiculo.dia_vencimento || 10,
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
}

export function buildFotosPayload(
  documentos: DocumentoEntrada[],
  resolverCodigoTipo: (tipo: string) => number | null,
): {
  fotos: FotoHinovaPayload[];
  descartadasSemLink: string[];
  descartadasSemTipo: Array<{ id: string; tipo: string }>;
  descartadasVideo: Array<{ id: string; arquivo_url: string }>;
} {
  const fotos: FotoHinovaPayload[] = [];
  const descartadasSemLink: string[] = [];
  const descartadasSemTipo: Array<{ id: string; tipo: string }> = [];
  const descartadasVideo: Array<{ id: string; arquivo_url: string }> = [];

  // Hinova /veiculo/foto/cadastrar aceita apenas IMAGENS e PDFs.
  // Vídeo é descartado defensivamente — extensões na URL ou tipo contendo "video"/"audio".
  const VIDEO_EXT_RE = /\.(mp4|m4v|mov|webm|avi|mkv|3gp|3g2|hevc|wmv|flv|ogv|mts|m2ts)(\?|#|$)/i;
  const isVideoLike = (url: string, tipo: string | null): boolean => {
    if (VIDEO_EXT_RE.test(url)) return true;
    const t = (tipo || '').toLowerCase();
    if (t.includes('video') || t.includes('vídeo') || t.includes('audio') || t.includes('áudio')) return true;
    return false;
  };

  const aliasTipo = (t: string | null): string => {
    const s = (t || '').toLowerCase().trim();
    const aliases: Record<string, string> = {
      // Fotos do veículo
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
      painel_completo: 'foto_painel',
      painel_km: 'foto_hodometro',
      km: 'foto_km',
      foto_veiculo_frente: 'foto_frontal_veiculo',
      foto_veiculo_traseira: 'foto_traseira_veiculo',
      foto_veiculo_lateral_esquerda: 'foto_lateral_esquerda',
      foto_veiculo_lateral_direita: 'foto_lateral_direita',
      // Variantes vindas de vistoria_fotos
      lateral_dianteira_esquerda: 'foto_lateral_esquerda',
      lateral_dianteira_direita: 'foto_lateral_direita',
      lateral_traseira_esquerda: 'foto_lateral_esquerda',
      lateral_traseira_direita: 'foto_lateral_direita',
      chassi_motor: 'foto_chassi',
      numero_motor: 'foto_motor',
      // Documentos do associado — enviados como fotos anexas ao veículo
      foto_cnh: 'cnh',
      cnh_frente: 'cnh',
      cnh_verso: 'cnh',
      cnh_aberta: 'cnh',
      foto_crlv: 'crlv',
      crlv_frente: 'crlv',
      crlv_verso: 'crlv',
      comprovante: 'comprovante_residencia',
      comp_residencia: 'comprovante_residencia',
      comprovante_endereco: 'comprovante_residencia',
      foto_rg: 'rg',
      rg_frente: 'rg',
      rg_verso: 'rg',
      foto_cpf: 'cpf',
      // Termo de Filiação assinado (Autentique)
      contrato: 'contrato_assinado',
      termo: 'contrato_assinado',
      termo_filiacao: 'contrato_assinado',
      termo_afiliacao: 'contrato_assinado',
      termo_assinado: 'contrato_assinado',
    };
    return aliases[s] || s;
  };

  for (const doc of documentos) {
    if (!doc.arquivo_url) {
      descartadasSemLink.push(doc.id);
      continue;
    }
    if (isVideoLike(doc.arquivo_url, doc.tipo)) {
      descartadasVideo.push({ id: doc.id, arquivo_url: doc.arquivo_url });
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

  return { fotos, descartadasSemLink, descartadasSemTipo, descartadasVideo };
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// pdfjs-dist para descompressão real (FlateDecode) e extração nativa de texto
// Build legacy é compatível com Deno/edge runtime sem worker
// unpkg serve pdf.min.mjs sem deps de canvas (Node), funciona no Deno edge runtime
import * as pdfjsLib from "https://esm.sh/pdfjs-dist@4.0.379/legacy/build/pdf.min.mjs?bundle&no-check";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ============================================================
// Validadores de campos brasileiros (checksum)
// ============================================================

// Validação de CPF por dígito verificador
function validateCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleaned[i]) * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(cleaned[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleaned[i]) * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(cleaned[10]);
}

// Validação de CNPJ por dígito verificador
function validateCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += parseInt(cleaned[i]) * weights[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === parseInt(cleaned[12]) && calc(13) === parseInt(cleaned[13]);
}

// Placa brasileira: ABC1234 (antiga) ou ABC1D23 (Mercosul)
function validatePlaca(placa: string): boolean {
  if (!placa) return false;
  const cleaned = placa.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (cleaned.length !== 7) return false;
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(cleaned);
}

// Mapas para desambiguar caracteres confundidos pelo OCR (Mercosul vs antigo)
const DIGIT_TO_LETTER: Record<string, string> = { '0': 'O', '1': 'I', '5': 'S', '8': 'B', '2': 'Z', '6': 'G' };
const LETTER_TO_DIGIT: Record<string, string> = { 'O': '0', 'I': '1', 'S': '5', 'B': '8', 'Z': '2', 'G': '6', 'T': '7', 'L': '1', 'Q': '0' };

/**
 * Gera todas as variantes plausíveis da placa para cobrir confusões OCR
 * comuns entre Mercosul (LLL N L NN) e formato antigo (LLL NNNN).
 * Inclui a placa original, normalização Mercosul e normalização para antiga.
 */
function gerarCandidatosPlaca(raw: string): string[] {
  if (!raw) return [];
  const cleaned = raw.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (cleaned.length !== 7) return [cleaned];
  const out = new Set<string>([cleaned]);

  // Variante 1: força Mercosul (5ª posição = letra)
  const mercosul = cleaned.split('');
  for (const i of [0, 1, 2, 4]) {
    const ch = mercosul[i];
    if (/[0-9]/.test(ch) && DIGIT_TO_LETTER[ch]) mercosul[i] = DIGIT_TO_LETTER[ch];
  }
  for (const i of [3, 5, 6]) {
    const ch = mercosul[i];
    if (/[A-Z]/.test(ch) && LETTER_TO_DIGIT[ch]) mercosul[i] = LETTER_TO_DIGIT[ch];
  }
  out.add(mercosul.join(''));

  // Variante 2: força antiga (5ª posição = dígito)
  const antiga = cleaned.split('');
  for (const i of [0, 1, 2]) {
    const ch = antiga[i];
    if (/[0-9]/.test(ch) && DIGIT_TO_LETTER[ch]) antiga[i] = DIGIT_TO_LETTER[ch];
  }
  for (const i of [3, 4, 5, 6]) {
    const ch = antiga[i];
    if (/[A-Z]/.test(ch) && LETTER_TO_DIGIT[ch]) antiga[i] = LETTER_TO_DIGIT[ch];
  }
  out.add(antiga.join(''));

  return Array.from(out);
}

/**
 * Normalização posicional Mercosul-aware (LLL N L NN).
 * Posições 0,1,2,4 → letras (corrige 0→O, 1→I, etc.)
 * Posições 3,5,6 → dígitos (corrige O→0, I→1, etc.)
 * Retorna a placa "saneada" para o padrão Mercosul. Não garante validade.
 */
function normalizePlacaMercosul(raw: string): string {
  if (!raw) return '';
  const cleaned = raw.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (cleaned.length !== 7) return cleaned;
  const out: string[] = cleaned.split('');
  const letterIdx = [0, 1, 2, 4];
  const digitIdx = [3, 5, 6];
  for (const i of letterIdx) {
    const ch = out[i];
    if (/[0-9]/.test(ch) && DIGIT_TO_LETTER[ch]) out[i] = DIGIT_TO_LETTER[ch];
  }
  for (const i of digitIdx) {
    const ch = out[i];
    if (/[A-Z]/.test(ch) && LETTER_TO_DIGIT[ch]) out[i] = LETTER_TO_DIGIT[ch];
  }
  return out.join('');
}

const PLACA_MERCOSUL_RE = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
const PLACA_ANTIGA_RE = /^[A-Z]{3}[0-9]{4}$/;

/**
 * Resolve a placa preferindo o formato Mercosul quando há ambiguidade
 * na 5ª posição (ex.: "1" lido no lugar de "I").
 * Retorna { placa, ajustada } com a melhor escolha.
 */
function resolvePlacaPreferMercosul(raw: string): { placa: string; ajustada: boolean } {
  const cleaned = (raw || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (cleaned.length !== 7) return { placa: cleaned, ajustada: false };

  // Já é Mercosul válido
  if (PLACA_MERCOSUL_RE.test(cleaned)) return { placa: cleaned, ajustada: false };

  // Tenta normalizar para Mercosul
  const normalized = normalizePlacaMercosul(cleaned);
  if (PLACA_MERCOSUL_RE.test(normalized) && normalized !== cleaned) {
    // Só prefere Mercosul se a 5ª posição original era um dígito ambíguo (1/0/5/8/2/6)
    const ch5 = cleaned[4];
    if (/[0-9]/.test(ch5) && DIGIT_TO_LETTER[ch5]) {
      return { placa: normalized, ajustada: true };
    }
  }

  // Senão, mantém o cleaned (pode ser placa antiga válida)
  return { placa: cleaned, ajustada: false };
}

// Renavam: 11 dígitos com dígito verificador (módulo 11)
function validateRenavam(renavam: string): boolean {
  if (!renavam) return false;
  const cleaned = renavam.replace(/\D/g, '').padStart(11, '0');
  if (cleaned.length !== 11) return false;
  if (/^0+$/.test(cleaned)) return false;
  const base = cleaned.substring(0, 10);
  const dv = parseInt(cleaned[10]);
  const reversed = base.split('').reverse().join('');
  const weights = [2,3,4,5,6,7,8,9,2,3];
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(reversed[i]) * weights[i];
  const mod = (sum * 10) % 11;
  const dvCalc = mod === 10 ? 0 : mod;
  return dvCalc === dv;
}

// Chassi: 17 caracteres alfanuméricos, sem I, O ou Q
function validateChassi(chassi: string): boolean {
  if (!chassi) return false;
  const cleaned = chassi.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (cleaned.length !== 17) return false;
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(cleaned);
}

// Mapa de dígitos comumente confundidos por modelos de visão
const DIGIT_CONFUSIONS: Record<number, number[]> = {
  0: [8, 6],
  1: [7, 4],
  3: [8],
  4: [6, 9],
  5: [6, 8],
  6: [4, 5, 8, 0],
  7: [1],
  8: [3, 0, 6],
  9: [4, 7],
};

function tryFixCPFByPermutation(cpf: string): string | null {
  const digits = cpf.replace(/\D/g, '').split('').map(Number);
  if (digits.length !== 11) return null;

  const validResults: string[] = [];

  for (let pos = 0; pos < 11; pos++) {
    const originalDigit = digits[pos];
    const alternatives = DIGIT_CONFUSIONS[originalDigit];
    if (!alternatives) continue;

    for (const alt of alternatives) {
      const candidate = [...digits];
      candidate[pos] = alt;
      const candidateStr = candidate.join('');
      if (validateCPF(candidateStr)) {
        const formatted = candidateStr.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        if (!validResults.includes(formatted)) {
          validResults.push(formatted);
        }
      }
    }
  }

  if (validResults.length === 1) {
    return validResults[0];
  }
  return null;
}

const systemPrompt = `Analista de documentos brasileiros. Detecte o tipo e extraia dados.

## Tipos e campos obrigatórios:

### CNH
nome, cpf (XXX.XXX.XXX-XX - PRIORIDADE MÁXIMA), rg, numero_registro (11 dígitos), data_nascimento (YYYY-MM-DD), validade (YYYY-MM-DD), categoria
- CPF SEMPRE existe na CNH: campo "CPF"/"CPF/MF", próximo ao nome/foto. Procure sequências de 11 dígitos.
- NÃO confunda com RENACH (tem letras), registro CNH ou RG.
- NUNCA retorne cpf:null. Se ilegível: cpf:"ilegivel"
- LEIA CADA DÍGITO DO CPF INDIVIDUALMENTE, DA ESQUERDA PARA A DIREITA. O CPF possui dígitos verificadores matemáticos — se tiver dúvida em qualquer dígito, retorne cpf:"ilegivel" em vez de adivinhar.
- CATEGORIA: leia EXCLUSIVAMENTE do campo "9 CAT HAB" que fica na frente da CNH, ao lado do CPF e nº registro. NÃO extraia da grade/tabela de categorias (verso ou rodapé) que lista ACC, A, B, C, D, BE, CE, DE etc com datas de habilitação. A grade é apenas um detalhamento — a categoria principal está no campo "9 CAT HAB". Categorias válidas: A, B, C, D, E, AB, AC, AD, AE, ACC.

### RG / CIN (Carteira de Identidade Nacional)
Aceite TANTO o RG antigo (modelo estadual com REGISTRO GERAL próprio) QUANTO a nova CIN (Carteira de Identidade Nacional - válida em todo território nacional, com QR Code, layout bilíngue PT/EN, texto "VÁLIDA EM TODO O TERRITÓRIO NACIONAL"). Ambos retornam tipo_detectado:"rg".

Campos:
- nome: campo "NOME / Name" no topo, logo abaixo do cabeçalho. NÃO confundir com filiação (nomes dos pais), autoridades, "PRESIDENTE DO DETRAN" ou assinaturas no rodapé.
- cpf: SEMPRE presente. Formato XXX.XXX.XXX-XX. Se ilegível, retorne "ilegivel".
  • CIN: aparece como "Registro Geral - CPF / Personal Number" — o CPF é o número único de identificação.
  • RG antigo: campo CPF separado (frente ou verso).
- rg: número do Registro Geral.
  • RG antigo: campo "REGISTRO GERAL" com número estadual (ex.: 12.345.678-9).
  • CIN: o CPF É o número único — use o mesmo valor do CPF.
- data_nascimento: "Data de Nascimento / Date of Birth" (YYYY-MM-DD).
- data_expedicao: "Data de Emissão / Issue Date" (YYYY-MM-DD).
- validade: "Validade / Expiry" (YYYY-MM-DD).
  • CIN frequentemente traz "INDETERMINADA" — nesse caso retorne validade:"indeterminada" e considere VÁLIDO.
- orgao_expedidor: "DETRAN-RJ", "SSP-SP", etc. (se visível).
- variante: "cin" se for a nova Carteira de Identidade Nacional (QR Code grande, layout bilíngue, "VÁLIDA EM TODO O TERRITÓRIO NACIONAL"); "rg_antigo" caso contrário.

Regras especiais CIN:
- NÃO reprove por validade ausente/INDETERMINADA — é o padrão da CIN.
- NÃO reprove por RG igual ao CPF — é o comportamento esperado da CIN.
- QR Code grande presente é indicador forte de CIN.

### CRLV
placa (ABC1234/ABC1D23), renavam (11 dígitos), chassi (17 chars), marca, modelo, ano_fabricacao (int), ano_modelo (int), cor (campo "COR"/"COR PREDOMINANTE" - leia literalmente), combustivel, motor, numero_motor, nome_proprietario, blindado (bool)
- numero_motor: leia do campo "MOTOR Nº" / "Nº DO MOTOR" / "MOTOR" do CRLV. Sempre preencha tanto "motor" quanto "numero_motor" com o mesmo valor (alias).
- "ANO FAB/MOD: 2013/2014" → ano_fabricacao:2013, ano_modelo:2014
- Blindado: procure em OBS/TIPO por "BLINDADO/BLINDAGEM/PROTEÇÃO BALÍSTICA". Sempre inclua campo blindado.
- ⚠️ PLACA — REGRA OBRIGATÓRIA DE FORMATO:
  • Existem DOIS formatos legais no Brasil. NUNCA misture os dois.
  • **Placa ANTIGA** (LLLNNNN, ex: ABC1234, LQV3623): as **4 últimas posições são SEMPRE dígitos (0-9)**. Se a 5ª posição parecer uma letra (G/I/O/S/B/Z), é OCR errado — leia como dígito (G→6, I→1, O→0, S→5, B→8, Z→2).
  • **Placa MERCOSUL** (LLLNLNN, ex: RKR3I57, BRA2E19): a **5ª posição é SEMPRE uma LETRA (A-Z)**. Se parecer dígito (1/0/5/8/2/6), leia como letra.
  • COMO DECIDIR O FORMATO: o CRLV brasileiro emitido a partir de set/2018 usa Mercosul; veículos anteriores podem manter a placa antiga. Use o **campo "PLACA ANTERIOR/UF"** e o ano de fabricação como pista. Se "PLACA ANTERIOR" estiver no formato antigo e for igual à placa atual, então a placa atual também é antiga.
  • **EM CASO DE DÚVIDA, releia a posição duvidosa caractere por caractere** comparando com letras/números vizinhos do mesmo documento (ex: outras ocorrências de "6" no Renavam ou no chassi).

### Nota Fiscal de Veículo (DANFE / NF-e com dados veiculares)

**Como reconhecer uma DANFE/NF-e de veículo (use TODAS as pistas abaixo):**
- Cabeçalho com "DANFE" ou "DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA"
- Campo "CHAVE DE ACESSO" com 44 dígitos (frequentemente acompanhado de código de barras horizontal)
- "PROTOCOLO DE AUTORIZAÇÃO DE USO" com data/hora
- "NATUREZA DA OPERAÇÃO" (ex.: "VENDA DE VEÍCULO 0 KM", "VENDA DE PROD. DO ESTAB.", "VENDA DE MERC. ADQ. OU REC.")
- Tabela "DADOS DO PRODUTO / SERVIÇOS" com colunas: CÓDIGO, DESCRIÇÃO DOS PRODUTOS / SERVIÇOS, NCM/SH, CST, **CFOP**, UN, QUANT, V. UNITÁRIO, V. TOTAL
- Blocos "EMITENTE", "DESTINATÁRIO/REMETENTE", "DADOS ADICIONAIS"

**Sinais de que a NF é de VEÍCULO (qualquer um basta):**
- A descrição do produto contém um CHASSI de 17 caracteres alfanuméricos (sem I, O, Q)
- CFOP nas faixas 5405/5104/5403/6405/6104/6403/5102/6102 (venda)
- Descrição contém palavras: "VEÍCULO", "VEICULO", "MOTOCICLETA", "MOTO", "AUTOMÓVEL", "0 KM", "ZERO KM", "ZERO-KM"
- NCM começa com 8703 (automóveis) ou 8711 (motocicletas)

⚠️ Se identificar QUALQUER desses sinais, **tipo_detectado = "nota_fiscal_veiculo"** — NUNCA "crlv" e NUNCA "outro".

**Onde encontrar os dados veiculares (geralmente concatenados na "DESCRIÇÃO DOS PRODUTOS / SERVIÇOS"):**
A descrição vem em linha única com vários campos separados por vírgula ou espaço. Padrões típicos:
- `CHASSI:9C6KG991070073366` ou `CHASSI Nº 9C6KG...` ou `CHASSI/SERIE 9C6KG...`
- `MOTOR:G3W6E-104052` ou `Nº MOTOR G3W6E-104052` ou `No MOTOR:G3W6E-104052` ou `MOTOR Nº G3W6E-104052`
- `RENAVAM:00118712345`
- `COR:VERMELHA` / `COR BRANCA`
- `COMBUSTÍVEL:GASOLINA` / `FLEX` / `DIESEL`
- `ANO FAB:2024` `ANO MOD:2025` (ou `ANO/MOD: 2024/2025`)
- `MARCA:YAMAHA` `MODELO:YBR 150 FACTOR`
- `CILINDRADAS:150` `POTENCIA:12CV` `CATEGORIA:PARTICULAR` `TIPO VEICULO:MOTOCICLETA`

**Extração obrigatória de numero_motor:**
Mesmo quando o número do motor estiver concatenado na descrição com outros campos, EXTRAIA SOMENTE o valor do motor. Use o padrão mental: `MOTOR\s*:?\s*([A-Z0-9-]+)` — capture até o próximo separador (vírgula, espaço, RENAVAM, COR, etc.). Devolva apenas a sequência alfanumérica do motor (com hífen se houver).

**Campos a retornar:**
- valor_nota_fiscal: prefira "VALOR TOTAL DA NOTA" do bloco "CÁLCULO DO IMPOSTO". Se não houver, use "V. TOTAL" do produto principal (quando único). Numérico, ponto decimal (ex.: 18890.00).
- chassi (17 chars), numero_motor, placa (se presente), marca, modelo, ano_fabricacao (int), ano_modelo (int), cor, combustivel
- nome_comprador: campo "NOME / RAZÃO SOCIAL" do bloco "DESTINATÁRIO/REMETENTE"
- cpf_cnpj_comprador: campo "CNPJ / CPF" do bloco "DESTINATÁRIO/REMETENTE" (formato XXX.XXX.XXX-XX para CPF ou XX.XXX.XXX/XXXX-XX para CNPJ)

- tipo_detectado deve ser "nota_fiscal_veiculo"
- Este documento substitui o CRLV para veículos zero km ou recém-adquiridos.

### ATPV-e / CRV Digital (Autorização para Transferência de Propriedade de Veículo - Eletrônica)
Detectar quando o documento for emitido pelo SENATRAN/DETRAN com título "AUTORIZAÇÃO PARA TRANSFERÊNCIA DE PROPRIEDADE DE VEÍCULO" ou "ATPV-e" / "CRV Digital" / "CRV-e". Geralmente contém QR Code, código de segurança, dados do veículo, dados do vendedor e dados do comprador.
Campos: placa, renavam (11 dígitos), chassi (17 chars), marca, modelo, ano_fabricacao (int), ano_modelo (int), cor, combustivel,
nome_comprador, cpf_comprador (XXX.XXX.XXX-XX), endereco_comprador (logradouro+numero), cidade_comprador, uf_comprador (2 letras), cep_comprador,
nome_vendedor, cpf_cnpj_vendedor,
valor_declarado_venda (numérico), data_emissao_crv (YYYY-MM-DD), data_venda (YYYY-MM-DD),
numero_crv, codigo_seguranca_crv, numero_atpv
- tipo_detectado deve ser "atpv_e"
- Este documento SUBSTITUI o CRLV para veículos recém-adquiridos cujo CRLV ainda não foi emitido no nome do novo proprietário.
- NÃO confundir com CRLV (que tem título "CERTIFICADO DE REGISTRO E LICENCIAMENTO DE VEÍCULO") nem com Nota Fiscal.

### Comprovante de Residência
Aceitar: contas (água/luz/gás/telefone/internet), faturas/boletos, IPTU/IPVA, IRPF, extratos, contratos aluguel, escrituras.
Campos: logradouro, numero, complemento, bairro, cidade, uf (2 letras), cep, nome_titular, tipo_comprovante ("conta_luz"|"conta_agua"|"conta_gas"|"conta_telefone"|"conta_internet"|"fatura_cartao"|"boleto_plano_saude"|"boleto_condominio"|"iptu"|"ipva"|"extrato_bancario"|"contrato_aluguel"|"outro"), data_emissao
- Aceitar sem data de emissão. IPTU/IPVA do ano vigente/anterior válidos.

#### Titularidade (quando nomeEsperado fornecido)
Compare nome_titular com nomeEsperado:
- Ignore case/acentos. Aceite abreviações (M.=Mario, D.=Da/De). Sobrenome obrigatório.
- Correspondência OK → aprovar. Não corresponde → reprovar. Ilegível → revisar. Mesmo sobrenome, nome diferente → revisar (cônjuge).
- Inclua campo "validacao_titularidade": {nome_titular_extraido, nome_esperado, correspondencia, tipo_correspondencia, observacao}

## Regras gerais:
- Documento vencido: informar. Campo ilegível: null. Suspeita adulteração: reprovar. Dúvida: revisar.
- CPF: XXX.XXX.XXX-XX. Datas: YYYY-MM-DD. Placa: formato antigo ou Mercosul.

## JSON de resposta:
{"tipo_detectado":"cnh"|"rg"|"crlv"|"nota_fiscal_veiculo"|"atpv_e"|"comprovante_residencia"|"outro","sucesso":bool,"dados":{...},"legivel":bool,"valido":bool,"sugestao":"aprovar"|"reprovar"|"revisar","motivo":"...","confianca":0.0-1.0}`;

/**
 * Tenta reparar um JSON truncado pela IA (max_tokens atingido).
 */
function tryRepairTruncatedJSON(raw: string): object | null {
  let s = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  s = s.replace(/:\s*_[A-Z_]+_\s*([,}\]])/g, ': null$1');

  try { return JSON.parse(s); } catch { /* continue */ }

  s = s.replace(/,\s*$/, '');

  let inString = false;
  let lastQuoteIndex = -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && inString) { i++; continue; }
    if (s[i] === '"') {
      inString = !inString;
      lastQuoteIndex = i;
    }
  }

  if (inString && lastQuoteIndex >= 0) {
    s = s.substring(0, lastQuoteIndex + 1);
    const beforeKey = s.lastIndexOf(',', lastQuoteIndex - 1);
    const beforeBrace = s.lastIndexOf('{', lastQuoteIndex - 1);
    const beforeBracket = s.lastIndexOf('[', lastQuoteIndex - 1);
    const cutPoint = Math.max(beforeKey, beforeBrace, beforeBracket);
    
    if (cutPoint >= 0) {
      if (s[cutPoint] === ',') {
        s = s.substring(0, cutPoint);
      } else {
        s = s.substring(0, cutPoint + 1);
      }
    }
  }

  s = s.replace(/,\s*$/, '');

  let openBraces = 0;
  let openBrackets = 0;
  inString = false;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && inString) { i++; continue; }
    if (s[i] === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (s[i] === '{') openBraces++;
    if (s[i] === '}') openBraces--;
    if (s[i] === '[') openBrackets++;
    if (s[i] === ']') openBrackets--;
  }

  for (let i = 0; i < openBrackets; i++) s += ']';
  for (let i = 0; i < openBraces; i++) s += '}';

  try {
    return JSON.parse(s);
  } catch {
    console.error('[OCR] Reparo de JSON falhou. Tentando extração via regex...');
  }

  try {
    const tipoMatch = raw.match(/"tipo_detectado"\s*:\s*"([^"]+)"/);
    const sugestaoMatch = raw.match(/"sugestao"\s*:\s*"([^"]+)"/);
    const motivoMatch = raw.match(/"motivo"\s*:\s*"([^"]+)"/);
    const confiancaMatch = raw.match(/"confianca"\s*:\s*([\d.]+)/);
    const legivelMatch = raw.match(/"legivel"\s*:\s*(true|false)/);
    const validoMatch = raw.match(/"valido"\s*:\s*(true|false)/);
    const sucessoMatch = raw.match(/"sucesso"\s*:\s*(true|false)/);

    if (tipoMatch) {
      const dados: Record<string, string | null> = {};
      const dadosFields = ['nome', 'cpf', 'rg', 'placa', 'renavam', 'chassi', 'marca', 'modelo', 'cor', 'combustivel', 'motor', 'nome_proprietario', 'categoria', 'numero_registro', 'validade', 'data_expedicao', 'orgao_expedidor', 'variante'];
      for (const field of dadosFields) {
        const m = raw.match(new RegExp(`"${field}"\\s*:\\s*"([^"]+)"`));
        if (m) dados[field] = m[1];
      }
      const anoFabMatch = raw.match(/"ano_fabricacao"\s*:\s*(\d+)/);
      const anoModMatch = raw.match(/"ano_modelo"\s*:\s*(\d+)/);
      if (anoFabMatch) dados['ano_fabricacao'] = anoFabMatch[1];
      if (anoModMatch) dados['ano_modelo'] = anoModMatch[1];

      return {
        tipo_detectado: tipoMatch[1],
        sucesso: sucessoMatch ? sucessoMatch[1] === 'true' : true,
        dados,
        legivel: legivelMatch ? legivelMatch[1] === 'true' : true,
        valido: validoMatch ? validoMatch[1] === 'true' : true,
        sugestao: sugestaoMatch?.[1] || 'revisar',
        motivo: motivoMatch?.[1] || 'Resposta da IA foi truncada - dados parciais recuperados',
        confianca: confiancaMatch ? parseFloat(confiancaMatch[1]) : 0.5,
        _reparado: true,
      };
    }
  } catch {
    // Falhou completamente
  }

  return null;
}

/**
 * Extrai CPF de uma resposta truncada/malformada via regex
 */
function extractCPFFromRaw(raw: string): string | null {
  // Tentar JSON repair primeiro
  const repaired = tryRepairTruncatedJSON(raw);
  if (repaired && typeof repaired === 'object' && 'cpf' in repaired) {
    return (repaired as any).cpf;
  }
  
  // Fallback: regex para CPF formatado
  const cpfMatch = raw.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})/);
  if (cpfMatch) return cpfMatch[1];
  
  // Fallback: regex para 11 dígitos seguidos
  const digitsMatch = raw.match(/(\d{11})/);
  if (digitsMatch) {
    const d = digitsMatch[1];
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9,11)}`;
  }
  
  // Verificar se contém "ilegivel"
  if (raw.toLowerCase().includes('ilegivel') || raw.toLowerCase().includes('ilegível')) {
    return 'ilegivel';
  }
  
  return null;
}

// Modelo estável para OCR de TEXTO (não usar -image, otimizado para geração)
const OCR_MODEL = 'google/gemini-2.5-flash';
const OCR_RETRY_MODEL = 'google/gemini-2.5-pro';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Autenticação OPCIONAL - permite uso público para cotações
    const authHeader = req.headers.get('Authorization');
    let isAuthenticated = false;
    
    if (authHeader?.startsWith('Bearer ')) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );

      try {
        const token = authHeader.replace('Bearer ', '');
        const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
        
        if (!claimsError && claimsData?.claims) {
          isAuthenticated = true;
          console.log('Authenticated request from user:', claimsData.claims.sub);
        }
      } catch (authErr) {
        console.warn('Auth validation failed (proceeding as public):', authErr);
      }
    }
    
    console.log('Request mode:', isAuthenticated ? 'authenticated' : 'public');

    const { url, tipoEsperado, cpfEsperado, nomeEsperado, extrairDados } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL do documento é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validação de segurança para requisições públicas
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const allowedBuckets = ['cotacoes-docs', 'contratos-documentos', 'documentos'];
    const isAllowedUrl = allowedBuckets.some(bucket => 
      url.startsWith(`${SUPABASE_URL}/storage/v1/object/public/${bucket}/`)
    );

    if (!isAuthenticated && !isAllowedUrl) {
      console.warn('Blocked public request with external URL:', url);
      return new Response(
        JSON.stringify({ 
          error: 'URL não permitida para requisições públicas',
          code: 'INVALID_URL',
          details: 'Apenas URLs do storage do projeto são permitidas sem autenticação'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing OCR for URL:', url, '| Authenticated:', isAuthenticated, '| tipoEsperado:', tipoEsperado || 'auto');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Serviço de OCR não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Construir prompt com contexto de tipo esperado
    let userPrompt = '';
    if (tipoEsperado) {
      const tipoLabels: Record<string, string> = {
        cnh: 'CNH (Carteira Nacional de Habilitação)',
        crlv: 'CRLV (Certificado de Registro e Licenciamento de Veículo)',
        rg: 'RG ou CIN (Carteira de Identidade — RG antigo ou nova Carteira de Identidade Nacional)',
        comprovante_residencia: 'Comprovante de Residência',
        laudo_vistoria: 'Laudo de Vistoria',
        nota_fiscal_veiculo: 'Nota Fiscal de Veículo',
        atpv_e: 'ATPV-e / CRV Digital (Autorização para Transferência de Propriedade de Veículo)',
      };
      const tipoLabel = tipoLabels[tipoEsperado] || tipoEsperado;
      userPrompt = `Este documento é um(a) ${tipoLabel}. Extraia todas as informações do tipo ${tipoEsperado}. Se o documento não corresponder ao tipo esperado, indique no campo motivo.`;
    } else {
      userPrompt = 'Analise este documento e extraia todas as informações. DETECTE AUTOMATICAMENTE o tipo do documento.';
    }
    
    if (cpfEsperado) {
      userPrompt += ` CPF esperado no cadastro: ${cpfEsperado}. Verifique se confere.`;
    }
    if (nomeEsperado) {
      userPrompt += `

⚠️ VERIFICAÇÃO CRÍTICA DE TITULARIDADE ⚠️
Nome do associado no cadastro: "${nomeEsperado}"
Se for COMPROVANTE DE RESIDÊNCIA: compare OBRIGATORIAMENTE o nome do titular com este nome.
- REPROVE se os nomes não corresponderem (permitindo abreviações válidas como "M. Silva" para "Mario Silva").
- Se mesmo sobrenome mas primeiro nome diferente, sugira REVISAR (possível cônjuge).
- Se nome ilegível, sugira REVISAR.
- Inclua o campo "validacao_titularidade" na resposta com os detalhes da comparação.`;
    }

    console.log('Calling Lovable AI Gateway for document OCR:', url);

    // Baixar arquivo e converter para base64
    const isPdfUrl = url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf?') || url.toLowerCase().includes('.pdf_');
    const isDataUri = url.startsWith('data:');
    let contentParts: any[];
    let extractedPdfText = '';

    if (isDataUri) {
      console.log('Data URI detected, sending directly...');
      contentParts = [
        { type: 'text', text: userPrompt },
        { type: 'image_url', image_url: { url } },
      ];
    } else {
      const fileType = isPdfUrl ? 'PDF' : 'image';
      console.log(`${fileType} detected, downloading...`);
      try {
        const fileResponse = await fetch(url);
        if (!fileResponse.ok) {
          throw new Error(`Failed to download ${fileType}: ${fileResponse.status}`);
        }
        const fileBuffer = await fileResponse.arrayBuffer();
        const uint8Array = new Uint8Array(fileBuffer);
        
        // Converter para base64
        let base64 = '';
        const chunkSize = 8192;
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.slice(i, i + chunkSize);
          base64 += String.fromCharCode(...chunk);
        }
        base64 = btoa(base64);
        
        const mimeType = isPdfUrl 
          ? 'application/pdf' 
          : (fileResponse.headers.get('content-type') || 'image/jpeg');
        const dataUri = `data:${mimeType};base64,${base64}`;
        console.log(`${fileType} downloaded: ${fileBuffer.byteLength} bytes, mime: ${mimeType}`);
        
        // Para PDFs, tentar extrair texto nativo
        if (isPdfUrl) {
          try {
            // Decodificar o PDF e procurar texto embutido
            const pdfText = await extractTextFromPDFBuffer(uint8Array);
            if (pdfText && pdfText.length > 50) {
              extractedPdfText = pdfText;
              console.log(`[OCR] Texto nativo extraído do PDF: ${pdfText.length} chars`);
            } else {
              console.log(`[OCR] PDF sem texto nativo suficiente (${pdfText?.length || 0} chars), usando OCR visual`);
            }
          } catch (pdfErr) {
            console.warn('[OCR] Falha ao extrair texto nativo do PDF:', pdfErr);
          }
        }

        contentParts = [
          { type: 'text', text: userPrompt },
          { type: 'image_url', image_url: { url: dataUri } },
        ];

        // Se temos texto nativo do PDF, adicionar ao prompt para melhorar precisão
        if (extractedPdfText) {
          const textHint = extractedPdfText.length > 3000 
            ? extractedPdfText.substring(0, 3000) + '...' 
            : extractedPdfText;
          contentParts = [
            { 
              type: 'text', 
              text: `${userPrompt}\n\n--- TEXTO EXTRAÍDO DO PDF (use como referência principal para dados textuais como CPF, nome, números) ---\n${textHint}\n--- FIM DO TEXTO ---\n\nA imagem do documento também está anexada. Use o texto extraído como fonte primária para campos numéricos (CPF, RG, etc.) e a imagem para confirmar layout e campos visuais.`
            },
            { type: 'image_url', image_url: { url: dataUri } },
          ];
        }
      } catch (downloadError) {
        console.error(`Failed to download ${fileType}:`, downloadError);
        return new Response(
          JSON.stringify({ error: `Erro ao baixar o documento para processamento.` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OCR_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: contentParts,
          },
        ],
        max_tokens: 2000,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido, tente novamente mais tarde.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos esgotados, adicione créditos ao workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Erro ao processar documento com IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ler resposta
    let data;
    try {
      const responseText = await response.text();
      if (!responseText || responseText.trim() === '') {
        console.error('Empty response from AI Gateway');
        return new Response(
          JSON.stringify({ error: 'Resposta vazia do gateway de IA. Tente novamente.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse AI Gateway response:', parseError);
      return new Response(
        JSON.stringify({ error: 'Erro ao processar resposta do gateway de IA. Tente novamente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content in AI response:', JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: 'Resposta vazia da IA. Tente novamente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parsear JSON da resposta
    let result;
    try {
      let cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      // Limpar placeholders deixados pelo modelo (ex: _CONFIDENCE_, _NOME_) → null
      // (não substituímos mais por 0.95 — confiança é calculada de verdade abaixo)
      cleanContent = cleanContent.replace(/:\s*_[A-Z_]+_\s*([,}\]])/g, ': null$1');
      result = JSON.parse(cleanContent);
    } catch (parseError) {
      console.warn('[OCR] JSON.parse falhou, tentando reparar JSON truncado...');
      const repaired = tryRepairTruncatedJSON(content);
      if (repaired) {
        console.warn('[OCR] JSON reparado com sucesso após truncamento');
        result = repaired;
      } else {
        console.error('[OCR] Reparo falhou. Conteúdo bruto:', content);
        return new Response(
          JSON.stringify({ 
            error: 'Erro ao interpretar resultado da análise',
            rawResponse: content,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('OCR result:', result);

    // Se temos texto nativo do PDF e o CPF extraído está em conflito, tentar pegar do texto
    if (result.tipo_detectado === 'cnh' && result.dados && extractedPdfText) {
      const cpfExtraido = result.dados.cpf;
      if (cpfExtraido && cpfExtraido !== 'ilegivel') {
        const cpfClean = cpfExtraido.replace(/\D/g, '');
        if (!validateCPF(cpfClean)) {
          // Tentar encontrar CPF válido no texto nativo do PDF
          const cpfRegex = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g;
          const matches = extractedPdfText.match(cpfRegex);
          if (matches) {
            for (const match of matches) {
              const cleaned = match.replace(/\D/g, '');
              if (cleaned.length === 11 && validateCPF(cleaned)) {
                const formatted = cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
                console.log(`[OCR] CPF corrigido via texto nativo do PDF: ${cpfExtraido} → ${formatted}`);
                result.dados.cpf = formatted;
                break;
              }
            }
          }
        }
      }
    }

    // Validar CPF extraído por checksum quando for CNH
    if (result.tipo_detectado === 'cnh' && result.dados) {
      const cpfExtraido = result.dados.cpf;
      const precisaRetry = !cpfExtraido || cpfExtraido === null || 
        (cpfExtraido !== 'ilegivel' && !validateCPF(cpfExtraido.replace(/\D/g, '')));
      
      if (precisaRetry) {
        const motivoRetry = !cpfExtraido || cpfExtraido === null 
          ? 'CPF não encontrado na CNH' 
          : `CPF extraído (${cpfExtraido}) falhou na validação de dígito verificador`;
        console.log(`[OCR] ${motivoRetry}, tentando extração específica...`);
        
        // Prompt corretivo com tool calling para resposta estruturada
        const retrySystemPrompt = cpfExtraido && cpfExtraido !== null
          ? `TAREFA ÚNICA: Re-leia o CPF desta CNH brasileira.

A leitura anterior retornou "${cpfExtraido}", mas este CPF é MATEMATICAMENTE INVÁLIDO (falha no dígito verificador).

INSTRUÇÕES:
1. Localize o campo "CPF" ou "CPF/MF" no documento
2. Leia CADA DÍGITO individualmente, da esquerda para a direita
3. Preste atenção especial aos dígitos que podem ser confundidos: 1/7, 3/8, 5/6, 0/8, 4/9
4. Se não tiver certeza absoluta de algum dígito, use a função com cpf="ilegivel"
5. Se tiver certeza, use a função com o CPF no formato XXX.XXX.XXX-XX`
          : `TAREFA ÚNICA: Extraia o CPF desta CNH brasileira.

O CPF é um número de 11 dígitos no formato XXX.XXX.XXX-XX.

Locais comuns do CPF na CNH:
- Próximo ao nome do condutor
- Abaixo da foto
- Campo rotulado "CPF" ou "CPF/MF"

Use a função para retornar o CPF encontrado ou "ilegivel" se não conseguir ler.`;

        // Adicionar texto nativo como contexto extra se disponível
        let retryUserContent: any[] = [
          { type: 'text', text: 'Extraia o CPF desta CNH.' },
          contentParts[1], // imagem
        ];
        
        if (extractedPdfText) {
          retryUserContent = [
            { type: 'text', text: `Extraia o CPF desta CNH.\n\nTexto nativo do PDF:\n${extractedPdfText.substring(0, 2000)}` },
            contentParts[1],
          ];
        }

        try {
          const retryResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: OCR_RETRY_MODEL,
              messages: [
                { role: 'system', content: retrySystemPrompt },
                { role: 'user', content: retryUserContent },
              ],
              max_tokens: 200,
              temperature: 0,
              tools: [{
                type: 'function',
                function: {
                  name: 'report_cpf',
                  description: 'Reportar o CPF extraído da CNH',
                  parameters: {
                    type: 'object',
                    properties: {
                      cpf: { 
                        type: 'string', 
                        description: 'CPF no formato XXX.XXX.XXX-XX ou "ilegivel" se não conseguir ler' 
                      }
                    },
                    required: ['cpf'],
                    additionalProperties: false,
                  }
                }
              }],
              tool_choice: { type: 'function', function: { name: 'report_cpf' } },
            }),
          });

          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            
            // Tentar extrair CPF do tool call primeiro
            let retryCpf: string | null = null;
            
            const toolCall = retryData.choices?.[0]?.message?.tool_calls?.[0];
            if (toolCall?.function?.arguments) {
              try {
                const args = JSON.parse(toolCall.function.arguments);
                retryCpf = args.cpf || null;
                console.log('[OCR] CPF extraído via tool calling:', retryCpf);
              } catch {
                console.warn('[OCR] Falha ao parsear tool call arguments, tentando content...');
              }
            }
            
            // Fallback: tentar extrair do content (caso o modelo não use tool calling)
            if (!retryCpf) {
              const retryContent = retryData.choices?.[0]?.message?.content;
              if (retryContent) {
                retryCpf = extractCPFFromRaw(retryContent);
                console.log('[OCR] CPF extraído via content fallback:', retryCpf);
              }
            }

            if (retryCpf && retryCpf !== 'ilegivel') {
              if (validateCPF(retryCpf.replace(/\D/g, ''))) {
                console.log('[OCR] CPF válido extraído na segunda tentativa:', retryCpf);
                result.dados.cpf = retryCpf;
              } else {
                console.log('[OCR] CPF da segunda tentativa também inválido:', retryCpf, '→ tentando correção por permutação');
                const cpfCorrigido = tryFixCPFByPermutation(retryCpf);
                if (cpfCorrigido) {
                  console.log(`[OCR] CPF corrigido por permutação: ${retryCpf} → ${cpfCorrigido}`);
                  result.dados.cpf = cpfCorrigido;
                } else {
                  const cpfCorrigido1 = cpfExtraido ? tryFixCPFByPermutation(cpfExtraido) : null;
                  if (cpfCorrigido1) {
                    console.log(`[OCR] CPF corrigido por permutação (1ª tentativa): ${cpfExtraido} → ${cpfCorrigido1}`);
                    result.dados.cpf = cpfCorrigido1;
                  } else {
                    result.dados.cpf = 'ilegivel';
                    result.motivo = (result.motivo || '') + ' CPF não pôde ser lido com precisão (dígito verificador inválido em ambas tentativas).';
                  }
                }
              }
            } else if (retryCpf === 'ilegivel') {
              console.log('[OCR] CPF marcado como ilegível na segunda tentativa');
              // Ainda tentar permutação com CPF da 1ª tentativa
              const cpfCorrigido = cpfExtraido ? tryFixCPFByPermutation(cpfExtraido) : null;
              if (cpfCorrigido) {
                console.log(`[OCR] CPF corrigido por permutação após ilegível: ${cpfExtraido} → ${cpfCorrigido}`);
                result.dados.cpf = cpfCorrigido;
              } else {
                result.dados.cpf = 'ilegivel';
                result.motivo = (result.motivo || '') + ' CPF não pôde ser lido (documento danificado ou cortado).';
              }
            } else {
              // Nenhum CPF extraído no retry - tentar permutação
              const cpfCorrigido = cpfExtraido ? tryFixCPFByPermutation(cpfExtraido) : null;
              if (cpfCorrigido) {
                console.log(`[OCR] CPF corrigido por permutação (fallback): ${cpfExtraido} → ${cpfCorrigido}`);
                result.dados.cpf = cpfCorrigido;
              } else {
                result.dados.cpf = 'ilegivel';
              }
            }
          } else {
            console.error('[OCR] Retry response not ok:', retryResponse.status);
            const cpfCorrigido = cpfExtraido ? tryFixCPFByPermutation(cpfExtraido) : null;
            if (cpfCorrigido) {
              result.dados.cpf = cpfCorrigido;
            } else {
              result.dados.cpf = 'ilegivel';
            }
          }
        } catch (retryError) {
          console.error('[OCR] Erro no retry de extração de CPF:', retryError);
          if (cpfExtraido && cpfExtraido !== 'ilegivel' && !validateCPF(cpfExtraido.replace(/\D/g, ''))) {
            const cpfCorrigido = tryFixCPFByPermutation(cpfExtraido);
            if (cpfCorrigido) {
              console.log(`[OCR] CPF corrigido por permutação após erro de rede: ${cpfExtraido} → ${cpfCorrigido}`);
              result.dados.cpf = cpfCorrigido;
            } else {
              result.dados.cpf = 'ilegivel';
            }
          }
        }
      } else if (cpfExtraido && cpfExtraido !== 'ilegivel') {
        console.log('[OCR] CPF extraído validado com sucesso:', cpfExtraido);
      }
    }

    // ============================================================
    // Validação universal de campos críticos por checksum + retry
    // ============================================================
    if (result?.dados && typeof result.dados === 'object') {
      const tipo = result.tipo_detectado;
      const d = result.dados as Record<string, any>;

      // Mapa: campo → validador
      const fieldValidators: Array<{ tipos: string[]; field: string; validate: (v: string) => boolean; label: string }> = [
        { tipos: ['crlv', 'atpv_e', 'nota_fiscal_veiculo'], field: 'placa', validate: validatePlaca, label: 'Placa' },
        { tipos: ['crlv', 'atpv_e'], field: 'renavam', validate: validateRenavam, label: 'Renavam' },
        { tipos: ['crlv', 'atpv_e', 'nota_fiscal_veiculo'], field: 'chassi', validate: validateChassi, label: 'Chassi' },
        { tipos: ['atpv_e'], field: 'cpf_comprador', validate: (v) => validateCPF(v.replace(/\D/g, '')), label: 'CPF comprador' },
        { tipos: ['nota_fiscal_veiculo'], field: 'cpf_cnpj_comprador', validate: (v) => {
          const c = v.replace(/\D/g, '');
          return c.length === 11 ? validateCPF(c) : c.length === 14 ? validateCNPJ(c) : false;
        }, label: 'CPF/CNPJ comprador' },
      ];

      const checksumResults: Array<{ field: string; ok: boolean; value: any }> = [];

      for (const v of fieldValidators) {
        if (!v.tipos.includes(tipo)) continue;
        const raw = d[v.field];
        if (!raw || raw === 'ilegivel') {
          checksumResults.push({ field: v.field, ok: false, value: raw });
          continue;
        }

        // ==== CROSS-CHECK PLACA: sempre confronta com texto nativo do PDF ====
        // O OCR visual confunde 6↔G, 1↔I, 0↔O entre formato antigo e Mercosul.
        // O texto nativo do PDF (quando existe) é a fonte mais confiável.
        if (v.field === 'placa') {
          const ocrPlaca = String(raw).replace(/[^A-Z0-9]/gi, '').toUpperCase();
          const candidatosOCR = gerarCandidatosPlaca(ocrPlaca).filter(p => validatePlaca(p));

          if (extractedPdfText) {
            const candidatosNativos = extractCandidatesFromText(extractedPdfText, 'placa').filter(p => validatePlaca(p));

            // 1) Se o OCR e o texto nativo coincidem em algum candidato, usa-o.
            const match = candidatosOCR.find(c => candidatosNativos.includes(c));
            if (match && match !== ocrPlaca) {
              console.log(`[OCR] Placa cross-check OCR↔PDF: "${ocrPlaca}" → "${match}"`);
              d.placa = match;
            } else if (!match && candidatosNativos.length > 0) {
              // 2) Se não há intersecção, prioriza o texto nativo (sempre mais confiável que visão).
              const escolhida = candidatosNativos[0];
              if (escolhida !== ocrPlaca) {
                console.log(`[OCR] Placa sobrescrita pelo texto nativo do PDF: "${ocrPlaca}" → "${escolhida}"`);
                d.placa = escolhida;
              }
            }
          }

          // 3) Fallback legado: prefere Mercosul se ainda não foi resolvido.
          const atual = String(d.placa);
          if (!validatePlaca(atual)) {
            const { placa: resolved, ajustada } = resolvePlacaPreferMercosul(atual);
            if (ajustada && validatePlaca(resolved)) {
              console.log(`[OCR] Placa ajustada por normalização Mercosul: "${atual}" → "${resolved}"`);
              d.placa = resolved;
            }
          }
        }

        const currentVal = String(d[v.field]);
        const ok = v.validate(currentVal);
        checksumResults.push({ field: v.field, ok, value: d[v.field] });
        if (!ok) {
          console.warn(`[OCR] Validação falhou: ${v.label}="${currentVal}" inválido`);

          // Tentar recuperar do texto nativo do PDF
          if (extractedPdfText) {
            const candidates = extractCandidatesFromText(extractedPdfText, v.field);
            for (const cand of candidates) {
              if (v.validate(cand)) {
                console.log(`[OCR] ${v.label} corrigido via texto nativo: "${currentVal}" → "${cand}"`);
                d[v.field] = cand;
                checksumResults[checksumResults.length - 1] = { field: v.field, ok: true, value: cand };
                break;
              }
            }
          }
        }
      }

      // Se houve falhas e não conseguimos corrigir, marcar como revisar
      const failedFields = checksumResults.filter(r => !r.ok && r.value && r.value !== 'ilegivel');
      if (failedFields.length > 0) {
        const names = failedFields.map(f => f.field).join(', ');
        result.motivo = (result.motivo || '') + ` Campos com checksum inválido: ${names}.`;
        if (result.sugestao === 'aprovar') result.sugestao = 'revisar';
      }

      // ============================================================
      // Confiança real (substitui fake 0.95)
      // ============================================================
      const totalChecks = checksumResults.length;
      const okChecks = checksumResults.filter(r => r.ok).length;
      const fromNativePdf = !!extractedPdfText && extractedPdfText.length > 50;

      let confidence = 0.7; // base visual
      if (fromNativePdf) confidence = 0.85;
      if (totalChecks > 0) {
        const checksumRatio = okChecks / totalChecks;
        confidence = (fromNativePdf ? 0.6 : 0.4) + checksumRatio * 0.4;
      }
      // Penalizar se houver campos null/ilegivel relevantes
      const nullishCount = Object.values(d).filter(v => v === null || v === 'ilegivel').length;
      const totalFields = Object.keys(d).length;
      if (totalFields > 0) {
        const completeness = 1 - nullishCount / totalFields;
        confidence = confidence * (0.7 + completeness * 0.3);
      }
      result.confianca = Math.max(0.1, Math.min(0.99, Number(confidence.toFixed(2))));
      result._fonte_dados = fromNativePdf ? 'pdf_nativo+visual' : 'visual';
      result._checksums = checksumResults;
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in document-ocr function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Extrai texto nativo de um PDF usando pdfjs-dist (descomprime FlateDecode etc).
 * Retorna string vazia se for PDF escaneado puro (apenas imagens).
 */
async function extractTextFromPDFBuffer(buffer: Uint8Array): Promise<string> {
  try {
    // pdfjs-dist precisa de um Uint8Array novo (não compartilhado)
    const data = new Uint8Array(buffer);
    const loadingTask = (pdfjsLib as any).getDocument({
      data,
      disableFontFace: true,
      useSystemFonts: false,
      isEvalSupported: false,
      // Sem worker no edge runtime
      verbosity: 0,
    });
    const pdf = await loadingTask.promise;
    const parts: string[] = [];
    const maxPages = Math.min(pdf.numPages, 10);
    for (let p = 1; p <= maxPages; p++) {
      const page = await pdf.getPage(p);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((it: any) => (typeof it.str === 'string' ? it.str : ''))
        .filter(Boolean)
        .join(' ');
      if (pageText.trim()) parts.push(pageText);
    }
    const result = parts.join('\n').replace(/[ \t]+/g, ' ').trim();
    return result;
  } catch (err) {
    console.warn('[OCR] pdfjs falhou ao extrair texto:', err instanceof Error ? err.message : err);
    return '';
  }
}

/**
 * Extrai candidatos plausíveis para um campo a partir de texto bruto do PDF.
 * Usado quando o checksum do valor extraído pela IA falha.
 */
function extractCandidatesFromText(text: string, field: string): string[] {
  if (!text) return [];
  const out = new Set<string>();
  switch (field) {
    case 'placa': {
      const re = /\b([A-Z]{3}[-\s]?[0-9][A-Z0-9][0-9]{2})\b/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        const cru = m[1].replace(/[-\s]/g, '').toUpperCase();
        out.add(cru);
        // Adiciona também a versão normalizada Mercosul como candidato alternativo
        const norm = normalizePlacaMercosul(cru);
        if (norm && norm !== cru) out.add(norm);
      }
      break;
    }
    case 'renavam': {
      const re = /\b(\d{9,11})\b/g;
      let m;
      while ((m = re.exec(text)) !== null) out.add(m[1].padStart(11, '0'));
      break;
    }
    case 'chassi': {
      const re = /\b([A-HJ-NPR-Z0-9]{17})\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) out.add(m[1].toUpperCase());
      break;
    }
    case 'cpf_comprador':
    case 'cpf_cnpj_comprador': {
      const reCpf = /\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b/g;
      const reCnpj = /\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/g;
      let m;
      while ((m = reCpf.exec(text)) !== null) {
        const c = m[1].replace(/\D/g, '');
        out.add(`${c.slice(0,3)}.${c.slice(3,6)}.${c.slice(6,9)}-${c.slice(9,11)}`);
      }
      while ((m = reCnpj.exec(text)) !== null) {
        const c = m[1].replace(/\D/g, '');
        out.add(`${c.slice(0,2)}.${c.slice(2,5)}.${c.slice(5,8)}/${c.slice(8,12)}-${c.slice(12,14)}`);
      }
      break;
    }
  }
  return Array.from(out);
}

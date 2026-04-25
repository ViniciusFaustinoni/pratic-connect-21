/**
 * Esquema central de campos editáveis por tipo de documento OCR.
 *
 * Cada ponto do sistema que usa OCR consome esse schema via `OcrDadosEditor`,
 * garantindo que a UI de edição manual seja consistente em todo o sistema
 * (cotação pública, contratos, leads, migração, vistoria...).
 *
 * Para adicionar um novo campo extraído basta acrescentar uma entrada aqui —
 * o editor passa a renderizar automaticamente em todos os fluxos.
 */

export type OcrFieldMask = 'cpf' | 'placa' | 'data' | 'cep' | 'cnpj' | 'telefone';

export interface OcrFieldDef {
  /** Chave usada em `dados_extraidos` / `ocr.dados`. */
  key: string;
  /** Rótulo exibido ao usuário. */
  label: string;
  /** Máscara (opcional). Reaproveita componentes de `MaskedInputs`. */
  mask?: OcrFieldMask;
  /** Tipo de input nativo (default text). */
  type?: 'text' | 'date' | 'select';
  /** Opções para campos do tipo select. */
  options?: { value: string; label: string }[];
  /** Placeholder. */
  placeholder?: string;
  /** Indica que o campo é especialmente importante (validações cruzadas). */
  important?: boolean;
}

/** Tipos de documento com schema de edição definido. */
export type OcrSchemaTipo =
  | 'cnh'
  | 'rg'
  | 'crlv'
  | 'nota_fiscal_veiculo'
  | 'atpv_e'
  | 'comprovante_residencia'
  | 'comprovante_pagamento'
  | 'boleto_referencia'
  | 'chassi_foto'
  | 'outro';

const CNH_FIELDS: OcrFieldDef[] = [
  { key: 'nome', label: 'Nome completo', important: true },
  { key: 'cpf', label: 'CPF', mask: 'cpf', important: true },
  { key: 'rg', label: 'RG' },
  { key: 'data_nascimento', label: 'Data de nascimento', type: 'date' },
  { key: 'numero_registro', label: 'Número da CNH' },
  {
    key: 'categoria',
    label: 'Categoria',
    type: 'select',
    options: [
      { value: 'A', label: 'A' },
      { value: 'B', label: 'B' },
      { value: 'AB', label: 'AB' },
      { value: 'C', label: 'C' },
      { value: 'D', label: 'D' },
      { value: 'E', label: 'E' },
      { value: 'AC', label: 'AC' },
      { value: 'AD', label: 'AD' },
      { value: 'AE', label: 'AE' },
    ],
  },
  { key: 'validade', label: 'Validade', type: 'date' },
];

const RG_FIELDS: OcrFieldDef[] = [
  { key: 'nome', label: 'Nome completo', important: true },
  { key: 'cpf', label: 'CPF', mask: 'cpf', important: true },
  { key: 'rg', label: 'RG' },
  { key: 'data_nascimento', label: 'Data de nascimento', type: 'date' },
];

const CRLV_FIELDS: OcrFieldDef[] = [
  { key: 'placa', label: 'Placa', mask: 'placa', important: true },
  { key: 'chassi', label: 'Chassi', important: true },
  { key: 'renavam', label: 'Renavam' },
  { key: 'marca', label: 'Marca' },
  { key: 'modelo', label: 'Modelo' },
  { key: 'ano_fabricacao', label: 'Ano fab.' },
  { key: 'ano_modelo', label: 'Ano mod.' },
  { key: 'cor', label: 'Cor' },
  { key: 'combustivel', label: 'Combustível' },
  { key: 'motor', label: 'Motor' },
  {
    key: 'blindado',
    label: 'Blindado',
    type: 'select',
    options: [
      { value: 'false', label: 'Não' },
      { value: 'true', label: 'Sim' },
    ],
  },
];

const COMPROVANTE_RESIDENCIA_FIELDS: OcrFieldDef[] = [
  { key: 'nome_titular', label: 'Nome do titular' },
  { key: 'cpf_titular', label: 'CPF', mask: 'cpf' },
  { key: 'cep', label: 'CEP', mask: 'cep' },
  { key: 'logradouro', label: 'Logradouro' },
  { key: 'numero', label: 'Número' },
  { key: 'bairro', label: 'Bairro' },
  { key: 'cidade', label: 'Cidade' },
  { key: 'uf', label: 'UF' },
  { key: 'data_emissao', label: 'Data de emissão', type: 'date' },
];

const COMPROVANTE_PAGAMENTO_FIELDS: OcrFieldDef[] = [
  { key: 'cpf', label: 'CPF do pagador', mask: 'cpf', important: true },
  { key: 'placa', label: 'Placa do veículo', mask: 'placa' },
  { key: 'data_documento', label: 'Data do pagamento', type: 'date', important: true },
  { key: 'valor', label: 'Valor pago' },
];

const CHASSI_FOTO_FIELDS: OcrFieldDef[] = [
  { key: 'chassi', label: 'Chassi extraído da foto', important: true },
];

export const OCR_FIELDS_SCHEMA: Record<OcrSchemaTipo, OcrFieldDef[]> = {
  cnh: CNH_FIELDS,
  rg: RG_FIELDS,
  crlv: CRLV_FIELDS,
  nota_fiscal_veiculo: CRLV_FIELDS, // Mesmos campos do CRLV
  atpv_e: CRLV_FIELDS,              // Mesmos campos do CRLV
  comprovante_residencia: COMPROVANTE_RESIDENCIA_FIELDS,
  comprovante_pagamento: COMPROVANTE_PAGAMENTO_FIELDS,
  boleto_referencia: COMPROVANTE_PAGAMENTO_FIELDS,
  chassi_foto: CHASSI_FOTO_FIELDS,
  outro: [],
};

export const OCR_TIPO_LABEL: Record<OcrSchemaTipo, string> = {
  cnh: 'CNH',
  rg: 'RG / CIN',
  crlv: 'CRLV',
  nota_fiscal_veiculo: 'Nota Fiscal',
  atpv_e: 'ATPV-e (CRV Digital)',
  comprovante_residencia: 'Comprovante de Residência',
  comprovante_pagamento: 'Comprovante de Pagamento',
  boleto_referencia: 'Boleto de Referência',
  chassi_foto: 'Foto do Chassi',
  outro: 'Documento',
};

export function getSchemaForTipo(tipo: string | null | undefined): OcrFieldDef[] {
  if (!tipo) return [];
  const key = tipo as OcrSchemaTipo;
  return OCR_FIELDS_SCHEMA[key] || [];
}

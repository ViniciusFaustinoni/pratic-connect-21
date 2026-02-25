// ============================================
// TIPOS — Módulo de Cobertura de Terceiros
// ============================================

export type CulpaTerceiro = 'associado_culpado' | 'terceiro_culpado' | 'compartilhada' | 'a_definir';

export type TipoDanoTerceiro = 'veiculo' | 'nao_veicular';

export type StatusTerceiro =
  | 'cadastrado'
  | 'documentacao_pendente'
  | 'documentacao_enviada'
  | 'termo_pendente'
  | 'termo_assinado'
  | 'oficina_pendente'
  | 'oficina_definida'
  | 'acordo_proposto'
  | 'acordo_aceito'
  | 'acordo_recusado'
  | 'regulagem'
  | 'orcamento'
  | 'pecas'
  | 'em_reparo'
  | 'concluido'
  | 'arquivado';

export type OficinaTipo = 'credenciada' | 'propria';

export type AcordoStatus = 'proposto' | 'aceito' | 'recusado';

export type TipoDocumentoTerceiro = 'cnh' | 'crlv' | 'bo' | 'foto_dano' | 'video' | 'orcamento_1' | 'orcamento_2' | 'orcamento_3';

export type StatusDocumentoTerceiro = 'pendente' | 'aprovado' | 'rejeitado';

export const CULPA_LABELS: Record<CulpaTerceiro, string> = {
  associado_culpado: 'Associado Culpado',
  terceiro_culpado: 'Terceiro Culpado',
  compartilhada: 'Culpa Compartilhada',
  a_definir: 'A Definir',
};

export const CULPA_COLORS: Record<CulpaTerceiro, string> = {
  associado_culpado: 'bg-green-100 text-green-800',
  terceiro_culpado: 'bg-red-100 text-red-800',
  compartilhada: 'bg-orange-100 text-orange-800',
  a_definir: 'bg-yellow-100 text-yellow-800',
};

export const STATUS_TERCEIRO_LABELS: Record<StatusTerceiro, string> = {
  cadastrado: 'Cadastrado',
  documentacao_pendente: 'Doc. Pendente',
  documentacao_enviada: 'Doc. Enviada',
  termo_pendente: 'Termo Pendente',
  termo_assinado: 'Termo Assinado',
  oficina_pendente: 'Oficina Pendente',
  oficina_definida: 'Oficina Definida',
  acordo_proposto: 'Acordo Proposto',
  acordo_aceito: 'Acordo Aceito',
  acordo_recusado: 'Acordo Recusado',
  regulagem: 'Em Regulagem',
  orcamento: 'Em Orçamento',
  pecas: 'Aguard. Peças',
  em_reparo: 'Em Reparo',
  concluido: 'Concluído',
  arquivado: 'Arquivado',
};

export const STATUS_TERCEIRO_COLORS: Record<StatusTerceiro, string> = {
  cadastrado: 'bg-gray-100 text-gray-800',
  documentacao_pendente: 'bg-yellow-100 text-yellow-800',
  documentacao_enviada: 'bg-blue-100 text-blue-800',
  termo_pendente: 'bg-amber-100 text-amber-800',
  termo_assinado: 'bg-green-100 text-green-800',
  oficina_pendente: 'bg-sky-100 text-sky-800',
  oficina_definida: 'bg-teal-100 text-teal-800',
  acordo_proposto: 'bg-purple-100 text-purple-800',
  acordo_aceito: 'bg-emerald-100 text-emerald-800',
  acordo_recusado: 'bg-red-100 text-red-800',
  regulagem: 'bg-teal-100 text-teal-800',
  orcamento: 'bg-amber-100 text-amber-800',
  pecas: 'bg-orange-100 text-orange-800',
  em_reparo: 'bg-violet-100 text-violet-800',
  concluido: 'bg-green-100 text-green-800',
  arquivado: 'bg-gray-100 text-gray-500',
};

export const TIPO_DOCUMENTO_LABELS: Record<TipoDocumentoTerceiro, string> = {
  cnh: 'CNH do Condutor',
  crlv: 'Documento do Veículo (CRLV)',
  bo: 'Boletim de Ocorrência',
  foto_dano: 'Fotos do Veículo Danificado',
  video: 'Vídeo do Veículo',
  orcamento_1: 'Orçamento 1',
  orcamento_2: 'Orçamento 2',
  orcamento_3: 'Orçamento 3',
};

export interface SinistroTerceiro {
  id: string;
  sinistro_id: string;
  numero_sequencial: number;
  nome: string;
  cpf: string;
  telefone: string;
  whatsapp: string;
  email?: string;
  veiculo_placa: string;
  veiculo_marca: string;
  veiculo_modelo: string;
  veiculo_ano: string;
  veiculo_cor: string;
  veiculo_fipe?: number;
  culpa: CulpaTerceiro;
  parentesco: boolean;
  parentesco_descricao?: string;
  tipo_dano: TipoDanoTerceiro;
  observacoes?: string;
  token: string;
  status: StatusTerceiro;
  oficina_tipo?: OficinaTipo;
  oficina_nome?: string;
  oficina_endereco?: string;
  oficina_telefone?: string;
  orcamento_valor?: number;
  acordo_valor?: number;
  acordo_justificativa?: string;
  acordo_status?: AcordoStatus;
  acordo_respondido_em?: string;
  termo_assinado_em?: string;
  termo_assinatura_ip?: string;
  termo_assinatura_nome?: string;
  documentos_aprovados_em?: string;
  reparo_concluido_em?: string;
  entrega_em?: string;
  created_at: string;
  created_by?: string;
  updated_at: string;
}

export interface SinistroTerceiroDocumento {
  id: string;
  terceiro_id: string;
  tipo: TipoDocumentoTerceiro;
  nome: string;
  url: string;
  status: StatusDocumentoTerceiro;
  motivo_rejeicao?: string;
  aprovado_por?: string;
  aprovado_em?: string;
  created_at: string;
}

export interface LimiteCoberturaTerceiros {
  plano_nome: string;
  limite_total: number;
  cota_associado: number;
  cota_isento: boolean;
  cota_dobrada: boolean;
  motivo_cota_dobrada?: string;
  total_consumido: number;
  disponivel: number;
}

// =============================================
// Types para Substituição de Veículo
// =============================================

export type StatusSubstituicao =
  | 'iniciada'
  | 'aguardando_retirada'
  | 'aguardando_vistoria'
  | 'aguardando_financeiro'
  | 'aguardando_aprovacao'
  | 'aprovada'
  | 'rejeitada'
  | 'efetivada'
  | 'cancelada_pelo_associado';

export type ResolucaoEvento =
  | 'aguardar_finalizacao'
  | 'cancelar_com_termo'
  | 'inclusao_temporaria';

export type TipoEventoBloqueante =
  | 'terceiros_paralelo'
  | 'proprio_aguardando'
  | 'proprio_cancelado'
  | 'inclusao_primeiro';

export interface SubstituicaoVeiculo {
  id: string;
  associado_id: string;
  veiculo_antigo_id: string;
  veiculo_novo_id: string | null;
  servico_retirada_id: string | null;
  servico_instalacao_id: string | null;
  contrato_novo_id: string | null;
  status: StatusSubstituicao;

  // Snapshot veículo antigo
  veiculo_antigo_placa: string | null;
  veiculo_antigo_modelo: string | null;
  veiculo_antigo_fipe: number | null;
  mensalidade_antiga: number | null;
  cota_participacao_antiga: number | null;

  // Veículo novo
  veiculo_novo_placa: string | null;
  veiculo_novo_modelo: string | null;
  veiculo_novo_fipe: number | null;
  mensalidade_nova: number | null;
  cota_participacao_nova: number | null;

  // Benefícios
  beneficios_novos: Record<string, unknown>;

  // Financeiro
  taxa_substituicao: number;
  valor_prorata: number | null;
  diferenca_mensalidade: number | null;
  cobranca_taxa_asaas_id: string | null;

  // Evento bloqueante
  evento_bloqueante_id: string | null;
  tipo_evento_bloqueante: TipoEventoBloqueante | null;
  resolucao_evento: ResolucaoEvento | null;
  termo_desistencia_evento_url: string | null;

  // Carência
  data_inicio_carencia: string | null;
  data_fim_carencia: string | null;
  carencia_dias: number;

  // Aprovação
  aprovado_por: string | null;
  aprovado_em: string | null;
  motivo_rejeicao: string | null;
  rejeitado_por: string | null;
  rejeitado_em: string | null;

  // Consultor
  consultor_id: string | null;
  pontos_consultor: number;
  comissao_creditada: boolean;

  // Autentique
  autentique_documento_id: string | null;
  autentique_status: string | null;

  // Metadata
  observacoes: string | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface DadosNovoVeiculo {
  placa: string;
  marca: string;
  modelo: string;
  ano_fabricacao: number;
  ano_modelo: number;
  cor: string;
  combustivel: string;
  codigo_fipe: string;
  valor_fipe: number;
  uso_aplicativo: boolean;
  plataforma_app?: string;
  cobertura_vidros: boolean;
  cobertura_terceiros: string | null;
  cobertura_assistencia: string | null;
}

// Labels e cores para badges de status
export const STATUS_SUBSTITUICAO_LABELS: Record<StatusSubstituicao, string> = {
  iniciada: 'Iniciada',
  aguardando_retirada: 'Aguardando Retirada',
  aguardando_vistoria: 'Aguardando Vistoria',
  aguardando_financeiro: 'Aguardando Financeiro',
  aguardando_aprovacao: 'Aguardando Aprovação',
  aprovada: 'Aprovada',
  rejeitada: 'Rejeitada',
  efetivada: 'Efetivada',
  cancelada_pelo_associado: 'Cancelada',
};

export const STATUS_SUBSTITUICAO_CORES: Record<StatusSubstituicao, string> = {
  iniciada: 'bg-blue-100 text-blue-800',
  aguardando_retirada: 'bg-yellow-100 text-yellow-800',
  aguardando_vistoria: 'bg-orange-100 text-orange-800',
  aguardando_financeiro: 'bg-amber-100 text-amber-800',
  aguardando_aprovacao: 'bg-purple-100 text-purple-800',
  aprovada: 'bg-green-100 text-green-800',
  rejeitada: 'bg-red-100 text-red-800',
  efetivada: 'bg-emerald-100 text-emerald-800',
  cancelada_pelo_associado: 'bg-gray-100 text-gray-800',
};

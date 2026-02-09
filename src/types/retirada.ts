/**
 * Tipos para o fluxo de Retirada de Rastreador
 * 
 * Este módulo define os tipos customizados usados no agendamento e execução
 * da retirada de rastreadores, incluindo motivos, subtipo, integridade do aparelho
 * e formas de cobrança de multa.
 */

/**
 * Motivo da solicitação de retirada do rastreador
 */
export type MotivoRetirada = 
  | 'cancelamento_voluntario'  // Cliente solicitou cancelamento
  | 'inadimplencia'            // Falta de pagamento
  | 'exclusao_diretoria'       // Determinação da diretoria
  | 'substituicao_veiculo'     // Troca de veículo
  | 'busca_apreensao';         // Busca e apreensão judicial

export const MOTIVO_RETIRADA_LABELS: Record<MotivoRetirada, string> = {
  cancelamento_voluntario: 'Cancelamento Voluntário',
  inadimplencia: 'Inadimplência',
  exclusao_diretoria: 'Exclusão pela Diretoria',
  substituicao_veiculo: 'Substituição de Veículo',
  busca_apreensao: 'Busca e Apreensão',
};

/**
 * Subtipo da retirada - define se é apenas retirada ou se há nova instalação
 */
export type SubTipoRetirada = 
  | 'somente_retirada'            // Apenas retirada do rastreador
  | 'retirada_com_nova_instalacao'; // Retirada seguida de nova instalação

export const SUB_TIPO_RETIRADA_LABELS: Record<SubTipoRetirada, string> = {
  somente_retirada: 'Somente Retirada',
  retirada_com_nova_instalacao: 'Retirada + Nova Instalação',
};

/**
 * Estado físico do aparelho após retirada
 */
export type IntegridadeAparelho = 
  | 'integro'     // Aparelho em perfeito estado
  | 'danificado'  // Aparelho com danos físicos
  | 'violado'     // Aparelho apresenta sinais de violação/adulteração
  | 'molhado';    // Aparelho com sinais de umidade/oxidação

export const INTEGRIDADE_APARELHO_LABELS: Record<IntegridadeAparelho, string> = {
  integro: 'Íntegro',
  danificado: 'Danificado',
  violado: 'Violado',
  molhado: 'Molhado/Oxidado',
};

export const INTEGRIDADE_APARELHO_COLORS: Record<IntegridadeAparelho, string> = {
  integro: 'bg-green-100 text-green-800',
  danificado: 'bg-red-100 text-red-800',
  violado: 'bg-orange-100 text-orange-800',
  molhado: 'bg-blue-100 text-blue-800',
};

/**
 * Forma de cobrança da multa por não devolução (R$400)
 */
export type FormaCobrancaMulta = 
  | 'automatica_asaas'   // Cobrança automática via integração Asaas
  | 'manual_financeiro'; // Conferência e cobrança manual pelo financeiro

export const FORMA_COBRANCA_MULTA_LABELS: Record<FormaCobrancaMulta, string> = {
  automatica_asaas: 'Automática (Asaas)',
  manual_financeiro: 'Manual (Financeiro)',
};

/**
 * Motivo da aplicação de multa R$400
 */
export type MotivoMulta = 
  | 'nao_devolveu'       // Associado não devolveu o rastreador (48h estourou)
  | 'nao_compareceu'     // Associado não compareceu à retirada agendada
  | 'aparelho_danificado'; // Rastreador devolvido danificado/violado/molhado

export const MOTIVO_MULTA_LABELS: Record<MotivoMulta, string> = {
  nao_devolveu: 'Não devolução do equipamento',
  nao_compareceu: 'Não comparecimento à retirada',
  aparelho_danificado: 'Aparelho devolvido danificado/violado',
};

export const MOTIVO_MULTA_COLORS: Record<MotivoMulta, string> = {
  nao_devolveu: 'bg-red-100 text-red-800',
  nao_compareceu: 'bg-orange-100 text-orange-800',
  aparelho_danificado: 'bg-yellow-100 text-yellow-800',
};

/**
 * Módulo que originou a solicitação de retirada
 */
export type ModuloOrigem = 
  | 'cadastro'       // Solicitado pelo módulo de Cadastro (cancelamento)
  | 'monitoramento'  // Solicitado pelo módulo de Monitoramento
  | 'financeiro'     // Solicitado pelo módulo Financeiro (inadimplência)
  | 'diretoria';     // Solicitado pela Diretoria

export const MODULO_ORIGEM_LABELS: Record<ModuloOrigem, string> = {
  cadastro: 'Cadastro',
  monitoramento: 'Monitoramento',
  financeiro: 'Financeiro',
  diretoria: 'Diretoria',
};

/**
 * Checklist de itens verificados na retirada
 */
export interface ChecklistRetirada {
  chip_presente: boolean;
  fios_isolados: boolean;
  acabamento_recolocado: boolean;
  integridade_verificada: boolean;
  video_gravado: boolean;
  assinatura_obtida: boolean;
}

/**
 * Dados de localização do rastreador para coleta
 */
export interface LocalizacaoRastreador {
  latitude: number;
  longitude: number;
  endereco?: string;
  referencia?: string;
  data_localizacao?: string;
}

/**
 * Valor padrão da multa por não devolução do rastreador
 */
export const VALOR_MULTA_NAO_DEVOLUCAO = 400.00;

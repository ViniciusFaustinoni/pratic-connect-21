/**
 * Mapeamento de motivos de recusa → orientações amigáveis para o associado.
 * Usado tanto no frontend (hooks de recusa) quanto no backend (cron de follow-up).
 */

const ORIENTACOES_POR_MOTIVO: Record<string, string> = {
  condicoes_precarias:
    '🔧 Leve o veículo a uma oficina de confiança para uma revisão geral. Itens como pneus, faróis, lanternas e lataria precisam estar em boas condições.',
  danos_estruturais:
    '🛠️ O veículo apresentou danos na estrutura (chassi, colunas ou longarinas). Procure uma funilaria especializada para o reparo e guarde os comprovantes do serviço.',
  adulteracoes:
    '⚙️ Foram identificadas modificações não originais de fábrica. Restaure os itens alterados ao padrão original do fabricante.',
  quilometragem_adulterada:
    '📊 Há indício de inconsistência no hodômetro. Solicite uma perícia veicular em empresa credenciada pelo DETRAN e guarde o laudo.',
  documentacao_irregular:
    '📄 A documentação do veículo está com pendências. Verifique junto ao DETRAN se há débitos, restrições ou transferência pendente e regularize.',
  chassi_divergente:
    '🔍 O número do chassi gravado no veículo diverge do documento (CRV/CRLV). Procure o DETRAN para regularização e perícia.',
  sinais_sinistro:
    '🚗 Foram identificados sinais de sinistro anterior. Obtenha um laudo cautelar em empresa credenciada para comprovar que o veículo está em condições de uso seguro.',
  sistema_eletrico:
    '⚡ O sistema elétrico do veículo precisa de reparos. Leve a um eletricista automotivo para diagnóstico e correção dos problemas encontrados.',
  outro:
    '📋 Nosso técnico identificou uma pendência que precisa de atenção. Entre em contato conosco para entender os detalhes e saber como resolver.',
};

/**
 * Retorna orientações amigáveis baseadas no motivo de recusa.
 * Se o motivo não for encontrado, retorna a orientação genérica.
 */
export function getOrientacoesRecusa(motivo: string): string {
  return ORIENTACOES_POR_MOTIVO[motivo] || ORIENTACOES_POR_MOTIVO['outro'];
}

/**
 * Versão para uso em Edge Functions (mesma lógica, exportada como objeto puro)
 */
export const ORIENTACOES_RECUSA = ORIENTACOES_POR_MOTIVO;

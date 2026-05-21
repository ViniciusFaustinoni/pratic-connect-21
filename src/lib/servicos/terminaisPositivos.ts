/**
 * Terminais positivos de campo para `servicos.status`.
 *
 * Um serviço pode terminar positivamente em campo por mais de um caminho:
 *   - `concluida`           — finalização padrão pelo técnico (vistoria, base, rota)
 *   - `aprovada`            — auto-promoção pós-conclusão (ex.: instalação técnica
 *                             fechada pelo técnico e auto-aprovada por trigger)
 *   - `aprovada_ressalvas`  — fechada em campo com observações registradas
 *
 * Esses três status são equivalentes do ponto de vista do Monitoramento:
 * o evento físico já aconteceu e o último aceite (canônico) é o do Monitoramento.
 *
 * Use `servicoConcluidoEmCampo(servico)` em qualquer guard de UI ou hook que
 * pergunte "o serviço já terminou positivamente em campo?". NÃO use comparação
 * direta `status === 'concluida'` — isso esconde o botão Aprovar para serviços
 * que terminaram por outros caminhos terminais positivos (caso TIB8F32).
 */
export const TERMINAIS_POSITIVOS_CAMPO = [
  'concluida',
  'aprovada',
  'aprovada_ressalvas',
] as const;

export type TerminalPositivoCampo = (typeof TERMINAIS_POSITIVOS_CAMPO)[number];

export function servicoConcluidoEmCampo(
  servico: { status?: string | null } | null | undefined,
): boolean {
  const s = (servico?.status || '').toLowerCase();
  return (TERMINAIS_POSITIVOS_CAMPO as readonly string[]).includes(s);
}

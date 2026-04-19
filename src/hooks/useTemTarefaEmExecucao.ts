import { useTarefaAtual } from './useTarefaAtual';

/**
 * Retorna true quando o profissional logado tem uma tarefa em execução
 * (status 'em_rota' ou 'em_andamento').
 *
 * Usado para evitar que o sistema force início de almoço enquanto o
 * técnico ainda está realizando um serviço.
 */
export function useTemTarefaEmExecucao(): boolean {
  const { data: tarefa } = useTarefaAtual();
  if (!tarefa) return false;
  return tarefa.status === 'em_rota' || tarefa.status === 'em_andamento';
}

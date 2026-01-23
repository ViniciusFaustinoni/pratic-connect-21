// Re-exporta o componente unificado para manter compatibilidade
import { AgendamentoVistoria } from './AgendamentoVistoria';

interface AgendamentoCotacaoProps {
  cotacaoId: string;
  onConfirmar: (dataAgendada?: string, horarioAgendado?: string) => void;
}

export function AgendamentoCotacao({ cotacaoId, onConfirmar }: AgendamentoCotacaoProps) {
  return (
    <AgendamentoVistoria
      cotacaoId={cotacaoId}
      onConfirmar={onConfirmar}
      contexto="presencial-direto"
    />
  );
}

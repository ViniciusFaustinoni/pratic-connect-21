// Re-exporta o componente unificado para manter compatibilidade
import { AgendamentoVistoria } from './AgendamentoVistoria';

interface AgendamentoVistoriaCompletaProps {
  cotacaoId: string;
  tipoVistoria?: 'autovistoria' | 'agendada';
  onConfirmar: () => void;
}

export function AgendamentoVistoriaCompleta({ cotacaoId, tipoVistoria, onConfirmar }: AgendamentoVistoriaCompletaProps) {
  return (
    <AgendamentoVistoria
      cotacaoId={cotacaoId}
      onConfirmar={onConfirmar}
      contexto="pos-autovistoria"
      tipoVistoria={tipoVistoria}
    />
  );
}

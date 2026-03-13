// Re-exporta o componente unificado para manter compatibilidade
import { AgendamentoVistoria } from './AgendamentoVistoria';

interface AgendamentoCotacaoProps {
  cotacaoId: string;
  onConfirmar: (dataAgendada?: string, horarioAgendado?: string) => void;
  enderecoInicial?: {
    cep?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
  };
}

export function AgendamentoCotacao({ cotacaoId, onConfirmar, enderecoInicial }: AgendamentoCotacaoProps) {
  return (
    <AgendamentoVistoria
      cotacaoId={cotacaoId}
      onConfirmar={onConfirmar}
      contexto="presencial-direto"
      enderecoInicial={enderecoInicial}
    />
  );
}

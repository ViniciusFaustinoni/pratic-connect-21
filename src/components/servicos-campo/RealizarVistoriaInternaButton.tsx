import { ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import { registrarLog } from '@/hooks/useAuditLog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Servico } from '@/hooks/useServicos';

/**
 * Botão "Realizar Vistoria Interna".
 *
 * Visível apenas para Coordenador de Monitoramento (ou Diretor / superuser).
 * Abre, em nova aba, a MESMA tela que o técnico usa para concluir o serviço —
 * checklist + fotos + vídeo 360° + vínculo de rastreador. A conclusão segue
 * exatamente o caminho canônico do técnico (mesmas mutations, mesmos triggers
 * DB, mesma fila de Aprovação de Associados no Monitoramento).
 *
 * Para serviços em status terminal o botão não aparece.
 */
interface Props {
  servico: Servico;
  /** Variante visual — usar `icon` para botão compacto em tabelas. */
  variant?: 'default' | 'icon';
  className?: string;
}

const STATUS_TERMINAIS = new Set([
  'concluida',
  'aprovada',
  'reprovada',
  'aprovada_ressalvas',
  'cancelada',
]);

function resolverRotaTecnico(tipo: Servico['tipo']): string | null {
  // 'vistoria_entrada' equivale a 'instalacao' (1ª visita) — ver memória
  // [vistoria_entrada ≡ instalacao]
  if (tipo === 'instalacao' || tipo === 'vistoria_entrada' || tipo === 'revistoria') {
    return '/instalador/instalacao';
  }
  if (tipo === 'vistoria_retirada') return '/instalador/retirada';
  if (tipo === 'manutencao') return '/instalador/manutencao';
  // Demais tipos de vistoria (saída, sinistro, periódica, cancelamento)
  return '/instalador/vistoria';
}

export function RealizarVistoriaInternaButton({
  servico,
  variant = 'default',
  className,
}: Props) {
  const { isCoordenadorMonitoramento, isDiretor, isSuperAdmin } = usePermissions();

  const podeUsar = isCoordenadorMonitoramento || isDiretor || isSuperAdmin;
  if (!podeUsar) return null;

  // Esconde em status terminal — nada a executar
  if (STATUS_TERMINAIS.has(servico.status)) return null;

  const rotaBase = resolverRotaTecnico(servico.tipo);
  if (!rotaBase) return null;

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Auditoria não-bloqueante
    void registrarLog({
      acao: 'iniciar',
      modulo: 'monitoramento',
      descricao: `Vistoria interna iniciada pelo Monitoramento (${servico.tipo}) — ${servico.veiculo?.placa ?? 'sem placa'} / ${servico.associado?.nome ?? 'sem cliente'}`,
      tabela: 'servicos',
      entidade_id: servico.id,
      dados_novos: {
        tipo: servico.tipo,
        placa: servico.veiculo?.placa ?? null,
        associado_id: servico.associado_id ?? null,
        modo: 'vistoria_interna_coordenador',
      },
    });
    toast.info('Abrindo tela de execução…', {
      description: 'A conclusão segue o mesmo fluxo do técnico.',
    });
    window.open(`${rotaBase}/${servico.id}`, '_blank', 'noopener,noreferrer');
  };

  if (variant === 'icon') {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn('h-7 w-7 text-primary hover:text-primary', className)}
        onClick={handleClick}
        title="Realizar vistoria interna (Coordenador)"
      >
        <ClipboardCheck className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn('gap-1.5 h-9 border-primary/40 text-primary hover:bg-primary/5', className)}
      onClick={handleClick}
      title="Executar fotos, vídeo e dados do rastreador como técnico (Coordenador de Monitoramento)"
    >
      <ClipboardCheck className="h-4 w-4" />
      Realizar Vistoria Interna
    </Button>
  );
}

import { useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import { registrarLog } from '@/hooks/useAuditLog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { VistoriaInternaDialog } from '@/components/monitoramento/VistoriaInternaDialog';
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
  /**
   * Callback síncrono executado ANTES de abrir o dialog interno.
   * Quando este botão é usado dentro de outro modal (ex.: ServicoDetailModal),
   * o pai deve fechar a si mesmo aqui para evitar empilhamento de Dialogs do
   * Radix (que causa overlay duplicado / conteúdo invisível).
   */
  onBeforeOpen?: () => void;
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
  if (tipo === 'vistoria_manutencao') return '/instalador/manutencao';
  // Demais tipos de vistoria (saída, sinistro, periódica, cancelamento)
  return '/instalador/vistoria';
}


export function RealizarVistoriaInternaButton({
  servico,
  variant = 'default',
  className,
  onBeforeOpen,
}: Props) {
  const perms = usePermissions();
  const podeUsar = perms.isCoordenadorMonitoramento || perms.isDiretor || (perms as any).isAdminMaster || (perms as any).isDesenvolvedor;
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!podeUsar) return null;
  if (STATUS_TERMINAIS.has(servico.status)) return null;

  const rotaBase = resolverRotaTecnico(servico.tipo);
  if (!rotaBase) return null;

  // Para instalação / vistoria_entrada / revistoria abrimos a tela embedada em modal.
  // Demais tipos (retirada, manutenção, vistoria genérica) seguem com window.open
  // por enquanto, já que reusam outras páginas do app do instalador.
  const podeEmbedar = rotaBase === '/instalador/instalacao';

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
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
        modo: podeEmbedar ? 'vistoria_interna_coordenador_modal' : 'vistoria_interna_coordenador',
      },
    });
    if (podeEmbedar) {
      // Se estiver dentro de outro Dialog, fecha o pai antes pra evitar
      // empilhamento de overlays do Radix.
      if (onBeforeOpen) {
        onBeforeOpen();
        // Espera o pai desmontar o overlay antes de abrir o nosso.
        setTimeout(() => setDialogOpen(true), 120);
      } else {
        setDialogOpen(true);
      }
    } else {
      onBeforeOpen?.();
      toast.info('Abrindo tela de execução…', {
        description: 'A conclusão segue o mesmo fluxo do técnico.',
      });
      window.open(`${rotaBase}/${servico.id}`, '_blank', 'noopener,noreferrer');
    }
  };

  const trigger =
    variant === 'icon' ? (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          'h-7 w-7 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary border border-primary/30',
          className,
        )}
        onClick={handleClick}
        title="Realizar vistoria interna (Coordenador)"
      >
        <ClipboardCheck className="h-4 w-4" />
      </Button>
    ) : (
      <Button
        type="button"
        size="sm"
        className={cn(
          'gap-1.5 h-9 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm font-medium',
          className,
        )}
        onClick={handleClick}
        title="Executar fotos, vídeo e dados do rastreador como técnico (Coordenador de Monitoramento)"
      >
        <ClipboardCheck className="h-4 w-4" />
        Realizar Vistoria Interna
      </Button>
    );

  return (
    <>
      {trigger}
      {podeEmbedar && (
        <VistoriaInternaDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          servicoId={servico.id}
        />
      )}
    </>
  );
}


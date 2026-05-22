import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import InstaladorChecklist from '@/pages/instalador/InstaladorChecklist';

/**
 * Modal full-screen que embeda a MESMA tela do técnico (InstaladorChecklist)
 * para o Coordenador de Monitoramento executar a vistoria internamente —
 * sem redirecionar para o app do instalador.
 *
 * Não altera nada do fluxo: usa as mesmas etapas, hooks, mutations e triggers
 * DB. Ao fechar, invalida as filas do Monitoramento.
 */
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servicoId: string | null;
}

export function VistoriaInternaDialog({ open, onOpenChange, servicoId }: Props) {
  const qc = useQueryClient();

  const handleClose = () => {
    onOpenChange(false);
    // Atualiza as filas do Monitoramento e Serviços de Campo
    qc.invalidateQueries({ queryKey: ['veiculos-suspensos-instalacao'] });
    qc.invalidateQueries({ queryKey: ['servicos-campo'] });
    qc.invalidateQueries({ queryKey: ['servicos'] });
    qc.invalidateQueries({ queryKey: ['instalacoes-aguardando-aprovacao-monitoramento'] });
    qc.invalidateQueries({ queryKey: ['aprovacao-monitoramento-stats'] });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : handleClose())}>
      <DialogContent
        className="max-w-none w-screen h-screen sm:rounded-none p-0 overflow-y-auto bg-slate-900 border-0 gap-0"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Vistoria Interna (Coordenador de Monitoramento)</DialogTitle>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleClose}
          className="fixed top-3 right-3 z-[60] h-9 w-9 rounded-full bg-slate-800/90 text-white hover:bg-slate-700 border border-slate-600"
          title="Fechar"
        >
          <X className="h-5 w-5" />
        </Button>
        {servicoId && (
          <InstaladorChecklist servicoIdProp={servicoId} vistoriaInterna onClose={handleClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

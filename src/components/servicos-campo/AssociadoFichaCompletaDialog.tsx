import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AssociadoDetalhe from '@/pages/cadastro/AssociadoDetalhe';

interface AssociadoFichaCompletaDialogProps {
  associadoId: string | null | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Wrapper que abre o componente AssociadoDetalhe (mesmo do cadastro)
 * dentro de um Dialog grande, permitindo visualização integral sem trocar de rota.
 */
export function AssociadoFichaCompletaDialog({
  associadoId,
  open,
  onOpenChange,
}: AssociadoFichaCompletaDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1400px] w-[95vw] max-h-[95vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 py-3 border-b shrink-0">
          <DialogTitle className="text-base">Ficha completa do associado</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          {associadoId && (
            <div className="p-4">
              <AssociadoDetalhe
                associadoId={associadoId}
                isModal
                onClose={() => onOpenChange(false)}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

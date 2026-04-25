import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CobrancaDetalhe from '@/pages/financeiro/CobrancaDetalhe';

interface CobrancaDetalheModalProps {
  id: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CobrancaDetalheModal({ id, open, onOpenChange }: CobrancaDetalheModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="sr-only">
          <DialogTitle>Detalhes da cobrança</DialogTitle>
        </DialogHeader>
        {id && <CobrancaDetalhe cobrancaId={id} embedded />}
      </DialogContent>
    </Dialog>
  );
}

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { History, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface HistoricoPrecoModalProps {
  open: boolean;
  onClose: () => void;
  faixaId: string | null;
}

export function HistoricoPrecoModal({ open, onClose, faixaId }: HistoricoPrecoModalProps) {
  // Como não existe tabela de histórico de preços, exibimos uma mensagem informativa
  // Se necessário, uma tabela tabelas_preco_historico pode ser criada futuramente
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Alterações
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              O histórico de alterações de preços não está disponível para esta faixa.
              <br /><br />
              Para habilitar esta funcionalidade, uma tabela de auditoria pode ser criada
              para registrar todas as alterações na tabela de preços.
            </AlertDescription>
          </Alert>
        </div>
      </DialogContent>
    </Dialog>
  );
}

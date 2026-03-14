import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { formatarMoeda } from '@/utils/format';

interface Props {
  open: boolean;
  onClose: () => void;
  parcela: { id: string; descricao: string; valor_liquido: number } | null;
  onConfirm: (dados: { parcelaId: string; dataPagamento: string; observacao?: string }) => void;
  isSaving?: boolean;
}

export function RegistrarPagamentoCCModal({ open, onClose, parcela, onConfirm, isSaving }: Props) {
  const [dataPagamento, setDataPagamento] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [observacao, setObservacao] = useState('');

  if (!parcela) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="p-4 bg-muted rounded-lg space-y-1">
            <p className="text-sm text-muted-foreground">{parcela.descricao}</p>
            <p className="text-lg font-semibold">{formatarMoeda(parcela.valor_liquido)}</p>
          </div>
          <div className="space-y-2">
            <Label>Data do Pagamento</Label>
            <Input type="date" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Observação (opcional)</Label>
            <Textarea value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Ex.: Pago via transferência bancária" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => { onConfirm({ parcelaId: parcela.id, dataPagamento, observacao }); onClose(); }}
            disabled={!dataPagamento || isSaving}
          >
            Confirmar Pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

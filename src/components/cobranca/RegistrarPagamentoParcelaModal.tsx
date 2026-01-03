import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

interface Parcela {
  id: string;
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
}

interface RegistrarPagamentoParcelaModalProps {
  open: boolean;
  onClose: () => void;
  parcela: Parcela | null;
  onConfirm: (dados: { parcelaId: string; valorPago: number; dataPagamento: string }) => void;
}

export function RegistrarPagamentoParcelaModal({
  open,
  onClose,
  parcela,
  onConfirm
}: RegistrarPagamentoParcelaModalProps) {
  const [valorPago, setValorPago] = useState(0);
  const [dataPagamento, setDataPagamento] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    if (parcela) {
      setValorPago(parcela.valor);
      setDataPagamento(format(new Date(), 'yyyy-MM-dd'));
    }
  }, [parcela]);

  const handleConfirm = () => {
    if (!parcela) return;
    onConfirm({
      parcelaId: parcela.id,
      valorPago,
      dataPagamento
    });
  };

  if (!parcela) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Parcela:</span>
              <span className="font-medium">{parcela.numero_parcela}ª</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">Vencimento:</span>
              <span className="font-medium">
                {format(new Date(parcela.data_vencimento), 'dd/MM/yyyy')}
              </span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">Valor:</span>
              <span className="font-medium">{formatCurrency(parcela.valor)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Valor Pago</Label>
            <Input
              type="number"
              step="0.01"
              value={valorPago}
              onChange={(e) => setValorPago(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label>Data do Pagamento</Label>
            <Input
              type="date"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={valorPago <= 0}>
            Confirmar Pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

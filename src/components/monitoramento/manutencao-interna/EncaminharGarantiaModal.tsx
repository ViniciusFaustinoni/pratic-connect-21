import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useEncaminharGarantia, type ManutencaoInterna } from '@/hooks/useManutencaoInterna';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manutencao: ManutencaoInterna | null;
}

export function EncaminharGarantiaModal({ open, onOpenChange, manutencao }: Props) {
  const [fornecedor, setFornecedor] = useState('');
  const [notaFiscal, setNotaFiscal] = useState('');
  const [observacao, setObservacao] = useState('');
  const mutation = useEncaminharGarantia();

  const handleSubmit = async () => {
    if (!manutencao || !fornecedor) return;
    await mutation.mutateAsync({
      manutencaoId: manutencao.id,
      fornecedor,
      notaFiscal,
      observacao,
    });
    onOpenChange(false);
  };

  if (!manutencao) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Encaminhar para Garantia</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Fornecedor *</Label>
            <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Nome do fornecedor" />
          </div>
          <div className="space-y-2">
            <Label>Nota Fiscal / Protocolo</Label>
            <Input value={notaFiscal} onChange={(e) => setNotaFiscal(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!fornecedor || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Encaminhar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

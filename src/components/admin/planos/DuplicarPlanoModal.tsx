import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Loader2 } from 'lucide-react';
import { useDuplicatePlan } from '@/hooks/usePlansAdmin';

interface DuplicarPlanoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plano: { id: string; nome: string } | null;
}

export function DuplicarPlanoModal({ open, onOpenChange, plano }: DuplicarPlanoModalProps) {
  const [desconto, setDesconto] = useState(0);
  const [sufixo, setSufixo] = useState('');
  const duplicatePlan = useDuplicatePlan();

  const nomeResultante = plano ? `${plano.nome} (cópia)${sufixo}` : '';

  const handleDuplicate = async () => {
    if (!plano) return;
    await duplicatePlan.mutateAsync({ id: plano.id, desconto, sufixo });
    onOpenChange(false);
    setDesconto(0);
    setSufixo('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Duplicar Plano
          </DialogTitle>
          <DialogDescription>
            Duplique o plano com todas as suas coberturas e benefícios. Opcionalmente aplique desconto e sufixo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome resultante</Label>
            <p className="text-sm font-medium text-foreground bg-muted rounded-md px-3 py-2">
              {nomeResultante}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="desconto">Desconto (%)</Label>
            <Input
              id="desconto"
              type="number"
              min={0}
              max={100}
              step={1}
              value={desconto}
              onChange={(e) => setDesconto(Math.min(100, Math.max(0, Number(e.target.value))))}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              Aplica desconto percentual nos valores de cada cobertura e benefício copiado.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sufixo">Sufixo</Label>
            <Input
              id="sufixo"
              value={sufixo}
              onChange={(e) => setSufixo(e.target.value)}
              placeholder="Ex: - SP"
            />
            <p className="text-xs text-muted-foreground">
              Sufixo adicionado ao nome de cada cobertura e benefício copiado.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleDuplicate} disabled={duplicatePlan.isPending}>
            {duplicatePlan.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Duplicando...
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Duplicar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

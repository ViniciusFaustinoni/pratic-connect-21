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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Copy, Loader2 } from 'lucide-react';
import { useDuplicatePlan } from '@/hooks/usePlansAdmin';
import { useRegioes } from '@/hooks/useRegioes';

interface DuplicarPlanoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plano: { id: string; nome: string } | null;
}

const KEEP_ORIGINAL = '__keep__';

export function DuplicarPlanoModal({ open, onOpenChange, plano }: DuplicarPlanoModalProps) {
  const [desconto, setDesconto] = useState(0);
  const [sufixo, setSufixo] = useState('');
  const [regiao, setRegiao] = useState(KEEP_ORIGINAL);
  const [tipoUso, setTipoUso] = useState(KEEP_ORIGINAL);
  const [combustivel, setCombustivel] = useState(KEEP_ORIGINAL);

  const duplicatePlan = useDuplicatePlan();
  const { data: regioes } = useRegioes();

  const nomeResultante = plano ? `${plano.nome} (cópia)${sufixo}` : '';

  const handleDuplicate = async () => {
    if (!plano) return;
    await duplicatePlan.mutateAsync({
      id: plano.id,
      desconto,
      sufixo,
      regiao: regiao !== KEEP_ORIGINAL ? regiao : undefined,
      tipoUso: tipoUso !== KEEP_ORIGINAL ? tipoUso : undefined,
      combustivel: combustivel !== KEEP_ORIGINAL ? combustivel : undefined,
    });
    onOpenChange(false);
    setDesconto(0);
    setSufixo('');
    setRegiao(KEEP_ORIGINAL);
    setTipoUso(KEEP_ORIGINAL);
    setCombustivel(KEEP_ORIGINAL);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Duplicar Plano
          </DialogTitle>
          <DialogDescription>
            Duplique o plano com todas as suas coberturas e benefícios. Opcionalmente aplique desconto, sufixo e regras em massa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome resultante</Label>
            <p className="text-sm font-medium text-foreground bg-muted rounded-md px-3 py-2">
              {nomeResultante}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="sufixo">Sufixo</Label>
              <Input
                id="sufixo"
                value={sufixo}
                onChange={(e) => setSufixo(e.target.value)}
                placeholder="Ex: - SP"
              />
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Regras em massa (opcional)</p>
            <p className="text-xs text-muted-foreground -mt-2">
              Substitui as regras de elegibilidade em todas as coberturas e benefícios clonados.
            </p>

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="regiao">Região</Label>
                <Select value={regiao} onValueChange={setRegiao}>
                  <SelectTrigger id="regiao">
                    <SelectValue placeholder="Manter original" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={KEEP_ORIGINAL}>Manter original</SelectItem>
                    {regioes?.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tipoUso">Tipo de Uso</Label>
                <Select value={tipoUso} onValueChange={setTipoUso}>
                  <SelectTrigger id="tipoUso">
                    <SelectValue placeholder="Manter original" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={KEEP_ORIGINAL}>Manter original</SelectItem>
                    <SelectItem value="particular">Particular</SelectItem>
                    <SelectItem value="aplicativo">Aplicativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="combustivel">Combustível</Label>
                <Select value={combustivel} onValueChange={setCombustivel}>
                  <SelectTrigger id="combustivel">
                    <SelectValue placeholder="Manter original" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={KEEP_ORIGINAL}>Manter original</SelectItem>
                    <SelectItem value="gasolina">Gasolina</SelectItem>
                    <SelectItem value="diesel">Diesel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
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

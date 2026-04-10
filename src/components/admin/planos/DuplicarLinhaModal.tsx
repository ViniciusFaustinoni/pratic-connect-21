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
import { useDuplicateProductLine } from '@/hooks/usePlansAdmin';
import { useRegioes } from '@/hooks/useRegioes';

interface DuplicarLinhaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linha: { id: string; name: string } | null;
}

const KEEP_ORIGINAL = '__keep__';

export function DuplicarLinhaModal({ open, onOpenChange, linha }: DuplicarLinhaModalProps) {
  const [desconto, setDesconto] = useState(0);
  const [sufixo, setSufixo] = useState('');
  const [regiao, setRegiao] = useState(KEEP_ORIGINAL);
  const [tipoUso, setTipoUso] = useState(KEEP_ORIGINAL);
  const [tipoVeiculo, setTipoVeiculo] = useState(KEEP_ORIGINAL);
  const [combustivel, setCombustivel] = useState(KEEP_ORIGINAL);

  const duplicateLine = useDuplicateProductLine();
  const { data: regioes } = useRegioes();

  const nomeResultante = linha ? `${linha.name}${sufixo || ' (cópia)'}` : '';

  const handleDuplicate = async () => {
    if (!linha) return;
    await duplicateLine.mutateAsync({
      id: linha.id,
      desconto,
      sufixo,
      regiao: regiao !== KEEP_ORIGINAL ? regiao : undefined,
      tipoUso: tipoUso !== KEEP_ORIGINAL ? tipoUso : undefined,
      tipoVeiculo: tipoVeiculo !== KEEP_ORIGINAL ? tipoVeiculo : undefined,
      combustivel: combustivel !== KEEP_ORIGINAL ? combustivel : undefined,
    });
    onOpenChange(false);
    setDesconto(0);
    setSufixo('');
    setRegiao(KEEP_ORIGINAL);
    setTipoUso(KEEP_ORIGINAL);
    setTipoVeiculo(KEEP_ORIGINAL);
    setCombustivel(KEEP_ORIGINAL);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Duplicar Linha
          </DialogTitle>
          <DialogDescription>
            Duplica a linha com todos os seus planos, coberturas e benefícios. Opcionalmente aplique modificadores globais.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome resultante da linha</Label>
            <p className="text-sm font-medium text-foreground bg-muted rounded-md px-3 py-2">
              {nomeResultante}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="desconto-linha">Desconto (%)</Label>
              <Input
                id="desconto-linha"
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
              <Label htmlFor="sufixo-linha">Sufixo</Label>
              <Input
                id="sufixo-linha"
                value={sufixo}
                onChange={(e) => setSufixo(e.target.value)}
                placeholder="Ex: - Motos"
              />
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Configurações em massa (opcional)</p>
            <p className="text-xs text-muted-foreground -mt-2">
              Substitui as configurações em todos os planos, coberturas e benefícios clonados.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="regiao-linha">Região</Label>
                <Select value={regiao} onValueChange={setRegiao}>
                  <SelectTrigger id="regiao-linha">
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
                <Label htmlFor="tipoUso-linha">Tipo de Uso</Label>
                <Select value={tipoUso} onValueChange={setTipoUso}>
                  <SelectTrigger id="tipoUso-linha">
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
                <Label htmlFor="tipoVeiculo-linha">Tipo de Veículo</Label>
                <Select value={tipoVeiculo} onValueChange={setTipoVeiculo}>
                  <SelectTrigger id="tipoVeiculo-linha">
                    <SelectValue placeholder="Manter original" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={KEEP_ORIGINAL}>Manter original</SelectItem>
                    <SelectItem value="car">Carro</SelectItem>
                    <SelectItem value="motorcycle">Moto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="combustivel-linha">Combustível</Label>
                <Select value={combustivel} onValueChange={setCombustivel}>
                  <SelectTrigger id="combustivel-linha">
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
          <Button onClick={handleDuplicate} disabled={duplicateLine.isPending}>
            {duplicateLine.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Duplicando...
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Duplicar Linha
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

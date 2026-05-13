import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Loader2, MapPin, Building2 } from 'lucide-react';
import { useSolicitarVistoriaTecnico } from '@/hooks/useSolicitarVistoriaTecnico';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servicoId: string;
  veiculoId: string;
  associadoId: string;
  isMoto: boolean;
  cenarioPadrao?: 'rota' | 'base';
  onSuccess?: () => void;
}

export function SolicitarVistoriaTecnicoDialog({
  open,
  onOpenChange,
  servicoId,
  veiculoId,
  associadoId,
  isMoto,
  cenarioPadrao = 'base',
  onSuccess,
}: Props) {
  const [motivo, setMotivo] = useState('');
  const [cenario, setCenario] = useState<'rota' | 'base'>(cenarioPadrao);
  const [data, setData] = useState('');
  const [periodo, setPeriodo] = useState<'manha' | 'tarde'>('manha');
  const fotos = isMoto ? 15 : 31;

  const mutation = useSolicitarVistoriaTecnico();

  const podeConfirmar = motivo.trim().length >= 5 && (cenario === 'base' || (!!data && !!periodo));

  const confirmar = () => {
    mutation.mutate(
      {
        servicoId,
        veiculoId,
        associadoId,
        motivo: motivo.trim(),
        cenario,
        dataAgendada: cenario === 'rota' ? data : undefined,
        periodo: cenario === 'rota' ? periodo : 'manha',
        fotosObrigatorias: fotos,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSuccess?.();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Solicitar vistoria de técnico</DialogTitle>
          <DialogDescription>
            O técnico vai até o veículo refazer apenas as {fotos} fotos do roteiro
            (sem instalação de rastreador). Após a execução, retorna para esta fila.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="motivo">Motivo da solicitação *</Label>
            <Textarea
              id="motivo"
              placeholder="Ex.: fotos com baixa qualidade, suspeita de avarias não declaradas, identificação do chassi ilegível…"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="min-h-[100px] mt-1"
            />
          </div>

          <div>
            <Label>Onde será feita?</Label>
            <RadioGroup
              value={cenario}
              onValueChange={(v) => setCenario(v as 'rota' | 'base')}
              className="grid grid-cols-2 gap-2 mt-2"
            >
              <label
                htmlFor="cen-base"
                className="flex items-start gap-2 p-3 rounded-lg border border-border cursor-pointer hover:bg-accent/30 [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5"
              >
                <RadioGroupItem id="cen-base" value="base" className="mt-0.5" />
                <div className="flex-1 text-sm">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Building2 className="h-4 w-4" /> Base
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Cliente leva o veículo. Sem custo.
                  </p>
                </div>
              </label>
              <label
                htmlFor="cen-rota"
                className="flex items-start gap-2 p-3 rounded-lg border border-border cursor-pointer hover:bg-accent/30 [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5"
              >
                <RadioGroupItem id="cen-rota" value="rota" className="mt-0.5" />
                <div className="flex-1 text-sm">
                  <div className="flex items-center gap-1.5 font-medium">
                    <MapPin className="h-4 w-4" /> Rota
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Técnico vai até o cliente. Repasse mínimo R$ 25.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>

          {cenario === 'rota' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="data">Data *</Label>
                <Input
                  id="data"
                  type="date"
                  value={data}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setData(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Período *</Label>
                <RadioGroup
                  value={periodo}
                  onValueChange={(v) => setPeriodo(v as 'manha' | 'tarde')}
                  className="grid grid-cols-2 gap-2 mt-1"
                >
                  <label htmlFor="p-manha" className="flex items-center gap-1.5 p-2 rounded border border-border text-sm cursor-pointer [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5">
                    <RadioGroupItem id="p-manha" value="manha" /> Manhã
                  </label>
                  <label htmlFor="p-tarde" className="flex items-center gap-1.5 p-2 rounded border border-border text-sm cursor-pointer [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5">
                    <RadioGroupItem id="p-tarde" value="tarde" /> Tarde
                  </label>
                </RadioGroup>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={!podeConfirmar || mutation.isPending}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Solicitar vistoria
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

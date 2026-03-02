import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, RotateCcw, XCircle, ShieldBan, Search } from 'lucide-react';
import { useResolverRecusa, type AcaoRecusa } from '@/hooks/useRecusasInstalador';

interface ResolverRecusaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servicoId: string;
  veiculoId: string;
  associadoId: string;
  placa: string;
  motivo: string | null;
  fotosRessalva: string[] | null;
}

const ACOES = [
  { value: 'reverter_recusa' as AcaoRecusa, label: 'Reverter recusa e reagendar instalação', icon: RotateCcw, color: 'text-blue-600' },
  { value: 'cancelar_contrato' as AcaoRecusa, label: 'Cancelar contrato do associado', icon: XCircle, color: 'text-destructive' },
  { value: 'blacklist' as AcaoRecusa, label: 'Incluir veículo na blacklist', icon: ShieldBan, color: 'text-destructive' },
  { value: 'nova_vistoria' as AcaoRecusa, label: 'Solicitar nova vistoria', icon: Search, color: 'text-amber-600' },
];

export function ResolverRecusaDialog({
  open,
  onOpenChange,
  servicoId,
  veiculoId,
  associadoId,
  placa,
  motivo,
  fotosRessalva,
}: ResolverRecusaDialogProps) {
  const [acao, setAcao] = useState<AcaoRecusa | ''>('');
  const [justificativa, setJustificativa] = useState('');
  const resolver = useResolverRecusa();

  const handleConfirmar = async () => {
    if (!acao || !justificativa.trim()) return;
    await resolver.mutateAsync({
      servicoId,
      veiculoId,
      associadoId,
      placa,
      acao,
      justificativa: justificativa.trim(),
    });
    setAcao('');
    setJustificativa('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Resolver Recusa do Instalador
          </DialogTitle>
          <DialogDescription>
            Veículo <strong>{placa}</strong> negado pelo instalador
          </DialogDescription>
        </DialogHeader>

        {/* Motivo */}
        {motivo && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm font-medium text-destructive mb-1">Motivo do instalador:</p>
            <p className="text-sm text-foreground">{motivo}</p>
          </div>
        )}

        {/* Fotos de evidência */}
        {fotosRessalva && fotosRessalva.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Fotos de evidência:</p>
            <div className="flex gap-2 flex-wrap">
              {fotosRessalva.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={url}
                    alt={`Evidência ${i + 1}`}
                    className="h-20 w-20 rounded-md object-cover border hover:opacity-80 transition-opacity"
                  />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Opções de decisão */}
        <div>
          <Label className="text-sm font-medium">Decisão:</Label>
          <RadioGroup value={acao} onValueChange={(v) => setAcao(v as AcaoRecusa)} className="mt-2 space-y-2">
            {ACOES.map((op) => (
              <div key={op.value} className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value={op.value} id={op.value} />
                <op.icon className={`h-4 w-4 ${op.color}`} />
                <Label htmlFor={op.value} className="cursor-pointer flex-1 text-sm">{op.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Justificativa */}
        <div>
          <Label htmlFor="justificativa" className="text-sm font-medium">
            Justificativa <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="justificativa"
            placeholder="Descreva o motivo da decisão..."
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            className="mt-1"
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={!acao || !justificativa.trim() || resolver.isPending}
            variant={acao === 'reverter_recusa' || acao === 'nova_vistoria' ? 'default' : 'destructive'}
          >
            {resolver.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              'Confirmar Decisão'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

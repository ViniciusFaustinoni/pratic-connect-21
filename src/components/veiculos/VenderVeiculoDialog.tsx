import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Car, Loader2 } from 'lucide-react';
import { useVenderVeiculo } from '@/hooks/useVenderVeiculo';
import type { Tables } from '@/integrations/supabase/types';

interface VenderVeiculoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  veiculo: (Tables<'veiculos'> & { rastreador?: { id: string; codigo: string } | null }) | null;
}

export function VenderVeiculoDialog({
  open,
  onOpenChange,
  veiculo,
}: VenderVeiculoDialogProps) {
  const [dataVenda, setDataVenda] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [liberarRastreador, setLiberarRastreador] = useState(true);

  const venderVeiculo = useVenderVeiculo();

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setDataVenda(new Date().toISOString().split('T')[0]);
      setObservacoes('');
      setLiberarRastreador(true);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!veiculo) return;

    await venderVeiculo.mutateAsync({
      veiculoId: veiculo.id,
      dataVenda,
      observacoes,
      liberarRastreador,
    });

    onOpenChange(false);
  };

  if (!veiculo) return null;

  const temRastreador = !!veiculo.rastreador;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Registrar Venda do Veículo
          </DialogTitle>
          <DialogDescription>
            Marcar o veículo {veiculo.placa} como vendido.
            {temRastreador && ' O rastreador pode ser liberado para o estoque.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info do veículo */}
          <div className="p-3 bg-muted rounded-lg space-y-1">
            <p className="text-sm font-medium">
              {veiculo.marca} {veiculo.modelo} {veiculo.ano_modelo}
            </p>
            <p className="text-sm text-muted-foreground">
              Placa: <span className="font-semibold">{veiculo.placa}</span>
            </p>
            {temRastreador && (
              <p className="text-sm text-muted-foreground">
                Rastreador: {veiculo.rastreador?.codigo}
              </p>
            )}
          </div>

          {/* Alerta */}
          <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg text-warning-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Atenção</p>
              <p>Esta ação marcará o veículo como inativo. O associado não terá mais este veículo vinculado.</p>
            </div>
          </div>

          {/* Data da venda */}
          <div className="space-y-2">
            <Label htmlFor="data-venda">Data da venda</Label>
            <Input
              id="data-venda"
              type="date"
              value={dataVenda}
              onChange={(e) => setDataVenda(e.target.value)}
            />
          </div>

          {/* Liberar rastreador */}
          {temRastreador && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="liberar-rastreador"
                checked={liberarRastreador}
                onCheckedChange={(checked) => setLiberarRastreador(checked === true)}
              />
              <Label htmlFor="liberar-rastreador" className="text-sm cursor-pointer">
                Liberar rastreador para o estoque
              </Label>
            </div>
          )}

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              placeholder="Informações adicionais sobre a venda..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={venderVeiculo.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={venderVeiculo.isPending}
            variant="destructive"
          >
            {venderVeiculo.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              'Confirmar Venda'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

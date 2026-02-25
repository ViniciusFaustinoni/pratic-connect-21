import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { DollarSign, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { SinistroTerceiro } from '@/types/terceiros';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  terceiro: SinistroTerceiro;
  sinistroId: string;
}

export function ProporAcordoModal({ open, onOpenChange, terceiro, sinistroId }: Props) {
  const queryClient = useQueryClient();
  const [valor, setValor] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [salvando, setSalvando] = useState(false);

  const handleSalvar = async () => {
    const valorNum = parseFloat(valor.replace(/\./g, '').replace(',', '.'));
    if (!valorNum || valorNum <= 0) {
      toast.error('Informe um valor válido');
      return;
    }
    if (!justificativa.trim()) {
      toast.error('Informe a justificativa');
      return;
    }

    setSalvando(true);
    try {
      const { error } = await supabase
        .from('sinistro_terceiros')
        .update({
          acordo_valor: valorNum,
          acordo_justificativa: justificativa,
          acordo_status: 'proposto',
          status: 'acordo_proposto',
        } as any)
        .eq('id', terceiro.id);

      if (error) throw error;

      toast.success('Proposta de acordo enviada');
      queryClient.invalidateQueries({ queryKey: ['sinistro-terceiros', sinistroId] });
      onOpenChange(false);
      setValor('');
      setJustificativa('');
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Propor Acordo — {terceiro.nome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Ao propor um acordo, o terceiro receberá o valor em dinheiro e a Pratic não fará o reparo.
          </p>

          <div className="space-y-2">
            <Label>Valor proposto (R$)</Label>
            <Input
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Justificativa</Label>
            <Textarea
              placeholder="Descreva o motivo da proposta de acordo..."
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <DollarSign className="h-4 w-4 mr-2" />}
            Enviar Proposta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

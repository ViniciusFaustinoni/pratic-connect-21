import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useInstaladores, useRastreadoresEstoque, useInstalacaoActions } from '@/hooks/useInstalacoes';
import { Loader2, UserPlus } from 'lucide-react';

interface AtribuirInstaladorDialogProps {
  instalacaoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AtribuirInstaladorDialog({ instalacaoId, open, onOpenChange }: AtribuirInstaladorDialogProps) {
  const [instaladorId, setInstaladorId] = useState('');
  const [rastreadorId, setRastreadorId] = useState('');

  const { data: instaladores, isLoading: loadingInstaladores } = useInstaladores();
  const { data: rastreadores, isLoading: loadingRastreadores } = useRastreadoresEstoque();
  const { atribuirInstalador, isAtribuindo } = useInstalacaoActions();

  const handleSubmit = () => {
    if (!instalacaoId || !instaladorId) return;

    atribuirInstalador(
      {
        instalacao_id: instalacaoId,
        instalador_id: instaladorId,
        rastreador_id: rastreadorId || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setInstaladorId('');
          setRastreadorId('');
        },
      }
    );
  };

  const handleClose = () => {
    onOpenChange(false);
    setInstaladorId('');
    setRastreadorId('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atribuir Instalador</DialogTitle>
          <DialogDescription>Selecione o instalador e opcionalmente um rastreador.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Instalador *</Label>
            <Select value={instaladorId} onValueChange={setInstaladorId} disabled={loadingInstaladores}>
              <SelectTrigger>
                <SelectValue placeholder={loadingInstaladores ? 'Carregando...' : 'Selecione um instalador'} />
              </SelectTrigger>
              <SelectContent>
                {instaladores?.map((inst) => (
                  <SelectItem key={inst.id} value={inst.id}>
                    {inst.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Rastreador (opcional)</Label>
            <Select value={rastreadorId} onValueChange={setRastreadorId} disabled={loadingRastreadores}>
              <SelectTrigger>
                <SelectValue placeholder={loadingRastreadores ? 'Carregando...' : 'Selecione um rastreador'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum</SelectItem>
                {rastreadores?.map((rast) => (
                  <SelectItem key={rast.id} value={rast.id}>
                    {rast.codigo} {rast.imei && `(${rast.imei})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!instaladorId || isAtribuindo}>
            {isAtribuindo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            Atribuir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

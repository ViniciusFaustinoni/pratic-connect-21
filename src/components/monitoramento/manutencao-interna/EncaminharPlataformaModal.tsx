import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useEncaminharPlataforma, type ManutencaoInterna } from '@/hooks/useManutencaoInterna';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manutencao: ManutencaoInterna | null;
}

export function EncaminharPlataformaModal({ open, onOpenChange, manutencao }: Props) {
  const [plataforma, setPlataforma] = useState('');
  const [protocolo, setProtocolo] = useState('');
  const [observacao, setObservacao] = useState('');
  const mutation = useEncaminharPlataforma();

  const handleSubmit = async () => {
    if (!manutencao || !plataforma) return;
    await mutation.mutateAsync({
      manutencaoId: manutencao.id,
      plataforma,
      protocoloExterno: protocolo,
      observacao,
    });
    onOpenChange(false);
  };

  if (!manutencao) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Encaminhar para Plataforma</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Plataforma *</Label>
            <Select value={plataforma} onValueChange={setPlataforma}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rede_veiculos">Rede Veículos</SelectItem>
                <SelectItem value="softruck">Softruck</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Protocolo/Chamado</Label>
            <Input value={protocolo} onChange={(e) => setProtocolo(e.target.value)} placeholder="Número do protocolo" />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!plataforma || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Encaminhar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

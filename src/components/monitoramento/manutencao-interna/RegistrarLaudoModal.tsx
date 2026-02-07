import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2 } from 'lucide-react';
import { useRegistrarLaudo, type ManutencaoInterna } from '@/hooks/useManutencaoInterna';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manutencao: ManutencaoInterna | null;
}

export function RegistrarLaudoModal({ open, onOpenChange, manutencao }: Props) {
  const [laudo, setLaudo] = useState('');
  const [recuperavel, setRecuperavel] = useState(true);
  const [acao, setAcao] = useState<'estoque' | 'baixar' | 'triagem'>('estoque');
  const mutation = useRegistrarLaudo();

  const handleSubmit = async () => {
    if (!manutencao || !laudo) return;
    await mutation.mutateAsync({ manutencaoId: manutencao.id, laudo, recuperavel, acao });
    onOpenChange(false);
  };

  if (!manutencao) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Laudo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Laudo/Resultado *</Label>
            <Textarea value={laudo} onChange={(e) => setLaudo(e.target.value)} rows={3} placeholder="Descrição do laudo..." />
          </div>
          <div className="space-y-2">
            <Label>Recuperável?</Label>
            <RadioGroup value={recuperavel ? 'sim' : 'nao'} onValueChange={(v) => setRecuperavel(v === 'sim')}>
              <div className="flex gap-4">
                <div className="flex items-center gap-2"><RadioGroupItem value="sim" id="sim" /><Label htmlFor="sim">Sim</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="nao" id="nao" /><Label htmlFor="nao">Não</Label></div>
              </div>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label>Ação</Label>
            <RadioGroup value={acao} onValueChange={(v) => setAcao(v as any)}>
              <div className="space-y-2">
                <div className="flex items-center gap-2"><RadioGroupItem value="estoque" id="estoque" /><Label htmlFor="estoque">Devolver ao Estoque</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="triagem" id="triagem" /><Label htmlFor="triagem">Voltar para Triagem</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="baixar" id="baixar" /><Label htmlFor="baixar">Descartar</Label></div>
              </div>
            </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!laudo || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

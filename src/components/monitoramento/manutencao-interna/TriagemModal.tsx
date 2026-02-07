import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useResolverInterno, type ManutencaoInterna } from '@/hooks/useManutencaoInterna';

interface TriagemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manutencao: ManutencaoInterna | null;
}

export function TriagemModal({ open, onOpenChange, manutencao }: TriagemModalProps) {
  const [acaoTomada, setAcaoTomada] = useState('');
  const [observacao, setObservacao] = useState('');
  const resolverMutation = useResolverInterno();

  const handleSubmit = async () => {
    if (!manutencao || !acaoTomada) return;
    await resolverMutation.mutateAsync({
      manutencaoId: manutencao.id,
      acaoTomada,
      observacao,
    });
    onOpenChange(false);
    setAcaoTomada('');
    setObservacao('');
  };

  if (!manutencao) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolver Internamente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="bg-muted/50 rounded-lg p-3">
            <span className="font-mono font-medium">{manutencao.rastreador?.codigo}</span>
            <span className="text-muted-foreground ml-2">{manutencao.rastreador?.plataforma}</span>
          </div>
          <div className="space-y-2">
            <Label>Ação Realizada *</Label>
            <Input
              placeholder="Ex: Troca de chip, reset, reconfiguração..."
              value={acaoTomada}
              onChange={(e) => setAcaoTomada(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Detalhes adicionais..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!acaoTomada || resolverMutation.isPending}>
            {resolverMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Devolver ao Estoque
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

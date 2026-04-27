import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCheck, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Props {
  instalacaoId: string;
  onSuccess?: () => void;
}

export function ConcluirInstalacaoPrestadorButton({ instalacaoId, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [obs, setObs] = useState('');
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('concluir_instalacao_prestador' as any, {
        p_instalacao_id: instalacaoId,
        p_observacao: obs,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Instalação concluída — cobertura liberada para ativação');
      setOpen(false);
      setObs('');
      qc.invalidateQueries();
      onSuccess?.();
    },
    onError: (e: any) => toast.error(e?.message || 'Falha ao concluir instalação'),
  });

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-8 text-xs border-amber-500/50 text-amber-700 hover:bg-amber-50"
        onClick={() => setOpen(true)}
      >
        <CheckCheck className="h-3 w-3 mr-1" /> Concluir (prestador)
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Concluir instalação por prestador externo</DialogTitle>
            <DialogDescription>
              Use quando o serviço já foi executado por um prestador parceiro, mas a
              instalação permanece pendente no sistema, bloqueando a ativação da cobertura.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="obs">Justificativa (obrigatório)</Label>
            <Textarea
              id="obs"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Ex.: Instalação realizada pelo prestador X em DD/MM, comprovante anexo no chat..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || obs.trim().length < 5}
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirmar conclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

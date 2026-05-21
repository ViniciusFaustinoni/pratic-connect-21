import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servicoId: string;
  servicoLabel?: string;
  onSuccess?: () => void;
}

export function CancelarServicoDialog({ open, onOpenChange, servicoId, servicoLabel, onSuccess }: Props) {
  const [motivo, setMotivo] = useState('');
  const qc = useQueryClient();

  const cancelar = useMutation({
    mutationFn: async () => {
      const m = motivo.trim();
      if (!m) throw new Error('Informe o motivo do cancelamento.');

      // Busca origens do serviço para encerrar agendamento_base correspondente
      const { data: srv, error: srvErr } = await supabase
        .from('servicos')
        .select('id, instalacao_origem_id, vistoria_origem_id')
        .eq('id', servicoId)
        .maybeSingle();
      if (srvErr) throw srvErr;

      const { error: updErr } = await supabase
        .from('servicos')
        .update({
          status: 'cancelada',
          motivo_cancelamento: m,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', servicoId);
      if (updErr) throw updErr;

      // Encerrar agendamento_base vinculado (trigger trg_sync_agendamento_base_on_servico_terminal
      // cuida disso, mas reforçamos defensivamente).
      if (srv?.instalacao_origem_id || srv?.vistoria_origem_id) {
        const q = supabase
          .from('agendamentos_base')
          .update({ status: 'cancelado', updated_at: new Date().toISOString() } as any)
          .in('status', ['agendado', 'pendente']);
        if (srv.instalacao_origem_id) await q.eq('instalacao_id', srv.instalacao_origem_id);
        else if (srv.vistoria_origem_id) await q.eq('vistoria_id', srv.vistoria_origem_id);
      }
    },
    onSuccess: () => {
      toast.success('Serviço cancelado.');
      qc.invalidateQueries({ queryKey: ['servicos-campo-unificado'] });
      qc.invalidateQueries({ queryKey: ['servicos'] });
      qc.invalidateQueries({ queryKey: ['fila-servicos'] });
      qc.invalidateQueries({ queryKey: ['servicos-para-atribuir-manual'] });
      setMotivo('');
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: any) => toast.error(err?.message || 'Falha ao cancelar serviço.'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Cancelar serviço
          </DialogTitle>
          <DialogDescription>
            {servicoLabel ? `${servicoLabel} — ` : ''}essa ação encerra o agendamento e remove o serviço da fila do técnico.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Motivo do cancelamento *</Label>
          <Textarea
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex: cliente desistiu, duplicado, erro de cadastro..."
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button
            variant="destructive"
            onClick={() => cancelar.mutate()}
            disabled={cancelar.isPending || !motivo.trim()}
          >
            {cancelar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Cancelar serviço
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

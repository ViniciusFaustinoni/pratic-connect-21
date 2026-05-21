import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, MapPinned } from 'lucide-react';
import { useInstaladores } from '@/hooks/useRotas';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servicoId: string;
  servicoTipo: string;
  servicoLabel?: string;
  onSuccess?: () => void;
}

/**
 * Realocação simplificada para serviços que não são instalação:
 * Retiradas, vistorias de saída/sinistro/periódica/cancelamento, manutenção.
 * Usa o RPC genérico `realocar_servico` com destino='rota' (apenas reagenda + reatribui).
 */
export function RealocarServicoSimplesDialog({
  open, onOpenChange, servicoId, servicoTipo, servicoLabel, onSuccess,
}: Props) {
  const hojeStr = format(new Date(), 'yyyy-MM-dd');
  const [data, setData] = useState(hojeStr);
  const [periodo, setPeriodo] = useState<'manha' | 'tarde'>('manha');
  const [profissionalId, setProfissionalId] = useState<string>('');
  const [motivo, setMotivo] = useState('');

  const { data: instaladores = [] } = useInstaladores();
  const qc = useQueryClient();

  const sabado = (() => {
    const d = new Date(`${data}T12:00:00`);
    return d.getDay() === 6;
  })();

  const realocar = useMutation({
    mutationFn: async () => {
      const m = motivo.trim();
      if (m.length < 5) throw new Error('Motivo é obrigatório (mínimo 5 caracteres).');
      // Quando há técnico selecionado → destino='profissional'; senão → 'fila'.
      // 'rota' exigiria _rota_id, que esse dialog não coleta.
      const destino = profissionalId ? 'profissional' : 'fila';
      const { data: res, error } = await supabase.rpc('realocar_servico', {
        _servico_id: servicoId,
        _destino: destino,
        _motivo: m,
        _nova_data: data,
        _novo_periodo: periodo,
        _profissional_id: profissionalId || undefined,
      } as any);
      if (error) throw error;
      return res;
    },
    onSuccess: () => {
      toast.success('Serviço realocado.');
      qc.invalidateQueries({ queryKey: ['servicos-campo-unificado'] });
      qc.invalidateQueries({ queryKey: ['servicos'] });
      qc.invalidateQueries({ queryKey: ['fila-servicos'] });
      qc.invalidateQueries({ queryKey: ['servicos-para-atribuir-manual'] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: any) => toast.error(err?.message || 'Falha ao realocar serviço.'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPinned className="h-5 w-5 text-primary" />
            Realocar serviço
          </DialogTitle>
          <DialogDescription>
            {servicoLabel || servicoTipo} — escolha nova data, período e (opcionalmente) técnico.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Data</Label>
            <Input type="date" min={hojeStr} value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <Label>Período</Label>
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as 'manha' | 'tarde')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manha">{sabado ? 'Manhã (09:00 – 13:00)' : 'Manhã (08:00 – 12:00)'}</SelectItem>
                {!sabado && <SelectItem value="tarde">Tarde (13:00 – 18:00)</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Técnico (opcional — deixe vazio para enviar à fila)</Label>
          <Select value={profissionalId || 'fila'} onValueChange={(v) => setProfissionalId(v === 'fila' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="Enviar para fila de atribuição" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="fila">— Enviar para fila —</SelectItem>
              {instaladores.map((i: any) => (
                <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Motivo *</Label>
          <Textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: técnico indisponível, cliente solicitou outra data..." />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button onClick={() => realocar.mutate()} disabled={realocar.isPending || !motivo.trim()}>
            {realocar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Confirmar realocação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

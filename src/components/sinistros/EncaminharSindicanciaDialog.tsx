import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Search, UserCheck } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { PRAZOS_SINISTRO, MOTIVOS_SINDICANCIA } from '@/types/sinistros';

interface EncaminharSindicanciaDialogProps {
  open: boolean;
  onClose: () => void;
  sinistroId: string;
  protocolo: string;
  tipoEvento?: string;
  onSuccess?: () => void;
}

export function EncaminharSindicanciaDialog({
  open, onClose, sinistroId, protocolo, tipoEvento, onSuccess,
}: EncaminharSindicanciaDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [sindicanteId, setSindicanteId] = useState('');
  const [motivoPredefinido, setMotivoPredefinido] = useState('');
  const [observacao, setObservacao] = useState('');
  const [isPericia, setIsPericia] = useState(false);
  const [prazoFim, setPrazoFim] = useState(
    format(addDays(new Date(), PRAZOS_SINISTRO.sindicancia), 'yyyy-MM-dd')
  );

  const motivosDisponiveis = MOTIVOS_SINDICANCIA[tipoEvento || ''] || [];

  const { data: sindicantes = [] } = useQuery({
    queryKey: ['sindicantes-disponiveis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome, email')
        .eq('ativo', true)
        .eq('tipo', 'funcionario')
        .order('nome');
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const encaminharMutation = useMutation({
    mutationFn: async () => {
      const motivoCompleto = [
        isPericia ? '[PERÍCIA TÉCNICA]' : '[SINDICÂNCIA]',
        motivoPredefinido && `Motivo: ${motivoPredefinido}`,
        observacao && `Obs: ${observacao}`,
      ].filter(Boolean).join(' — ');

      const { error: updateError } = await supabase
        .from('sinistros')
        .update({
          status: (isPericia ? 'em_pericia' : 'em_sindicancia') as any,
          sindicante_id: sindicanteId,
          sindicancia_prazo_fim: prazoFim,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sinistroId);
      if (updateError) throw updateError;

      const { error: histError } = await supabase
        .from('sinistro_historico')
        .insert({
          sinistro_id: sinistroId,
          status_novo: isPericia ? 'em_pericia' : 'em_sindicancia',
          usuario_id: user?.id,
          observacao: `Encaminhado para ${isPericia ? 'perícia técnica' : 'sindicância'}. ${motivoCompleto}. Prazo: ${format(new Date(prazoFim), 'dd/MM/yyyy')}`,
        });
      if (histError) throw histError;

      try {
        await supabase.functions.invoke('notificar-sinistro', {
          body: { sinistro_id: sinistroId, status: 'em_sindicancia' },
        });
      } catch (err) {
        console.error('Erro ao notificar:', err);
      }
    },
    onSuccess: () => {
      toast.success(`Evento encaminhado para ${isPericia ? 'perícia técnica' : 'sindicância'}!`);
      queryClient.invalidateQueries({ queryKey: ['sinistro', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistro-historico', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistros'] });
      handleClose();
      onSuccess?.();
    },
    onError: (error) => {
      console.error('Erro ao encaminhar:', error);
      toast.error('Erro ao encaminhar');
    },
  });

  const handleClose = () => {
    setSindicanteId('');
    setMotivoPredefinido('');
    setObservacao('');
    setIsPericia(false);
    setPrazoFim(format(addDays(new Date(), PRAZOS_SINISTRO.sindicancia), 'yyyy-MM-dd'));
    onClose();
  };

  const handleSubmit = () => {
    if (!sindicanteId) { toast.error('Selecione um responsável'); return; }
    if (!motivoPredefinido && !observacao.trim()) { toast.error('Informe o motivo'); return; }
    encaminharMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-rose-600" />
            Encaminhar para {isPericia ? 'Perícia Técnica' : 'Sindicância'}
          </DialogTitle>
          <DialogDescription>Evento {protocolo}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Perícia toggle */}
          <div className="flex items-center space-x-2">
            <Checkbox id="pericia" checked={isPericia} onCheckedChange={(v) => setIsPericia(!!v)} />
            <Label htmlFor="pericia" className="text-sm">Perícia técnica (causa técnica, não fraude)</Label>
          </div>

          {/* Responsável */}
          <div className="space-y-2">
            <Label>Responsável *</Label>
            <Select value={sindicanteId} onValueChange={setSindicanteId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {sindicantes.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex items-center gap-2"><UserCheck className="h-4 w-4" />{s.nome}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Motivo predefinido */}
          {motivosDisponiveis.length > 0 && (
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Select value={motivoPredefinido} onValueChange={setMotivoPredefinido}>
                <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
                <SelectContent>
                  {motivosDisponiveis.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Prazo */}
          <div className="space-y-2">
            <Label>Prazo Final</Label>
            <Input type="date" value={prazoFim} onChange={(e) => setPrazoFim(e.target.value)} min={format(new Date(), 'yyyy-MM-dd')} />
            <p className="text-xs text-muted-foreground">Padrão: {PRAZOS_SINISTRO.sindicancia} dias</p>
          </div>

          {/* Observação */}
          <div className="space-y-2">
            <Label>Observação complementar</Label>
            <Textarea
              placeholder="Descreva detalhes adicionais..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={encaminharMutation.isPending}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={encaminharMutation.isPending} className="bg-rose-600 hover:bg-rose-700">
            {encaminharMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Encaminhar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface ModalReagendamentoManualProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servico: {
    id: string;
    associado?: { id: string; nome: string } | null;
  } | null;
  onSuccess: () => void;
}

export default function ModalReagendamentoManual({
  open,
  onOpenChange,
  servico,
  onSuccess,
}: ModalReagendamentoManualProps) {
  const [date, setDate] = useState<Date | undefined>();
  const [periodo, setPeriodo] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!date || !periodo || !servico) return;

    setSaving(true);
    try {
      // Buscar serviço original (incluindo origem instalação/vistoria e dados atuais)
      const { data: original, error: fetchErr } = await supabase
        .from('servicos')
        .select('tipo, associado_id, veiculo_id, observacoes, data_agendada, periodo, hora_agendada, status, instalacao_origem_id, vistoria_origem_id, historico_datas')
        .eq('id', servico.id)
        .single();

      if (fetchErr || !original) throw fetchErr || new Error('Serviço não encontrado');

      const novaData = format(date, 'yyyy-MM-dd');
      const novoPeriodo = periodo;

      // Anexa ao histórico do PRÓPRIO serviço (data anterior vira histórico)
      const novoHistorico = [
        ...((original.historico_datas as any[]) || []),
        {
          data_anterior: original.data_agendada,
          periodo_anterior: original.periodo,
          hora_anterior: original.hora_agendada,
          status_anterior: original.status,
          motivo: 'Reagendamento manual',
          alterado_em: new Date().toISOString(),
        },
      ];

      // 1) Se houver instalação de origem: atualiza ela (triggers propagam para serviços)
      if (original.instalacao_origem_id) {
        const { error: instErr } = await supabase
          .from('instalacoes')
          .update({
            data_agendada: novaData,
            periodo: novoPeriodo as any,
            status: 'agendada' as any,
            observacoes: `Reagendamento manual em ${new Date().toLocaleString('pt-BR')}.`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', original.instalacao_origem_id);
        if (instErr) throw instErr;
      }

      // 2) Atualiza o próprio serviço in-place (sem criar duplicata)
      const { error: updErr } = await supabase
        .from('servicos')
        .update({
          data_agendada: novaData,
          periodo: novoPeriodo as any,
          status: 'agendada' as any,
          historico_datas: novoHistorico as any,
          observacoes: `${original.observacoes || ''}\n[Reagendado manualmente em ${new Date().toLocaleString('pt-BR')}]`.trim(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', servico.id);

      if (updErr) throw updErr;

      toast.success('Serviço reagendado com sucesso');
      onOpenChange(false);
      setDate(undefined);
      setPeriodo('');
      onSuccess();
    } catch (err: any) {
      toast.error('Erro ao reagendar: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reagendar Serviço</DialogTitle>
          <DialogDescription>
            {servico?.associado?.nome
              ? `Associado: ${servico.associado.nome}`
              : 'Selecione a nova data e período'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Data</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  locale={ptBR}
                  disabled={(d) => d < new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Período</label>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="M">Manhã</SelectItem>
                <SelectItem value="T">Tarde</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!date || !periodo || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

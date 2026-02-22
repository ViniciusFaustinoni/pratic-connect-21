import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { TIPO_DILIGENCIA_LABELS, type TipoDiligencia } from '@/types/sindicancia';

interface Props {
  sindicanciaId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RegistrarDiligenciaModal({ sindicanciaId, open, onOpenChange, onSuccess }: Props) {
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [tipo, setTipo] = useState<string>('');
  const [dataDigilencia, setDataDiligencia] = useState(new Date().toISOString().split('T')[0]);
  const [descricao, setDescricao] = useState('');
  const [resultado, setResultado] = useState('');
  const [local, setLocal] = useState('');

  const handleSubmit = async () => {
    if (!tipo || !descricao || !profile?.id) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('sindicancia_diligencias').insert({
      sindicancia_id: sindicanciaId,
      tipo,
      data_diligencia: dataDigilencia,
      descricao,
      resultado: resultado || null,
      local: local || null,
      registrado_por: profile.id,
    });

    if (error) {
      toast.error('Erro ao registrar diligência');
      console.error(error);
    } else {
      // Atualizar status para em_andamento se estava atribuido
      await supabase
        .from('sindicancias')
        .update({ status: 'em_andamento' })
        .eq('id', sindicanciaId)
        .eq('status', 'atribuido');

      toast.success('Diligência registrada!');
      onOpenChange(false);
      onSuccess();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar Diligência</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo *</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_DILIGENCIA_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data *</Label>
            <Input type="date" value={dataDigilencia} onChange={e => setDataDiligencia(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Textarea
              placeholder="Descreva o que foi feito..."
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Resultado / Achado</Label>
            <Textarea
              placeholder="O que foi encontrado..."
              value={resultado}
              onChange={e => setResultado(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Local da Diligência</Label>
            <Input
              placeholder="Endereço ou referência"
              value={local}
              onChange={e => setLocal(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Registrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

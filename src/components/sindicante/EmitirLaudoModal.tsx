import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { CONCLUSAO_LAUDO_LABELS, RECOMENDACAO_LABELS } from '@/types/sindicancia';

interface Props {
  sindicanciaId: string;
  sinistroId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EmitirLaudoModal({ sindicanciaId, sinistroId, open, onOpenChange, onSuccess }: Props) {
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [conclusao, setConclusao] = useState('');
  const [resumo, setResumo] = useState('');
  const [irregularidades, setIrregularidades] = useState('');
  const [recomendacao, setRecomendacao] = useState('');

  const handleSubmit = async () => {
    if (!conclusao || !resumo || !recomendacao) {
      toast.error('Preencha conclusão, resumo e recomendação');
      return;
    }
    if (resumo.length < 100) {
      toast.error('O resumo executivo deve ter pelo menos 100 caracteres');
      return;
    }

    setSaving(true);

    // Atualizar sindicância com laudo
    const { error: sindError } = await supabase
      .from('sindicancias')
      .update({
        laudo_conclusao: conclusao,
        laudo_resumo: resumo,
        laudo_irregularidades: irregularidades || null,
        laudo_recomendacao: recomendacao,
        data_laudo: new Date().toISOString(),
        status: 'laudo_emitido',
      })
      .eq('id', sindicanciaId);

    if (sindError) {
      toast.error('Erro ao emitir laudo');
      console.error(sindError);
      setSaving(false);
      return;
    }

    // Atualizar status do sinistro para aguardando_analise
    await supabase
      .from('sinistros')
      .update({ status: 'aguardando_analise' })
      .eq('id', sinistroId);

    toast.success('Laudo emitido com sucesso!');
    onOpenChange(false);
    onSuccess();
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Emitir Laudo Final</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Conclusão *</Label>
            <Select value={conclusao} onValueChange={setConclusao}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conclusão" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CONCLUSAO_LAUDO_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Resumo Executivo * <span className="text-xs text-muted-foreground">(min. 100 caracteres)</span></Label>
            <Textarea
              placeholder="Descreva o resumo da investigação..."
              value={resumo}
              onChange={e => setResumo(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">{resumo.length} caracteres</p>
          </div>

          {(conclusao === 'irregular_comprovada' || conclusao === 'irregular_suspeita') && (
            <div className="space-y-2">
              <Label>Irregularidades Encontradas</Label>
              <Textarea
                placeholder="Detalhe as irregularidades..."
                value={irregularidades}
                onChange={e => setIrregularidades(e.target.value)}
                rows={3}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Recomendação *</Label>
            <Select value={recomendacao} onValueChange={setRecomendacao}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a recomendação" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RECOMENDACAO_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Emitir Laudo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { XCircle } from 'lucide-react';

interface CancelarCotacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cotacaoId: string;
  numero?: string;
  onCancelled?: () => void;
}

const CATEGORIAS: { value: string; label: string }[] = [
  { value: 'cliente_desistiu', label: 'Cliente desistiu' },
  { value: 'comprou_concorrente', label: 'Comprou de concorrente' },
  { value: 'valor_alto', label: 'Achou o valor alto' },
  { value: 'nao_atendeu', label: 'Cliente não retornou contato' },
  { value: 'duplicada', label: 'Cotação duplicada' },
  { value: 'outro', label: 'Outro motivo' },
];

export function CancelarCotacaoDialog({
  open,
  onOpenChange,
  cotacaoId,
  numero,
  onCancelled,
}: CancelarCotacaoDialogProps) {
  const qc = useQueryClient();
  const [categoria, setCategoria] = useState<string>('');
  const [motivo, setMotivo] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const motivoValido = motivo.trim().length >= 10;
  const podeEnviar = !!categoria && motivoValido && !loading;

  const handleConfirm = async () => {
    if (!podeEnviar) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cancelar-cotacao', {
        body: { cotacao_id: cotacaoId, categoria, motivo: motivo.trim() },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Cotação ${numero ?? ''} cancelada. Placa liberada.`);
      qc.invalidateQueries({ queryKey: ['cotacoes'] });
      setCategoria('');
      setMotivo('');
      onOpenChange(false);
      onCancelled?.();
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível cancelar a cotação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-full bg-destructive/10">
              <XCircle className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle>Cancelar cotação {numero ? `#${numero}` : ''}</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            A cotação será arquivada e a placa liberada imediatamente. Nenhum dado é apagado — você pode
            reativá-la depois.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="categoria">Categoria *</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger id="categoria">
                <SelectValue placeholder="Selecione um motivo" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="motivo">Descrição *</Label>
            <Textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Detalhe o motivo (mínimo 10 caracteres)"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {motivo.trim().length}/10 caracteres
            </p>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Voltar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!podeEnviar}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? 'Cancelando...' : 'Cancelar cotação'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

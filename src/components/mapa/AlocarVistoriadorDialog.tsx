import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useBasesPratic } from '@/hooks/useBasesPratic';
import { format } from 'date-fns';
import { getHojeBrasilia } from '@/lib/date-utils';
import { toast } from 'sonner';
import { MapPin, Building2, Loader2, Save } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profissionalId: string | null;
  profissionalNome: string | null;
  alocacaoAtual?: { tipo_alocacao: 'rota' | 'base'; base_id: string | null } | null;
}

export function AlocarVistoriadorDialog({
  open,
  onOpenChange,
  profissionalId,
  profissionalNome,
  alocacaoAtual,
}: Props) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const { data: bases = [] } = useBasesPratic();

  const [tipo, setTipo] = useState<'rota' | 'base'>('rota');
  const [baseId, setBaseId] = useState<string>('');

  useEffect(() => {
    if (open) {
      setTipo(alocacaoAtual?.tipo_alocacao || 'rota');
      setBaseId(alocacaoAtual?.base_id || '');
    }
  }, [open, alocacaoAtual]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!profissionalId) throw new Error('Profissional não informado');
      if (!profile?.id) throw new Error('Não autenticado');
      if (tipo === 'base' && !baseId) {
        throw new Error('Selecione uma base');
      }

      const dataStr = format(getHojeBrasilia(), 'yyyy-MM-dd');

      const { error } = await supabase
        .from('alocacoes_diarias')
        .upsert(
          {
            profissional_id: profissionalId,
            data: dataStr,
            tipo_alocacao: tipo,
            base_id: tipo === 'base' ? baseId : null,
            definido_por: profile.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'profissional_id,data' }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(
        tipo === 'base'
          ? `${profissionalNome} alocado em base`
          : `${profissionalNome} alocado em rota`
      );
      qc.invalidateQueries({ queryKey: ['alocacoes-dia'] });
      qc.invalidateQueries({ queryKey: ['alocacao-diaria'] });
      qc.invalidateQueries({ queryKey: ['escala-dia'] });
      qc.invalidateQueries({ queryKey: ['plantoes-mes'] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Erro ao salvar alocação');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Alocação de hoje
          </DialogTitle>
          <DialogDescription>
            <strong>{profissionalNome}</strong> — {format(getHojeBrasilia(), "dd/MM/yyyy")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Toggle tipo */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTipo('rota')}
              className={cn(
                'rounded-lg border-2 p-4 transition-colors text-left',
                tipo === 'rota'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-accent/50'
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="h-4 w-4 text-blue-600" />
                <span className="font-semibold text-sm">Rota</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Atende serviços em campo, visível no mapa
              </p>
            </button>
            <button
              type="button"
              onClick={() => setTipo('base')}
              className={cn(
                'rounded-lg border-2 p-4 transition-colors text-left',
                tipo === 'base'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-accent/50'
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="h-4 w-4 text-amber-600" />
                <span className="font-semibold text-sm">Base</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Fica fixo na base, oculto do mapa
              </p>
            </button>
          </div>

          {/* Seleção de base */}
          {tipo === 'base' && (
            <div className="space-y-2">
              <Label>Em qual base ele ficará fixo?</Label>
              <Select value={baseId} onValueChange={setBaseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a base..." />
                </SelectTrigger>
                <SelectContent>
                  {bases.length === 0 && (
                    <div className="p-2 text-sm text-muted-foreground">
                      Nenhuma base Pratic cadastrada
                    </div>
                  )}
                  {bases.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.nome_fantasia || b.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                O técnico só receberá vistorias agendadas para essa base.
              </p>
            </div>
          )}

          <Button
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending || (tipo === 'base' && !baseId)}
            className="w-full gap-2"
          >
            {salvar.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar alocação de hoje
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

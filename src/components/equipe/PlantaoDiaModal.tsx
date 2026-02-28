import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { MapPin, Building2, Save, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface Alocacao {
  id: string;
  profissional_id: string;
  data: string;
  tipo_alocacao: 'rota' | 'base';
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: Date;
  profissionais: { id: string; nome: string }[];
  alocacoesExistentes: Alocacao[];
}

export function PlantaoDiaModal({ open, onOpenChange, data, profissionais, alocacoesExistentes }: Props) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [alocacoes, setAlocacoes] = useState<Record<string, 'rota' | 'base'>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const dataFormatada = format(data, 'yyyy-MM-dd');
  const dataLabel = format(data, "EEEE, dd 'de' MMMM", { locale: ptBR });

  useEffect(() => {
    if (open) {
      const initial: Record<string, 'rota' | 'base'> = {};
      alocacoesExistentes.forEach(a => {
        initial[a.profissional_id] = a.tipo_alocacao as 'rota' | 'base';
      });
      setAlocacoes(initial);
      setHasChanges(false);
    }
  }, [open, alocacoesExistentes]);

  const toggleAlocacao = (profId: string) => {
    setAlocacoes(prev => {
      const current = prev[profId] || 'rota';
      return { ...prev, [profId]: current === 'rota' ? 'base' : 'rota' };
    });
    setHasChanges(true);
  };

  const definirTodos = (tipo: 'rota' | 'base') => {
    const newAlocacoes: Record<string, 'rota' | 'base'> = {};
    profissionais.forEach(p => { newAlocacoes[p.id] = tipo; });
    setAlocacoes(newAlocacoes);
    setHasChanges(true);
  };

  const salvarMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error('Não autenticado');

      const upserts = Object.entries(alocacoes).map(([profissionalId, tipo]) => ({
        profissional_id: profissionalId,
        data: dataFormatada,
        tipo_alocacao: tipo,
        definido_por: profile.id,
        updated_at: new Date().toISOString(),
      }));

      if (upserts.length === 0) return;

      const { error } = await supabase
        .from('alocacoes_diarias')
        .upsert(upserts, { onConflict: 'profissional_id,data' });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Plantão salvo com sucesso!');
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['plantoes-mes'] });
      queryClient.invalidateQueries({ queryKey: ['alocacao-diaria'] });
      queryClient.invalidateQueries({ queryKey: ['escala-dia'] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Erro ao salvar: ' + (error as Error).message);
    },
  });

  const countRota = Object.values(alocacoes).filter(v => v === 'rota').length;
  const countBase = Object.values(alocacoes).filter(v => v === 'base').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Plantão do Dia
          </DialogTitle>
          <DialogDescription className="capitalize">{dataLabel}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Ações em massa */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="gap-1">
                <MapPin className="h-3 w-3" /> Rota: {countRota}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Building2 className="h-3 w-3" /> Base: {countBase}
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => definirTodos('rota')}>
                Todos Rota
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => definirTodos('base')}>
                Todos Base
              </Button>
            </div>
          </div>

          {/* Lista de profissionais */}
          {profissionais.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">
              Nenhum vistoriador cadastrado.
            </p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {profissionais.map(prof => {
                const tipo = alocacoes[prof.id] || null;
                const isBase = tipo === 'base';

                return (
                  <div
                    key={prof.id}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {prof.nome.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-sm">{prof.nome}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "text-xs font-medium",
                        isBase ? "text-amber-600 dark:text-amber-400" : tipo === 'rota' ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"
                      )}>
                        {isBase ? 'Base' : tipo === 'rota' ? 'Rota' : '—'}
                      </span>
                      <div className="flex items-center gap-2">
                        <MapPin className={cn("h-3.5 w-3.5", !isBase ? "text-blue-500" : "text-muted-foreground/40")} />
                        <Switch checked={isBase} onCheckedChange={() => toggleAlocacao(prof.id)} />
                        <Building2 className={cn("h-3.5 w-3.5", isBase ? "text-amber-500" : "text-muted-foreground/40")} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Salvar */}
          {hasChanges && (
            <Button
              onClick={() => salvarMutation.mutate()}
              disabled={salvarMutation.isPending}
              className="w-full gap-2"
            >
              {salvarMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar Plantão
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

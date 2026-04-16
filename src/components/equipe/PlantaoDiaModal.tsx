import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useBasesPratic } from '@/hooks/useBasesPratic';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface Alocacao {
  id: string;
  profissional_id: string;
  data: string;
  tipo_alocacao: 'rota' | 'base';
  base_id?: string | null;
}

interface EstadoLocal {
  tipo: 'rota' | 'base';
  base_id: string | null;
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
  const { data: bases = [] } = useBasesPratic();
  const [alocacoes, setAlocacoes] = useState<Record<string, EstadoLocal>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const dataFormatada = format(data, 'yyyy-MM-dd');
  const dataLabel = format(data, "EEEE, dd 'de' MMMM", { locale: ptBR });

  useEffect(() => {
    if (open) {
      const initial: Record<string, EstadoLocal> = {};
      alocacoesExistentes.forEach(a => {
        initial[a.profissional_id] = {
          tipo: a.tipo_alocacao as 'rota' | 'base',
          base_id: a.base_id ?? null,
        };
      });
      setAlocacoes(initial);
      setHasChanges(false);
    }
  }, [open, alocacoesExistentes]);

  const toggleAlocacao = (profId: string) => {
    setAlocacoes(prev => {
      const current = prev[profId]?.tipo || 'rota';
      const novoTipo = current === 'rota' ? 'base' : 'rota';
      return {
        ...prev,
        [profId]: {
          tipo: novoTipo,
          base_id: novoTipo === 'base' ? (prev[profId]?.base_id || null) : null,
        },
      };
    });
    setHasChanges(true);
  };

  const setBase = (profId: string, baseId: string) => {
    setAlocacoes(prev => ({
      ...prev,
      [profId]: { tipo: 'base', base_id: baseId },
    }));
    setHasChanges(true);
  };

  const definirTodos = (tipo: 'rota' | 'base') => {
    const novo: Record<string, EstadoLocal> = {};
    profissionais.forEach(p => {
      novo[p.id] = {
        tipo,
        base_id: tipo === 'base' ? (alocacoes[p.id]?.base_id || null) : null,
      };
    });
    setAlocacoes(novo);
    setHasChanges(true);
  };

  const salvarMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error('Não autenticado');

      const entries = Object.entries(alocacoes);
      const incompletos = entries.filter(([, v]) => v.tipo === 'base' && !v.base_id);
      if (incompletos.length > 0) {
        throw new Error('Selecione a base para todos os profissionais marcados como Base.');
      }

      const upserts = entries.map(([profissionalId, v]) => ({
        profissional_id: profissionalId,
        data: dataFormatada,
        tipo_alocacao: v.tipo,
        base_id: v.tipo === 'base' ? v.base_id : null,
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
      queryClient.invalidateQueries({ queryKey: ['alocacoes-dia'] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Erro ao salvar: ' + (error as Error).message);
    },
  });

  const countRota = Object.values(alocacoes).filter(v => v.tipo === 'rota').length;
  const countBase = Object.values(alocacoes).filter(v => v.tipo === 'base').length;

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

          {profissionais.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">
              Nenhum vistoriador cadastrado.
            </p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {profissionais.map(prof => {
                const estado = alocacoes[prof.id];
                const tipo = estado?.tipo || null;
                const isBase = tipo === 'base';

                return (
                  <div
                    key={prof.id}
                    className="rounded-lg border p-3 hover:bg-accent/50 transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between">
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
                    {isBase && (
                      <div className="pl-11">
                        <Select
                          value={estado?.base_id || ''}
                          onValueChange={(v) => setBase(prof.id, v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Selecione a base..." />
                          </SelectTrigger>
                          <SelectContent>
                            {bases.length === 0 && (
                              <div className="p-2 text-xs text-muted-foreground">
                                Nenhuma base cadastrada
                              </div>
                            )}
                            {bases.map((b) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.nome_fantasia || b.razao_social}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

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

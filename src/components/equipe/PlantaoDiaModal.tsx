import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useBasesPratic } from '@/hooks/useBasesPratic';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Building2, Save, Loader2, Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  plantonista: boolean;
  base_id: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: Date;
  profissionais: { id: string; nome: string }[];
  alocacoesExistentes: Alocacao[];
}

/**
 * Modal de Plantão do Dia.
 *
 * Semântica unificada (abr/2025):
 * - Estar marcado como plantonista = automaticamente tipo_alocacao='base' nesse dia.
 * - Não estar marcado = sem registro em alocacoes_diarias (default = rota).
 * - O sistema (mapa, atribuições) lê alocacoes_diarias e trata 'base' como base.
 */
export function PlantaoDiaModal({ open, onOpenChange, data, profissionais, alocacoesExistentes }: Props) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { data: bases = [] } = useBasesPratic();
  const [estado, setEstado] = useState<Record<string, EstadoLocal>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const dataFormatada = format(data, 'yyyy-MM-dd');
  const dataLabel = format(data, "EEEE, dd 'de' MMMM", { locale: ptBR });

  useEffect(() => {
    if (open) {
      const initial: Record<string, EstadoLocal> = {};
      // Apenas alocações tipo 'base' contam como plantão
      alocacoesExistentes
        .filter(a => a.tipo_alocacao === 'base')
        .forEach(a => {
          initial[a.profissional_id] = {
            plantonista: true,
            base_id: a.base_id ?? null,
          };
        });
      setEstado(initial);
      setHasChanges(false);
    }
  }, [open, alocacoesExistentes]);

  const togglePlantonista = (profId: string) => {
    setEstado(prev => {
      const atual = prev[profId];
      if (atual?.plantonista) {
        // desmarca: remove do estado
        const novo = { ...prev };
        delete novo[profId];
        return novo;
      }
      // marca: vira plantonista (base) — base padrão = primeira base se houver só uma
      return {
        ...prev,
        [profId]: {
          plantonista: true,
          base_id: bases.length === 1 ? bases[0].id : null,
        },
      };
    });
    setHasChanges(true);
  };

  const setBase = (profId: string, baseId: string) => {
    setEstado(prev => ({
      ...prev,
      [profId]: { plantonista: true, base_id: baseId },
    }));
    setHasChanges(true);
  };

  const marcarTodos = () => {
    const novo: Record<string, EstadoLocal> = {};
    profissionais.forEach(p => {
      novo[p.id] = {
        plantonista: true,
        base_id: estado[p.id]?.base_id ?? (bases.length === 1 ? bases[0].id : null),
      };
    });
    setEstado(novo);
    setHasChanges(true);
  };

  const limparTodos = () => {
    setEstado({});
    setHasChanges(true);
  };

  const salvarMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error('Não autenticado');

      const plantonistas = Object.entries(estado).filter(([, v]) => v.plantonista);
      const semBase = plantonistas.filter(([, v]) => !v.base_id);
      if (semBase.length > 0) {
        throw new Error('Selecione a base para todos os plantonistas.');
      }

      // Upsert dos plantonistas como tipo_alocacao='base'
      if (plantonistas.length > 0) {
        const upserts = plantonistas.map(([profissionalId, v]) => ({
          profissional_id: profissionalId,
          data: dataFormatada,
          tipo_alocacao: 'base' as const,
          base_id: v.base_id,
          definido_por: profile.id,
          observacoes: 'Plantão',
          updated_at: new Date().toISOString(),
        }));

        const { error } = await supabase
          .from('alocacoes_diarias')
          .upsert(upserts, { onConflict: 'profissional_id,data' });

        if (error) throw error;
      }

      // Remover alocações 'base' antigas que não estão mais marcadas como plantonista
      const idsPlantonistasAtuais = plantonistas.map(([id]) => id);
      const idsParaRemover = alocacoesExistentes
        .filter(a => a.tipo_alocacao === 'base' && !idsPlantonistasAtuais.includes(a.profissional_id))
        .map(a => a.id);

      if (idsParaRemover.length > 0) {
        const { error } = await supabase
          .from('alocacoes_diarias')
          .delete()
          .in('id', idsParaRemover);

        if (error) throw error;
      }
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

  const countPlantao = Object.values(estado).filter(v => v.plantonista).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-amber-600" />
            Plantão do Dia
          </DialogTitle>
          <DialogDescription className="capitalize">{dataLabel}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-2.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <p>
              Técnicos marcados como plantonistas são automaticamente tratados como
              <strong className="text-foreground"> Base</strong> nesse dia: somem do mapa
              de rota e recebem apenas vistorias da base selecionada.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Badge variant="outline" className="gap-1">
              <Building2 className="h-3 w-3" /> Plantonistas: {countPlantao}
            </Badge>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={marcarTodos}>
                Todos
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={limparTodos}>
                Limpar
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
                const e = estado[prof.id];
                const isPlantao = !!e?.plantonista;

                return (
                  <div
                    key={prof.id}
                    className={cn(
                      "rounded-lg border p-3 transition-colors space-y-2",
                      isPlantao ? "border-amber-300 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-800" : "hover:bg-accent/50"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={`plantao-${prof.id}`}
                          checked={isPlantao}
                          onCheckedChange={() => togglePlantonista(prof.id)}
                        />
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {prof.nome.charAt(0).toUpperCase()}
                        </div>
                        <label htmlFor={`plantao-${prof.id}`} className="font-medium text-sm cursor-pointer">
                          {prof.nome}
                        </label>
                      </div>
                      {isPlantao && (
                        <Badge variant="outline" className="text-[10px] gap-1 text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
                          <Building2 className="h-2.5 w-2.5" />
                          Base
                        </Badge>
                      )}
                    </div>
                    {isPlantao && (
                      <div className="pl-11">
                        <Select
                          value={e?.base_id || ''}
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

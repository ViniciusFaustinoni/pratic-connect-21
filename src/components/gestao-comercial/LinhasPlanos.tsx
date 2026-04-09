import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { LinhaFormModal } from '@/components/admin/planos/LinhaFormModal';
import { PlanFormModal } from '@/components/admin/planos/PlanFormModal';
import { usePermissions } from '@/hooks/usePermissions';
import { useDuplicateProductLine, useDuplicatePlan, useTogglePlanStatus } from '@/hooks/usePlansAdmin';
import { ImportarLinhasModal } from './ImportarLinhasModal';
import { DuplicarPlanoModal } from '@/components/admin/planos/DuplicarPlanoModal';
import {
  ChevronDown,
  Copy,
  Layers3,
  Loader2,
  Pencil,
  Plus,
  Shield,
  Sparkles,
  Trash2,
} from 'lucide-react';

const LINE_TONES: Record<string, { accent: string; soft: string }> = {
  blue: { accent: '217 91% 60%', soft: '217 91% 60% / 0.12' },
  green: { accent: '142 71% 45%', soft: '142 71% 45% / 0.12' },
  orange: { accent: '24 95% 53%', soft: '24 95% 53% / 0.12' },
  purple: { accent: '271 91% 65%', soft: '271 91% 65% / 0.12' },
  red: { accent: '0 84% 60%', soft: '0 84% 60% / 0.12' },
};

const BADGE_TONES: Record<string, { background: string; border: string; text: string }> = {
  yellow: { background: '45 93% 47% / 0.14', border: '45 93% 47% / 0.32', text: '45 93% 62%' },
  green: { background: '142 71% 45% / 0.14', border: '142 71% 45% / 0.32', text: '142 71% 58%' },
  blue: { background: '217 91% 60% / 0.14', border: '217 91% 60% / 0.32', text: '217 91% 70%' },
  purple: { background: '271 91% 65% / 0.14', border: '271 91% 65% / 0.32', text: '271 91% 76%' },
  orange: { background: '24 95% 53% / 0.14', border: '24 95% 53% / 0.32', text: '24 95% 68%' },
  red: { background: '0 84% 60% / 0.14', border: '0 84% 60% / 0.32', text: '0 84% 72%' },
};

function useLinhasComPlanos() {
  return useQuery({
    queryKey: ['linhas_com_planos_clean'],
    queryFn: async () => {
      const { data: lines, error: linesError } = await supabase
        .from('product_lines')
        .select('*')
        .order('display_order');

      if (linesError) throw linesError;

      const { data: planos, error: plansError } = await supabase
        .from('planos')
        .select('id, nome, ativo, product_line_id, ordem, badge_text, badge_color')
        .eq('visivel_gestao', true)
        .order('ordem');

      if (plansError) throw plansError;

      const planoIds = (planos || []).map((plan) => plan.id);
      const coberturasMap = new Map<string, { id: string; nome: string; valor: number }[]>();
      const beneficiosMap = new Map<string, { id: string; name: string; preco_sugerido: number }[]>();

      if (planoIds.length > 0) {
        const { data: coberturas } = await supabase
          .from('planos_coberturas')
          .select('plano_id, cobertura_id, coberturas(id, nome, valor)')
          .in('plano_id', planoIds);

        for (const c of coberturas || []) {
          const cob = c.coberturas as any;
          if (!cob) continue;
          const list = coberturasMap.get(c.plano_id) || [];
          list.push({ id: cob.id, nome: cob.nome, valor: cob.valor || 0 });
          coberturasMap.set(c.plano_id, list);
        }

        const { data: beneficios } = await supabase
          .from('planos_beneficios')
          .select('plano_id, benefit_id, benefits:benefit_id(id, name, preco_sugerido)')
          .in('plano_id', planoIds);

        for (const b of beneficios || []) {
          const ben = b.benefits as any;
          if (!ben) continue;
          const list = beneficiosMap.get(b.plano_id) || [];
          list.push({ id: ben.id, name: ben.name, preco_sugerido: ben.preco_sugerido || 0 });
          beneficiosMap.set(b.plano_id, list);
        }
      }

      return (lines || []).map((line) => ({
        ...line,
        plans: (planos || [])
          .filter((plan) => plan.product_line_id === line.id)
          .map((plan) => {
            const cobs = coberturasMap.get(plan.id) || [];
            const bens = beneficiosMap.get(plan.id) || [];
            return {
              ...plan,
              coberturas_list: cobs,
              beneficios_list: bens,
              valor_mensal: cobs.reduce((s, c) => s + c.valor, 0) + bens.reduce((s, b) => s + b.preco_sugerido, 0),
              coberturas_count: cobs.length,
              beneficios_count: bens.length,
            };
          }),
      }));
    },
  });
}

function useDeleteLinha() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: planos } = await supabase.from('planos').select('id').eq('product_line_id', id);

      for (const plano of planos || []) {
        await supabase.from('planos_coberturas').delete().eq('plano_id', plano.id);
        await supabase.from('planos_beneficios').delete().eq('plano_id', plano.id);
        await supabase.from('entity_eligibility_rules' as any).delete().eq('entity_type', 'plano').eq('entity_id', plano.id);
      }

      if (planos && planos.length > 0) {
        await supabase.from('planos').delete().in('id', planos.map((plano) => plano.id));
      }

      const { error } = await supabase.from('product_lines').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linhas_com_planos_clean'] });
      toast.success('Linha excluída');
    },
    onError: (error: Error) => toast.error(`Erro ao excluir linha: ${error.message}`),
  });
}

function useDeletePlano() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('planos_coberturas').delete().eq('plano_id', id);
      await supabase.from('planos_beneficios').delete().eq('plano_id', id);
      await supabase.from('entity_eligibility_rules' as any).delete().eq('entity_type', 'plano').eq('entity_id', id);

      const { error } = await supabase.from('planos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linhas_com_planos_clean'] });
      toast.success('Plano excluído');
    },
    onError: (error: Error) => toast.error(`Erro ao excluir plano: ${error.message}`),
  });
}

export function LinhasPlanos() {
  const { data: linhas = [], isLoading } = useLinhasComPlanos();
  const [openLines, setOpenLines] = useState<Set<string>>(new Set());
  const [linhaModal, setLinhaModal] = useState<{ open: boolean; productLine?: any }>({ open: false });
  const [planoModal, setPlanoModal] = useState<{ open: boolean; planId?: string; defaultLineId?: string }>({ open: false });
  const [importModal, setImportModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'linha' | 'plano'; id: string; name: string; plansCount?: number } | null>(null);
  const [duplicarModal, setDuplicarModal] = useState<{ open: boolean; plano: { id: string; nome: string } | null }>({ open: false, plano: null });
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);

  const selectedPlan = useMemo(
    () => (planoModal.planId ? { id: planoModal.planId } : null),
    [planoModal.planId],
  );

  const { isDiretor, isDesenvolvedor, isAdminMaster } = usePermissions();
  const canDelete = isDiretor || isDesenvolvedor || isAdminMaster;

  const deleteLinha = useDeleteLinha();
  const deletePlano = useDeletePlano();
  const duplicateLine = useDuplicateProductLine();
  const duplicatePlan = useDuplicatePlan();
  const toggleStatus = useTogglePlanStatus();

  const totalPlanos = linhas.reduce((accumulator, linha) => accumulator + linha.plans.length, 0);
  const totalAtivos = linhas.reduce(
    (accumulator, linha) => accumulator + linha.plans.filter((plano: any) => plano.ativo).length,
    0,
  );

  const toggleLine = (lineId: string) => {
    setOpenLines((previous) => {
      const next = new Set(previous);
      if (next.has(lineId)) {
        next.delete(lineId);
      } else {
        next.add(lineId);
      }
      return next;
    });
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirm) return;

    if (deleteConfirm.type === 'linha') {
      deleteLinha.mutate(deleteConfirm.id);
    } else {
      deletePlano.mutate(deleteConfirm.id);
    }

    setDeleteConfirm(null);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">Planos por linha de produto</h3>
            <p className="text-sm text-muted-foreground">
              Organize planos em seções colapsáveis e mantenha o catálogo visualmente consistente.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setImportModal(true)}>
              Importar linhas
            </Button>
            <Button size="sm" onClick={() => setLinhaModal({ open: true })}>
              <Plus className="mr-1.5 h-4 w-4" />
              Nova Linha
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-3xl border border-border/60 bg-card/70 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Linhas</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{linhas.length}</p>
          </div>
          <div className="rounded-3xl border border-border/60 bg-card/70 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Planos</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{totalPlanos}</p>
          </div>
          <div className="rounded-3xl border border-border/60 bg-card/70 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Ativos</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{totalAtivos}</p>
          </div>
        </div>

        <div className="space-y-4">
          {linhas.map((linha: any) => {
            const isOpen = openLines.has(linha.id);
            const lineTone = LINE_TONES[linha.color || 'blue'] || LINE_TONES.blue;
            const activePlans = linha.plans.filter((plano: any) => plano.ativo).length;

            return (
              <Collapsible key={linha.id} open={isOpen} onOpenChange={() => toggleLine(linha.id)}>
                <section className="overflow-hidden rounded-[28px] border border-border/60 bg-card/80 shadow-sm">
                  <div
                    className="border-b border-border/50 px-4 py-4 sm:px-5"
                    style={{ backgroundImage: `linear-gradient(135deg, hsl(${lineTone.soft}), transparent 62%)` }}
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <CollapsibleTrigger asChild>
                        <button type="button" className="flex flex-1 items-start gap-4 text-left">
                          <div
                            className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl border text-lg"
                            style={{
                              borderColor: `hsl(${lineTone.accent} / 0.28)`,
                              backgroundColor: `hsl(${lineTone.soft})`,
                            }}
                          >
                            {linha.icon || '📦'}
                          </div>

                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', !isOpen && '-rotate-90')} />
                              <h4 className="text-lg font-semibold text-foreground">{linha.name}</h4>
                            </div>

                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <Badge variant="secondary">{linha.plans.length} plano{linha.plans.length === 1 ? '' : 's'}</Badge>
                              <Badge variant="outline">{activePlans} ativo{activePlans === 1 ? '' : 's'}</Badge>
                              {linha.vehicle_type ? (
                                <Badge variant="outline">{linha.vehicle_type === 'motorcycle' ? 'Motos' : 'Carros'}</Badge>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      </CollapsibleTrigger>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" onClick={() => setPlanoModal({ open: true, defaultLineId: linha.id })}>
                          <Plus className="mr-1.5 h-4 w-4" />
                          Novo Plano
                        </Button>
                        <Button size="icon" variant="outline" onClick={() => setLinhaModal({ open: true, productLine: linha })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="outline" onClick={() => duplicateLine.mutate(linha.id)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        {canDelete ? (
                          <Button
                            size="icon"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirm({
                              type: 'linha',
                              id: linha.id,
                              name: linha.name,
                              plansCount: linha.plans.length,
                            })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <CollapsibleContent>
                    <div className="px-2 pb-2">
                      {linha.plans.length > 0 ? (
                        <div className="divide-y divide-border/60">
                          {linha.plans.map((plano: any) => {
                            const badgeTone = plano.badge_color ? BADGE_TONES[plano.badge_color] : null;
                            const isExpanded = expandedPlanId === plano.id;

                            return (
                              <div key={plano.id}>
                                <div
                                  className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40 rounded-lg cursor-pointer"
                                  onClick={() => setExpandedPlanId(isExpanded ? null : plano.id)}
                                >
                                  <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0', !isExpanded && '-rotate-90')} />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-sm font-medium text-foreground">{plano.nome}</span>
                                      {plano.badge_text ? (
                                        <Badge
                                          className="border text-[10px] px-1.5 py-0"
                                          style={badgeTone ? {
                                            backgroundColor: `hsl(${badgeTone.background})`,
                                            borderColor: `hsl(${badgeTone.border})`,
                                            color: `hsl(${badgeTone.text})`,
                                          } : undefined}
                                        >
                                          {plano.badge_text}
                                        </Badge>
                                      ) : null}
                                    </div>
                                  </div>

                                  <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                                    <span className="flex items-center gap-1">
                                      <Shield className="h-3.5 w-3.5" />
                                      {plano.coberturas_count} cob.
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Sparkles className="h-3.5 w-3.5" />
                                      {plano.beneficios_count} ben.
                                    </span>
                                    <span>Ordem {plano.ordem ?? 0}</span>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <Switch
                                      checked={plano.ativo}
                                      onCheckedChange={(checked) => toggleStatus.mutate({ id: plano.id, is_active: checked })}
                                      disabled={toggleStatus.isPending}
                                    />
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8"
                                      onClick={() => setPlanoModal({ open: true, planId: plano.id, defaultLineId: linha.id })}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDuplicarModal({ open: true, plano: { id: plano.id, nome: plano.nome } })}>
                                      <Copy className="h-3.5 w-3.5" />
                                    </Button>
                                    {canDelete ? (
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={() => setDeleteConfirm({ type: 'plano', id: plano.id, name: plano.nome })}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    ) : null}
                                  </div>
                                </div>

                                {isExpanded && (
                                  <div className="ml-8 mr-3 mb-2 rounded-xl border border-border/50 bg-muted/20 p-3 space-y-3">
                                    {plano.coberturas_list.length > 0 && (
                                      <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                          <Shield className="h-3.5 w-3.5" /> Coberturas
                                        </p>
                                        <div className="space-y-0.5">
                                          {plano.coberturas_list.map((cob: any) => (
                                            <button
                                              key={cob.id}
                                              type="button"
                                              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm hover:bg-muted/60 transition-colors text-left"
                                              onClick={() => setPlanoModal({ open: true, planId: plano.id, defaultLineId: linha.id })}
                                            >
                                              <span className="text-foreground">{cob.nome}</span>
                                              <span className="text-muted-foreground font-medium tabular-nums">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cob.valor)}
                                              </span>
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {plano.beneficios_list.length > 0 && (
                                      <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                          <Sparkles className="h-3.5 w-3.5" /> Benefícios
                                        </p>
                                        <div className="space-y-0.5">
                                          {plano.beneficios_list.map((ben: any) => (
                                            <button
                                              key={ben.id}
                                              type="button"
                                              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm hover:bg-muted/60 transition-colors text-left"
                                              onClick={() => setPlanoModal({ open: true, planId: plano.id, defaultLineId: linha.id })}
                                            >
                                              <span className="text-foreground">{ben.name}</span>
                                              <span className="text-muted-foreground font-medium tabular-nums">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ben.preco_sugerido)}
                                              </span>
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {plano.coberturas_list.length === 0 && plano.beneficios_list.length === 0 && (
                                      <p className="text-sm text-muted-foreground text-center py-2">Nenhuma cobertura ou benefício cadastrado.</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-[24px] border border-dashed border-border/60 bg-card/40 px-6 py-10 text-center">
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-background/60">
                            <Layers3 className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <h5 className="mt-4 text-base font-semibold text-foreground">Nenhum plano nesta linha</h5>
                          <p className="mt-2 text-sm text-muted-foreground">
                            Crie o primeiro plano desta linha para começar a organizar coberturas e benefícios.
                          </p>
                          <Button className="mt-5" onClick={() => setPlanoModal({ open: true, defaultLineId: linha.id })}>
                            <Plus className="mr-1.5 h-4 w-4" />
                            Novo Plano
                          </Button>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </section>
              </Collapsible>
            );
          })}
        </div>
      </div>

      <LinhaFormModal
        open={linhaModal.open}
        onOpenChange={(open) => { if (!open) setLinhaModal({ open: false }); }}
        productLine={linhaModal.productLine}
      />

      <PlanFormModal
        open={planoModal.open}
        onOpenChange={(open) => { if (!open) setPlanoModal({ open: false }); }}
        plan={selectedPlan}
        defaultProductLineId={planoModal.defaultLineId}
      />

      <ImportarLinhasModal open={importModal} onClose={() => setImportModal(false)} />

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {deleteConfirm?.type === 'linha' ? 'linha' : 'plano'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.type === 'linha' ? (
                <>
                  Tem certeza que deseja excluir a linha <strong>"{deleteConfirm?.name}"</strong>?
                  {(deleteConfirm?.plansCount ?? 0) > 0 ? (
                    <> Isso também excluirá <strong>{deleteConfirm?.plansCount} plano(s)</strong> vinculado(s).</>
                  ) : null}
                  {' '}Esta ação não pode ser desfeita.
                </>
              ) : (
                <>
                  Tem certeza que deseja excluir o plano <strong>"{deleteConfirm?.name}"</strong>? Esta ação não pode ser desfeita.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {(deleteLinha.isPending || deletePlano.isPending) ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <DuplicarPlanoModal
        open={duplicarModal.open}
        onOpenChange={(open) => setDuplicarModal({ open, plano: open ? duplicarModal.plano : null })}
        plano={duplicarModal.plano}
      />
    </>
  );
}

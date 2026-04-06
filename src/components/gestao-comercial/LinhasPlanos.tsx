import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, ChevronRight, Loader2, Pencil, Trash2, Copy, Upload, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlanoFormSheet } from './PlanoFormSheet';
import { usePermissions } from '@/hooks/usePermissions';
import { useDuplicateProductLine, useDuplicatePlan } from '@/hooks/usePlansAdmin';
import { ImportarLinhasModal } from './ImportarLinhasModal';

// ── Data hooks ──

function useLinhasComPlanos() {
  return useQuery({
    queryKey: ['linhas_com_planos_clean'],
    queryFn: async () => {
      const { data: lines, error: le } = await supabase
        .from('product_lines')
        .select('*')
        .order('display_order');
      if (le) throw le;

      const { data: planos, error: pe } = await supabase
        .from('planos')
        .select('id, nome, ativo, product_line_id, ordem')
        .eq('visivel_gestao', true)
        .order('ordem');
      if (pe) throw pe;

      const planoIds = (planos || []).map(p => p.id);
      
      let cobValores = new Map<string, number>();
      let benValores = new Map<string, number>();
      
      if (planoIds.length > 0) {
        const { data: cobs } = await supabase
          .from('planos_coberturas')
          .select('plano_id, coberturas(valor)')
          .in('plano_id', planoIds);
        
        for (const c of cobs || []) {
          const prev = cobValores.get(c.plano_id) || 0;
          cobValores.set(c.plano_id, prev + ((c.coberturas as any)?.valor || 0));
        }

        const { data: bens } = await supabase
          .from('planos_beneficios')
          .select('plano_id, benefits:benefit_id(preco_sugerido)')
          .in('plano_id', planoIds);

        for (const b of bens || []) {
          const prev = benValores.get(b.plano_id) || 0;
          benValores.set(b.plano_id, prev + ((b.benefits as any)?.preco_sugerido || 0));
        }
      }

      return (lines || []).map(line => ({
        ...line,
        plans: (planos || [])
          .filter(p => p.product_line_id === line.id)
          .map(p => ({
            ...p,
            valor_mensal: (cobValores.get(p.id) || 0) + (benValores.get(p.id) || 0),
          })),
      }));
    },
  });
}

function useCreateLinha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nome: string) => {
      const slug = nome.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const { error } = await supabase.from('product_lines').insert({ name: nome, slug, display_order: 99 });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['linhas_com_planos_clean'] }); toast.success('Linha criada'); },
    onError: () => toast.error('Erro ao criar linha'),
  });
}

function useUpdateLinha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('product_lines').update({ name }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['linhas_com_planos_clean'] }); toast.success('Linha atualizada'); },
  });
}

function useDeleteLinha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Delete all plans in this line first
      const { data: planos } = await supabase.from('planos').select('id').eq('product_line_id', id);
      for (const p of planos || []) {
        await supabase.from('planos_coberturas').delete().eq('plano_id', p.id);
        await supabase.from('planos_beneficios').delete().eq('plano_id', p.id);
        
        await supabase.from('entity_eligibility_rules' as any).delete().eq('entity_type', 'plano').eq('entity_id', p.id);
      }
      if (planos && planos.length > 0) {
        await supabase.from('planos').delete().in('id', planos.map(p => p.id));
      }
      const { error } = await supabase.from('product_lines').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['linhas_com_planos_clean'] }); toast.success('Linha excluída'); },
    onError: (e: Error) => toast.error(`Erro ao excluir linha: ${e.message}`),
  });
}

function useMovePlanToLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ planId, newLineId }: { planId: string; newLineId: string }) => {
      const { error } = await supabase.from('planos').update({ product_line_id: newLineId }).eq('id', planId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['linhas_com_planos_clean'] }); toast.success('Plano movido para nova linha'); },
    onError: () => toast.error('Erro ao mover plano'),
  });
}

function useReorderPlans() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderedPlanIds: string[]) => {
      const updates = orderedPlanIds.map((id, index) =>
        supabase.from('planos').update({ ordem: index }).eq('id', id)
      );
      const results = await Promise.all(updates);
      const failed = results.find(r => r.error);
      if (failed?.error) throw failed.error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['linhas_com_planos_clean'] }); },
    onError: () => toast.error('Erro ao reordenar planos'),
  });
}

function useDeletePlano() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('planos_coberturas').delete().eq('plano_id', id);
      await supabase.from('planos_beneficios').delete().eq('plano_id', id);
      await supabase.from('entity_eligibility_rules' as any).delete().eq('entity_type', 'plano').eq('entity_id', id);
      const { error } = await supabase.from('planos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['linhas_com_planos_clean'] }); toast.success('Plano excluído'); },
    onError: (e: Error) => toast.error(`Erro ao excluir plano: ${e.message}`),
  });
}

// ── Linha Sheet ──

function LinhaSheet({ open, onClose, linha }: { open: boolean; onClose: () => void; linha?: any }) {
  const [nome, setNome] = useState(linha?.name || '');
  const createMut = useCreateLinha();
  const updateMut = useUpdateLinha();

  const handleSave = () => {
    if (linha?.id) {
      updateMut.mutate({ id: linha.id, name: nome }, { onSuccess: onClose });
    } else {
      createMut.mutate(nome, { onSuccess: onClose });
    }
  };

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-sm">
        <SheetHeader><SheetTitle>{linha ? 'Editar' : 'Nova'} Linha</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-6">
          <div><Label>Nome da Linha</Label><Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Select" autoFocus /></div>
          <div className="flex gap-2 pt-4">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSave} disabled={!nome.trim() || isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Main Component ──

export function LinhasPlanos() {
  const { data: linhas = [], isLoading } = useLinhasComPlanos();
  const [openLines, setOpenLines] = useState<Set<string>>(new Set());
  const [linhaSheet, setLinhaSheet] = useState<{ open: boolean; linha?: any }>({ open: false });
  const [planoSheet, setPlanoSheet] = useState<{ open: boolean; planoId?: string; linhaId?: string }>({ open: false });
  const [importModal, setImportModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'linha' | 'plano'; id: string; name: string; plansCount?: number } | null>(null);

  const { isDiretor, isDesenvolvedor, isAdminMaster } = usePermissions();
  const canDelete = isDiretor || isDesenvolvedor || isAdminMaster;

  const deleteLinha = useDeleteLinha();
  const deletePlano = useDeletePlano();
  const duplicateLine = useDuplicateProductLine();
  const duplicatePlan = useDuplicatePlan();
  const movePlan = useMovePlanToLine();

  const [draggedPlan, setDraggedPlan] = useState<{ id: string; fromLineId: string } | null>(null);
  const [dragOverLineId, setDragOverLineId] = useState<string | null>(null);

  const toggleLine = (id: string) => {
    setOpenLines(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
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

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">Linhas e Planos</h3>
          <p className="text-xs text-muted-foreground">{linhas.length} linhas cadastradas</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setImportModal(true)}><Upload className="h-4 w-4 mr-1" />Importar</Button>
          <Button size="sm" onClick={() => setLinhaSheet({ open: true })}><Plus className="h-4 w-4 mr-1" />Nova Linha</Button>
        </div>
      </div>

      <div className="space-y-2">
        {linhas.map(linha => (
          <Collapsible key={linha.id} open={openLines.has(linha.id)} onOpenChange={() => toggleLine(linha.id)}>
            <div
              className={cn('border rounded-lg overflow-hidden transition-all', dragOverLineId === linha.id && draggedPlan?.fromLineId !== linha.id && 'ring-2 ring-primary')}
              onDragOver={(e) => {
                e.preventDefault();
                if (draggedPlan && draggedPlan.fromLineId !== linha.id) {
                  setDragOverLineId(linha.id);
                  if (!openLines.has(linha.id)) {
                    setOpenLines(prev => new Set(prev).add(linha.id));
                  }
                }
              }}
              onDragLeave={() => setDragOverLineId(null)}
              onDrop={() => {
                if (draggedPlan && draggedPlan.fromLineId !== linha.id) {
                  movePlan.mutate({ planId: draggedPlan.id, newLineId: linha.id });
                }
                setDragOverLineId(null);
                setDraggedPlan(null);
              }}
            >
              <CollapsibleTrigger className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left">
                <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', openLines.has(linha.id) && 'rotate-90')} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{linha.name}</p>
                  <p className="text-xs text-muted-foreground">{linha.plans.length} plano{linha.plans.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setLinhaSheet({ open: true, linha }); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); duplicateLine.mutate(linha.id); }} title="Duplicar">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  {canDelete && (
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: 'linha', id: linha.id, name: linha.name, plansCount: linha.plans.length }); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="border-t px-4 py-2 space-y-1 bg-muted/20">
                  {linha.plans.map((plano: any) => (
                    <div
                      key={plano.id}
                      className={cn('flex items-center gap-1', draggedPlan?.id === plano.id && 'opacity-40')}
                      draggable
                      onDragStart={(e) => {
                        setDraggedPlan({ id: plano.id, fromLineId: linha.id });
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => { setDraggedPlan(null); setDragOverLineId(null); }}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
                      <button
                        onClick={() => setPlanoSheet({ open: true, planoId: plano.id, linhaId: linha.id })}
                        className="flex-1 flex items-center gap-3 px-3 py-2 rounded-md hover:bg-background transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{plano.nome}</p>
                        </div>
                        <span className="text-sm font-semibold text-primary">
                          R$ {plano.valor_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <Switch checked={plano.ativo} className="shrink-0 pointer-events-none" />
                      </button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                        onClick={() => duplicatePlan.mutate(plano.id)} title="Duplicar"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      {canDelete && (
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                          onClick={() => setDeleteConfirm({ type: 'plano', id: plano.id, name: plano.nome })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" className="w-full mt-1 text-muted-foreground" onClick={() => setPlanoSheet({ open: true, linhaId: linha.id })}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Novo Plano
                  </Button>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </div>

      {linhaSheet.open && <LinhaSheet open linha={linhaSheet.linha} onClose={() => setLinhaSheet({ open: false })} />}
      {planoSheet.open && <PlanoFormSheet open planoId={planoSheet.planoId} linhaId={planoSheet.linhaId} onClose={() => setPlanoSheet({ open: false })} />}
      <ImportarLinhasModal open={importModal} onClose={() => setImportModal(false)} />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(v) => !v && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {deleteConfirm?.type === 'linha' ? 'linha' : 'plano'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.type === 'linha' ? (
                <>
                  Tem certeza que deseja excluir a linha <strong>"{deleteConfirm?.name}"</strong>?
                  {(deleteConfirm?.plansCount ?? 0) > 0 && (
                    <> Isso também excluirá <strong>{deleteConfirm?.plansCount} plano(s)</strong> vinculado(s).</>
                  )}
                  {' '}Esta ação não pode ser desfeita.
                </>
              ) : (
                <>
                  Tem certeza que deseja excluir o plano <strong>"{deleteConfirm?.name}"</strong>?
                  Esta ação não pode ser desfeita.
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
              {(deleteLinha.isPending || deletePlano.isPending) ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

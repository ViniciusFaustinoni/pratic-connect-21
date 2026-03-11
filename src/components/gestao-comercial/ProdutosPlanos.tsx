import { useState, useMemo } from 'react';
import { Package, Plus, Users, DollarSign, Shield, ChevronRight, Edit, Copy, Trash2, MoreVertical, Star, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
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
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePlans, useProductLines } from '@/hooks/usePlans';
import { useDeletePlan, useDuplicatePlan, useTogglePlanStatus } from '@/hooks/usePlansAdmin';
import { toast } from 'sonner';

// Import existing modals
import { VincularCoberturaModal, EditarCoberturaVinculadaModal } from '@/components/diretoria';
import { VincularBeneficioModal } from '@/components/gestao-comercial/VincularBeneficioModal';
import { PlanFormModal } from '@/components/admin/planos/PlanFormModal';
import type { PlanWithDetails } from '@/hooks/usePlans';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function ProdutosPlanos() {
  const [selectedLineSlug, setSelectedLineSlug] = useState<string>('all');
  const [selectedPlanoId, setSelectedPlanoId] = useState<string | null>(null);
  const [detailSubTab, setDetailSubTab] = useState<'precos' | 'coberturas' | 'beneficios' | 'detalhes'>('precos');
  const [modalOpen, setModalOpen] = useState(false);
  const [produtoEdit, setProdutoEdit] = useState<any>(null);
  const [precosPage, setPrecosPage] = useState(0);
  const [precosRegiao, setPrecosRegiao] = useState<string>('all');
  const [precosTipoUso, setPrecosTipoUso] = useState<string>('all');

  // Cobertura modals
  const [vincularCoberturaOpen, setVincularCoberturaOpen] = useState(false);
  const [editarCoberturaOpen, setEditarCoberturaOpen] = useState(false);
  const [coberturaParaEditar, setCoberturaParaEditar] = useState<any>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmType, setDeleteConfirmType] = useState<'cobertura' | 'beneficio'>('cobertura');
  const [planDeleteConfirmOpen, setPlanDeleteConfirmOpen] = useState(false);
  const [planToggleConfirm, setPlanToggleConfirm] = useState<{ id: string; activate: boolean } | null>(null);
  // Beneficio modals
  const [vincularBeneficioOpen, setVincularBeneficioOpen] = useState(false);

  const queryClient = useQueryClient();
  const { data: lines, isLoading: linesLoading } = useProductLines();
  const { data: plans, isLoading: plansLoading } = usePlans(selectedLineSlug === 'all' ? undefined : selectedLineSlug);
  
  const deletePlan = useDeletePlan();
  const duplicatePlan = useDuplicatePlan();
  const toggleStatus = useTogglePlanStatus();

  // Fetch associados count per plan
  const { data: associadosCounts } = useQuery({
    queryKey: ['associados-por-plano'],
    queryFn: async () => {
      const { data } = await supabase
        .from('associados')
        .select('plano_id')
        .eq('status', 'ativo');
      const counts: Record<string, number> = {};
      data?.forEach(a => { if (a.plano_id) counts[a.plano_id] = (counts[a.plano_id] || 0) + 1; });
      return counts;
    },
  });

  // Fetch price mappings
  const { data: precoMappings } = useQuery({
    queryKey: ['plano-preco-mappings'],
    queryFn: async () => {
      const { data: maps } = await supabase.from('plano_preco_map').select('plano_id, linha_slug');
      const { data: precos } = await supabase
        .from('tabelas_preco_mensalidade')
        .select('linha_slug, fipe_min, fipe_max, valor_mensal, regiao, tipo_uso')
        .eq('is_active', true);

      const porLinha: Record<string, typeof precos> = {};
      precos?.forEach(p => {
        const slug = p.linha_slug || '';
        if (!porLinha[slug]) porLinha[slug] = [];
        porLinha[slug]!.push(p);
      });

      const porPlano: Record<string, { linhaSlug: string; faixas: typeof precos }> = {};
      maps?.forEach(m => {
        if (porLinha[m.linha_slug]) {
          porPlano[m.plano_id] = { linhaSlug: m.linha_slug, faixas: porLinha[m.linha_slug]! };
        }
      });
      return porPlano;
    },
  });

  // Fetch coberturas per plan (with full planos_coberturas data)
  const { data: coberturasPorPlano } = useQuery({
    queryKey: ['coberturas-por-plano'],
    queryFn: async () => {
      const { data } = await supabase
        .from('planos_coberturas')
        .select('id, plano_id, cobertura_id, percentual_cobertura, valor_limite, franquia_percentual, franquia_valor, carencia_dias, obrigatoria, coberturas(id, nome, descricao, tipo)');
      const map: Record<string, any[]> = {};
      data?.forEach((pc: any) => {
        if (!map[pc.plano_id]) map[pc.plano_id] = [];
        map[pc.plano_id].push({
          ...pc,
          cobertura: pc.coberturas,
        });
      });
      return map;
    },
  });

  // Fetch beneficios per plan
  const { data: beneficiosPorPlano } = useQuery({
    queryKey: ['beneficios-por-plano'],
    queryFn: async () => {
      const { data } = await supabase
        .from('planos_beneficios')
        .select('id, plano_id, benefit_id, custom_text, custom_value, is_highlighted, display_order, benefits(id, name, icon, category, description)');
      const map: Record<string, any[]> = {};
      data?.forEach((pb: any) => {
        if (!map[pb.plano_id]) map[pb.plano_id] = [];
        map[pb.plano_id].push(pb);
      });
      return map;
    },
  });

  // Mutation: desvincular cobertura
  const desvincularCobertura = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('planos_coberturas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Cobertura desvinculada!');
      queryClient.invalidateQueries({ queryKey: ['coberturas-por-plano'] });
      queryClient.invalidateQueries({ queryKey: ['plano-coberturas'] });
    },
    onError: () => toast.error('Erro ao desvincular cobertura'),
  });

  // Mutation: desvincular beneficio
  const desvincularBeneficio = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('planos_beneficios').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Benefício desvinculado!');
      queryClient.invalidateQueries({ queryKey: ['beneficios-por-plano'] });
      queryClient.invalidateQueries({ queryKey: ['benefit-plan-associations'] });
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
    onError: () => toast.error('Erro ao desvincular benefício'),
  });

  const selectedPlan = useMemo(() => plans?.find(p => p.id === selectedPlanoId), [plans, selectedPlanoId]);
  const selectedPrecos = selectedPlanoId ? precoMappings?.[selectedPlanoId] : null;
  const selectedCoberturas = selectedPlanoId ? coberturasPorPlano?.[selectedPlanoId] || [] : [];
  const selectedBeneficios = selectedPlanoId ? beneficiosPorPlano?.[selectedPlanoId] || [] : [];

  const isLoading = linesLoading || plansLoading;

  const handleConfirmDelete = () => {
    if (!deleteConfirmId) return;
    if (deleteConfirmType === 'cobertura') {
      desvincularCobertura.mutate(deleteConfirmId);
    } else {
      desvincularBeneficio.mutate(deleteConfirmId);
    }
    setDeleteConfirmId(null);
  };

  if (isLoading) {
    return <div className="grid grid-cols-3 gap-4"><Skeleton className="h-96 col-span-1" /><Skeleton className="h-96 col-span-2" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header with line filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={selectedLineSlug} onValueChange={setSelectedLineSlug}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todas as linhas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as linhas</SelectItem>
              {lines?.map(l => (
                <SelectItem key={l.id} value={l.slug}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="secondary">{plans?.length ?? 0} planos</Badge>
        </div>
        <Button onClick={() => { setProdutoEdit(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Plano
        </Button>
      </div>

      {/* Master-detail layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[500px]">
        {/* Plan list sidebar */}
        <div className="space-y-1 overflow-y-auto max-h-[700px] rounded-xl border bg-card p-2">
          {plans?.map(plan => {
            const count = associadosCounts?.[plan.id] ?? 0;
            const selected = selectedPlanoId === plan.id;
            return (
              <button
                key={plan.id}
                onClick={() => { setSelectedPlanoId(plan.id); setDetailSubTab('precos'); setPrecosPage(0); setPrecosRegiao('all'); setPrecosTipoUso('all'); }}
                className={cn(
                  'w-full text-left px-3 py-3 rounded-lg border transition-all',
                  selected
                    ? 'bg-primary/10 border-primary/30 text-foreground'
                    : 'bg-transparent border-transparent hover:bg-muted/50 text-foreground',
                  !plan.ativo && 'opacity-50'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate">{plan.nome}</span>
                  <Badge variant="outline" className="text-xs ml-2 shrink-0">
                    {count}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {plan.product_lines?.name || 'Sem linha'}
                </p>
              </button>
            );
          })}
          {(!plans || plans.length === 0) && (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum plano encontrado</p>
            </div>
          )}
        </div>

        {/* Plan detail panel */}
        <div className="lg:col-span-2 rounded-xl border bg-card">
          {!selectedPlan ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <ChevronRight className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Selecione um plano para ver detalhes</p>
              </div>
            </div>
          ) : (
            <div>
              {/* Plan header */}
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold">{selectedPlan.nome}</h2>
                    {selectedPlan.destaque && (
                      <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                        <Star className="h-3 w-3 mr-1" />
                        Destaque
                      </Badge>
                    )}
                    <Badge variant={selectedPlan.ativo ? 'default' : 'secondary'}>
                      {selectedPlan.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {selectedPlan.product_lines?.name} · {selectedPlan.codigo}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => { setProdutoEdit(selectedPlan); setModalOpen(true); }}>
                      <Edit className="h-4 w-4 mr-2" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => duplicatePlan.mutate(selectedPlan.id)}>
                      <Copy className="h-4 w-4 mr-2" /> Duplicar
                    </DropdownMenuItem>
                    {selectedPlan.ativo ? (
                      <DropdownMenuItem
                        className="text-destructive opacity-50 cursor-not-allowed"
                        onClick={(e) => { e.preventDefault(); toast.error('Inative o plano antes de excluir'); }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setPlanDeleteConfirmOpen(true)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Sub-tabs */}
              <div className="flex border-b px-4">
                {([
                  { key: 'precos' as const, label: 'Faixas de Preço', icon: DollarSign },
                  { key: 'coberturas' as const, label: 'Coberturas', icon: Shield },
                  { key: 'beneficios' as const, label: 'Benefícios', icon: Gift },
                  { key: 'detalhes' as const, label: 'Detalhes', icon: Package },
                ] as const).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setDetailSubTab(tab.key)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 -mb-[1px] transition-colors',
                      detailSubTab === tab.key
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    {tab.label}
                    {tab.key === 'coberturas' && selectedCoberturas.length > 0 && (
                      <Badge variant="secondary" className="h-4 px-1 text-[10px]">{selectedCoberturas.length}</Badge>
                    )}
                    {tab.key === 'beneficios' && selectedBeneficios.length > 0 && (
                      <Badge variant="secondary" className="h-4 px-1 text-[10px]">{selectedBeneficios.length}</Badge>
                    )}
                  </button>
                ))}
              </div>

              {/* Sub-tab content */}
              <div className="p-4">
                {detailSubTab === 'precos' && (() => {
                  const allFaixas = selectedPrecos?.faixas || [];
                  const regioes = Array.from(new Set(allFaixas.map(f => f.regiao).filter(Boolean))).sort() as string[];
                  const tiposUso = Array.from(new Set(allFaixas.map(f => f.tipo_uso).filter(Boolean))).sort() as string[];
                  const filtered = allFaixas.filter(f => {
                    if (precosRegiao !== 'all' && f.regiao !== precosRegiao) return false;
                    if (precosTipoUso !== 'all' && f.tipo_uso !== precosTipoUso) return false;
                    return true;
                  });
                  const perPage = 30;
                  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
                  const safePage = Math.min(precosPage, totalPages - 1);
                  const paged = filtered.slice(safePage * perPage, (safePage + 1) * perPage);

                  return (
                    <div>
                      {allFaixas.length > 0 ? (
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <p className="text-xs text-muted-foreground">
                              Linha <Badge variant="outline" className="ml-1">{selectedPrecos?.linhaSlug}</Badge>
                            </p>
                            <Select value={precosRegiao} onValueChange={v => { setPrecosRegiao(v); setPrecosPage(0); }}>
                              <SelectTrigger className="w-[130px] h-7 text-xs"><SelectValue placeholder="Região" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Todas regiões</SelectItem>
                                {regioes.map(r => <SelectItem key={r} value={r}>{r.toUpperCase()}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            {tiposUso.length > 1 && (
                              <Select value={precosTipoUso} onValueChange={v => { setPrecosTipoUso(v); setPrecosPage(0); }}>
                                <SelectTrigger className="w-[130px] h-7 text-xs"><SelectValue placeholder="Tipo Uso" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">Todos tipos</SelectItem>
                                  {tiposUso.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Faixa FIPE</TableHead>
                                <TableHead>Região</TableHead>
                                <TableHead>Tipo Uso</TableHead>
                                <TableHead className="text-right">Valor Mensal</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {paged.map((f, i) => (
                                <TableRow key={i}>
                                  <TableCell className="text-xs">
                                    {formatCurrency(Number(f.fipe_min))} – {formatCurrency(Number(f.fipe_max))}
                                  </TableCell>
                                  <TableCell><Badge variant="outline">{f.regiao?.toUpperCase() || '-'}</Badge></TableCell>
                                  <TableCell className="text-xs">{f.tipo_uso || '-'}</TableCell>
                                  <TableCell className="text-right font-semibold text-primary">
                                    {formatCurrency(Number(f.valor_mensal))}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          {filtered.length > perPage && (
                            <div className="flex items-center justify-between mt-3 px-1">
                              <p className="text-xs text-muted-foreground">
                                Página {safePage + 1} de {totalPages} · {filtered.length} faixas
                              </p>
                              <div className="flex gap-1.5">
                                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={safePage === 0}
                                  onClick={() => setPrecosPage(safePage - 1)}>
                                  ← Anterior
                                </Button>
                                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={safePage >= totalPages - 1}
                                  onClick={() => setPrecosPage(safePage + 1)}>
                                  Próximo →
                                </Button>
                              </div>
                            </div>
                          )}
                          {filtered.length === 0 && allFaixas.length > 0 && (
                            <p className="text-xs text-muted-foreground text-center py-4">
                              Nenhuma faixa com os filtros selecionados
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <DollarSign className="h-6 w-6 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">Nenhuma faixa de preço vinculada</p>
                          <p className="text-xs mt-1">Configure via plano_preco_map</p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {detailSubTab === 'coberturas' && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-muted-foreground">{selectedCoberturas.length} cobertura(s) vinculada(s)</p>
                      <Button size="sm" onClick={() => setVincularCoberturaOpen(true)}>
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Vincular
                      </Button>
                    </div>
                    {selectedCoberturas.length > 0 ? (
                      <div className="space-y-2">
                        {selectedCoberturas.map((pc: any) => (
                          <div key={pc.id} className="flex items-center justify-between rounded-lg border p-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{pc.cobertura?.nome}</p>
                              {pc.cobertura?.descricao && <p className="text-xs text-muted-foreground">{pc.cobertura.descricao}</p>}
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {pc.percentual_cobertura != null && (
                                  <Badge variant="outline" className="text-xs">{pc.percentual_cobertura}%</Badge>
                                )}
                                {pc.valor_limite != null && (
                                  <Badge variant="outline" className="text-xs">Limite: {formatCurrency(Number(pc.valor_limite))}</Badge>
                                )}
                                {pc.franquia_valor != null && (
                                  <Badge variant="outline" className="text-xs">Franquia: {formatCurrency(Number(pc.franquia_valor))}</Badge>
                                )}
                                {pc.carencia_dias != null && (
                                  <Badge variant="outline" className="text-xs">Carência: {pc.carencia_dias}d</Badge>
                                )}
                                {pc.obrigatoria && (
                                  <Badge variant="default" className="text-xs">Obrigatória</Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-1 ml-2">
                              <Button variant="ghost" size="icon" className="h-7 w-7"
                                onClick={() => { setCoberturaParaEditar(pc); setEditarCoberturaOpen(true); }}>
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                                onClick={() => { setDeleteConfirmType('cobertura'); setDeleteConfirmId(pc.id); }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Shield className="h-6 w-6 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Nenhuma cobertura vinculada</p>
                      </div>
                    )}
                  </div>
                )}

                {detailSubTab === 'beneficios' && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-muted-foreground">{selectedBeneficios.length} benefício(s) vinculado(s)</p>
                      <Button size="sm" onClick={() => setVincularBeneficioOpen(true)}>
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Vincular
                      </Button>
                    </div>
                    {selectedBeneficios.length > 0 ? (
                      <div className="space-y-2">
                        {selectedBeneficios.map((pb: any) => (
                          <div key={pb.id} className="flex items-center justify-between rounded-lg border p-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {pb.benefits?.icon && <span className="text-base">{pb.benefits.icon}</span>}
                                <p className="text-sm font-medium">{pb.benefits?.name || 'Benefício'}</p>
                                {pb.is_highlighted && (
                                  <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-xs">
                                    <Star className="h-2.5 w-2.5 mr-0.5" />
                                    Destaque
                                  </Badge>
                                )}
                              </div>
                              {pb.benefits?.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">{pb.benefits.description}</p>
                              )}
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {pb.benefits?.category && (
                                  <Badge variant="outline" className="text-xs">{pb.benefits.category}</Badge>
                                )}
                                {pb.custom_text && (
                                  <Badge variant="secondary" className="text-xs">{pb.custom_text}</Badge>
                                )}
                                {pb.custom_value && (
                                  <Badge variant="secondary" className="text-xs">{pb.custom_value}</Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-1 ml-2">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                                onClick={() => { setDeleteConfirmType('beneficio'); setDeleteConfirmId(pb.id); }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Gift className="h-6 w-6 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Nenhum benefício vinculado</p>
                      </div>
                    )}
                  </div>
                )}

                {detailSubTab === 'detalhes' && (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Código</p>
                      <p className="font-medium">{selectedPlan.codigo}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Linha de Produto</p>
                      <p className="font-medium">{selectedPlan.product_lines?.name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Valor Adesão</p>
                      <p className="font-medium">{formatCurrency(selectedPlan.valor_adesao)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Ano Mínimo</p>
                      <p className="font-medium">{selectedPlan.ano_minimo || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Tipo Uso</p>
                      <p className="font-medium">{selectedPlan.tipo_uso}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Ordem</p>
                      <p className="font-medium">{selectedPlan.ordem ?? '-'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground text-xs">Descrição</p>
                      <p className="font-medium">{selectedPlan.descricao || '-'}</p>
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">Ativo:</span>
                      <Switch
                        checked={selectedPlan.ativo}
                        onCheckedChange={(checked) => toggleStatus.mutate({ id: selectedPlan.id, is_active: checked })}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <PlanFormModal
        open={modalOpen}
        onOpenChange={(open) => { if (!open) setModalOpen(false); }}
        plan={produtoEdit as PlanWithDetails | null}
      />

      {selectedPlanoId && (
        <>
          <VincularCoberturaModal
            open={vincularCoberturaOpen}
            onClose={() => setVincularCoberturaOpen(false)}
            planoId={selectedPlanoId}
          />
          <EditarCoberturaVinculadaModal
            open={editarCoberturaOpen}
            onClose={() => { setEditarCoberturaOpen(false); setCoberturaParaEditar(null); queryClient.invalidateQueries({ queryKey: ['coberturas-por-plano'] }); }}
            cobertura={coberturaParaEditar}
            planoId={selectedPlanoId}
          />
          <VincularBeneficioModal
            open={vincularBeneficioOpen}
            onClose={() => setVincularBeneficioOpen(false)}
            planoId={selectedPlanoId}
          />
        </>
      )}

      {/* Delete/unlink confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar remoção</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmType === 'cobertura'
                ? 'Deseja desvincular esta cobertura do plano? Isso não exclui a cobertura do sistema.'
                : 'Deseja desvincular este benefício do plano? Isso não exclui o benefício do sistema.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Desvincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState } from 'react';
import { Gift, Shield, Plus, Edit, Trash2, Copy } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { useBenefits, useCoberturas, usePlans } from '@/hooks/usePlans';
import { useDeleteBenefit, useDeleteCobertura, useUpdateCobertura, useDuplicateBenefit } from '@/hooks/usePlansAdmin';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BeneficioFormModal } from '@/components/admin/planos/BeneficioFormModal';
import { CoberturaUnificadaFormModal } from '@/components/admin/planos/CoberturaUnificadaFormModal';
import type { Benefit, Cobertura } from '@/types/plans';

export function BeneficiosCoberturas() {
  const [activeTab, setActiveTab] = useState('coberturas');
  const [filtroPlano, setFiltroPlano] = useState<string>('all');

  // Benefit modal state
  const [beneficioModalOpen, setBeneficioModalOpen] = useState(false);
  const [beneficioEdit, setBeneficioEdit] = useState<Benefit | null>(null);

  // Cobertura modal state
  const [coberturaModalOpen, setCoberturaModalOpen] = useState(false);
  const [coberturaEdit, setCoberturaEdit] = useState<Cobertura | null>(null);

  // Delete state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<'benefit' | 'coverage'>('benefit');

  const { data: benefits, isLoading: benefitsLoading } = useBenefits();
  const { data: coberturas, isLoading: coberturasLoading } = useCoberturas();
  const { data: plans } = usePlans();
  const deleteBenefit = useDeleteBenefit();
  const deleteCobertura = useDeleteCobertura();
  const updateCobertura = useUpdateCobertura();
  const duplicateBenefit = useDuplicateBenefit();
  const { isDiretor, isDesenvolvedor, isAdminMaster } = usePermissions();
  const canDelete = isDiretor || isDesenvolvedor || isAdminMaster;

  // Fetch benefit-plan associations
  const { data: benefitPlans } = useQuery({
    queryKey: ['benefit-plan-associations'],
    queryFn: async () => {
      const { data } = await supabase
        .from('planos_beneficios')
        .select('benefit_id, plano_id, planos!inner(nome, visivel_gestao)')
        .eq('planos.visivel_gestao', true);
      const map: Record<string, { plano_id: string; nome: string }[]> = {};
      data?.forEach((pb: any) => {
        if (!pb.benefit_id) return;
        if (!map[pb.benefit_id]) map[pb.benefit_id] = [];
        map[pb.benefit_id].push({ plano_id: pb.plano_id, nome: pb.planos?.nome || '' });
      });
      return map;
    },
  });

  const isLoading = benefitsLoading || coberturasLoading;

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-96" /></div>;
  }

  // Filter benefits by plan
  const filteredBenefits = filtroPlano === 'all'
    ? benefits
    : benefits?.filter(b => benefitPlans?.[b.id]?.some(p => p.plano_id === filtroPlano));

  const handleConfirmDelete = () => {
    if (!deleteConfirmId) return;
    if (deleteType === 'benefit') {
      deleteBenefit.mutate(deleteConfirmId);
    } else {
      deleteCobertura.mutate(deleteConfirmId);
    }
    setDeleteConfirmId(null);
  };

  const handleToggleCobertura = async (cob: Cobertura) => {
    await updateCobertura.mutateAsync({
      id: cob.id,
      nome: cob.nome,
      ativo: !cob.ativo,
    });
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="coberturas" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Coberturas ({coberturas?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="beneficios" className="gap-1.5">
            <Gift className="h-3.5 w-3.5" />
            Benefícios ({benefits?.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* ========== ABA COBERTURAS ========== */}
        <TabsContent value="coberturas" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Catálogo global de coberturas. Vincule aos planos em Planos & Preços.
            </p>
            <Button size="sm" onClick={() => { setCoberturaEdit(null); setCoberturaModalOpen(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Nova Cobertura
            </Button>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {coberturas?.map(cob => (
              <div key={cob.id} className="rounded-lg border bg-card p-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {cob.icon && <span className="text-xl">{cob.icon}</span>}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{cob.nome}</p>
                        {cob.codigo && (
                          <Badge variant="outline" className="text-[10px] font-mono">{cob.codigo}</Badge>
                        )}
                      </div>
                      {(cob.subtitle || cob.descricao) && (
                        <p className="text-xs text-muted-foreground mt-0.5">{cob.subtitle || cob.descricao}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={cob.ativo ?? true}
                      onCheckedChange={() => handleToggleCobertura(cob)}
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => { setCoberturaEdit(cob); setCoberturaModalOpen(true); }}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                              onClick={() => { setDeleteType('coverage'); setDeleteConfirmId(cob.id); }}
                              disabled={!canDelete}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {!canDelete && <TooltipContent>Apenas diretores podem excluir coberturas</TooltipContent>}
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>
            ))}
            {(!coberturas || coberturas.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="h-6 w-6 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhuma cobertura cadastrada</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ========== ABA BENEFÍCIOS ========== */}
        <TabsContent value="beneficios" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Select value={filtroPlano} onValueChange={setFiltroPlano}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filtrar por plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os planos</SelectItem>
                {plans?.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => { setBeneficioEdit(null); setBeneficioModalOpen(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Novo Benefício
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Catálogo de benefícios exibidos no app, site e materiais comerciais. Vincule-os aos planos em Planos & Preços.
          </p>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredBenefits?.map(benefit => {
              const linkedPlans = benefitPlans?.[benefit.id] || [];
              return (
                <div key={benefit.id} className="rounded-lg border bg-card p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">{benefit.name}</p>
                      {benefit.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{benefit.description}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => { setBeneficioEdit(benefit); setBeneficioModalOpen(true); }}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Duplicar"
                        onClick={() => duplicateBenefit.mutate(benefit.id)}
                        disabled={duplicateBenefit.isPending}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                                onClick={() => { setDeleteType('benefit'); setDeleteConfirmId(benefit.id); }}
                                disabled={!canDelete}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          {!canDelete && <TooltipContent>Apenas diretores podem excluir benefícios</TooltipContent>}
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                  {benefit.category && (
                    <Badge variant="outline" className="text-xs">{benefit.category}</Badge>
                  )}
                  {linkedPlans.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {linkedPlans.map(p => (
                        <Badge key={p.plano_id} variant="secondary" className="text-xs">
                          {p.nome}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {(!filteredBenefits || filteredBenefits.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                <Gift className="h-6 w-6 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum benefício encontrado</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <BeneficioFormModal
        open={beneficioModalOpen}
        onOpenChange={setBeneficioModalOpen}
        benefit={beneficioEdit}
      />

      <CoberturaUnificadaFormModal
        open={coberturaModalOpen}
        onOpenChange={setCoberturaModalOpen}
        cobertura={coberturaEdit}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteType === 'benefit'
                ? 'Este benefício será removido permanentemente, incluindo todos os vínculos com planos.'
                : 'Esta cobertura será removida permanentemente, incluindo todos os vínculos com planos.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState } from 'react';
import { Gift, Shield, Plus, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { useBenefits, useMainCoverages, usePlans } from '@/hooks/usePlans';
import { useDeleteBenefit, useDeleteMainCoverage } from '@/hooks/usePlansAdmin';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BeneficioFormModal } from '@/components/admin/planos/BeneficioFormModal';
import { CoberturaFormModal } from '@/components/admin/planos/CoberturaFormModal';
import type { Benefit, MainCoverage } from '@/types/plans';

export function BeneficiosCoberturas() {
  const [filtroPlano, setFiltroPlano] = useState<string>('all');

  // Benefit modal state
  const [beneficioModalOpen, setBeneficioModalOpen] = useState(false);
  const [beneficioEdit, setBeneficioEdit] = useState<Benefit | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<'benefit' | 'coverage'>('benefit');

  // Coverage modal state
  const [coberturaModalOpen, setCoberturaModalOpen] = useState(false);
  const [coberturaEdit, setCoberturaEdit] = useState<MainCoverage | null>(null);

  const { data: benefits, isLoading: benefitsLoading } = useBenefits();
  const { data: coverages, isLoading: coveragesLoading } = useMainCoverages();
  const { data: plans } = usePlans();
  const deleteBenefit = useDeleteBenefit();
  const deleteCoverage = useDeleteMainCoverage();

  // Fetch benefit-plan associations
  const { data: benefitPlans } = useQuery({
    queryKey: ['benefit-plan-associations'],
    queryFn: async () => {
      const { data } = await supabase
        .from('planos_beneficios')
        .select('benefit_id, plano_id, planos(nome)');
      const map: Record<string, { plano_id: string; nome: string }[]> = {};
      data?.forEach((pb: any) => {
        if (!pb.benefit_id) return;
        if (!map[pb.benefit_id]) map[pb.benefit_id] = [];
        map[pb.benefit_id].push({ plano_id: pb.plano_id, nome: pb.planos?.nome || '' });
      });
      return map;
    },
  });

  const isLoading = benefitsLoading || coveragesLoading;

  if (isLoading) {
    return <div className="grid grid-cols-2 gap-6"><Skeleton className="h-96" /><Skeleton className="h-96" /></div>;
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
      deleteCoverage.mutate(deleteConfirmId);
    }
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-4">
      {/* Filter by plan */}
      <div className="flex items-center gap-3">
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Benefits column */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Benefícios</h3>
              <Badge variant="secondary" className="text-xs">Marketing & App</Badge>
            </div>
            <Button size="sm" onClick={() => { setBeneficioEdit(null); setBeneficioModalOpen(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Novo
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Itens exibidos no app do associado e materiais comerciais
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => { setBeneficioEdit(benefit); setBeneficioModalOpen(true); }}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => { setDeleteType('benefit'); setDeleteConfirmId(benefit.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
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
        </div>

        {/* Coverages column */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Coberturas Principais</h3>
              <Badge variant="secondary" className="text-xs">Display</Badge>
            </div>
            <Button size="sm" onClick={() => { setCoberturaEdit(null); setCoberturaModalOpen(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Nova
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Coberturas principais exibidas no site e materiais
          </p>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {coverages?.map(cov => (
              <div key={cov.id} className="rounded-lg border bg-card p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">{cov.name}</p>
                    {cov.subtitle && (
                      <p className="text-xs text-muted-foreground mt-0.5">{cov.subtitle}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => { setCoberturaEdit(cov); setCoberturaModalOpen(true); }}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => { setDeleteType('coverage'); setDeleteConfirmId(cov.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {cov.icon && (
                  <Badge variant="outline" className="text-xs mt-2">{cov.icon}</Badge>
                )}
              </div>
            ))}
            {(!coverages || coverages.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="h-6 w-6 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhuma cobertura cadastrada</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <BeneficioFormModal
        open={beneficioModalOpen}
        onOpenChange={setBeneficioModalOpen}
        benefit={beneficioEdit}
      />

      <CoberturaFormModal
        open={coberturaModalOpen}
        onOpenChange={setCoberturaModalOpen}
        coverage={coberturaEdit}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteType === 'benefit'
                ? 'Este benefício será removido permanentemente, incluindo todos os vínculos com planos.'
                : 'Esta cobertura será removida permanentemente.'}
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

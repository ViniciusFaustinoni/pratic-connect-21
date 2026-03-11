import { useState } from 'react';
import { Package, Plus, Edit, DollarSign, Shield, Users, Star, MoreVertical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PlanFormModal } from '@/components/admin/planos/PlanFormModal';
import { usePlans, useProductLines } from '@/hooks/usePlans';
import type { PlanWithDetails } from '@/hooks/usePlans';
import { useTogglePlanStatus } from '@/hooks/usePlansAdmin';

export default function ProdutosGestao() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [produtoEdit, setProdutoEdit] = useState<PlanWithDetails | null>(null);

  const { data: plans, isLoading } = usePlans();
  const { data: lines } = useProductLines();
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

  // Fetch coberturas count per plan
  const { data: coberturasPorPlano } = useQuery({
    queryKey: ['planos-coberturas-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos_coberturas')
        .select('plano_id');
      if (error) throw error;
      const contagem: Record<string, number> = {};
      data?.forEach(pc => {
        contagem[pc.plano_id] = (contagem[pc.plano_id] || 0) + 1;
      });
      return contagem;
    }
  });

  // Fetch price info per plan
  const { data: precosPorPlano } = useQuery({
    queryKey: ['planos-precos-info'],
    queryFn: async () => {
      const { data: mappings } = await supabase.from('plano_preco_map').select('plano_id, linha_slug');
      const { data: precos } = await supabase
        .from('tabelas_preco_mensalidade')
        .select('linha_slug, fipe_min, fipe_max')
        .eq('is_active', true);

      const porLinha: Record<string, { count: number; minFipe: number; maxFipe: number }> = {};
      precos?.forEach(p => {
        const slug = p.linha_slug || '';
        if (!porLinha[slug]) porLinha[slug] = { count: 0, minFipe: Infinity, maxFipe: 0 };
        porLinha[slug].count++;
        porLinha[slug].minFipe = Math.min(porLinha[slug].minFipe, Number(p.fipe_min));
        porLinha[slug].maxFipe = Math.max(porLinha[slug].maxFipe, Number(p.fipe_max));
      });

      const info: Record<string, { count: number; minFipe: number; maxFipe: number }> = {};
      mappings?.forEach(m => {
        if (porLinha[m.linha_slug]) info[m.plano_id] = porLinha[m.linha_slug];
      });
      return info;
    }
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-64" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Gestão de Produtos</h1>
        </div>
        <Button onClick={() => { setProdutoEdit(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Produto
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans?.map(plan => {
          const coberturasCount = coberturasPorPlano?.[plan.id] || 0;
          const precosInfo = precosPorPlano?.[plan.id];
          const associadosCount = associadosCounts?.[plan.id] || 0;

          return (
            <Card key={plan.id} className={`relative ${!plan.ativo ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    {plan.destaque && (
                      <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 mb-1">
                        <Star className="h-3 w-3 mr-1" />
                        Destaque
                      </Badge>
                    )}
                    <p className="text-xs text-muted-foreground">{plan.codigo}</p>
                    <CardTitle className="text-lg">{plan.nome}</CardTitle>
                    <p className="text-xs text-muted-foreground">{plan.product_lines?.name || 'Sem linha'}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setProdutoEdit(plan); setModalOpen(true); }}>
                        <Edit className="h-4 w-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/diretoria/produtos/${plan.id}?tab=precos`)}>
                        <DollarSign className="h-4 w-4 mr-2" /> Preços
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/diretoria/produtos/${plan.id}?tab=coberturas`)}>
                        <Shield className="h-4 w-4 mr-2" /> Coberturas
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  {precosInfo && precosInfo.minFipe !== Infinity && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Faixa FIPE:</span>
                      <span className="font-medium">
                        {formatCurrency(precosInfo.minFipe)} a {formatCurrency(precosInfo.maxFipe)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Shield className="h-3 w-3" /> Coberturas:
                    </span>
                    <span className="font-medium">{coberturasCount} inclusas</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> Faixas de preço:
                    </span>
                    <span className="font-medium">{precosInfo?.count || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" /> Associados:
                    </span>
                    <span className="font-medium">{associadosCount} ativos</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm text-muted-foreground">Ativo</span>
                  <Switch
                    checked={plan.ativo}
                    onCheckedChange={(checked) => toggleStatus.mutate({ id: plan.id, is_active: checked })}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {plans?.length === 0 && (
        <Card className="p-12 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhum produto cadastrado</h3>
          <p className="text-muted-foreground mb-4">Comece criando seu primeiro plano de proteção.</p>
          <Button onClick={() => { setProdutoEdit(null); setModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Novo Produto
          </Button>
        </Card>
      )}

      <PlanFormModal
        open={modalOpen}
        onOpenChange={(open) => { if (!open) setModalOpen(false); }}
        plan={produtoEdit}
      />
    </div>
  );
}
import { Package, Users, DollarSign, Star, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const kpiConfig = [
  { key: 'planos', label: 'Planos ativos', icon: Package, gradient: 'from-blue-500/10 to-blue-600/5', iconColor: 'text-blue-500' },
  { key: 'associados', label: 'Associados', icon: Users, gradient: 'from-emerald-500/10 to-emerald-600/5', iconColor: 'text-emerald-500' },
  { key: 'faixas', label: 'Faixas de preço', icon: DollarSign, gradient: 'from-amber-500/10 to-amber-600/5', iconColor: 'text-amber-500' },
  { key: 'beneficios', label: 'Benefícios', icon: Star, gradient: 'from-purple-500/10 to-purple-600/5', iconColor: 'text-purple-500' },
] as const;

export function PageHeader() {
  const { data: kpis, isLoading } = useQuery({
    queryKey: ['gestao-comercial-kpis'],
    queryFn: async () => {
      const [planosRes, associadosRes, faixasRes, beneficiosRes] = await Promise.all([
        supabase.from('planos').select('id', { count: 'exact', head: true }).eq('ativo', true),
        supabase.from('associados').select('id', { count: 'exact', head: true }).eq('status', 'ativo'),
        supabase.from('tabelas_preco_mensalidade').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('benefits').select('id', { count: 'exact', head: true }).eq('is_active', true),
      ]);
      return {
        planos: planosRes.count ?? 0,
        associados: associadosRes.count ?? 0,
        faixas: faixasRes.count ?? 0,
        beneficios: beneficiosRes.count ?? 0,
      };
    },
    staleTime: 60_000,
  });

  return (
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="h-8 w-1 rounded-full bg-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Gestão Comercial</h1>
        </div>
        <p className="text-sm text-muted-foreground pl-4">
          Produtos, planos, benefícios e regras comerciais
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {kpiConfig.map((kpi) => (
          <div
            key={kpi.key}
            className={cn(
              'flex items-center gap-2.5 rounded-xl border bg-gradient-to-br px-3.5 py-2.5 min-w-[130px]',
              kpi.gradient
            )}
          >
            <kpi.icon className={cn('h-4 w-4 shrink-0', kpi.iconColor)} />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium leading-none">{kpi.label}</p>
              {isLoading ? (
                <Skeleton className="h-5 w-8 mt-0.5" />
              ) : (
                <p className="text-base font-bold text-foreground leading-tight mt-0.5">
                  {(kpis?.[kpi.key] ?? 0).toLocaleString('pt-BR')}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

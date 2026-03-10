import { Package, Users, DollarSign, Star } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const kpiConfig = [
  { key: 'planos', label: 'Planos ativos', icon: Package, color: 'text-blue-400' },
  { key: 'associados', label: 'Associados cobertos', icon: Users, color: 'text-emerald-400' },
  { key: 'faixas', label: 'Faixas de preço', icon: DollarSign, color: 'text-amber-400' },
  { key: 'beneficios', label: 'Benefícios cadastrados', icon: Star, color: 'text-purple-400' },
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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gestão Comercial</h1>
        <p className="text-sm text-muted-foreground">
          Produtos, planos, benefícios, coberturas e tabela de preços em um único lugar
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpiConfig.map((kpi) => (
          <div
            key={kpi.key}
            className="flex items-center gap-3 rounded-xl border bg-card p-4"
          >
            <div className={cn('rounded-lg bg-muted p-2', kpi.color)}>
              <kpi.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              {isLoading ? (
                <Skeleton className="h-6 w-12 mt-0.5" />
              ) : (
                <p className="text-lg font-bold">
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

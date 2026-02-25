import {
  FolderOpen, CalendarDays, Clock, Wrench, Radar, DollarSign,
  TrendingUp, TrendingDown, ArrowRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useKPIAbertos, useKPINovosEsteMes, useKPIAguardandoAcao,
  useKPIEmOficina, useKPIEmRecuperacao, useKPIIndenizacoesPendentes,
  FiltrosGlobais,
} from '@/hooks/useEventosDashboard';
import { usePermissions } from '@/hooks/usePermissions';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

interface KPICardProps {
  titulo: string;
  valor: string | number;
  subtitulo?: string;
  icon: React.ElementType;
  cor: string;
  variacao?: number;
  variacaoInvertida?: boolean;
  loading?: boolean;
  destaque?: boolean;
}

function KPICard({ titulo, valor, subtitulo, icon: Icon, cor, variacao, variacaoInvertida, loading, destaque }: KPICardProps) {
  if (loading) {
    return (
      <Card className={destaque ? 'col-span-2 lg:col-span-1' : ''}>
        <CardContent className="p-5">
          <Skeleton className="h-4 w-20 mb-4" />
          <Skeleton className="h-9 w-14 mb-2" />
          <Skeleton className="h-3 w-24" />
        </CardContent>
      </Card>
    );
  }

  const corMap: Record<string, { icon: string; bg: string; ring: string }> = {
    blue:   { icon: 'text-blue-600',   bg: 'bg-blue-50',   ring: 'ring-blue-100' },
    green:  { icon: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-100' },
    orange: { icon: 'text-orange-600', bg: 'bg-orange-50', ring: 'ring-orange-100' },
    indigo: { icon: 'text-indigo-600', bg: 'bg-indigo-50', ring: 'ring-indigo-100' },
    purple: { icon: 'text-violet-600', bg: 'bg-violet-50', ring: 'ring-violet-100' },
    amber:  { icon: 'text-amber-600',  bg: 'bg-amber-50',  ring: 'ring-amber-100' },
  };
  const c = corMap[cor] || corMap.blue;

  let variacaoColor = '';
  let VarIcon = TrendingUp;
  if (variacao !== undefined) {
    if (variacaoInvertida) {
      variacaoColor = variacao <= 0 ? 'text-emerald-600' : 'text-red-500';
    } else {
      variacaoColor = variacao >= 0 ? 'text-emerald-600' : 'text-red-500';
    }
    VarIcon = variacao >= 0 ? TrendingUp : TrendingDown;
  }

  return (
    <Card className={`group hover:shadow-lg transition-all duration-200 border-border/60 hover:border-border ${destaque ? 'col-span-2 sm:col-span-1' : ''}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2 rounded-lg ${c.bg} ring-1 ${c.ring}`}>
            <Icon className={`h-4 w-4 ${c.icon}`} />
          </div>
          {variacao !== undefined && (
            <span className={`text-xs font-semibold flex items-center gap-0.5 ${variacaoColor}`}>
              <VarIcon className="h-3 w-3" />
              {variacao > 0 ? '+' : ''}{variacao}%
            </span>
          )}
        </div>
        <div className="text-3xl font-bold tracking-tight text-foreground">{valor}</div>
        <div className="mt-1 space-y-0.5">
          <p className="text-xs font-medium text-muted-foreground">{titulo}</p>
          {subtitulo && <p className="text-[11px] text-muted-foreground/70">{subtitulo}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

interface Props {
  filtros: FiltrosGlobais;
}

export default function EventosKPICards({ filtros }: Props) {
  const { isDiretor, isGerencia, isAnalistaEventos } = usePermissions();
  const abertos = useKPIAbertos(filtros);
  const novos = useKPINovosEsteMes(filtros);
  const aguardando = useKPIAguardandoAcao(filtros);
  const oficina = useKPIEmOficina(filtros);
  const recuperacao = useKPIEmRecuperacao(filtros);
  const indenizacoes = useKPIIndenizacoesPendentes(filtros);

  const canSeeValues = isDiretor || isGerencia;

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
      <KPICard titulo="Eventos Abertos" valor={abertos.data ?? 0} icon={FolderOpen} cor="blue" loading={abertos.isLoading} destaque />
      <KPICard
        titulo="Novos este Mês"
        valor={novos.data?.count ?? 0}
        icon={CalendarDays}
        cor="green"
        variacao={novos.data?.variacao}
        variacaoInvertida
        subtitulo="vs mês anterior"
        loading={novos.isLoading}
      />
      <KPICard titulo="Aguardando Ação" valor={aguardando.data ?? 0} icon={Clock} cor="orange" loading={aguardando.isLoading} />
      <KPICard titulo="Em Oficina" valor={oficina.data ?? 0} icon={Wrench} cor="indigo" loading={oficina.isLoading} />
      <KPICard titulo="Em Recuperação" valor={recuperacao.data ?? 0} icon={Radar} cor="purple" loading={recuperacao.isLoading} />
      <KPICard
        titulo="Indenizações Pend."
        valor={indenizacoes.data?.count ?? 0}
        icon={DollarSign}
        cor="amber"
        subtitulo={canSeeValues ? formatCurrency(indenizacoes.data?.valorTotal ?? 0) : undefined}
        loading={indenizacoes.isLoading}
      />
    </div>
  );
}

import {
  FolderOpen, CalendarDays, Clock, Wrench, Radar, DollarSign,
  TrendingUp, TrendingDown,
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
}

function KPICard({ titulo, valor, subtitulo, icon: Icon, cor, variacao, variacaoInvertida, loading }: KPICardProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-8 w-16 mb-1" />
          <Skeleton className="h-3 w-20" />
        </CardContent>
      </Card>
    );
  }

  const corMap: Record<string, string> = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    orange: 'text-orange-600 bg-orange-50',
    indigo: 'text-indigo-600 bg-indigo-50',
    purple: 'text-violet-600 bg-violet-50',
    amber: 'text-amber-600 bg-amber-50',
  };
  const corClasses = corMap[cor] || 'text-gray-600 bg-gray-50';
  const [textCor, bgCor] = corClasses.split(' ');

  let variacaoColor = '';
  let VarIcon = TrendingUp;
  if (variacao !== undefined) {
    if (variacaoInvertida) {
      variacaoColor = variacao <= 0 ? 'text-green-600' : 'text-red-600';
    } else {
      variacaoColor = variacao >= 0 ? 'text-green-600' : 'text-red-600';
    }
    VarIcon = variacao >= 0 ? TrendingUp : TrendingDown;
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{titulo}</span>
          <div className={`p-1.5 rounded-md ${bgCor}`}>
            <Icon className={`h-4 w-4 ${textCor}`} />
          </div>
        </div>
        <div className="text-2xl font-bold tracking-tight">{valor}</div>
        <div className="flex items-center gap-1 mt-1">
          {variacao !== undefined && (
            <span className={`text-xs font-medium flex items-center gap-0.5 ${variacaoColor}`}>
              <VarIcon className="h-3 w-3" />
              {variacao > 0 ? '+' : ''}{variacao}%
            </span>
          )}
          {subtitulo && <span className="text-xs text-muted-foreground">{subtitulo}</span>}
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
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <KPICard titulo="Eventos Abertos" valor={abertos.data ?? 0} icon={FolderOpen} cor="blue" loading={abertos.isLoading} />
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

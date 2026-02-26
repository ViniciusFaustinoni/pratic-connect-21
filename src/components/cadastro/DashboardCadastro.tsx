import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Car,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePropostaStats, usePropostasPendentes } from '@/hooks/usePropostasPendentes';
import { useCadastroPerformance } from '@/hooks/useCadastroPerformance';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// ============================================
// COMPONENTE: KPI Compacto com tendência
// ============================================
interface KPIProps {
  titulo: string;
  valor: number | string;
  borderColor: string;
  textColor: string;
  loading?: boolean;
}

function KPICompact({ titulo, valor, borderColor, textColor, loading }: KPIProps) {
  if (loading) {
    return <Skeleton className="h-20 w-full rounded-lg bg-muted" />;
  }
  return (
    <div className={cn("rounded-lg border-l-4 bg-card border border-border p-4", borderColor)}>
      <p className="text-xs text-muted-foreground font-medium">{titulo}</p>
      <p className={cn("text-2xl font-bold mt-1", textColor)}>{valor}</p>
    </div>
  );
}

// ============================================
// BANNER COMPACTO
// ============================================
function CompactBanner({ nome, aguardando }: { nome: string; aguardando: number }) {
  const getSaudacao = () => {
    const hora = new Date().getHours();
    if (hora < 12) return 'Bom dia';
    if (hora < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4">
      <div>
        <p className="text-sm text-muted-foreground">
          {getSaudacao()}, <span className="font-semibold text-foreground">{nome}</span>
        </p>
        {aguardando > 0 ? (
          <p className="text-sm text-muted-foreground mt-0.5">
            Você tem <span className="font-semibold text-warning">{aguardando} proposta(s)</span> aguardando análise
          </p>
        ) : (
          <p className="text-sm text-success mt-0.5 font-medium">Sua fila está vazia! 🎉</p>
        )}
      </div>
      <Badge className="bg-primary/10 text-primary border-primary/30 text-xs">
        Analista de Cadastro
      </Badge>
    </div>
  );
}

// ============================================
// MINI PIPELINE VISUAL
// ============================================
function PipelineVisual({ stats, loading }: { stats: any; loading: boolean }) {
  if (loading) return <Skeleton className="h-8 w-full rounded-full bg-muted" />;

  const aguardando = stats?.aguardando || 0;
  const emAnalise = stats?.emAnalise || 0;
  const aprovados = stats?.aprovadosHoje || 0;
  const reprovados = stats?.reprovadosHoje || 0;
  const total = aguardando + emAnalise + aprovados + reprovados;

  if (total === 0) return null;

  const segments = [
    { label: 'Aguardando', value: aguardando, color: 'bg-warning', textColor: 'text-warning' },
    { label: 'Em Análise', value: emAnalise, color: 'bg-info', textColor: 'text-info' },
    { label: 'Aprovados', value: aprovados, color: 'bg-success', textColor: 'text-success' },
    { label: 'Reprovados', value: reprovados, color: 'bg-destructive', textColor: 'text-destructive' },
  ].filter(s => s.value > 0);

  return (
    <div className="space-y-2">
      <div className="flex rounded-full overflow-hidden h-3 bg-muted">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={cn("h-full transition-all", seg.color)}
            style={{ width: `${(seg.value / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex gap-4 flex-wrap">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5">
            <div className={cn("w-2.5 h-2.5 rounded-full", seg.color)} />
            <span className="text-xs text-muted-foreground">
              {seg.label}: <span className={cn("font-semibold", seg.textColor)}>{seg.value}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// FILA DE TRABALHO (KANBAN CARDS)
// ============================================
function FilaTrabalho() {
  const navigate = useNavigate();
  const { data: propostas, isLoading } = usePropostasPendentes();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full bg-muted rounded-lg" />)}
      </div>
    );
  }

  const pendentes = propostas?.slice(0, 6) || [];

  if (pendentes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CheckCircle className="h-10 w-10 mx-auto mb-2 text-success" />
        <p className="text-sm font-medium">Fila vazia</p>
      </div>
    );
  }

  // Color based on waiting time
  const getWaitColor = (date: string | null) => {
    if (!date) return 'border-l-border';
    const hours = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60);
    if (hours > 48) return 'border-l-destructive';
    if (hours > 24) return 'border-l-warning';
    return 'border-l-success';
  };

  return (
    <div className="space-y-2">
      {pendentes.map((proposta) => (
        <div
          key={proposta.id}
          className={cn(
            "flex items-center gap-3 p-3 rounded-lg bg-card border border-border hover:border-border-hover transition-all cursor-pointer border-l-4",
            getWaitColor(proposta.data_assinatura)
          )}
          onClick={() => navigate(`/cadastro/propostas/${proposta.id}`)}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {proposta.cliente_nome || 'Sem nome'}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Car className="h-3 w-3" />
              <span className="font-mono">{proposta.veiculo_placa || '---'}</span>
              <span className="text-border">•</span>
              <span>{proposta.veiculo_modelo || '---'}</span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <span className="text-[10px] text-muted-foreground">
              {proposta.data_assinatura
                ? formatDistanceToNow(new Date(proposta.data_assinatura), { locale: ptBR, addSuffix: true })
                : '---'}
            </span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </div>
      ))}
      
      {(propostas?.length || 0) > 6 && (
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={() => navigate('/cadastro/propostas')}
        >
          Ver todas as {propostas?.length} propostas
          <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

// ============================================
// GRÁFICO COMPACTO
// ============================================
function PerformanceChartCompact() {
  const [periodo, setPeriodo] = useState<'7d' | '30d'>('7d');
  const { data, isLoading } = useCadastroPerformance();

  if (isLoading) return <Skeleton className="h-[180px] w-full bg-muted" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4 text-primary" />
          Performance
        </h3>
        <div className="flex gap-1 bg-muted rounded-md p-0.5">
          <button
            className={cn("px-2.5 py-1 text-xs rounded-md transition-colors",
              periodo === '7d' ? 'bg-card shadow-sm text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setPeriodo('7d')}
          >
            7d
          </button>
          <button
            className={cn("px-2.5 py-1 text-xs rounded-md transition-colors",
              periodo === '30d' ? 'bg-card shadow-sm text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setPeriodo('30d')}
          >
            30d
          </button>
        </div>
      </div>
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data || []}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="dia" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Bar dataKey="aprovados" fill="hsl(var(--success))" name="Aprovadas" radius={[3, 3, 0, 0]} />
            <Bar dataKey="reprovados" fill="hsl(var(--destructive))" name="Reprovadas" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ============================================
// DASHBOARD PRINCIPAL
// ============================================
export function DashboardCadastro() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: stats, isLoading: statsLoading } = usePropostaStats();

  const aprovadosHoje = stats?.aprovadosHoje || 0;
  const reprovadosHoje = stats?.reprovadosHoje || 0;
  const totalHoje = aprovadosHoje + reprovadosHoje;
  const taxaAprovacao = totalHoje > 0 ? Math.round((aprovadosHoje / totalHoje) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Banner Compacto */}
      <CompactBanner
        nome={profile?.nome?.split(' ')[0] || 'Analista'}
        aguardando={stats?.aguardando || 0}
      />

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KPICompact titulo="Aguardando" valor={stats?.aguardando || 0} borderColor="border-l-warning" textColor="text-warning" loading={statsLoading} />
        <KPICompact titulo="Aprovadas Hoje" valor={aprovadosHoje} borderColor="border-l-success" textColor="text-success" loading={statsLoading} />
        <KPICompact titulo="Reprovadas Hoje" valor={reprovadosHoje} borderColor="border-l-destructive" textColor="text-destructive" loading={statsLoading} />
        <KPICompact titulo="Taxa Aprovação" valor={`${taxaAprovacao}%`} borderColor="border-l-primary" textColor="text-primary" loading={statsLoading} />
      </div>

      {/* Pipeline Visual */}
      <PipelineVisual stats={stats} loading={statsLoading} />

      {/* Conteúdo em 2 colunas */}
      <div className="grid gap-5 lg:grid-cols-5">
        {/* Fila de trabalho - 3 colunas */}
        <Card className="lg:col-span-3 border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                <Clock className="h-4 w-4 text-warning" />
                Fila de Trabalho
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground h-7"
                onClick={() => navigate('/cadastro/propostas')}
              >
                Ver Todas <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <FilaTrabalho />
          </CardContent>
        </Card>

        {/* Gráfico - 2 colunas */}
        <Card className="lg:col-span-2 border-border">
          <CardContent className="p-4">
            <PerformanceChartCompact />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

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
  Car,
  ChevronRight,
  BarChart3,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePropostaStats, usePropostasPendentes } from '@/hooks/usePropostasPendentes';
import { useCadastroPerformance } from '@/hooks/useCadastroPerformance';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/UserAvatar';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ============================================
// KPI Card com ícone grande e animação
// ============================================
interface KPIProps {
  titulo: string;
  valor: number | string;
  icon: React.ReactNode;
  bgColor: string;
  textColor: string;
  loading?: boolean;
  pulse?: boolean;
}

function KPICard({ titulo, valor, icon, bgColor, textColor, loading, pulse }: KPIProps) {
  if (loading) {
    return <Skeleton className="h-24 w-full rounded-xl bg-muted" />;
  }
  return (
    <div className={cn(
      "relative rounded-xl border border-border bg-card p-4 overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5",
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">{titulo}</p>
          <p className={cn("text-3xl font-bold tracking-tight", textColor)}>{valor}</p>
        </div>
        <div className={cn(
          "rounded-xl p-2.5 transition-transform",
          bgColor,
          pulse && "animate-pulse"
        )}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ============================================
// BANNER com avatar e gradiente
// ============================================
function WelcomeBanner({ nome, aguardando }: { nome: string; aguardando: number }) {
  const getSaudacao = () => {
    const hora = new Date().getHours();
    if (hora < 12) return 'Bom dia';
    if (hora < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  return (
    <div className="relative rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-5 overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-8 translate-x-8" />
      <div className="absolute bottom-0 left-1/2 w-24 h-24 bg-primary/3 rounded-full translate-y-12" />
      <div className="relative flex items-center gap-4">
        <UserAvatar name={nome} size="lg" className="ring-2 ring-primary/20" />
        <div className="flex-1">
          <p className="text-lg font-semibold text-foreground">
            {getSaudacao()}, {nome}!
          </p>
          {aguardando > 0 ? (
            <p className="text-sm text-muted-foreground mt-0.5">
              Você tem <span className="font-bold text-warning">{aguardando}</span> proposta{aguardando !== 1 ? 's' : ''} aguardando sua análise
            </p>
          ) : (
            <p className="text-sm text-success mt-0.5 font-medium flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Sua fila está vazia! Parabéns!
            </p>
          )}
        </div>
        <Badge className="bg-primary/10 text-primary border-primary/30 text-xs hidden sm:flex">
          Analista de Cadastro
        </Badge>
      </div>
    </div>
  );
}

// ============================================
// PIPELINE FUNIL VISUAL
// ============================================
function PipelineFunnel({ stats, loading }: { stats: any; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-2">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-xl bg-muted" />)}
      </div>
    );
  }

  const stages = [
    { label: 'Aguardando', value: stats?.aguardando || 0, icon: <Clock className="h-4 w-4" />, bgColor: 'bg-warning/10', textColor: 'text-warning', borderColor: 'border-warning/30' },
    { label: 'Em Análise', value: stats?.emAnalise || 0, icon: <FileText className="h-4 w-4" />, bgColor: 'bg-info/10', textColor: 'text-info', borderColor: 'border-info/30' },
    { label: 'Aprovados', value: stats?.aprovadosHoje || 0, icon: <CheckCircle className="h-4 w-4" />, bgColor: 'bg-success/10', textColor: 'text-success', borderColor: 'border-success/30' },
    { label: 'Reprovados', value: stats?.reprovadosHoje || 0, icon: <XCircle className="h-4 w-4" />, bgColor: 'bg-destructive/10', textColor: 'text-destructive', borderColor: 'border-destructive/30' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {stages.map((stage, idx) => (
        <div key={stage.label} className="relative flex items-center">
          <div className={cn(
            "flex-1 rounded-xl border p-3 text-center transition-all hover:shadow-sm",
            stage.bgColor, stage.borderColor
          )}>
            <div className={cn("flex justify-center mb-1", stage.textColor)}>
              {stage.icon}
            </div>
            <p className={cn("text-xl font-bold", stage.textColor)}>{stage.value}</p>
            <p className="text-[10px] text-muted-foreground font-medium">{stage.label}</p>
          </div>
          {idx < stages.length - 1 && (
            <ChevronRight className="h-4 w-4 text-muted-foreground/30 -mr-1 hidden sm:block flex-shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================
// FILA DE TRABALHO com prioridade visual
// ============================================
function FilaTrabalho() {
  const navigate = useNavigate();
  const { data: propostas, isLoading } = usePropostasPendentes();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full bg-muted rounded-xl" />)}
      </div>
    );
  }

  const pendentes = propostas?.slice(0, 6) || [];

  if (pendentes.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3">
          <CheckCircle className="h-7 w-7 text-success" />
        </div>
        <p className="text-sm font-semibold text-foreground">Fila vazia!</p>
        <p className="text-xs mt-1">Todas as propostas foram analisadas</p>
      </div>
    );
  }

  const getWaitInfo = (date: string | null) => {
    if (!date) return { border: 'border-l-border', dot: 'bg-muted-foreground', pulse: false };
    const hours = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60);
    if (hours > 48) return { border: 'border-l-destructive', dot: 'bg-destructive', pulse: true };
    if (hours > 24) return { border: 'border-l-warning', dot: 'bg-warning', pulse: false };
    return { border: 'border-l-success', dot: 'bg-success', pulse: false };
  };

  return (
    <div className="space-y-1.5">
      {pendentes.map((proposta) => {
        const wait = getWaitInfo(proposta.data_assinatura);
        return (
          <div
            key={proposta.id}
            className={cn(
              "group flex items-center gap-3 p-3 rounded-xl bg-card border border-border transition-all cursor-pointer border-l-4",
              "hover:bg-accent/50 hover:shadow-sm hover:translate-x-1",
              wait.border
            )}
            onClick={() => navigate(`/cadastro/propostas/${proposta.id}`)}
          >
            {/* Priority dot */}
            <div className="relative flex-shrink-0">
              <span className={cn("block w-2.5 h-2.5 rounded-full", wait.dot)} />
              {wait.pulse && (
                <span className={cn("absolute inset-0 rounded-full animate-ping opacity-75", wait.dot)} />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {proposta.cliente_nome || 'Sem nome'}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Car className="h-3 w-3" />
                <span className="font-mono font-semibold text-foreground/80">{proposta.veiculo_placa || '---'}</span>
                <span className="text-border">•</span>
                <span className="truncate">{proposta.veiculo_modelo || '---'}</span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <span className="text-[10px] text-muted-foreground">
                {proposta.data_assinatura
                  ? formatDistanceToNow(new Date(proposta.data_assinatura), { locale: ptBR, addSuffix: true })
                  : '---'}
              </span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>
        );
      })}
      
      {(propostas?.length || 0) > 6 && (
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs mt-2 rounded-xl"
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
// GRÁFICO COM TOOLTIP MELHORADO
// ============================================
function PerformanceChart() {
  const [periodo, setPeriodo] = useState<'7d' | '30d'>('7d');
  const { data, isLoading } = useCadastroPerformance();

  if (isLoading) return <Skeleton className="h-[200px] w-full bg-muted rounded-xl" />;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;
    return (
      <div className="bg-popover border border-border rounded-xl shadow-lg p-3 text-xs">
        <p className="font-semibold text-foreground mb-1.5">{label}</p>
        {payload.map((entry: any) => (
          <div key={entry.name} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-bold text-foreground">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <BarChart3 className="h-4 w-4 text-primary" />
          Performance
        </h3>
        <div className="flex gap-0.5 bg-muted rounded-lg p-0.5">
          {(['7d', '30d'] as const).map(p => (
            <button
              key={p}
              className={cn("px-3 py-1.5 text-xs rounded-md transition-all",
                periodo === p ? 'bg-card shadow-sm text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setPeriodo(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data || []} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis dataKey="dia" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} allowDecimals={false} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="aprovados" fill="hsl(var(--success))" name="Aprovadas" radius={[4, 4, 0, 0]} />
            <Bar dataKey="reprovados" fill="hsl(var(--destructive))" name="Reprovadas" radius={[4, 4, 0, 0]} />
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
    <div className="space-y-5 animate-fade-in">
      {/* Banner */}
      <WelcomeBanner
        nome={profile?.nome?.split(' ')[0] || 'Analista'}
        aguardando={stats?.aguardando || 0}
      />

      {/* Pipeline Funil */}
      <PipelineFunnel stats={stats} loading={statsLoading} />

      {/* Conteúdo em 2 colunas */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Fila de trabalho */}
        <Card className="lg:col-span-3 border-border rounded-xl">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <div className="p-1.5 rounded-lg bg-warning/10">
                  <Clock className="h-4 w-4 text-warning" />
                </div>
                Fila de Trabalho
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground h-7 hover:text-primary"
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

        {/* Gráfico */}
        <Card className="lg:col-span-2 border-border rounded-xl">
          <CardContent className="p-4">
            <PerformanceChart />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

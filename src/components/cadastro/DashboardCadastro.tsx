import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  Shield,
  Users,
  TrendingUp,
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
// COMPONENTE: CARD DE KPI
// ============================================
interface KPICardProps {
  titulo: string;
  valor: number | string;
  icon: React.ReactNode;
  cor: string;
  loading?: boolean;
}

function KPICard({ titulo, valor, icon, cor, loading }: KPICardProps) {
  if (loading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-24 bg-muted" />
              <Skeleton className="h-8 w-16 bg-muted" />
            </div>
            <Skeleton className="h-10 w-10 rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card hover:border-border-hover transition-all duration-200">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{titulo}</p>
            <p className="text-3xl font-bold text-foreground">{valor}</p>
          </div>
          <div className={cn("p-3 rounded-lg", cor)}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// COMPONENTE: BANNER DE BOAS-VINDAS
// ============================================
interface WelcomeBannerProps {
  nome: string;
}

function WelcomeBanner({ nome }: WelcomeBannerProps) {
  const getSaudacao = () => {
    const hora = new Date().getHours();
    if (hora < 12) return 'Bom dia';
    if (hora < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border-hover bg-gradient-to-r from-purple-900 via-violet-800 to-purple-900 p-6">
      {/* Glow effect */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-purple-400/10 rounded-full blur-3xl" />
      
      {/* Decorative icon */}
      <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-10">
        <FileText className="h-32 w-32 text-white" />
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <Badge className="bg-purple-500/30 text-purple-200 border-purple-400/30">
            Analista de Cadastro
          </Badge>
        </div>
        <h1 className="text-2xl font-bold text-white">
          {getSaudacao()}, {nome}! 👋
        </h1>
        <p className="text-white/80 mt-1">
          Gerencie propostas e associados da sua fila de trabalho.
        </p>
      </div>
    </div>
  );
}

// ============================================
// COMPONENTE: GRÁFICO DE PERFORMANCE SEMANAL
// ============================================
function PerformanceChart() {
  const { data, isLoading } = useCadastroPerformance();

  if (isLoading) {
    return (
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Performance Semanal</CardTitle>
          <CardDescription>Propostas analisadas nos últimos 7 dias</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full bg-muted" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              Performance Semanal
            </CardTitle>
            <CardDescription>
              Propostas analisadas nos últimos 7 dias
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data || []}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="dia" 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              />
              <YAxis 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                allowDecimals={false}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />
              <Bar 
                dataKey="aprovados" 
                fill="#22c55e" 
                name="Aprovadas" 
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="reprovados" 
                fill="#ef4444" 
                name="Reprovadas" 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// COMPONENTE: LISTA DE PROPOSTAS AGUARDANDO
// ============================================
function PropostasAguardando() {
  const navigate = useNavigate();
  const { data: propostas, isLoading } = usePropostasPendentes();

  if (isLoading) {
    return (
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Propostas Aguardando Análise</CardTitle>
          <CardDescription>Propostas prontas para sua análise</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 w-full bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const pendentes = propostas?.slice(0, 5) || [];

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Clock className="h-5 w-5 text-warning" />
              Propostas Aguardando
            </CardTitle>
            <CardDescription>
              {pendentes.length > 0 
                ? `${propostas?.length || 0} propostas prontas para análise`
                : 'Nenhuma proposta pendente'}
            </CardDescription>
          </div>
          <Button 
            variant="outline"
            size="sm"
            className="border-border hover:border-border-hover"
            onClick={() => navigate('/cadastro/propostas')}
          >
            Ver Todas <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {pendentes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 text-success" />
            <p>Parabéns! Sua fila está vazia.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendentes.map((proposta) => (
              <div 
                key={proposta.id}
                className="flex items-center justify-between p-3 rounded-lg bg-card-hover border border-border hover:border-border-hover transition-colors cursor-pointer"
                onClick={() => navigate(`/cadastro/propostas/${proposta.id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <FileText className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {proposta.cliente_nome || 'Sem nome'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {proposta.veiculo_placa || 'Sem placa'} • {proposta.veiculo_modelo || 'Sem modelo'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    há {formatDistanceToNow(new Date(proposta.data_assinatura || proposta.id), { locale: ptBR })}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}

        {pendentes.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <Button 
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => {
                const primeiro = pendentes[0];
                if (primeiro) navigate(`/cadastro/propostas/${primeiro.id}`);
              }}
            >
              <FileText className="mr-2 h-4 w-4" />
              Analisar Próxima Proposta
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// COMPONENTE PRINCIPAL: DASHBOARD CADASTRO
// ============================================
export function DashboardCadastro() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const { data: stats, isLoading: statsLoading } = usePropostaStats();

  // Calcular taxa de aprovação
  const aprovadosHoje = stats?.aprovadosHoje || 0;
  const reprovadosHoje = stats?.reprovadosHoje || 0;
  const totalHoje = aprovadosHoje + reprovadosHoje;
  const taxaAprovacao = totalHoje > 0 ? Math.round((aprovadosHoje / totalHoje) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* BANNER */}
      <WelcomeBanner nome={profile?.nome?.split(' ')[0] || 'Analista'} />

      {/* KPIs - Grid de 4 baseados em PROPOSTAS */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          titulo="Aguardando Análise"
          valor={stats?.aguardando || 0}
          icon={<Clock className="h-5 w-5 text-white" />}
          cor="bg-warning"
          loading={statsLoading}
        />
        <KPICard
          titulo="Aprovadas Hoje"
          valor={aprovadosHoje}
          icon={<CheckCircle className="h-5 w-5 text-white" />}
          cor="bg-success"
          loading={statsLoading}
        />
        <KPICard
          titulo="Reprovadas Hoje"
          valor={reprovadosHoje}
          icon={<XCircle className="h-5 w-5 text-white" />}
          cor="bg-destructive"
          loading={statsLoading}
        />
        <KPICard
          titulo="Taxa de Aprovação"
          valor={`${taxaAprovacao}%`}
          icon={<Shield className="h-5 w-5 text-white" />}
          cor="bg-purple-600"
          loading={statsLoading}
        />
      </div>

      {/* GRÁFICO DE PERFORMANCE */}
      <PerformanceChart />

      {/* CONTEÚDO PRINCIPAL */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Propostas Aguardando */}
        <PropostasAguardando />

        {/* Ações Rápidas - SIMPLIFICADAS */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Ações Rápidas</CardTitle>
            <CardDescription>Acesso direto às principais funcionalidades</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full justify-start h-auto py-4 border-border hover:border-purple-500 hover:bg-purple-500/10"
              onClick={() => navigate('/cadastro/propostas')}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <CheckCircle className="h-5 w-5 text-purple-500" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-foreground">Propostas Pendentes</p>
                  <p className="text-sm text-muted-foreground">Analisar contratos assinados</p>
                </div>
              </div>
            </Button>

            <Button 
              variant="outline" 
              className="w-full justify-start h-auto py-4 border-border hover:border-purple-500 hover:bg-purple-500/10"
              onClick={() => navigate('/cadastro/associados')}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Users className="h-5 w-5 text-purple-500" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-foreground">Associados</p>
                  <p className="text-sm text-muted-foreground">Consultar e editar cadastros</p>
                </div>
              </div>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

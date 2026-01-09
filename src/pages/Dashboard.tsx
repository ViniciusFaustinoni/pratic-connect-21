import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  UserPlus,
  FileText,
  Calculator,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Phone,
  MessageSquare,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  DollarSign,
  Car,
  Calendar,
  CheckCircle,
  Wrench,
  Plus,
  Shield,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLeads } from '@/hooks/useLeads';
import { useCotacoes } from '@/hooks/useCotacoes';
import { useContratos } from '@/hooks/useContratos';
import { usePendingDocumentos, useDocumentosContagem } from '@/hooks/useDocumentos';
import { useInstalacoesDoDia, useInstalacoesMetricas } from '@/hooks/useInstalacoes';
import { FollowupWidget } from '@/components/vendas/FollowupWidget';

import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// ============================================
// CONFIGURAÇÕES E MAPEAMENTOS
// ============================================
const etapaConfig: Record<string, { label: string; cor: string }> = {
  novo: { label: 'Novo', cor: 'bg-info' },
  contato_inicial: { label: 'Contato', cor: 'bg-warning' },
  apresentacao: { label: 'Apresentação', cor: 'bg-purple-500' },
  cotacao_enviada: { label: 'Cotação', cor: 'bg-primary' },
  negociacao: { label: 'Negociação', cor: 'bg-pink-500' },
  contrato_enviado: { label: 'Contrato Env.', cor: 'bg-indigo-500' },
  ganho: { label: 'Ganho', cor: 'bg-success' },
  perdido: { label: 'Perdido', cor: 'bg-destructive' },
};

const statusInstalacaoLabels: Record<string, string> = {
  agendada: 'Agendada',
  em_rota: 'Em Rota',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  reagendada: 'Reagendada',
};

// ============================================
// COMPONENTE: BADGE DE ETAPA
// ============================================
function BadgeEtapa({ etapa }: { etapa: string }) {
  const config = etapaConfig[etapa] || { label: etapa, cor: 'bg-muted' };
  return (
    <Badge className={cn(config.cor, 'text-white border-0')}>
      {config.label}
    </Badge>
  );
}

// ============================================
// COMPONENTE: CARD DE KPI PREMIUM
// ============================================
interface KPICardProps {
  titulo: string;
  valor: number | string;
  variacao?: number;
  emoji: string;
  loading?: boolean;
}

function KPICard({ titulo, valor, variacao, emoji, loading }: KPICardProps) {
  if (loading) {
    return (
      <Card className="border-border bg-card hover:border-border-hover transition-all duration-200">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-24 bg-muted" />
              <Skeleton className="h-8 w-16 bg-muted" />
            </div>
            <Skeleton className="h-8 w-8 rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card hover:border-border-hover transition-all duration-200 group">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{emoji}</span>
              {variacao !== undefined && (
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs border-0",
                    variacao > 0 && "bg-success/20 text-success",
                    variacao < 0 && "bg-destructive/20 text-destructive",
                    variacao === 0 && "bg-muted text-muted-foreground"
                  )}
                >
                  {variacao > 0 ? (
                    <><TrendingUp className="h-3 w-3 mr-1" />+{variacao}%</>
                  ) : variacao < 0 ? (
                    <><TrendingDown className="h-3 w-3 mr-1" />{variacao}%</>
                  ) : (
                    <><Minus className="h-3 w-3 mr-1" />0%</>
                  )}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{titulo}</p>
            <p className="text-2xl font-bold text-foreground">{valor}</p>
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
  onRefresh?: () => void;
  lastUpdate?: Date;
}

function WelcomeBanner({ nome, onRefresh, lastUpdate }: WelcomeBannerProps) {
  const getSaudacao = () => {
    const hora = new Date().getHours();
    if (hora < 12) return 'Bom dia';
    if (hora < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border-hover bg-gradient-to-r from-primary-dark via-pratic-dark-700 to-primary-dark p-6">
      {/* Glow effect */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full blur-3xl animate-glow-pulse" />
      
      {/* Decorative shield */}
      <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-10">
        <Shield className="h-32 w-32 text-foreground" />
      </div>
      
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {getSaudacao()}, {nome}! 👋
          </h1>
          <p className="text-white/80 mt-1">
            Aqui está o resumo das atividades de hoje.
          </p>
        </div>
        
        {/* Botão Atualizar integrado */}
        {onRefresh && (
          <div className="flex items-center gap-2 shrink-0">
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/30"
              onClick={onRefresh}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
            {lastUpdate && (
              <span className="text-sm text-white/60">
                {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// COMPONENTE: BARRA DE ALERTAS
// ============================================
interface Alerta {
  id: string;
  tipo: 'urgente' | 'atencao' | 'info';
  titulo: string;
  descricao: string;
  acao: string;
}

function AlertaBanner({ alertas }: { alertas: Alerta[] }) {
  const navigate = useNavigate();
  
  if (!alertas || alertas.length === 0) return null;

  return (
    <div className="space-y-2">
      {alertas.slice(0, 3).map((alerta) => {
        const bgColor = alerta.tipo === 'urgente' 
          ? 'border-destructive/50 bg-destructive/10' 
          : alerta.tipo === 'atencao' 
          ? 'border-warning/50 bg-warning/10' 
          : 'border-primary/50 bg-primary/10';
        
        const iconColor = alerta.tipo === 'urgente' 
          ? 'text-destructive' 
          : alerta.tipo === 'atencao' 
          ? 'text-warning' 
          : 'text-primary';

        return (
          <Alert key={alerta.id} className={cn(bgColor, "border")}>
            <AlertTriangle className={cn('h-4 w-4', iconColor)} />
            <AlertDescription className="flex items-center justify-between">
              <div>
                <span className="font-medium text-foreground">{alerta.titulo}</span>
                <span className="text-muted-foreground ml-2">{alerta.descricao}</span>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-foreground hover:bg-card-hover"
                onClick={() => navigate(alerta.acao)}
              >
                Ver <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
}

// ============================================
// COMPONENTE: FUNIL DE VENDAS
// ============================================
interface FunilItem {
  etapa: string;
  count: number;
}

function FunilVendas({ dados, loading }: { dados: FunilItem[]; loading: boolean }) {
  const navigate = useNavigate();
  const totalLeads = dados.reduce((acc, item) => acc + item.count, 0);
  const taxaConversao = totalLeads > 0 
    ? Math.round((dados.find(d => d.etapa === 'ganho')?.count || 0) / totalLeads * 100) 
    : 0;

  if (loading) {
    return (
      <Card className="border-border bg-card">
        <CardHeader>
          <Skeleton className="h-6 w-40 bg-muted" />
          <Skeleton className="h-4 w-60 bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24 bg-muted" />
                <Skeleton className="h-2 w-full bg-muted" />
              </div>
            ))}
          </div>
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
              <TrendingUp className="h-5 w-5 text-primary" />
              Funil de Vendas
            </CardTitle>
            <CardDescription>Distribuição de leads por etapa</CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="border-border hover:border-border-hover hover:bg-card-hover"
            onClick={() => navigate('/vendas/kanban')}
          >
            Ver Kanban <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {dados.filter(item => item.etapa !== 'perdido').map((item) => {
            const config = etapaConfig[item.etapa] || { label: item.etapa, cor: 'bg-muted' };
            const percentual = totalLeads > 0 ? Math.round((item.count / totalLeads) * 100) : 0;
            
            return (
              <div key={item.etapa} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{config.label}</span>
                  <span className="font-medium text-foreground">{item.count}</span>
                </div>
                <Progress 
                  value={percentual} 
                  className="h-2 bg-muted" 
                  indicatorClassName={config.cor}
                />
              </div>
            );
          })}
        </div>
        
        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total de leads: {totalLeads}</span>
          <Badge variant="outline" className="text-success border-success">
            Taxa de conversão: {taxaConversao}%
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// COMPONENTE: AÇÕES RÁPIDAS
// ============================================
function QuickActions() {
  const navigate = useNavigate();
  
  const actions = [
    { 
      label: 'Nova Cotação', 
      emoji: '📊', 
      url: '/vendas/cotador',
      primary: true 
    },
    { 
      label: 'Novo Lead', 
      emoji: '👤', 
      url: '/vendas/leads?novo=true',
      primary: false 
    },
    { 
      label: 'Agendar', 
      emoji: '🔧', 
      url: '/monitoramento/instalacoes?agendar=true',
      primary: false 
    },
    { 
      label: 'Documentos', 
      emoji: '📄', 
      url: '/cadastro/documentos',
      primary: false 
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {actions.map((action) => (
        <Button
          key={action.label}
          variant="outline"
          className={cn(
            "h-auto py-4 flex flex-col gap-2 transition-all duration-200 hover:scale-105",
            action.primary 
              ? "bg-gradient-to-r from-accent to-accent-hover border-accent text-white hover:shadow-[0_0_20px_hsl(351,84%,49%,0.3)]" 
              : "bg-gradient-to-r from-primary-dark to-primary border-primary text-white hover:shadow-[0_0_20px_hsl(218,67%,36%,0.3)]"
          )}
          onClick={() => navigate(action.url)}
        >
          <span className="text-2xl">{action.emoji}</span>
          <span className="text-sm font-medium">{action.label}</span>
        </Button>
      ))}
    </div>
  );
}

// ============================================
// COMPONENTE PRINCIPAL: DASHBOARD
// ============================================
export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Queries de dados
  const { data: leadsData, isLoading: leadsLoading } = useLeads({ page: 1, perPage: 100 });
  const { data: cotacoes, isLoading: cotacoesLoading } = useCotacoes();
  const { data: contratos, isLoading: contratosLoading } = useContratos();
  const { data: pendingDocs, isLoading: docsLoading } = usePendingDocumentos();
  const { data: docsContagem } = useDocumentosContagem();
  const { data: instalacoesDia, isLoading: instalacoesLoading } = useInstalacoesDoDia();
  const { data: instMetricas } = useInstalacoesMetricas();

  const isLoading = leadsLoading || cotacoesLoading || contratosLoading;
  const leads = leadsData?.leads || [];

  // Função de atualização
  const handleRefresh = () => {
    queryClient.invalidateQueries();
    setLastUpdate(new Date());
  };

  // Calcular dados do funil
  const funnelData: FunilItem[] = [
    { etapa: 'novo', count: leads.filter(l => l.etapa === 'novo').length },
    { etapa: 'contato_inicial', count: leads.filter(l => l.etapa === 'contato_inicial').length },
    { etapa: 'apresentacao', count: leads.filter(l => l.etapa === 'apresentacao').length },
    { etapa: 'cotacao_enviada', count: leads.filter(l => l.etapa === 'cotacao_enviada').length },
    { etapa: 'negociacao', count: leads.filter(l => l.etapa === 'negociacao').length },
    { etapa: 'contrato_enviado', count: leads.filter(l => l.etapa === 'contrato_enviado').length },
    { etapa: 'ganho', count: leads.filter(l => l.etapa === 'ganho').length },
    { etapa: 'perdido', count: leads.filter(l => l.etapa === 'perdido').length },
  ];

  // Calcular alertas
  const alertas: Alerta[] = [];
  
  if ((docsContagem?.pendente || 0) > 5) {
    alertas.push({
      id: 'docs',
      tipo: 'atencao',
      titulo: `${docsContagem?.pendente} documentos aguardando`,
      descricao: 'Documentos precisam ser analisados',
      acao: '/cadastro/documentos',
    });
  }
  
  if ((instMetricas?.reagendadas || 0) > 0) {
    alertas.push({
      id: 'reagendadas',
      tipo: 'info',
      titulo: `${instMetricas?.reagendadas} instalações reagendadas`,
      descricao: 'Verificar disponibilidade',
      acao: '/monitoramento/instalacoes',
    });
  }

  // Formatar tempo
  const formatTime = (dateStr: string) => {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: false, locale: ptBR });
  };

  return (
    <div className="space-y-6">
      {/* BANNER */}
      <WelcomeBanner 
        nome={profile?.nome?.split(' ')[0] || 'Usuário'} 
        onRefresh={handleRefresh}
        lastUpdate={lastUpdate}
      />

      {/* ALERTAS */}
      <AlertaBanner alertas={alertas} />

      {/* KPIs - Grid de 4 */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          titulo="Associados Ativos"
          valor={contratos?.filter(c => c.status === 'ativo').length || 0}
          emoji="👥"
          loading={contratosLoading}
        />
        <KPICard
          titulo="Leads do Mês"
          valor={leads.length}
          emoji="📊"
          variacao={12}
          loading={leadsLoading}
        />
        <KPICard
          titulo="Instalações/Mês"
          valor={instMetricas?.concluidasHoje || 0}
          emoji="🔧"
          loading={instalacoesLoading}
        />
        <KPICard
          titulo="Receita Mensal"
          valor={`R$ ${(contratos?.filter(c => c.status === 'ativo').reduce((acc, c) => acc + (c.valor_mensal || 0), 0) || 0).toLocaleString('pt-BR')}`}
          emoji="💰"
          loading={contratosLoading}
        />
      </div>

      {/* GRID PRINCIPAL - 2/3 + 1/3 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* COLUNA 1-2: Funil + Leads */}
        <div className="lg:col-span-2 space-y-6">
          {/* FUNIL DE VENDAS */}
          <FunilVendas dados={funnelData} loading={leadsLoading} />

          {/* ÚLTIMOS LEADS */}
          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <UserPlus className="h-5 w-5 text-primary" />
                    Últimos Leads
                  </CardTitle>
                  <CardDescription>Leads mais recentes do funil de vendas</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-border hover:border-border-hover hover:bg-card-hover"
                  onClick={() => navigate('/vendas/leads')}
                >
                  Ver Todos <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {leadsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full bg-muted" />
                  ))}
                </div>
              ) : leads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <UserPlus className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">Nenhum lead cadastrado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {leads.slice(0, 5).map((lead) => (
                    <div
                      key={lead.id}
                      className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-card-hover hover:border-border-hover transition-all duration-200 cursor-pointer"
                      onClick={() => navigate(`/vendas/leads/${lead.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-medium text-primary">
                          {lead.nome.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{lead.nome}</p>
                          <p className="text-sm text-muted-foreground">
                            {lead.veiculo_marca} {lead.veiculo_modelo}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <BadgeEtapa etapa={lead.etapa} />
                        <span className="text-xs text-muted-foreground">
                          {formatTime(lead.created_at)}
                        </span>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 hover:bg-card-hover"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`tel:${lead.telefone}`, '_blank');
                            }}
                          >
                            <Phone className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 hover:bg-card-hover"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`https://wa.me/55${lead.telefone?.replace(/\D/g, '')}`, '_blank');
                            }}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* COLUNA 3: Ações Rápidas + Widgets */}
        <div className="space-y-6">
          {/* AÇÕES RÁPIDAS */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent>
              <QuickActions />
            </CardContent>
          </Card>

          {/* WIDGET DE FOLLOW-UPS */}
          <FollowupWidget maxItems={3} />

          {/* DOCUMENTOS PENDENTES */}
          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                  <Clock className="h-5 w-5 text-warning" />
                  Documentos Pendentes
                </CardTitle>
                <Badge variant="secondary" className="bg-muted text-muted-foreground">{docsContagem?.pendente || 0}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {docsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full bg-muted" />)}
                </div>
              ) : !pendingDocs || pendingDocs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <CheckCircle className="h-8 w-8 text-success" />
                  <p className="mt-2 text-sm text-muted-foreground">Nenhum documento pendente</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingDocs.slice(0, 3).map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm text-foreground">{doc.associados?.nome || 'Desconhecido'}</p>
                        <p className="text-xs text-muted-foreground">{doc.tipo}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(doc.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <Button 
                variant="ghost" 
                className="w-full mt-3 hover:bg-card-hover" 
                size="sm"
                onClick={() => navigate('/cadastro/documentos')}
              >
                Ver todos <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {/* INSTALAÇÕES HOJE */}
          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                  <Car className="h-5 w-5 text-warning" />
                  Instalações Hoje
                </CardTitle>
                <Badge variant="secondary" className="bg-muted text-muted-foreground">{instalacoesDia?.length || 0}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {instalacoesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full bg-muted" />)}
                </div>
              ) : !instalacoesDia || instalacoesDia.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <Calendar className="h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">Nenhuma instalação hoje</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {instalacoesDia.slice(0, 3).map((inst) => (
                    <div key={inst.id} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-foreground">
                          {inst.periodo === 'manha' ? '🌅 Manhã' : inst.periodo === 'tarde' ? '☀️ Tarde' : '🌙 Noite'}
                        </span>
                        <Badge 
                          variant={inst.status === 'em_andamento' || inst.status === 'em_rota' ? 'default' : 'outline'}
                          className={cn(
                            inst.status === 'em_andamento' || inst.status === 'em_rota' 
                              ? "bg-primary" 
                              : "border-border"
                          )}
                        >
                          {statusInstalacaoLabels[inst.status] || inst.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground">{inst.associados?.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {inst.veiculos?.marca} {inst.veiculos?.modelo} • {inst.veiculos?.placa}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <Button 
                variant="ghost" 
                className="w-full mt-3 hover:bg-card-hover" 
                size="sm"
                onClick={() => navigate('/monitoramento/instalacoes')}
              >
                Ver agenda completa <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

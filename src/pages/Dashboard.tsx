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
  novo: { label: 'Novo', cor: 'bg-blue-500' },
  contato_inicial: { label: 'Contato', cor: 'bg-yellow-500' },
  apresentacao: { label: 'Apresentação', cor: 'bg-purple-500' },
  cotacao_enviada: { label: 'Cotação', cor: 'bg-orange-500' },
  negociacao: { label: 'Negociação', cor: 'bg-pink-500' },
  contrato_enviado: { label: 'Contrato Env.', cor: 'bg-indigo-500' },
  ganho: { label: 'Ganho', cor: 'bg-green-500' },
  perdido: { label: 'Perdido', cor: 'bg-red-500' },
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
  const config = etapaConfig[etapa] || { label: etapa, cor: 'bg-gray-500' };
  return (
    <Badge className={cn(config.cor, 'text-white')}>
      {config.label}
    </Badge>
  );
}

// ============================================
// COMPONENTE: CARD DE KPI
// ============================================
interface KPICardProps {
  titulo: string;
  valor: number | string;
  variacao?: number;
  icone: React.ReactNode;
  cor: string;
  loading?: boolean;
}

function KPICard({ titulo, valor, variacao, icone, cor, loading }: KPICardProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-12 w-12 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{titulo}</p>
            <p className="text-2xl font-bold">{valor}</p>
            
            {variacao !== undefined && (
              <div className="flex items-center gap-1 text-sm">
                {variacao > 0 ? (
                  <>
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-green-500">+{variacao}%</span>
                  </>
                ) : variacao < 0 ? (
                  <>
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    <span className="text-red-500">{variacao}%</span>
                  </>
                ) : (
                  <>
                    <Minus className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">0%</span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className={cn('p-3 rounded-lg', cor)}>
            {icone}
          </div>
        </div>
      </CardContent>
    </Card>
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
          <Alert key={alerta.id} className={bgColor}>
            <AlertTriangle className={cn('h-4 w-4', iconColor)} />
            <AlertDescription className="flex items-center justify-between">
              <div>
                <span className="font-medium">{alerta.titulo}</span>
                <span className="text-muted-foreground ml-2">{alerta.descricao}</span>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
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
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Funil de Vendas
            </CardTitle>
            <CardDescription>Distribuição de leads por etapa</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/vendas/kanban')}>
            Ver Kanban <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {dados.filter(item => item.etapa !== 'perdido').map((item) => {
            const config = etapaConfig[item.etapa] || { label: item.etapa, cor: 'bg-gray-500' };
            const percentual = totalLeads > 0 ? Math.round((item.count / totalLeads) * 100) : 0;
            
            return (
              <div key={item.etapa} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{config.label}</span>
                  <span className="font-medium">{item.count}</span>
                </div>
                <Progress 
                  value={percentual} 
                  className="h-2" 
                  indicatorClassName={config.cor}
                />
              </div>
            );
          })}
        </div>
        
        <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total de leads: {totalLeads}</span>
          <Badge variant="outline" className="text-green-600 border-green-600">
            Taxa de conversão: {taxaConversao}%
          </Badge>
        </div>
      </CardContent>
    </Card>
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

  // Saudação dinâmica
  const getSaudacao = () => {
    const hora = new Date().getHours();
    if (hora < 12) return 'Bom dia';
    if (hora < 18) return 'Boa tarde';
    return 'Boa noite';
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
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {getSaudacao()}, {profile?.nome?.split(' ')[0]}! 👋
          </h1>
          <p className="text-muted-foreground">
            Aqui está o resumo das atividades de hoje.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          <span className="text-xs text-muted-foreground">
            Última atualização: {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* ALERTAS */}
      <AlertaBanner alertas={alertas} />

      {/* KPIs - Grid de 5 */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KPICard
          titulo="Leads Novos"
          valor={leads.filter(l => l.etapa === 'novo').length}
          icone={<UserPlus className="h-6 w-6 text-blue-600" />}
          cor="bg-blue-100 dark:bg-blue-900/30"
          loading={leadsLoading}
        />
        <KPICard
          titulo="Cotações Enviadas"
          valor={cotacoes?.filter(c => c.status === 'enviada').length || 0}
          icone={<Calculator className="h-6 w-6 text-purple-600" />}
          cor="bg-purple-100 dark:bg-purple-900/30"
          loading={cotacoesLoading}
        />
        <KPICard
          titulo="Contratos Ativos"
          valor={contratos?.filter(c => c.status === 'ativo').length || 0}
          icone={<FileText className="h-6 w-6 text-green-600" />}
          cor="bg-green-100 dark:bg-green-900/30"
          loading={contratosLoading}
        />
        <KPICard
          titulo="Docs Pendentes"
          valor={docsContagem?.pendente || pendingDocs?.length || 0}
          icone={<Clock className="h-6 w-6 text-warning" />}
          cor="bg-yellow-100 dark:bg-yellow-900/30"
          loading={docsLoading}
        />
        <KPICard
          titulo="Instalações Hoje"
          valor={instalacoesDia?.length || 0}
          icone={<Car className="h-6 w-6 text-orange-600" />}
          cor="bg-orange-100 dark:bg-orange-900/30"
          loading={instalacoesLoading}
        />
      </div>

      {/* GRID PRINCIPAL - 3 colunas */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* COLUNA 1-2: Funil + Leads */}
        <div className="lg:col-span-2 space-y-6">
          {/* FUNIL DE VENDAS */}
          <FunilVendas dados={funnelData} loading={leadsLoading} />

          {/* ÚLTIMOS LEADS */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5 text-primary" />
                    Últimos Leads
                  </CardTitle>
                  <CardDescription>Leads mais recentes do funil de vendas</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/vendas/leads')}>
                  Ver Todos <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {leadsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
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
                      className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/vendas/leads/${lead.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                          {lead.nome.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium">{lead.nome}</p>
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
                            className="h-8 w-8"
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
                            className="h-8 w-8"
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
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                className="h-auto py-3 flex flex-col gap-1"
                onClick={() => navigate('/vendas/leads')}
              >
                <Plus className="h-5 w-5" />
                <span className="text-xs">Novo Lead</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto py-3 flex flex-col gap-1"
                onClick={() => navigate('/vendas/cotador')}
              >
                <Calculator className="h-5 w-5" />
                <span className="text-xs">Nova Cotação</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto py-3 flex flex-col gap-1"
                onClick={() => navigate('/monitoramento/instalacoes')}
              >
                <Wrench className="h-5 w-5" />
                <span className="text-xs">Agendar Instalação</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto py-3 flex flex-col gap-1"
                onClick={() => navigate('/cadastro/documentos')}
              >
                <FileText className="h-5 w-5" />
                <span className="text-xs">Analisar Docs</span>
              </Button>
            </CardContent>
          </Card>

          {/* WIDGET DE FOLLOW-UPS */}
          <FollowupWidget maxItems={3} />

          {/* DOCUMENTOS PENDENTES */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="h-5 w-5 text-warning" />
                  Documentos Pendentes
                </CardTitle>
                <Badge variant="secondary">{docsContagem?.pendente || 0}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {docsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : !pendingDocs || pendingDocs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                  <p className="mt-2 text-sm text-muted-foreground">Nenhum documento pendente</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingDocs.slice(0, 3).map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{doc.associados?.nome || 'Desconhecido'}</p>
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
                className="w-full mt-3" 
                size="sm"
                onClick={() => navigate('/cadastro/documentos')}
              >
                Ver todos <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {/* INSTALAÇÕES HOJE */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Car className="h-5 w-5 text-orange-500" />
                  Instalações Hoje
                </CardTitle>
                <Badge variant="secondary">{instalacoesDia?.length || 0}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {instalacoesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
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
                        <span className="font-medium text-sm">
                          {inst.periodo === 'manha' ? '🌅 Manhã' : inst.periodo === 'tarde' ? '☀️ Tarde' : '🌙 Noite'}
                        </span>
                        <Badge variant={inst.status === 'em_andamento' || inst.status === 'em_rota' ? 'default' : 'outline'}>
                          {statusInstalacaoLabels[inst.status] || inst.status}
                        </Badge>
                      </div>
                      <p className="text-sm">{inst.associados?.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {inst.veiculos?.marca} {inst.veiculos?.modelo} • {inst.veiculos?.placa}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <Button 
                variant="ghost" 
                className="w-full mt-3" 
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

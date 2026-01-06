import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  UserPlus,
  FileText,
  Calculator,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLeads } from '@/hooks/useLeads';
import { useCotacoes } from '@/hooks/useCotacoes';
import { useContratos } from '@/hooks/useContratos';
import { useAssociados } from '@/hooks/useAssociados';
import { usePendingDocumentos } from '@/hooks/useDocumentos';

import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const etapaColors: Record<string, string> = {
  novo: 'bg-[hsl(var(--etapa-novo))]',
  contato_inicial: 'bg-[hsl(var(--etapa-contato))]',
  apresentacao: 'bg-[hsl(var(--etapa-apresentacao))]',
  cotacao_enviada: 'bg-[hsl(var(--etapa-cotacao))]',
  negociacao: 'bg-[hsl(var(--etapa-negociacao))]',
  ganho: 'bg-[hsl(var(--etapa-ganho))]',
  perdido: 'bg-[hsl(var(--etapa-perdido))]',
};

const etapaLabels: Record<string, string> = {
  novo: 'Novo',
  contato_inicial: 'Contato',
  apresentacao: 'Apresentação',
  cotacao_enviada: 'Cotação',
  negociacao: 'Negociação',
  ganho: 'Ganho',
  perdido: 'Perdido',
};

export default function Dashboard() {
  const { profile } = useAuth();
  const { data: leadsData, isLoading: leadsLoading } = useLeads({ page: 1, perPage: 100 });
  const { data: cotacoes, isLoading: cotacoesLoading } = useCotacoes();
  const { data: contratos, isLoading: contratosLoading } = useContratos();
  const { data: associadosData, isLoading: associadosLoading } = useAssociados();
  const associados = associadosData?.associados;
  const { data: pendingDocs, isLoading: docsLoading } = usePendingDocumentos();

  const isLoading = leadsLoading || cotacoesLoading || contratosLoading || associadosLoading;

  // Calculate stats from real data
  const leads = leadsData?.leads || [];
  const stats = [
    {
      title: 'Leads Novos',
      value: leads.filter(l => l.etapa === 'novo').length.toString(),
      icon: UserPlus,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Cotações Enviadas',
      value: cotacoes?.filter(c => c.status === 'enviada').length.toString() || '0',
      icon: Calculator,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Contratos Ativos',
      value: contratos?.filter(c => c.status === 'ativo').length.toString() || '0',
      icon: FileText,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Associados Ativos',
      value: associados?.filter(a => a.status === 'ativo').length.toString() || '0',
      icon: Users,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
  ];

  // Calculate funnel data
  const funnelData = [
    { etapa: 'novo', count: leads.filter(l => l.etapa === 'novo').length },
    { etapa: 'contato_inicial', count: leads.filter(l => l.etapa === 'contato_inicial').length },
    { etapa: 'apresentacao', count: leads.filter(l => l.etapa === 'apresentacao').length },
    { etapa: 'cotacao_enviada', count: leads.filter(l => l.etapa === 'cotacao_enviada').length },
    { etapa: 'negociacao', count: leads.filter(l => l.etapa === 'negociacao').length },
    { etapa: 'ganho', count: leads.filter(l => l.etapa === 'ganho').length },
    { etapa: 'perdido', count: leads.filter(l => l.etapa === 'perdido').length },
  ];

  const formatTime = (dateStr: string) => {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: false, locale: ptBR });
  };

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Olá, {profile?.nome?.split(' ')[0]}! 👋
        </h1>
        <p className="text-muted-foreground">
          Aqui está o resumo das atividades de hoje.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className={`rounded-lg p-2 ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
              <div className="mt-4">
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-bold">{stat.value}</p>
                )}
                <p className="text-sm text-muted-foreground">{stat.title}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Leads */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Últimos Leads
            </CardTitle>
            <CardDescription>Leads mais recentes do funil de vendas</CardDescription>
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
              <div className="space-y-4">
                {leads.slice(0, 5).map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                        {lead.nome.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{lead.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          {lead.veiculo_marca} {lead.veiculo_modelo}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`${etapaColors[lead.etapa]} text-white`}>
                        {etapaLabels[lead.etapa]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(lead.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              Documentos Pendentes
            </CardTitle>
            <CardDescription>Documentos aguardando análise</CardDescription>
          </CardHeader>
          <CardContent>
            {docsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !pendingDocs || pendingDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">Nenhum documento pendente</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingDocs.slice(0, 5).map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-warning/10 text-sm font-medium text-warning">
                        {doc.associados?.nome?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="font-medium">{doc.associados?.nome || 'Desconhecido'}</p>
                        <p className="text-sm text-muted-foreground">{doc.tipo}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Pendente</Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(doc.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Funnel Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-accent" />
              Funil de Vendas
            </CardTitle>
            <CardDescription>Distribuição dos leads por etapa</CardDescription>
          </CardHeader>
          <CardContent>
            {leadsLoading ? (
              <div className="grid gap-3 sm:grid-cols-7">
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div key={i} className="text-center">
                    <Skeleton className="mx-auto h-12 w-12 rounded-full" />
                    <Skeleton className="mx-auto mt-2 h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-7">
                {funnelData.map((item) => (
                  <div key={item.etapa} className="text-center">
                    <div
                      className={`mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full ${etapaColors[item.etapa]} text-lg font-bold text-white`}
                    >
                      {item.count}
                    </div>
                    <p className="text-xs text-muted-foreground">{etapaLabels[item.etapa]}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

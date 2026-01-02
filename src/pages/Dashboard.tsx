import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  UserPlus,
  FileText,
  Calculator,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// Dados simulados para demonstração
const stats = [
  {
    title: 'Leads Novos',
    value: '47',
    change: '+12%',
    changeType: 'positive' as const,
    icon: UserPlus,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    title: 'Cotações Enviadas',
    value: '28',
    change: '+8%',
    changeType: 'positive' as const,
    icon: Calculator,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  {
    title: 'Contratos Assinados',
    value: '12',
    change: '+23%',
    changeType: 'positive' as const,
    icon: FileText,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  {
    title: 'Associados Ativos',
    value: '1.847',
    change: '+5%',
    changeType: 'positive' as const,
    icon: Users,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
  },
];

const recentLeads = [
  { nome: 'João Silva', veiculo: 'Civic 2022', etapa: 'cotacao_enviada', tempo: '2h' },
  { nome: 'Maria Santos', veiculo: 'Corolla 2021', etapa: 'contato_inicial', tempo: '4h' },
  { nome: 'Pedro Oliveira', veiculo: 'HB20 2023', etapa: 'novo', tempo: '6h' },
  { nome: 'Ana Costa', veiculo: 'Onix 2022', etapa: 'negociacao', tempo: '1d' },
  { nome: 'Carlos Lima', veiculo: 'Polo 2021', etapa: 'apresentacao', tempo: '1d' },
];

const pendingDocs = [
  { nome: 'Roberto Alves', tipo: 'CNH', tempo: '1h' },
  { nome: 'Fernanda Lima', tipo: 'CRLV', tempo: '3h' },
  { nome: 'Marcelo Santos', tipo: 'Comprovante', tempo: '5h' },
];

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
                <Badge
                  variant="secondary"
                  className={
                    stat.changeType === 'positive'
                      ? 'bg-green-500/10 text-green-600'
                      : 'bg-red-500/10 text-red-600'
                  }
                >
                  <TrendingUp className="mr-1 h-3 w-3" />
                  {stat.change}
                </Badge>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold">{stat.value}</p>
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
            <div className="space-y-4">
              {recentLeads.map((lead, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                      {lead.nome.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium">{lead.nome}</p>
                      <p className="text-sm text-muted-foreground">{lead.veiculo}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`${etapaColors[lead.etapa]} text-white`}>
                      {etapaLabels[lead.etapa]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{lead.tempo}</span>
                  </div>
                </div>
              ))}
            </div>
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
            <div className="space-y-4">
              {pendingDocs.map((doc, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-warning/10 text-sm font-medium text-warning">
                      {doc.nome.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium">{doc.nome}</p>
                      <p className="text-sm text-muted-foreground">{doc.tipo}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Pendente</Badge>
                    <span className="text-xs text-muted-foreground">{doc.tempo}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Funnel Stats */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-accent" />
              Funil de Vendas
            </CardTitle>
            <CardDescription>Distribuição dos leads por etapa</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-7">
              {[
                { etapa: 'novo', count: 15 },
                { etapa: 'contato_inicial', count: 12 },
                { etapa: 'apresentacao', count: 8 },
                { etapa: 'cotacao_enviada', count: 6 },
                { etapa: 'negociacao', count: 4 },
                { etapa: 'ganho', count: 2 },
                { etapa: 'perdido', count: 3 },
              ].map((item) => (
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

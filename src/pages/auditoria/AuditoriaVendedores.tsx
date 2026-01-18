import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Shield,
  AlertTriangle,
  Eye,
  UserX,
  Search,
  Play,
  RefreshCw,
  Users,
  AlertCircle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  useAlertasAuditoria,
  useVendedoresRisco,
  useCPFsDuplicados,
  useAuditoriaStats,
  useExecutarAnalise,
} from '@/hooks/useAuditoriaVendedores';
import { VendedorRiskBadge, RiskScoreIndicator } from '@/components/auditoria/VendedorRiskBadge';
import { AlertaDetalheModal } from '@/components/auditoria/AlertaDetalheModal';
import { VendedorMonitoramentoModal } from '@/components/auditoria/VendedorMonitoramentoModal';
import { toast } from 'sonner';

const ALERT_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  cpf_duplicado: { label: 'CPF Duplicado', icon: Users, color: 'text-red-500' },
  taxa_conversao_baixa: { label: 'Taxa Conversão Baixa', icon: AlertTriangle, color: 'text-orange-500' },
  cotacoes_abandonadas: { label: 'Cotações Abandonadas', icon: AlertCircle, color: 'text-amber-500' },
  leads_perdidos_massa: { label: 'Leads Perdidos em Massa', icon: UserX, color: 'text-red-400' },
  horario_atipico: { label: 'Horário Atípico', icon: Clock, color: 'text-purple-500' },
  marcacao_manual: { label: 'Marcação Manual', icon: Eye, color: 'text-blue-500' },
};

export default function AuditoriaVendedores() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('alertas');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pendente');
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [selectedAlerta, setSelectedAlerta] = useState<any>(null);
  const [selectedVendedor, setSelectedVendedor] = useState<any>(null);

  const { data: stats, isLoading: loadingStats } = useAuditoriaStats();
  const { data: alertas = [], isLoading: loadingAlertas, refetch: refetchAlertas } = useAlertasAuditoria({
    status: statusFilter === 'todos' ? undefined : statusFilter,
    tipoAlerta: tipoFilter === 'todos' ? undefined : tipoFilter,
  });
  const { data: vendedoresRisco = [], isLoading: loadingVendedores, refetch: refetchVendedores } = useVendedoresRisco();
  const { data: cpfsDuplicados = [], isLoading: loadingCPFs } = useCPFsDuplicados();
  const executarAnalise = useExecutarAnalise();

  const handleExecutarAnalise = async () => {
    try {
      await executarAnalise.mutateAsync(undefined);
      toast.success('Análise executada com sucesso!');
      refetchAlertas();
      refetchVendedores();
    } catch (error) {
      toast.error('Erro ao executar análise');
    }
  };

  const filteredAlertas = alertas.filter((alerta: any) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      alerta.vendedor?.nome?.toLowerCase().includes(searchLower) ||
      alerta.descricao?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="shrink-0 z-10 bg-gradient-to-b from-muted/50 to-background border-b border-border/50">
        <div className="px-6 py-6 space-y-6">
          {/* Title */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Auditoria de Vendedores</h1>
                <p className="text-muted-foreground">
                  Monitoramento de exclusividade e detecção de padrões suspeitos
                </p>
              </div>
            </div>
            <Button
              onClick={handleExecutarAnalise}
              disabled={executarAnalise.isPending}
            >
              {executarAnalise.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Executar Análise
            </Button>
          </div>

          {/* Stats Cards */}
          {loadingStats ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <AlertTriangle className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Alertas</p>
                      <p className="text-2xl font-bold">{stats?.totalAlertas || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <Clock className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pendentes</p>
                      <p className="text-2xl font-bold text-amber-600">{stats?.alertasPendentes || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-500/10">
                      <Eye className="h-5 w-5 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Sob Observação</p>
                      <p className="text-2xl font-bold text-orange-600">{stats?.vendedoresSobObservacao || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-500/10">
                      <UserX className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Suspensos</p>
                      <p className="text-2xl font-bold text-red-600">{stats?.vendedoresSuspensos || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto px-6 py-5">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <TabsList>
              <TabsTrigger value="alertas" className="gap-2">
                <AlertTriangle className="h-4 w-4" />
                Alertas ({alertas.length})
              </TabsTrigger>
              <TabsTrigger value="ranking" className="gap-2">
                <Shield className="h-4 w-4" />
                Ranking de Risco ({vendedoresRisco.length})
              </TabsTrigger>
              <TabsTrigger value="cpfs" className="gap-2">
                <Users className="h-4 w-4" />
                CPFs Duplicados ({cpfsDuplicados.length})
              </TabsTrigger>
            </TabsList>

            {activeTab === 'alertas' && (
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="analisado">Analisado</SelectItem>
                    <SelectItem value="ignorado">Ignorado</SelectItem>
                    <SelectItem value="confirmado">Confirmado</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={tipoFilter} onValueChange={setTipoFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os tipos</SelectItem>
                    <SelectItem value="cpf_duplicado">CPF Duplicado</SelectItem>
                    <SelectItem value="taxa_conversao_baixa">Taxa Conversão Baixa</SelectItem>
                    <SelectItem value="cotacoes_abandonadas">Cotações Abandonadas</SelectItem>
                    <SelectItem value="leads_perdidos_massa">Leads Perdidos</SelectItem>
                    <SelectItem value="horario_atipico">Horário Atípico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Alertas Tab */}
          <TabsContent value="alertas" className="space-y-4">
            {loadingAlertas ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : filteredAlertas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle className="h-12 w-12 text-green-500/50 mb-4" />
                <h3 className="text-lg font-medium">Nenhum alerta encontrado</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {statusFilter === 'pendente' 
                    ? 'Não há alertas pendentes de análise'
                    : 'Nenhum alerta corresponde aos filtros selecionados'
                  }
                </p>
              </div>
            ) : (
              <Card className="border-border/50">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-center">Score</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAlertas.map((alerta: any) => {
                      const config = ALERT_TYPE_CONFIG[alerta.tipo_alerta] || { 
                        label: alerta.tipo_alerta, 
                        icon: AlertTriangle, 
                        color: 'text-muted-foreground' 
                      };
                      const Icon = config.icon;

                      return (
                        <TableRow key={alerta.id} className="group">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={alerta.vendedor?.avatar_url} />
                                <AvatarFallback>
                                  {alerta.vendedor?.nome?.charAt(0) || '?'}
                                </AvatarFallback>
                              </Avatar>
                              <span 
                                className="font-medium hover:underline cursor-pointer"
                                onClick={() => navigate(`/vendas/vendedores/${alerta.vendedor_id}`)}
                              >
                                {alerta.vendedor?.nome || 'Desconhecido'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Icon className={`h-4 w-4 ${config.color}`} />
                              <span className="text-sm">{config.label}</span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            <span className="text-sm text-muted-foreground truncate block">
                              {alerta.descricao}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <RiskScoreIndicator score={alerta.score_risco || 0} />
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(alerta.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="secondary"
                              className={
                                alerta.status === 'pendente' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
                                alerta.status === 'confirmado' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                                alerta.status === 'analisado' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                'bg-muted'
                              }
                            >
                              {alerta.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedAlerta(alerta)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Analisar
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          {/* Ranking Tab */}
          <TabsContent value="ranking" className="space-y-4">
            {loadingVendedores ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : vendedoresRisco.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Shield className="h-12 w-12 text-green-500/50 mb-4" />
                <h3 className="text-lg font-medium">Nenhum vendedor em monitoramento</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Execute uma análise para identificar padrões suspeitos
                </p>
              </div>
            ) : (
              <Card className="border-border/50">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-center">Score de Risco</TableHead>
                      <TableHead className="text-center">Total Alertas</TableHead>
                      <TableHead className="text-center">Confirmados</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendedoresRisco.map((vendedor: any, index: number) => (
                      <TableRow key={vendedor.id} className="group">
                        <TableCell className="font-bold text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={vendedor.vendedor?.avatar_url} />
                              <AvatarFallback>
                                {vendedor.vendedor?.nome?.charAt(0) || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <span 
                              className="font-medium hover:underline cursor-pointer"
                              onClick={() => navigate(`/vendas/vendedores/${vendedor.vendedor_id}`)}
                            >
                              {vendedor.vendedor?.nome || 'Desconhecido'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <RiskScoreIndicator score={vendedor.score_risco_acumulado || 0} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{vendedor.total_alertas || 0}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={vendedor.alertas_confirmados > 0 ? 'text-red-600 font-medium' : ''}>
                            {vendedor.alertas_confirmados || 0}
                          </span>
                        </TableCell>
                        <TableCell>
                          <VendedorRiskBadge 
                            status={vendedor.status_monitoramento} 
                            scoreRisco={vendedor.score_risco_acumulado}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedVendedor({
                              id: vendedor.vendedor_id,
                              nome: vendedor.vendedor?.nome,
                              avatar_url: vendedor.vendedor?.avatar_url,
                            })}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Gerenciar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          {/* CPFs Duplicados Tab */}
          <TabsContent value="cpfs" className="space-y-4">
            {loadingCPFs ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : cpfsDuplicados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle className="h-12 w-12 text-green-500/50 mb-4" />
                <h3 className="text-lg font-medium">Nenhum CPF duplicado encontrado</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Todos os leads possuem CPFs únicos por vendedor
                </p>
              </div>
            ) : (
              <Card className="border-border/50">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>CPF</TableHead>
                      <TableHead className="text-center">Vendedores</TableHead>
                      <TableHead className="text-center">Total Leads</TableHead>
                      <TableHead>Nomes Usados</TableHead>
                      <TableHead>Último Lead</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cpfsDuplicados.map((item: any) => (
                      <TableRow key={item.cpf}>
                        <TableCell className="font-mono">{item.cpf}</TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant="secondary"
                            className={
                              item.qtd_vendedores > 2 
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                            }
                          >
                            {item.qtd_vendedores} vendedores
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{item.total_leads}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {item.nomes_usados?.slice(0, 3).map((nome: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {nome}
                              </Badge>
                            ))}
                            {item.nomes_usados?.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{item.nomes_usados.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.ultimo_lead && format(new Date(item.ultimo_lead), "dd/MM/yy", { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <AlertaDetalheModal
        alerta={selectedAlerta}
        open={!!selectedAlerta}
        onOpenChange={(open) => !open && setSelectedAlerta(null)}
      />

      <VendedorMonitoramentoModal
        vendedor={selectedVendedor}
        monitoramento={vendedoresRisco.find((v: any) => v.vendedor_id === selectedVendedor?.id)}
        open={!!selectedVendedor}
        onOpenChange={(open) => !open && setSelectedVendedor(null)}
      />
    </div>
  );
}

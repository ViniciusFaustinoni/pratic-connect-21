import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ArrowLeft, 
  Search, 
  Users, 
  TrendingUp, 
  Target, 
  XCircle,
  Phone,
  Car,
  Calendar,
  FileText,
  ChevronRight
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useConsultor } from '@/hooks/useConsultores';
import { 
  useConsultorLeads, 
  useConsultorCotacoes, 
  useConsultorContratos,
  useConsultorStats 
} from '@/hooks/useConsultorHistorico';
import { ETAPA_LABELS, ETAPA_COLORS, STATUS_COTACAO_LABELS, STATUS_COTACAO_COLORS } from '@/types/vendas';

export default function ConsultorHistorico() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [etapaFilter, setEtapaFilter] = useState('todos');
  const [activeTab, setActiveTab] = useState('leads');

  const { data: consultor, isLoading: loadingConsultor } = useConsultor(id);
  const { data: stats, isLoading: loadingStats } = useConsultorStats(id || '');
  const { data: leads = [], isLoading: loadingLeads } = useConsultorLeads({
    consultorId: id || '',
    search,
    etapa: etapaFilter,
  });
  const { data: cotacoes = [], isLoading: loadingCotacoes } = useConsultorCotacoes(id || '');
  const { data: contratos = [], isLoading: loadingContratos } = useConsultorContratos(id || '');

  const isLoading = loadingConsultor || loadingStats;
  const taxaConversao = stats?.total ? ((stats.ganhos / stats.total) * 100).toFixed(1) : '0';

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-background p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!consultor) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h2 className="text-xl font-semibold mb-2">Consultor não encontrado</h2>
        <Button onClick={() => navigate('/vendas/consultores')}>
          Voltar para Consultores
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="shrink-0 z-10 bg-gradient-to-b from-muted/50 to-background border-b border-border/50">
        <div className="px-6 py-6 space-y-6">
          {/* Back Button & Title */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/vendas/consultores')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{consultor.nome}</h1>
              <p className="text-muted-foreground">Histórico de atividades do consultor</p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Leads</p>
                    <p className="text-2xl font-bold">{stats?.total || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ganhos</p>
                    <p className="text-2xl font-bold text-green-600">{stats?.ganhos || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-500/10">
                    <XCircle className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Perdidos</p>
                    <p className="text-2xl font-bold text-red-600">{stats?.perdidos || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <TrendingUp className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Conversão</p>
                    <p className="text-2xl font-bold">{taxaConversao}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto px-6 py-5">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <TabsList>
              <TabsTrigger value="leads" className="gap-2">
                <Users className="h-4 w-4" />
                Leads ({leads.length})
              </TabsTrigger>
              <TabsTrigger value="cotacoes" className="gap-2">
                <FileText className="h-4 w-4" />
                Cotações ({cotacoes.length})
              </TabsTrigger>
              <TabsTrigger value="contratos" className="gap-2">
                <FileText className="h-4 w-4" />
                Contratos ({contratos.length})
              </TabsTrigger>
            </TabsList>

            {activeTab === 'leads' && (
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar lead..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={etapaFilter} onValueChange={setEtapaFilter}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder="Etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas etapas</SelectItem>
                    <SelectItem value="novo">Novo</SelectItem>
                    <SelectItem value="contato">Contato</SelectItem>
                    <SelectItem value="qualificado">Qualificado</SelectItem>
                    <SelectItem value="cotacao_enviada">Cotação Enviada</SelectItem>
                    <SelectItem value="negociacao">Negociação</SelectItem>
                    <SelectItem value="ganho">Ganho</SelectItem>
                    <SelectItem value="perdido">Perdido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <TabsContent value="leads" className="space-y-3">
            {loadingLeads ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">Nenhum lead encontrado</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {search || etapaFilter !== 'todos'
                    ? 'Tente ajustar os filtros'
                    : 'Este consultor ainda não possui leads atribuídos'}
                </p>
              </div>
            ) : (
              leads.map((lead: any) => (
                <Card 
                  key={lead.id} 
                  className="border-border/50 hover:border-primary/50 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/vendas/leads/${lead.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium truncate">{lead.nome || 'Sem nome'}</h3>
                          <Badge 
                            variant="secondary" 
                            className={ETAPA_COLORS[lead.etapa as keyof typeof ETAPA_COLORS] || 'bg-muted'}
                          >
                            {ETAPA_LABELS[lead.etapa as keyof typeof ETAPA_LABELS] || lead.etapa}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          {lead.telefone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5" />
                              {lead.telefone}
                            </span>
                          )}
                          {lead.veiculo_placa && (
                            <span className="flex items-center gap-1">
                              <Car className="h-3.5 w-3.5" />
                              {lead.veiculo_placa}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {format(new Date(lead.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="cotacoes" className="space-y-3">
            {loadingCotacoes ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : cotacoes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">Nenhuma cotação encontrada</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Este consultor ainda não possui cotações
                </p>
              </div>
            ) : (
              cotacoes.map((cotacao: any) => (
                <Card 
                  key={cotacao.id} 
                  className="border-border/50 hover:border-primary/50 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/vendas/cotacoes/${cotacao.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium">{cotacao.numero}</h3>
                          <Badge 
                            variant="secondary" 
                            className={STATUS_COTACAO_COLORS[cotacao.status as keyof typeof STATUS_COTACAO_COLORS] || 'bg-muted'}
                          >
                            {STATUS_COTACAO_LABELS[cotacao.status as keyof typeof STATUS_COTACAO_LABELS] || cotacao.status}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          {cotacao.lead?.nome && (
                            <span>{cotacao.lead.nome}</span>
                          )}
                          {cotacao.valor_mensal && (
                            <span className="font-medium text-foreground">
                              R$ {cotacao.valor_mensal.toFixed(2)}/mês
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {format(new Date(cotacao.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="contratos" className="space-y-3">
            {loadingContratos ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : contratos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">Nenhum contrato encontrado</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Este consultor ainda não possui contratos
                </p>
              </div>
            ) : (
              contratos.map((contrato: any) => (
                <Card 
                  key={contrato.id} 
                  className="border-border/50 hover:border-primary/50 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/vendas/contratos/${contrato.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium">{contrato.numero}</h3>
                          <Badge variant="secondary">
                            {contrato.status}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          {contrato.lead?.nome && (
                            <span>{contrato.lead.nome}</span>
                          )}
                          {contrato.plano?.nome && (
                            <span className="text-primary">{contrato.plano.nome}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {format(new Date(contrato.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

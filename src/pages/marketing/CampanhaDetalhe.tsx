import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  ArrowLeft, Calendar, Target, DollarSign, Users,
  TrendingUp, Percent, Edit, Pause, Play, Copy, ExternalLink,
  ChevronDown, CheckCircle, BarChart3, Link, Image
} from 'lucide-react';
import { useCampanha, useCampanhaMetricas, useUpdateCampanha } from '@/hooks/useMarketing';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const statusConfig: Record<string, { label: string; className: string }> = {
  rascunho: { label: 'Rascunho', className: 'bg-gray-100 text-gray-800' },
  agendada: { label: 'Agendada', className: 'bg-blue-100 text-blue-800' },
  ativa: { label: 'Ativa', className: 'bg-green-100 text-green-800' },
  pausada: { label: 'Pausada', className: 'bg-yellow-100 text-yellow-800' },
  finalizada: { label: 'Finalizada', className: 'bg-purple-100 text-purple-800' },
  cancelada: { label: 'Cancelada', className: 'bg-red-100 text-red-800' },
};

const tipoConfig: Record<string, { label: string; className: string }> = {
  aquisicao: { label: 'Aquisição', className: 'bg-blue-100 text-blue-800' },
  reativacao: { label: 'Reativação', className: 'bg-orange-100 text-orange-800' },
  indicacao: { label: 'Indicação', className: 'bg-pink-100 text-pink-800' },
  remarketing: { label: 'Remarketing', className: 'bg-purple-100 text-purple-800' },
  branding: { label: 'Branding', className: 'bg-cyan-100 text-cyan-800' },
  promocional: { label: 'Promocional', className: 'bg-green-100 text-green-800' },
  sazonal: { label: 'Sazonal', className: 'bg-amber-100 text-amber-800' },
};

const etapaLabels: Record<string, string> = {
  novo: 'Novo',
  contato: 'Contato',
  qualificado: 'Qualificado',
  proposta: 'Proposta',
  negociacao: 'Negociação',
  ganho: 'Ganho',
  perdido: 'Perdido',
};

export default function CampanhaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: campanha, isLoading } = useCampanha(id!);
  const { data: metricas, isLoading: loadingMetricas } = useCampanhaMetricas(id!);
  const updateCampanha = useUpdateCampanha();

  // Query: Leads da campanha
  const { data: leads } = useQuery({
    queryKey: ['campanha-leads', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('leads')
        .select('id, nome, telefone, etapa, created_at, vendedor:profiles(nome)')
        .eq('campanha_id', id)
        .order('created_at', { ascending: false })
        .limit(20);
      return data;
    },
    enabled: !!id
  });

  // Query: UTMs da campanha
  const { data: utms } = useQuery({
    queryKey: ['campanha-utms', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('utms')
        .select('*')
        .eq('campanha_id', id);
      return data;
    },
    enabled: !!id
  });

  // Calcular totais
  const totais = metricas?.reduce((acc, m) => ({
    valor_gasto: acc.valor_gasto + (m.valor_gasto || 0),
    impressoes: acc.impressoes + (m.impressoes || 0),
    cliques: acc.cliques + (m.cliques || 0),
    leads: acc.leads + (m.leads || 0),
    conversoes: acc.conversoes + (m.conversoes || 0),
  }), { valor_gasto: 0, impressoes: 0, cliques: 0, leads: 0, conversoes: 0 }) || { valor_gasto: 0, impressoes: 0, cliques: 0, leads: 0, conversoes: 0 };

  const taxaConversao = totais.leads > 0 ? ((totais.conversoes / totais.leads) * 100).toFixed(1) : '0';
  const cpl = totais.leads > 0 ? (totais.valor_gasto / totais.leads).toFixed(2) : '0.00';
  const cpa = totais.conversoes > 0 ? (totais.valor_gasto / totais.conversoes).toFixed(2) : '0.00';

  const handleToggleStatus = () => {
    if (!campanha) return;
    const newStatus = campanha.status === 'ativa' ? 'pausada' : 'ativa';
    updateCampanha.mutate({ id: campanha.id, status: newStatus });
  };

  const handleFinalizar = () => {
    if (!campanha) return;
    updateCampanha.mutate({ id: campanha.id, status: 'finalizada' });
  };

  const copyUTMUrl = () => {
    if (!campanha) return;
    const baseUrl = 'https://seusite.com.br/';
    const params = new URLSearchParams();
    if (campanha.utm_source) params.append('utm_source', campanha.utm_source);
    if (campanha.utm_medium) params.append('utm_medium', campanha.utm_medium);
    if (campanha.utm_campaign) params.append('utm_campaign', campanha.utm_campaign);
    const url = `${baseUrl}?${params.toString()}`;
    navigator.clipboard.writeText(url);
    toast.success('URL copiada!');
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!campanha) {
    return (
      <div className="p-6">
        <p>Campanha não encontrada</p>
      </div>
    );
  }

  const progressoOrcamento = campanha.orcamento_total ? (totais.valor_gasto / campanha.orcamento_total) * 100 : 0;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/marketing/campanhas')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{campanha.nome}</h1>
              <Badge className={statusConfig[campanha.status]?.className}>
                {statusConfig[campanha.status]?.label}
              </Badge>
              <Badge variant="outline" className={tipoConfig[campanha.tipo]?.className}>
                {tipoConfig[campanha.tipo]?.label || campanha.tipo}
              </Badge>
            </div>
            <p className="text-muted-foreground">{campanha.codigo}</p>
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              Ações <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/marketing/campanhas/${id}/editar`)}>
              <Edit className="mr-2 h-4 w-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleToggleStatus}>
              {campanha.status === 'ativa' ? (
                <><Pause className="mr-2 h-4 w-4" /> Pausar</>
              ) : (
                <><Play className="mr-2 h-4 w-4" /> Ativar</>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleFinalizar}>
              <CheckCircle className="mr-2 h-4 w-4" /> Finalizar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info('Função em desenvolvimento')}>
              <Copy className="mr-2 h-4 w-4" /> Duplicar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4 text-center">
            <Users className="h-5 w-5 mx-auto text-blue-600 mb-1" />
            <p className="text-2xl font-bold text-blue-900">{totais.leads}</p>
            <p className="text-xs text-blue-600">Total Leads</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-green-600 mb-1" />
            <p className="text-2xl font-bold text-green-900">{totais.conversoes}</p>
            <p className="text-xs text-green-600">Conversões</p>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="pt-4 text-center">
            <Percent className="h-5 w-5 mx-auto text-purple-600 mb-1" />
            <p className="text-2xl font-bold text-purple-900">{taxaConversao}%</p>
            <p className="text-xs text-purple-600">Taxa Conversão</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="pt-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto text-yellow-600 mb-1" />
            <p className="text-2xl font-bold text-yellow-900">R$ {totais.valor_gasto.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
            <p className="text-xs text-yellow-600">Investido</p>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="pt-4 text-center">
            <Target className="h-5 w-5 mx-auto text-orange-600 mb-1" />
            <p className="text-2xl font-bold text-orange-900">R$ {cpl}</p>
            <p className="text-xs text-orange-600">CPL</p>
          </CardContent>
        </Card>
        <Card className="bg-pink-50 border-pink-200">
          <CardContent className="pt-4 text-center">
            <BarChart3 className="h-5 w-5 mx-auto text-pink-600 mb-1" />
            <p className="text-2xl font-bold text-pink-900">R$ {cpa}</p>
            <p className="text-xs text-pink-600">CPA</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="visao-geral" className="space-y-4">
        <TabsList>
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="metricas">Métricas</TabsTrigger>
          <TabsTrigger value="leads">Leads ({leads?.length || 0})</TabsTrigger>
          <TabsTrigger value="utms">UTMs</TabsTrigger>
          <TabsTrigger value="materiais">Materiais</TabsTrigger>
        </TabsList>

        {/* Tab: Visão Geral */}
        <TabsContent value="visao-geral">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Card Informações */}
            <Card>
              <CardHeader>
                <CardTitle>Informações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tipo</span>
                  <Badge className={tipoConfig[campanha.tipo]?.className}>
                    {tipoConfig[campanha.tipo]?.label || campanha.tipo}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Canal</span>
                  <span className="font-medium">{campanha.canal?.nome || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Período</span>
                  <span className="font-medium">
                    {format(new Date(campanha.data_inicio), 'dd/MM/yyyy', { locale: ptBR })}
                    {campanha.data_fim && ` - ${format(new Date(campanha.data_fim), 'dd/MM/yyyy', { locale: ptBR })}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Responsável</span>
                  <span className="font-medium">{(campanha as any).responsavel?.nome || '-'}</span>
                </div>
                {campanha.publico_alvo && (
                  <div className="pt-2 border-t">
                    <span className="text-sm text-muted-foreground">Público Alvo</span>
                    <p className="text-sm mt-1">{campanha.publico_alvo}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Card Orçamento */}
            <Card>
              <CardHeader>
                <CardTitle>Orçamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-bold text-lg">
                    R$ {(campanha.orcamento_total || 0).toLocaleString('pt-BR')}
                  </span>
                </div>
                {campanha.orcamento_diario && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Diário</span>
                    <span className="font-medium">
                      R$ {campanha.orcamento_diario.toLocaleString('pt-BR')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gasto</span>
                  <span className="font-medium text-orange-600">
                    R$ {totais.valor_gasto.toLocaleString('pt-BR')}
                  </span>
                </div>
                <div>
                  <Progress value={Math.min(progressoOrcamento, 100)} className="h-3" />
                  <p className="text-xs text-muted-foreground text-center mt-1">
                    {progressoOrcamento.toFixed(1)}% utilizado
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Card Metas */}
            <Card>
              <CardHeader>
                <CardTitle>Metas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Leads</span>
                    <span>{totais.leads} / {campanha.meta_leads || 0}</span>
                  </div>
                  <Progress value={campanha.meta_leads ? (totais.leads / campanha.meta_leads) * 100 : 0} />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Conversões</span>
                    <span>{totais.conversoes} / {campanha.meta_conversoes || 0}</span>
                  </div>
                  <Progress value={campanha.meta_conversoes ? (totais.conversoes / campanha.meta_conversoes) * 100 : 0} />
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-muted-foreground">Meta CPL</span>
                  <span>
                    R$ {campanha.meta_cpl || '-'} 
                    <span className="text-muted-foreground ml-1">(atual: R$ {cpl})</span>
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Card UTMs */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Parâmetros UTM</CardTitle>
                <Button variant="ghost" size="sm" onClick={copyUTMUrl}>
                  <Copy className="h-4 w-4 mr-1" /> Copiar URL
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 font-mono text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">utm_source</span>
                    <span>{campanha.utm_source || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">utm_medium</span>
                    <span>{campanha.utm_medium || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">utm_campaign</span>
                    <span>{campanha.utm_campaign || campanha.codigo}</span>
                  </div>
                  {(campanha as any).utm_content && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">utm_content</span>
                      <span>{(campanha as any).utm_content}</span>
                    </div>
                  )}
                  {(campanha as any).utm_term && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">utm_term</span>
                      <span>{(campanha as any).utm_term}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Observações */}
            {campanha.observacoes && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Observações</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {campanha.observacoes}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Tab: Métricas */}
        <TabsContent value="metricas">
          <Card>
            <CardHeader>
              <CardTitle>Métricas Diárias</CardTitle>
              <CardDescription>Acompanhe o desempenho diário da campanha</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingMetricas ? (
                <Skeleton className="h-64 w-full" />
              ) : metricas?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma métrica registrada ainda
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Gasto</TableHead>
                      <TableHead className="text-right">Impressões</TableHead>
                      <TableHead className="text-right">Cliques</TableHead>
                      <TableHead className="text-right">CTR</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right">CPL</TableHead>
                      <TableHead className="text-right">Conversões</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metricas?.map(m => (
                      <TableRow key={m.id}>
                        <TableCell>
                          {format(new Date(m.data), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          R$ {(m.valor_gasto || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {(m.impressoes || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">{m.cliques || 0}</TableCell>
                        <TableCell className="text-right">{(m.ctr || 0).toFixed(2)}%</TableCell>
                        <TableCell className="text-right">{m.leads || 0}</TableCell>
                        <TableCell className="text-right">
                          R$ {(m.cpl || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">{m.conversoes || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Leads */}
        <TabsContent value="leads">
          <Card>
            <CardHeader>
              <CardTitle>Leads da Campanha</CardTitle>
              <CardDescription>Leads gerados por esta campanha</CardDescription>
            </CardHeader>
            <CardContent>
              {leads?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum lead registrado ainda
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Etapa</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads?.map((lead: any) => (
                      <TableRow 
                        key={lead.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/vendas/leads/${lead.id}`)}
                      >
                        <TableCell className="font-medium">{lead.nome}</TableCell>
                        <TableCell>{lead.telefone}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{etapaLabels[lead.etapa] || lead.etapa}</Badge>
                        </TableCell>
                        <TableCell>{lead.vendedor?.nome || '-'}</TableCell>
                        <TableCell>
                          {format(new Date(lead.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: UTMs */}
        <TabsContent value="utms">
          <Card>
            <CardHeader>
              <CardTitle>UTMs Vinculados</CardTitle>
              <CardDescription>Links de rastreamento da campanha</CardDescription>
            </CardHeader>
            <CardContent>
              {!utms || utms.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum UTM registrado
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>URL</TableHead>
                      <TableHead className="text-center">Cliques</TableHead>
                      <TableHead className="text-center">Leads</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {utms?.map((utm: any) => (
                      <TableRow key={utm.id}>
                        <TableCell>
                          <div className="truncate max-w-md font-mono text-xs">
                            {utm.url_completa || utm.url}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{utm.cliques || 0}</TableCell>
                        <TableCell className="text-center">{utm.leads_gerados || 0}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => {
                                navigator.clipboard.writeText(utm.url_completa || utm.url);
                                toast.success('URL copiada!');
                              }}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => window.open(utm.url_completa || utm.url, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Materiais */}
        <TabsContent value="materiais">
          <Card>
            <CardHeader>
              <CardTitle>Materiais de Marketing</CardTitle>
              <CardDescription>Arquivos e criativos da campanha</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground py-8">
                <Image className="h-12 w-12 mx-auto mb-2 opacity-50" />
                Nenhum material cadastrado
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, Settings, Edit, AlertTriangle, 
  ArrowRight, Shuffle, MapPin, BarChart3,
  RefreshCw, History, TrendingUp, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import {
  useDistribuicaoConfig,
  useDistribuicaoVendedores,
  useDistribuicaoHistorico,
  useDistribuicaoEstatisticas,
  useAtualizarConfig,
  useAtualizarVendedor,
  useToggleRecebendoLeads,
  useResetarContadores,
} from '@/hooks/useDistribuicao';
import {
  STATUS_DISTRIBUICAO_LABELS,
  STATUS_DISTRIBUICAO_COLORS,
  TIPO_ATRIBUICAO_LABELS,
  TIPO_ATRIBUICAO_COLORS,
  type StatusDistribuicao,
  type VendedorDistribuicao,
} from '@/types/distribuicao';

export default function DistribuicaoLeads() {
  const [editingVendedor, setEditingVendedor] = useState<VendedorDistribuicao | null>(null);
  const [maxDia, setMaxDia] = useState('');
  const [maxMes, setMaxMes] = useState('');
  const [regioes, setRegioes] = useState('');
  const [canais, setCanais] = useState('');
  const [status, setStatus] = useState<StatusDistribuicao>('ativo');

  // Hooks
  const { data: config, isLoading: loadingConfig } = useDistribuicaoConfig();
  const { data: vendedores, isLoading: loadingVendedores } = useDistribuicaoVendedores();
  const { data: historico, isLoading: loadingHistorico } = useDistribuicaoHistorico();
  const { data: stats } = useDistribuicaoEstatisticas();

  const updateConfig = useAtualizarConfig();
  const updateVendedor = useAtualizarVendedor();
  const toggleRecebendo = useToggleRecebendoLeads();
  const resetContadores = useResetarContadores();

  const handleEditVendedor = (vendedor: VendedorDistribuicao) => {
    setEditingVendedor(vendedor);
    setMaxDia(vendedor.max_leads_dia?.toString() || '');
    setMaxMes(vendedor.max_leads_mes?.toString() || '');
    setRegioes(vendedor.regioes?.join(', ') || '');
    setCanais(vendedor.canais?.join(', ') || '');
    setStatus(vendedor.status);
  };

  const handleSalvarLimites = () => {
    if (!editingVendedor) return;
    
    updateVendedor.mutate({
      id: editingVendedor.id,
      max_leads_dia: maxDia ? parseInt(maxDia) : null,
      max_leads_mes: maxMes ? parseInt(maxMes) : null,
      regioes: regioes ? regioes.split(',').map(r => r.trim()) : [],
      canais: canais ? canais.split(',').map(c => c.trim()) : [],
      status,
    }, {
      onSuccess: () => setEditingVendedor(null),
    });
  };

  const tipoDistribuicaoLabels: Record<string, { label: string; icon: React.ElementType; desc: string }> = {
    round_robin: { label: 'Round Robin (Rotativo)', icon: Shuffle, desc: 'Distribui leads alternadamente entre os vendedores' },
    por_regiao: { label: 'Por Região', icon: MapPin, desc: 'Distribui leads baseado na região do cliente' },
    por_canal: { label: 'Por Canal', icon: Settings, desc: 'Distribui leads baseado no canal de origem' },
    por_performance: { label: 'Por Performance', icon: BarChart3, desc: 'Prioriza vendedores com melhor taxa de conversão' },
    manual: { label: 'Manual', icon: Users, desc: 'Leads precisam ser atribuídos manualmente' },
  };

  const proximoVendedor = vendedores?.filter(v => v.recebendo_leads && v.status === 'ativo')?.[config?.proximo_vendedor || 0];

  const isLoading = loadingConfig || loadingVendedores;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Distribuição de Leads</h1>
          <p className="text-muted-foreground">
            Configure como os leads são distribuídos entre os vendedores
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => resetContadores.mutate()}
            disabled={resetContadores.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${resetContadores.isPending ? 'animate-spin' : ''}`} />
            Resetar Contadores
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <div className="grid gap-4 md:grid-cols-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : (
        <Tabs defaultValue="vendedores" className="space-y-6">
          <TabsList>
            <TabsTrigger value="vendedores">
              <Users className="h-4 w-4 mr-2" />
              Vendedores
            </TabsTrigger>
            <TabsTrigger value="historico">
              <History className="h-4 w-4 mr-2" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="config">
              <Settings className="h-4 w-4 mr-2" />
              Configurações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vendedores" className="space-y-6">
            {/* Cards Estatísticas */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Leads Hoje</p>
                      <p className="text-2xl font-bold">{stats?.total_leads_hoje || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Distribuídos</p>
                      <p className="text-2xl font-bold">{stats?.leads_distribuidos_hoje || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className={stats?.leads_sem_vendedor && stats.leads_sem_vendedor > 0 ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stats?.leads_sem_vendedor && stats.leads_sem_vendedor > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-muted text-muted-foreground'}`}>
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Sem Vendedor</p>
                      <p className="text-2xl font-bold">{stats?.leads_sem_vendedor || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      <ArrowRight className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Próximo</p>
                      <p className="text-lg font-medium truncate max-w-[120px]">
                        {proximoVendedor?.vendedor?.nome || 'N/A'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Alerta se houver leads sem vendedor */}
            {stats?.leads_sem_vendedor && stats.leads_sem_vendedor > 0 && (
              <Alert variant="destructive" className="border-yellow-300 bg-yellow-50 text-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-200">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Existem {stats.leads_sem_vendedor} leads sem vendedor atribuído. Verifique se há vendedores disponíveis.
                </AlertDescription>
              </Alert>
            )}

            {/* Tabela de Vendedores */}
            <Card>
              <CardHeader>
                <CardTitle>Fila de Vendedores</CardTitle>
                <CardDescription>
                  Vendedores na ordem de distribuição round-robin
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {vendedores && vendedores.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Vendedor</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-center">Limite/Dia</TableHead>
                        <TableHead className="text-center">Hoje</TableHead>
                        <TableHead className="text-center">Progresso</TableHead>
                        <TableHead className="text-center">Total</TableHead>
                        <TableHead className="text-center">Recebendo?</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vendedores.map((v, idx) => {
                        const progressDia = v.max_leads_dia && v.max_leads_dia > 0
                          ? ((v.leads_recebidos_hoje || 0) / v.max_leads_dia) * 100 
                          : 0;
                        const limiteAtingido = v.max_leads_dia && v.max_leads_dia > 0 && (v.leads_recebidos_hoje || 0) >= v.max_leads_dia;
                        
                        return (
                          <TableRow key={v.id} className={limiteAtingido ? 'opacity-50' : ''}>
                            <TableCell className="font-mono text-muted-foreground">
                              {idx + 1}
                            </TableCell>
                            <TableCell>
                              <p className="font-medium">{v.vendedor?.nome || 'Sem nome'}</p>
                              <p className="text-xs text-muted-foreground">{v.vendedor?.email}</p>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={STATUS_DISTRIBUICAO_COLORS[v.status]}>
                                {STATUS_DISTRIBUICAO_LABELS[v.status]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {v.max_leads_dia || '∞'}
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {v.leads_recebidos_hoje || 0}
                            </TableCell>
                            <TableCell className="text-center">
                              {v.max_leads_dia && v.max_leads_dia > 0 ? (
                                <div className="flex items-center gap-2 justify-center">
                                  <Progress 
                                    value={Math.min(progressDia, 100)} 
                                    className="w-20 h-2"
                                  />
                                  <span className="text-xs text-muted-foreground w-8">
                                    {Math.round(progressDia)}%
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground">
                              {v.total_leads_historico || 0}
                            </TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={v.recebendo_leads}
                                onCheckedChange={(checked) => toggleRecebendo.mutate({ id: v.id, recebendo_leads: checked })}
                                disabled={v.status !== 'ativo'}
                              />
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleEditVendedor(v)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="py-12 text-center">
                    <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="text-lg font-medium">Nenhum vendedor configurado</p>
                    <p className="text-muted-foreground">
                      Configure vendedores para distribuição de leads
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historico" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Histórico de Atribuições
                </CardTitle>
                <CardDescription>
                  Últimas 50 atribuições de leads
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loadingHistorico ? (
                  <div className="p-6 space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16" />
                    ))}
                  </div>
                ) : historico && historico.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lead</TableHead>
                        <TableHead>Vendedor</TableHead>
                        <TableHead className="text-center">Tipo</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead className="text-right">Quando</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historico.map((h) => (
                        <TableRow key={h.id}>
                          <TableCell>
                            <p className="font-medium">{h.lead?.nome || 'Lead removido'}</p>
                            <p className="text-xs text-muted-foreground">{h.lead?.telefone}</p>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium">{h.vendedor?.nome || '-'}</p>
                            {h.vendedor_anterior && (
                              <p className="text-xs text-muted-foreground">
                                Anterior: {h.vendedor_anterior.nome}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={TIPO_ATRIBUICAO_COLORS[h.tipo]}>
                              {TIPO_ATRIBUICAO_LABELS[h.tipo]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {h.motivo || '-'}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            <div className="flex items-center justify-end gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(h.created_at), { 
                                addSuffix: true, 
                                locale: ptBR 
                              })}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="py-12 text-center">
                    <History className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="text-lg font-medium">Nenhum histórico</p>
                    <p className="text-muted-foreground">
                      O histórico aparecerá quando leads forem distribuídos
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config" className="space-y-6">
            {/* Card Configuração */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Tipo de Distribuição
                </CardTitle>
                <CardDescription>
                  Escolha como os leads serão distribuídos automaticamente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Método de Distribuição</Label>
                  <Select 
                    value={config?.tipo_distribuicao || 'round_robin'} 
                    onValueChange={(tipo) => updateConfig.mutate({ tipo_distribuicao: tipo })}
                  >
                    <SelectTrigger className="w-80">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(tipoDistribuicaoLabels).map(([value, { label, desc }]) => (
                        <SelectItem key={value} value={value}>
                          <div>
                            <p className="font-medium">{label}</p>
                            <p className="text-xs text-muted-foreground">{desc}</p>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <p className="font-medium">Distribuição Ativa</p>
                    <p className="text-sm text-muted-foreground">
                      Leads serão distribuídos automaticamente
                    </p>
                  </div>
                  <Switch
                    checked={config?.ativo ?? true}
                    onCheckedChange={(ativo) => updateConfig.mutate({ ativo })}
                  />
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <p className="font-medium">Distribuir Fins de Semana</p>
                    <p className="text-sm text-muted-foreground">
                      Distribuir leads aos sábados e domingos
                    </p>
                  </div>
                  <Switch
                    checked={config?.distribuir_fins_semana ?? false}
                    onCheckedChange={(distribuir_fins_semana) => updateConfig.mutate({ distribuir_fins_semana })}
                  />
                </div>

                <div className="pt-4 border-t grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Limite Diário Padrão</Label>
                    <Input
                      type="number"
                      value={config?.limite_diario_padrao || ''}
                      onChange={(e) => updateConfig.mutate({ limite_diario_padrao: parseInt(e.target.value) || 20 })}
                      placeholder="20"
                    />
                    <p className="text-xs text-muted-foreground">
                      Usado quando vendedor não tem limite definido
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Hora de Reset</Label>
                    <Select
                      value={String(config?.resetar_contadores_hora || 0)}
                      onValueChange={(h) => updateConfig.mutate({ resetar_contadores_hora: parseInt(h) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[...Array(24)].map((_, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {String(i).padStart(2, '0')}:00
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Hora para resetar contadores diários
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Modal Editar Vendedor */}
      <Dialog open={!!editingVendedor} onOpenChange={() => setEditingVendedor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar {editingVendedor?.vendedor?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as StatusDistribuicao)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_DISTRIBUICAO_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Máximo Leads/Dia</Label>
                <Input 
                  type="number" 
                  value={maxDia} 
                  onChange={(e) => setMaxDia(e.target.value)}
                  placeholder="Sem limite"
                />
              </div>
              <div className="space-y-2">
                <Label>Máximo Leads/Mês</Label>
                <Input 
                  type="number" 
                  value={maxMes} 
                  onChange={(e) => setMaxMes(e.target.value)}
                  placeholder="Sem limite"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Regiões (opcional)</Label>
              <Input 
                value={regioes} 
                onChange={(e) => setRegioes(e.target.value)}
                placeholder="SP, RJ, MG..."
              />
              <p className="text-xs text-muted-foreground">
                Separar por vírgula. Deixe em branco para todas.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Canais (opcional)</Label>
              <Input 
                value={canais} 
                onChange={(e) => setCanais(e.target.value)}
                placeholder="site, google, facebook..."
              />
              <p className="text-xs text-muted-foreground">
                Separar por vírgula. Deixe em branco para todos.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingVendedor(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvarLimites} disabled={updateVendedor.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

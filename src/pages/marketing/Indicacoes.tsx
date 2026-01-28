import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, Search, Gift, Users, TrendingUp,
  DollarSign, Phone, Check, Settings, Trophy, Clock
} from 'lucide-react';
import { useIndicacoes, useProgramaIndicacao, useRecompensarIndicacao, useIndicacoesStats, useTopIndicadores } from '@/hooks/useMarketing';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { IndicacaoFormDialog } from '@/components/marketing/IndicacaoFormDialog';
import { ConfigurarProgramaModal } from '@/components/marketing/ConfigurarProgramaModal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

const statusConfig: Record<string, { label: string; className: string }> = {
  pendente: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800' },
  contatado: { label: 'Contatado', className: 'bg-blue-100 text-blue-800' },
  convertido: { label: 'Convertido', className: 'bg-green-100 text-green-800' },
  recompensado: { label: 'Recompensado', className: 'bg-purple-100 text-purple-800' },
  expirado: { label: 'Expirado', className: 'bg-gray-100 text-gray-800' },
  cancelado: { label: 'Cancelado', className: 'bg-red-100 text-red-800' },
};

export default function Indicacoes() {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('todas');
  const [showForm, setShowForm] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [recompensarId, setRecompensarId] = useState<string | null>(null);

  const { data: programa } = useProgramaIndicacao();
  const { data: stats, isLoading: statsLoading } = useIndicacoesStats();
  const { data: indicacoes, isLoading } = useIndicacoes();
  const { data: topIndicadores, isLoading: topLoading } = useTopIndicadores();
  const recompensarMutation = useRecompensarIndicacao();

  // Pendentes de pagamento
  const pendentesPagamento = indicacoes?.filter(i => i.status === 'convertido' && !i.recompensa_paga) || [];

  // Filtrar indicações baseado na tab
  const getFilteredByTab = () => {
    let filtered = indicacoes || [];
    
    if (tab === 'pendente') {
      filtered = filtered.filter(i => i.status === 'pendente');
    } else if (tab === 'convertido') {
      filtered = filtered.filter(i => i.status === 'convertido');
    } else if (tab === 'recompensado') {
      filtered = filtered.filter(i => i.status === 'recompensado');
    }
    
    // Aplicar busca
    if (search) {
      filtered = filtered.filter(i =>
        i.indicador_nome?.toLowerCase().includes(search.toLowerCase()) ||
        i.indicado_nome.toLowerCase().includes(search.toLowerCase()) ||
        i.codigo.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    return filtered;
  };

  const filteredIndicacoes = getFilteredByTab();

  const handleRecompensar = () => {
    if (recompensarId) {
      recompensarMutation.mutate(recompensarId, {
        onSuccess: () => setRecompensarId(null),
      });
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Programa de Indicações</h1>
          <p className="text-muted-foreground">
            Gerencie indicações de associados
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowConfigModal(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Configurar Programa
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Indicação
          </Button>
        </div>
      </div>

      {/* Programa Ativo */}
      {programa && (
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                <Gift className="h-6 w-6" />
              </div>
              <div>
                <p className="font-medium">{programa.nome}</p>
                <p className="text-sm text-muted-foreground">
                  Recompensa: R$ {programa.valor_indicador.toFixed(2)} por indicação convertida
                </p>
              </div>
            </div>
            <Badge className="bg-green-100 text-green-800">Ativo</Badge>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Indicações do Mês</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalMes || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Conversões</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-green-600">{stats?.convertidasMes || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-yellow-600">{stats?.pendentes || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Valor Pago (Mês)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">
                R$ {(stats?.valorPagoMes || 0).toFixed(2)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filtro e Busca */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tabs e Tabela */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="todas">Todas</TabsTrigger>
          <TabsTrigger value="pendente">Pendentes</TabsTrigger>
          <TabsTrigger value="convertido">Convertidas</TabsTrigger>
          <TabsTrigger value="recompensado">Recompensadas</TabsTrigger>
          <TabsTrigger value="pendentes-pagamento" className="flex items-center gap-2">
            Pend. Pagamento
            {pendentesPagamento.length > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                {pendentesPagamento.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="top">
            <Trophy className="mr-1 h-4 w-4" />
            Top Indicadores
          </TabsTrigger>
        </TabsList>

        {/* Tab Todas/Pendentes/Convertidas/Recompensadas */}
        {['todas', 'pendente', 'convertido', 'recompensado'].map(tabValue => (
          <TabsContent key={tabValue} value={tabValue} className="mt-4">
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-6 space-y-3">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : filteredIndicacoes?.length === 0 ? (
                  <div className="py-12 text-center">
                    <Gift className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="text-lg font-medium">Nenhuma indicação encontrada</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Indicador</TableHead>
                        <TableHead>Indicado</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Recompensa</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredIndicacoes?.map(indicacao => (
                        <TableRow key={indicacao.id}>
                          <TableCell className="font-mono text-sm">
                            {indicacao.codigo}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{indicacao.indicador_nome}</p>
                              <p className="text-xs text-muted-foreground">
                                {indicacao.indicador_telefone}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{indicacao.indicado_nome}</p>
                              <p className="text-xs text-muted-foreground">
                                {indicacao.indicado_telefone}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusConfig[indicacao.status]?.className}>
                              {statusConfig[indicacao.status]?.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(indicacao.data_indicacao), 'dd/MM/yyyy', { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            {indicacao.valor_recompensa ? (
                              <span className={indicacao.recompensa_paga ? 'text-green-600' : 'text-orange-600'}>
                                R$ {indicacao.valor_recompensa.toFixed(2)}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon">
                                <Phone className="h-4 w-4" />
                              </Button>
                              {indicacao.status === 'convertido' && !indicacao.recompensa_paga && (
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => setRecompensarId(indicacao.id)}
                                >
                                  <Check className="h-4 w-4 text-green-600" />
                                </Button>
                              )}
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
        ))}

        {/* Tab Pendentes de Pagamento */}
        <TabsContent value="pendentes-pagamento" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Indicações Pendentes de Pagamento</CardTitle>
              <CardDescription>
                Indicações já convertidas aguardando pagamento de recompensa
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : pendentesPagamento.length === 0 ? (
                <div className="py-12 text-center">
                  <Check className="mx-auto h-12 w-12 text-green-500/50 mb-4" />
                  <p className="text-lg font-medium">Nenhum pagamento pendente</p>
                  <p className="text-muted-foreground">
                    Todas as recompensas foram pagas!
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Indicador</TableHead>
                      <TableHead>Indicado</TableHead>
                      <TableHead>Data Conversão</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendentesPagamento.map(indicacao => (
                      <TableRow key={indicacao.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{indicacao.indicador_nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {indicacao.indicador_telefone}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{indicacao.indicado_nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {indicacao.indicado_telefone}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {indicacao.data_conversao 
                            ? format(new Date(indicacao.data_conversao), 'dd/MM/yyyy', { locale: ptBR })
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          R$ {(indicacao.valor_recompensa || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm"
                            onClick={() => setRecompensarId(indicacao.id)}
                          >
                            <DollarSign className="mr-1 h-4 w-4" />
                            Pagar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Top Indicadores */}
        <TabsContent value="top" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Ranking de Indicadores
              </CardTitle>
              <CardDescription>
                Associados que mais indicaram novos associados
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {topLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !topIndicadores?.length ? (
                <div className="py-12 text-center">
                  <Trophy className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-lg font-medium">Nenhum indicador ainda</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Posição</TableHead>
                      <TableHead>Indicador</TableHead>
                      <TableHead className="text-center">Total Indicações</TableHead>
                      <TableHead className="text-center">Convertidas</TableHead>
                      <TableHead className="text-right">Valor Recebido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topIndicadores?.map((ind, idx) => (
                      <TableRow key={ind.indicador_id || ind.indicador_nome}>
                        <TableCell>
                          <div className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                            idx === 0 && "bg-yellow-100 text-yellow-700",
                            idx === 1 && "bg-gray-100 text-gray-700",
                            idx === 2 && "bg-orange-100 text-orange-700",
                            idx > 2 && "bg-muted"
                          )}>
                            {idx + 1}º
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{ind.indicador_nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {ind.indicador_telefone}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-medium">{ind.total}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-green-600 font-medium">{ind.convertidas}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-medium">
                            R$ {ind.valorRecebido.toFixed(2)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <IndicacaoFormDialog
        open={showForm}
        onClose={() => setShowForm(false)}
      />

      <AlertDialog open={!!recompensarId} onOpenChange={() => setRecompensarId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Pagamento de Recompensa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja marcar esta indicação como recompensada? 
              Esta ação registra que o pagamento foi realizado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRecompensar}
              disabled={recompensarMutation.isPending}
            >
              Confirmar Pagamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal Configurar Programa */}
      <ConfigurarProgramaModal
        open={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        programa={programa}
      />
    </div>
  );
}

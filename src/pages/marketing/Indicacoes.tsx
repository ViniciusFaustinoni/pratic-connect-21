import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, Search, Gift, Users, TrendingUp,
  DollarSign, Phone, Check, Settings
} from 'lucide-react';
import { useIndicacoes, useProgramaIndicacao, useRecompensarIndicacao, useMarketingStats } from '@/hooks/useMarketing';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { IndicacaoFormDialog } from '@/components/marketing/IndicacaoFormDialog';
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

const statusConfig: Record<string, { label: string; className: string }> = {
  pendente: { label: 'Pendente', className: 'bg-gray-100 text-gray-800' },
  contatado: { label: 'Contatado', className: 'bg-blue-100 text-blue-800' },
  convertido: { label: 'Convertido', className: 'bg-green-100 text-green-800' },
  recompensado: { label: 'Recompensado', className: 'bg-purple-100 text-purple-800' },
  expirado: { label: 'Expirado', className: 'bg-yellow-100 text-yellow-800' },
  cancelado: { label: 'Cancelado', className: 'bg-red-100 text-red-800' },
};

export default function Indicacoes() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('todas');
  const [showForm, setShowForm] = useState(false);
  const [recompensarId, setRecompensarId] = useState<string | null>(null);

  const { data: programa } = useProgramaIndicacao();
  const { data: stats } = useMarketingStats();
  const { data: indicacoes, isLoading } = useIndicacoes(
    tab !== 'todas' ? { status: tab } : undefined
  );
  const recompensarMutation = useRecompensarIndicacao();

  const filteredIndicacoes = indicacoes?.filter(i =>
    i.indicador_nome?.toLowerCase().includes(search.toLowerCase()) ||
    i.indicado_nome.toLowerCase().includes(search.toLowerCase()) ||
    i.codigo.toLowerCase().includes(search.toLowerCase())
  );

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
          <Button variant="outline" onClick={() => navigate('/marketing/programa')}>
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
            <div className="text-2xl font-bold">{stats?.indicacoesMes || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Conversões</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.indicacoesConvertidas || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.indicacoesMes 
                ? ((stats.indicacoesConvertidas / stats.indicacoesMes) * 100).toFixed(1)
                : 0}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Recompensas Pendentes</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {indicacoes?.filter(i => i.status === 'convertido' && !i.recompensa_paga).length || 0}
            </div>
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
        </TabsList>

        <TabsContent value={tab} className="mt-4">
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
    </div>
  );
}

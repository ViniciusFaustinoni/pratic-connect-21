import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Settings, Users, TrendingUp, Pause, Play, UserMinus, UserPlus,
  MoreHorizontal, RefreshCw, AlertCircle, Clock, GripVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useConfiguracaoDistribuicao,
  useAtualizarConfiguracao,
  useVendedoresDistribuicao,
  useAtualizarStatusVendedor,
  useAtualizarLimiteVendedor,
  useEstatisticasDistribuicao,
  useVendedoresDisponiveis,
  useAdicionarVendedorDistribuicao,
  useResetarContadores,
  useHistoricoDistribuicao,
} from '@/hooks/useDistribuicao';
import { STATUS_DISTRIBUICAO_LABELS, STATUS_DISTRIBUICAO_COLORS } from '@/types/distribuicao';
import type { StatusDistribuicao } from '@/types/distribuicao';

export default function DistribuicaoConfig() {
  const [modalAdicionarAberto, setModalAdicionarAberto] = useState(false);
  const [vendedorSelecionado, setVendedorSelecionado] = useState('');
  const [editandoLimite, setEditandoLimite] = useState<string | null>(null);
  const [novoLimite, setNovoLimite] = useState(0);
  
  // Queries
  const { data: config, isLoading: loadingConfig } = useConfiguracaoDistribuicao();
  const { data: vendedores, isLoading: loadingVendedores } = useVendedoresDistribuicao();
  const { data: estatisticas } = useEstatisticasDistribuicao();
  const { data: disponiveis } = useVendedoresDisponiveis();
  const { data: historico } = useHistoricoDistribuicao({ limit: 10 });
  
  // Mutations
  const atualizarConfig = useAtualizarConfiguracao();
  const atualizarStatus = useAtualizarStatusVendedor();
  const atualizarLimite = useAtualizarLimiteVendedor();
  const adicionarVendedor = useAdicionarVendedorDistribuicao();
  const resetarContadores = useResetarContadores();
  
  const handleToggleDistribuicao = () => {
    if (!config) return;
    atualizarConfig.mutate({ ativo: !config.ativo });
  };
  
  const handleAdicionarVendedor = () => {
    if (!vendedorSelecionado) return;
    adicionarVendedor.mutate(vendedorSelecionado, {
      onSuccess: () => {
        setModalAdicionarAberto(false);
        setVendedorSelecionado('');
      },
    });
  };
  
  const handleSalvarLimite = (vendedor_id: string) => {
    atualizarLimite.mutate({ vendedor_id, limite_diario: novoLimite }, {
      onSuccess: () => setEditandoLimite(null),
    });
  };
  
  if (loadingConfig || loadingVendedores) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }
  
  return (
    <div className="p-6 space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Distribuição de Leads</h1>
          <p className="text-muted-foreground">Configure a distribuição automática de leads para vendedores</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => resetarContadores.mutate()}
            disabled={resetarContadores.isPending}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", resetarContadores.isPending && "animate-spin")} />
            Resetar Contadores
          </Button>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted">
            <span className="text-sm font-medium">Distribuição</span>
            <Switch 
              checked={config?.ativo || false}
              onCheckedChange={handleToggleDistribuicao}
            />
            <Badge variant={config?.ativo ? "default" : "secondary"}>
              {config?.ativo ? 'Ativa' : 'Inativa'}
            </Badge>
          </div>
        </div>
      </div>
      
      {/* CARDS DE ESTATÍSTICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vendedores Ativos</p>
                <p className="text-2xl font-bold">{estatisticas?.total_vendedores_ativos || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Distribuídos Hoje</p>
                <p className="text-2xl font-bold">{estatisticas?.leads_distribuidos_hoje || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-500/10">
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Leads Hoje</p>
                <p className="text-2xl font-bold">{estatisticas?.total_leads_hoje || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-orange-500/10">
                <AlertCircle className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sem Vendedor</p>
                <p className="text-2xl font-bold">{estatisticas?.leads_sem_vendedor || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* TABELA DE VENDEDORES */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Vendedores na Distribuição</CardTitle>
              <CardDescription>Gerencie quem recebe leads automaticamente</CardDescription>
            </div>
            <Dialog open={modalAdicionarAberto} onOpenChange={setModalAdicionarAberto}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Vendedor</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <Label>Selecione o vendedor</Label>
                  <Select value={vendedorSelecionado} onValueChange={setVendedorSelecionado}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {disponiveis?.map((v: any) => (
                        <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(!disponiveis || disponiveis.length === 0) && (
                    <Alert className="mt-4">
                      <AlertDescription>
                        Todos os vendedores já estão na distribuição.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setModalAdicionarAberto(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleAdicionarVendedor} disabled={!vendedorSelecionado}>
                    Adicionar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-center">Leads Hoje</TableHead>
                  <TableHead className="text-center">Limite</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendedores?.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{v.vendedor?.nome}</p>
                        <p className="text-sm text-muted-foreground">{v.vendedor?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {v.leads_hoje}
                    </TableCell>
                    <TableCell className="text-center">
                      {editandoLimite === v.vendedor_id ? (
                        <div className="flex items-center justify-center gap-1">
                          <Input
                            type="number"
                            value={novoLimite}
                            onChange={(e) => setNovoLimite(parseInt(e.target.value) || 0)}
                            className="w-16 h-8 text-center"
                            min={0}
                          />
                          <Button size="sm" variant="ghost" onClick={() => handleSalvarLimite(v.vendedor_id)}>
                            OK
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditandoLimite(v.vendedor_id);
                            setNovoLimite(v.limite_diario || config?.limite_diario_padrao || 20);
                          }}
                        >
                          {v.limite_diario || config?.limite_diario_padrao || 20}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn(STATUS_DISTRIBUICAO_COLORS[v.status as StatusDistribuicao])}>
                        {STATUS_DISTRIBUICAO_LABELS[v.status as StatusDistribuicao]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {v.status === 'ativo' ? (
                            <DropdownMenuItem
                              onClick={() => atualizarStatus.mutate({ vendedor_id: v.vendedor_id, status: 'pausado' })}
                            >
                              <Pause className="h-4 w-4 mr-2" />
                              Pausar
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => atualizarStatus.mutate({ vendedor_id: v.vendedor_id, status: 'ativo' })}
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Ativar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => atualizarStatus.mutate({ vendedor_id: v.vendedor_id, status: 'ferias' })}
                          >
                            <UserMinus className="h-4 w-4 mr-2" />
                            Marcar Férias
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {(!vendedores || vendedores.length === 0) && (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">Nenhum vendedor configurado</p>
                <p className="text-sm">Adicione vendedores para iniciar a distribuição</p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* SIDEBAR - HISTÓRICO E CONFIG */}
        <div className="space-y-6">
          {/* CONFIGURAÇÕES */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configurações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Limite diário padrão</Label>
                <Input
                  type="number"
                  value={config?.limite_diario_padrao || 20}
                  onChange={(e) => atualizarConfig.mutate({ 
                    limite_diario_padrao: parseInt(e.target.value) || 20 
                  })}
                  min={1}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label>Distribuir fins de semana</Label>
                <Switch
                  checked={config?.distribuir_fins_semana || false}
                  onCheckedChange={(checked) => atualizarConfig.mutate({ distribuir_fins_semana: checked })}
                />
              </div>
            </CardContent>
          </Card>
          
          {/* HISTÓRICO RECENTE */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Últimas Distribuições
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {historico?.slice(0, 5).map((h) => (
                  <div key={h.id} className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{h.lead?.nome}</p>
                      <p className="text-muted-foreground text-xs">→ {h.vendedor?.nome}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {h.motivo}
                    </Badge>
                  </div>
                ))}
                
                {(!historico || historico.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma distribuição recente
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { Settings, History, Calculator, TrendingUp, TrendingDown, Minus, Save, AlertTriangle, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/hooks/usePermissions';
import { 
  useFaixasCotas, 
  useFaixasCotasHistorico,
  useAtualizarAjusteFaixa,
  useAtualizarAjusteGrupo,
  useLimitesFipe,
  useTotalCotasAtivas,
  formatFipe,
  formatPercentual,
  type FaixaCota,
} from '@/hooks/useFaixasCotas';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function FaixasCotas() {
  const { isDiretor, isAdminMaster, isDesenvolvedor } = usePermissions();
  const hasAccess = isDiretor || isAdminMaster || isDesenvolvedor;
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [grupoFipeInicio, setGrupoFipeInicio] = useState<string>('');
  const [grupoFipeFim, setGrupoFipeFim] = useState<string>('');
  const [grupoAjuste, setGrupoAjuste] = useState<string>('');
  
  const { data: faixas, isLoading: loadingFaixas } = useFaixasCotas();
  const { data: historico, isLoading: loadingHistorico } = useFaixasCotasHistorico();
  const { data: limites } = useLimitesFipe();
  const { data: totalCotas } = useTotalCotasAtivas();
  
  const atualizarAjuste = useAtualizarAjusteFaixa();
  const atualizarGrupo = useAtualizarAjusteGrupo();
  
  // Estatísticas
  const stats = useMemo(() => {
    if (!faixas) return null;
    
    const comDesconto = faixas.filter(f => f.ajuste_percentual < 0).length;
    const comAdicao = faixas.filter(f => f.ajuste_percentual > 0).length;
    const neutras = faixas.filter(f => f.ajuste_percentual === 0).length;
    
    return { comDesconto, comAdicao, neutras, total: faixas.length };
  }, [faixas]);
  
  // Opções para select de faixas
  const faixaOptions = useMemo(() => {
    return faixas?.map(f => ({
      value: f.fipe_de.toString(),
      label: formatFipe(f.fipe_de),
    })) || [];
  }, [faixas]);
  
  const handleStartEdit = (faixa: FaixaCota) => {
    setEditingId(faixa.id);
    setEditValue(faixa.ajuste_percentual.toString());
  };
  
  const handleSaveEdit = () => {
    if (!editingId) return;
    
    const valor = parseFloat(editValue);
    if (isNaN(valor) || valor < -100 || valor > 100) {
      return;
    }
    
    atualizarAjuste.mutate({ faixaId: editingId, ajustePercentual: valor });
    setEditingId(null);
    setEditValue('');
  };
  
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };
  
  const handleAplicarGrupo = () => {
    const inicio = parseFloat(grupoFipeInicio);
    const fim = parseFloat(grupoFipeFim);
    const ajuste = parseFloat(grupoAjuste);
    
    if (isNaN(inicio) || isNaN(fim) || isNaN(ajuste)) {
      return;
    }
    
    atualizarGrupo.mutate({
      fipeInicio: inicio,
      fipeFim: fim,
      ajustePercentual: ajuste,
    });
    
    setGrupoFipeInicio('');
    setGrupoFipeFim('');
    setGrupoAjuste('');
  };
  
  const getAjusteBadge = (ajuste: number) => {
    if (ajuste < 0) {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <TrendingDown className="h-3 w-3 mr-1" />
          {formatPercentual(ajuste)}
        </Badge>
      );
    }
    if (ajuste > 0) {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <TrendingUp className="h-3 w-3 mr-1" />
          {formatPercentual(ajuste)}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-gray-50 text-gray-600">
        <Minus className="h-3 w-3 mr-1" />
        0%
      </Badge>
    );
  };
  
  if (!hasAccess) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
        <p className="text-muted-foreground">
          Apenas diretores e administradores podem acessar esta página.
        </p>
      </div>
    );
  }
  
  if (loadingFaixas) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Configuração de Faixas de Cotas
        </h1>
        <p className="text-muted-foreground">
          Gerencie os ajustes percentuais (desconto/adição) para cada faixa de valor FIPE
        </p>
      </div>
      
      {/* Alerta informativo */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Como funciona o sistema de cotas</AlertTitle>
        <AlertDescription>
          Cada veículo é classificado em uma faixa baseada no valor FIPE. 
          O desconto (-) beneficia associados de faixas menores, enquanto a adição (+) é redistribuída entre todos.
          Limites atuais: {formatFipe(limites?.minimo || 20000)} a {formatFipe(limites?.maximo || 180000)}
        </AlertDescription>
      </Alert>
      
      {/* Estatísticas */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total de Faixas</div>
            <p className="text-2xl font-bold">{stats?.total || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-4 w-4 text-green-600" />
              Com Desconto
            </div>
            <p className="text-2xl font-bold text-green-600">{stats?.comDesconto || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-4 w-4 text-red-600" />
              Com Adição
            </div>
            <p className="text-2xl font-bold text-red-600">{stats?.comAdicao || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total de Cotas Ativas</div>
            <p className="text-2xl font-bold">{totalCotas?.toLocaleString('pt-BR') || 0}</p>
          </CardContent>
        </Card>
      </div>
      
      <Tabs defaultValue="faixas">
        <TabsList>
          <TabsTrigger value="faixas">Faixas de Cotas</TabsTrigger>
          <TabsTrigger value="historico">Histórico de Alterações</TabsTrigger>
        </TabsList>
        
        <TabsContent value="faixas" className="space-y-4">
          {/* Aplicar em grupo */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Aplicar Ajuste em Grupo</CardTitle>
              <CardDescription>
                Aplique o mesmo percentual para um intervalo de faixas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-4">
                <div className="space-y-1.5">
                  <Label>De (FIPE)</Label>
                  <Select value={grupoFipeInicio} onValueChange={setGrupoFipeInicio}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {faixaOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Até (FIPE)</Label>
                  <Select value={grupoFipeFim} onValueChange={setGrupoFipeFim}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {faixaOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Ajuste (%)</Label>
                  <Input 
                    type="number"
                    placeholder="-10 ou +15"
                    value={grupoAjuste}
                    onChange={(e) => setGrupoAjuste(e.target.value)}
                    className="w-32"
                    min={-100}
                    max={100}
                    step={0.5}
                  />
                </div>
                <Button 
                  onClick={handleAplicarGrupo}
                  disabled={!grupoFipeInicio || !grupoFipeFim || !grupoAjuste || atualizarGrupo.isPending}
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  Aplicar
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Tabela de faixas */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Faixas de Cotas (33 faixas de R$ 5.000)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Faixa FIPE</TableHead>
                    <TableHead className="text-center">Cotas</TableHead>
                    <TableHead className="text-center">Ajuste (%)</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {faixas?.map((faixa) => (
                    <TableRow key={faixa.id}>
                      <TableCell>
                        <span className="font-medium">{formatFipe(faixa.fipe_de)}</span>
                        <span className="text-muted-foreground mx-2">até</span>
                        <span className="font-medium">{formatFipe(faixa.fipe_ate)}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{faixa.quantidade_cotas}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {editingId === faixa.id ? (
                          <Input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-24 mx-auto text-center"
                            min={-100}
                            max={100}
                            step={0.5}
                            autoFocus
                          />
                        ) : (
                          getAjusteBadge(faixa.ajuste_percentual)
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingId === faixa.id ? (
                          <div className="flex justify-end gap-2">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={handleCancelEdit}
                            >
                              Cancelar
                            </Button>
                            <Button 
                              size="sm"
                              onClick={handleSaveEdit}
                              disabled={atualizarAjuste.isPending}
                            >
                              <Save className="h-3 w-3 mr-1" />
                              Salvar
                            </Button>
                          </div>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleStartEdit(faixa)}
                                >
                                  Editar
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Clique para editar o ajuste percentual
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="historico">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico de Alterações
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHistorico ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : historico?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma alteração registrada ainda.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Ajuste Anterior</TableHead>
                      <TableHead>Ajuste Novo</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historico?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          {format(new Date(item.alterado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {item.ajuste_anterior !== null ? formatPercentual(item.ajuste_anterior) : '-'}
                        </TableCell>
                        <TableCell>
                          {item.ajuste_novo !== null ? formatPercentual(item.ajuste_novo) : '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.motivo || '-'}
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
    </div>
  );
}

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Plus, Pencil, Trash2, Settings, Calendar, Trophy, TrendingUp, Percent, DollarSign, Target, Info } from 'lucide-react';
import { useComissoesFaixas } from '@/hooks/useComissoesFaixas';
import { useComissoesCampanhas } from '@/hooks/useComissoesCampanhas';
import { PermissionGate } from '@/components/PermissionGate';
import { Skeleton } from '@/components/ui/skeleton';
import type {
  FaixaAdesao,
  FaixaRecorrente,
  FaixaProducao,
  FaixaCrescimento,
  FaixaClassificacao,
  ParametroComissao,
  Campanha,
} from '@/types/comissoes';

const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function ComissoesConfig() {
  const {
    faixasAdesao,
    faixasRecorrente,
    faixasProducao,
    faixasCrescimento,
    faixasClassificacao,
    parametros,
    isLoading,
    addFaixa,
    updateFaixa,
    deleteFaixa,
    updateParametro,
  } = useComissoesFaixas();

  const {
    campanhas,
    criarCampanha,
    fecharCampanha,
  } = useComissoesCampanhas();

  const [abaAtiva, setAbaAtiva] = useState('adesao');
  const [subAbaRecorrente, setSubAbaRecorrente] = useState<'interno' | 'externo'>('interno');
  const [subAbaCrescimento, setSubAbaCrescimento] = useState<'interno' | 'externo'>('interno');
  const [filtroClassificacao, setFiltroClassificacao] = useState<{ tipo: string; categoria: string }>({ tipo: 'interno', categoria: 'mais_1_ano' });

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<string>('');
  const [editingItem, setEditingItem] = useState<unknown>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ tabela: string; id: string } | null>(null);

  // Form data para cada tipo
  const [formAdesao, setFormAdesao] = useState({ quantidade_vendas_minima: 0, percentual_adesao: 0, ativo: true });
  const [formRecorrente, setFormRecorrente] = useState({ tipo_consultor: 'interno', placas_minima: 0, placas_maxima: null as number | null, percentual_recorrente: 0, ativo: true });
  const [formProducao, setFormProducao] = useState({ placas_confirmadas_minima: 0, valor_remuneracao: 0, ativo: true });
  const [formCrescimento, setFormCrescimento] = useState({ tipo_consultor: 'interno', placas_confirmadas: 0, valor_remuneracao: 0, percentual_minimo_recorrente: 0, ativo: true });
  const [formClassificacao, setFormClassificacao] = useState({ tipo_consultor: 'interno', categoria_tempo: 'mais_1_ano', posicao_ranking: 1, faixa_placas_base: 300, valor_premio: 0, ativo: true });
  const [formParametro, setFormParametro] = useState({ chave: '', valor: '' });

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  // Handlers para abrir dialogs
  const handleOpenDialog = (type: string, item?: unknown) => {
    setDialogType(type);
    setEditingItem(item || null);

    if (type === 'adesao') {
      const data = item as FaixaAdesao | undefined;
      setFormAdesao({
        quantidade_vendas_minima: data?.quantidade_vendas_minima || 0,
        percentual_adesao: data?.percentual_adesao || 0,
        ativo: data?.ativo ?? true,
      });
    } else if (type === 'recorrente') {
      const data = item as FaixaRecorrente | undefined;
      setFormRecorrente({
        tipo_consultor: data?.tipo_consultor || subAbaRecorrente,
        placas_minima: data?.placas_minima || 0,
        placas_maxima: data?.placas_maxima ?? null,
        percentual_recorrente: data?.percentual_recorrente || 0,
        ativo: data?.ativo ?? true,
      });
    } else if (type === 'producao') {
      const data = item as FaixaProducao | undefined;
      setFormProducao({
        placas_confirmadas_minima: data?.placas_confirmadas_minima || 0,
        valor_remuneracao: data?.valor_remuneracao || 0,
        ativo: data?.ativo ?? true,
      });
    } else if (type === 'crescimento') {
      const data = item as FaixaCrescimento | undefined;
      setFormCrescimento({
        tipo_consultor: data?.tipo_consultor || subAbaCrescimento,
        placas_confirmadas: data?.placas_confirmadas || 0,
        valor_remuneracao: data?.valor_remuneracao || 0,
        percentual_minimo_recorrente: data?.percentual_minimo_recorrente || 0,
        ativo: data?.ativo ?? true,
      });
    } else if (type === 'classificacao') {
      const data = item as FaixaClassificacao | undefined;
      setFormClassificacao({
        tipo_consultor: data?.tipo_consultor || filtroClassificacao.tipo,
        categoria_tempo: data?.categoria_tempo || filtroClassificacao.categoria,
        posicao_ranking: data?.posicao_ranking || 1,
        faixa_placas_base: data?.faixa_placas_base || 300,
        valor_premio: data?.valor_premio || 0,
        ativo: data?.ativo ?? true,
      });
    } else if (type === 'parametro') {
      const data = item as ParametroComissao | undefined;
      setFormParametro({
        chave: data?.chave || '',
        valor: data?.valor || '',
      });
    }

    setDialogOpen(true);
  };

  const handleSave = async () => {
    const tabelaMap: Record<string, string> = {
      adesao: 'comissoes_faixas_adesao',
      recorrente: 'comissoes_faixas_recorrente',
      producao: 'comissoes_faixas_producao',
      crescimento: 'comissoes_faixas_crescimento',
      classificacao: 'comissoes_faixas_classificacao',
    };

    try {
      if (dialogType === 'parametro') {
        await updateParametro.mutateAsync({ chave: formParametro.chave, valor: formParametro.valor });
      } else {
        const tabela = tabelaMap[dialogType] as 'comissoes_faixas_adesao' | 'comissoes_faixas_recorrente' | 'comissoes_faixas_producao' | 'comissoes_faixas_crescimento' | 'comissoes_faixas_classificacao';
        let dados: Record<string, unknown> = {};

        if (dialogType === 'adesao') {
          dados = { ...formAdesao, tipo_consultor: 'interno' };
        } else if (dialogType === 'recorrente') {
          dados = formRecorrente;
        } else if (dialogType === 'producao') {
          dados = { ...formProducao, tipo_consultor: 'externo' };
        } else if (dialogType === 'crescimento') {
          dados = formCrescimento;
        } else if (dialogType === 'classificacao') {
          dados = formClassificacao;
        }

        if (editingItem) {
          await updateFaixa.mutateAsync({ tabela, id: (editingItem as { id: string }).id, dados });
        } else {
          await addFaixa.mutateAsync({ tabela, dados });
        }
      }
      setDialogOpen(false);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = (tabela: string, id: string) => {
    setItemToDelete({ tabela, id });
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (itemToDelete) {
      await deleteFaixa.mutateAsync({ tabela: itemToDelete.tabela as 'comissoes_faixas_adesao' | 'comissoes_faixas_recorrente' | 'comissoes_faixas_producao' | 'comissoes_faixas_crescimento' | 'comissoes_faixas_classificacao', id: itemToDelete.id });
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  const handleCriarCampanha = async () => {
    const now = new Date();
    const mes = now.getMonth() + 1;
    const ano = now.getFullYear();
    const dataInicio = new Date(ano, mes - 1, 1).toISOString().split('T')[0];
    const dataFim = new Date(ano, mes, 0).toISOString().split('T')[0];

    await criarCampanha.mutateAsync({
      nome: `Campanha ${MESES[mes]}/${ano}`,
      mes,
      ano,
      data_inicio: dataInicio,
      data_fim: dataFim,
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <PermissionGate permission={['isDiretor', 'isGerente']} mode="any" fallback={
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Você não tem permissão para acessar esta página.
          </CardContent>
        </Card>
      </div>
    }>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Configuração de Comissionamento
          </h1>
          <p className="text-muted-foreground">
            Defina as faixas de comissão, parâmetros e campanhas mensais
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
          <TabsList className="grid w-full grid-cols-7 h-auto">
            <TabsTrigger value="adesao" className="flex flex-col gap-1 py-2">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs">Adesão</span>
            </TabsTrigger>
            <TabsTrigger value="recorrente" className="flex flex-col gap-1 py-2">
              <Percent className="h-4 w-4" />
              <span className="text-xs">Recorrente</span>
            </TabsTrigger>
            <TabsTrigger value="producao" className="flex flex-col gap-1 py-2">
              <Target className="h-4 w-4" />
              <span className="text-xs">Produção</span>
            </TabsTrigger>
            <TabsTrigger value="crescimento" className="flex flex-col gap-1 py-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs">Crescimento</span>
            </TabsTrigger>
            <TabsTrigger value="classificacao" className="flex flex-col gap-1 py-2">
              <Trophy className="h-4 w-4" />
              <span className="text-xs">Ranking</span>
            </TabsTrigger>
            <TabsTrigger value="parametros" className="flex flex-col gap-1 py-2">
              <Settings className="h-4 w-4" />
              <span className="text-xs">Parâmetros</span>
            </TabsTrigger>
            <TabsTrigger value="campanhas" className="flex flex-col gap-1 py-2">
              <Calendar className="h-4 w-4" />
              <span className="text-xs">Campanhas</span>
            </TabsTrigger>
          </TabsList>

          {/* Aba Adesão */}
          <TabsContent value="adesao">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Faixas de Bonificação sobre Adesões</CardTitle>
                  <CardDescription>Consultor Interno — Percentual aplicado sobre o total de adesões do mês</CardDescription>
                </div>
                <Button onClick={() => handleOpenDialog('adesao')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Faixa
                </Button>
              </CardHeader>
              <CardContent>
                <div className="mb-4 p-3 bg-primary/10 rounded-lg flex items-start gap-2">
                  <Info className="h-5 w-5 text-primary mt-0.5" />
                  <div className="text-sm text-primary">
                    <strong>Como funciona:</strong> Pagamento em 2 fases. 1ª Fase = (Total × %) - 10% em folha | 2ª Fase = 10% fixo no 5º dia útil
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Qtd. Vendas Mínima</TableHead>
                      <TableHead className="text-right">% sobre Adesões</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {faixasAdesao.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Nenhuma faixa cadastrada
                        </TableCell>
                      </TableRow>
                    ) : faixasAdesao.map((faixa) => (
                      <TableRow key={faixa.id}>
                        <TableCell className="font-mono">{faixa.quantidade_vendas_minima} vendas</TableCell>
                        <TableCell className="text-right font-mono font-semibold">{faixa.percentual_adesao}%</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={faixa.ativo ? 'default' : 'secondary'}>
                            {faixa.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenDialog('adesao', faixa)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete('comissoes_faixas_adesao', faixa.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Recorrente */}
          <TabsContent value="recorrente">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Faixas de Comissão Recorrente</CardTitle>
                  <CardDescription>Calculado sobre boletos pagos pela base ativa do mês anterior</CardDescription>
                </div>
                <Button onClick={() => handleOpenDialog('recorrente')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Faixa
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Button variant={subAbaRecorrente === 'interno' ? 'default' : 'outline'} size="sm" onClick={() => setSubAbaRecorrente('interno')}>
                    Interno
                  </Button>
                  <Button variant={subAbaRecorrente === 'externo' ? 'default' : 'outline'} size="sm" onClick={() => setSubAbaRecorrente('externo')}>
                    Externo
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Placas Mín.</TableHead>
                      <TableHead>Placas Máx.</TableHead>
                      <TableHead className="text-right">% Recorrente</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {faixasRecorrente.filter(f => f.tipo_consultor === subAbaRecorrente).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Nenhuma faixa cadastrada
                        </TableCell>
                      </TableRow>
                    ) : faixasRecorrente.filter(f => f.tipo_consultor === subAbaRecorrente).map((faixa) => (
                      <TableRow key={faixa.id}>
                        <TableCell className="font-mono">{faixa.placas_minima}</TableCell>
                        <TableCell className="font-mono">{faixa.placas_maxima ?? 'Sem limite'}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">{faixa.percentual_recorrente}%</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={faixa.ativo ? 'default' : 'secondary'}>
                            {faixa.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenDialog('recorrente', faixa)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete('comissoes_faixas_recorrente', faixa.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Produção */}
          <TabsContent value="producao">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Faixas de Produção Mensal</CardTitle>
                  <CardDescription>Exclusivo para consultores externos — Remuneração por quantidade de placas confirmadas</CardDescription>
                </div>
                <Button onClick={() => handleOpenDialog('producao')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Faixa
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Placas Confirmadas</TableHead>
                      <TableHead className="text-right">Remuneração</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {faixasProducao.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Nenhuma faixa cadastrada
                        </TableCell>
                      </TableRow>
                    ) : faixasProducao.map((faixa) => (
                      <TableRow key={faixa.id}>
                        <TableCell className="font-mono">{faixa.placas_confirmadas_minima}+ placas</TableCell>
                        <TableCell className="text-right font-mono font-semibold text-primary">{formatCurrency(faixa.valor_remuneracao)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={faixa.ativo ? 'default' : 'secondary'}>
                            {faixa.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenDialog('producao', faixa)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete('comissoes_faixas_producao', faixa.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Crescimento */}
          <TabsContent value="crescimento">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Faixas de Crescimento de Base</CardTitle>
                  <CardDescription>Bonificação por marcos de crescimento na base individual</CardDescription>
                </div>
                <Button onClick={() => handleOpenDialog('crescimento')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Faixa
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Button variant={subAbaCrescimento === 'interno' ? 'default' : 'outline'} size="sm" onClick={() => setSubAbaCrescimento('interno')}>
                    Interno
                  </Button>
                  <Button variant={subAbaCrescimento === 'externo' ? 'default' : 'outline'} size="sm" onClick={() => setSubAbaCrescimento('externo')}>
                    Externo
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Placas Confirmadas</TableHead>
                      <TableHead className="text-right">Remuneração</TableHead>
                      <TableHead className="text-right">% Recorrente Garantido</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {faixasCrescimento.filter(f => f.tipo_consultor === subAbaCrescimento).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Nenhuma faixa cadastrada
                        </TableCell>
                      </TableRow>
                    ) : faixasCrescimento.filter(f => f.tipo_consultor === subAbaCrescimento).map((faixa) => (
                      <TableRow key={faixa.id}>
                        <TableCell className="font-mono">{faixa.placas_confirmadas} placas</TableCell>
                        <TableCell className="text-right font-mono font-semibold text-primary">{formatCurrency(faixa.valor_remuneracao)}</TableCell>
                        <TableCell className="text-right font-mono">{faixa.percentual_minimo_recorrente > 0 ? `${faixa.percentual_minimo_recorrente}%` : '-'}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={faixa.ativo ? 'default' : 'secondary'}>
                            {faixa.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenDialog('crescimento', faixa)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete('comissoes_faixas_crescimento', faixa.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Classificação/Ranking */}
          <TabsContent value="classificacao">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Prêmios por Classificação no Ranking</CardTitle>
                  <CardDescription>Premiação mensal baseada na posição do ranking de vendas</CardDescription>
                </div>
                <Button onClick={() => handleOpenDialog('classificacao')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Prêmio
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4">
                  <Select value={filtroClassificacao.tipo} onValueChange={(v) => setFiltroClassificacao({ ...filtroClassificacao, tipo: v })}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="interno">Interno</SelectItem>
                      <SelectItem value="externo">Externo</SelectItem>
                    </SelectContent>
                  </Select>
                  {filtroClassificacao.tipo === 'interno' && (
                    <Select value={filtroClassificacao.categoria} onValueChange={(v) => setFiltroClassificacao({ ...filtroClassificacao, categoria: v })}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mais_1_ano">+1 Ano de Casa</SelectItem>
                        <SelectItem value="menos_1_ano">-1 Ano de Casa</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="mb-4 p-3 bg-accent rounded-lg flex items-start gap-2">
                  <Trophy className="h-5 w-5 text-accent-foreground mt-0.5" />
                  <div className="text-sm text-accent-foreground">
                    Posição no ranking depende de vendas confirmadas no mês. Troca de titularidade = 0,5 ponto.
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Posição</TableHead>
                      <TableHead>Faixa de Placas</TableHead>
                      <TableHead className="text-right">Valor do Prêmio</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {faixasClassificacao
                      .filter(f => f.tipo_consultor === filtroClassificacao.tipo && (filtroClassificacao.tipo === 'externo' || f.categoria_tempo === filtroClassificacao.categoria))
                      .length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Nenhum prêmio cadastrado
                        </TableCell>
                      </TableRow>
                    ) : faixasClassificacao
                      .filter(f => f.tipo_consultor === filtroClassificacao.tipo && (filtroClassificacao.tipo === 'externo' || f.categoria_tempo === filtroClassificacao.categoria))
                      .map((faixa) => (
                        <TableRow key={faixa.id}>
                          <TableCell>
                            <Badge variant={faixa.posicao_ranking === 1 ? 'default' : 'outline'}>
                              {faixa.posicao_ranking}º Lugar
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono">{faixa.faixa_placas_base}+ placas</TableCell>
                          <TableCell className="text-right font-mono font-semibold text-primary">{formatCurrency(faixa.valor_premio)}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={faixa.ativo ? 'default' : 'secondary'}>
                              {faixa.ativo ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => handleOpenDialog('classificacao', faixa)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete('comissoes_faixas_classificacao', faixa.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Parâmetros */}
          <TabsContent value="parametros">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Parâmetros Globais</CardTitle>
                <CardDescription>Valores fixos utilizados nos cálculos de comissões</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parâmetro</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parametros.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Nenhum parâmetro cadastrado
                        </TableCell>
                      </TableRow>
                    ) : parametros.map((param) => (
                      <TableRow key={param.id}>
                        <TableCell className="font-mono text-sm">{param.chave}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {param.tipo_dado === 'numero' && param.chave.includes('valor') ? formatCurrency(parseFloat(param.valor)) : param.valor}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{param.descricao}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDialog('parametro', param)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Campanhas */}
          <TabsContent value="campanhas">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Campanhas de Comissionamento</CardTitle>
                  <CardDescription>Períodos de apuração para cálculo de comissões</CardDescription>
                </div>
                <Button onClick={handleCriarCampanha} disabled={criarCampanha.isPending}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Campanha
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campanha</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-right">Vendas</TableHead>
                      <TableHead className="text-right">Comissões</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campanhas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Nenhuma campanha cadastrada
                        </TableCell>
                      </TableRow>
                    ) : campanhas.map((campanha) => (
                      <TableRow key={campanha.id}>
                        <TableCell className="font-medium">{campanha.nome}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(campanha.data_inicio).toLocaleDateString('pt-BR')} - {new Date(campanha.data_fim).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right font-mono">{campanha.total_vendas_confirmadas}</TableCell>
                        <TableCell className="text-right font-mono text-primary">{formatCurrency(campanha.total_comissoes_geradas)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={
                            campanha.status === 'aberta' ? 'default' :
                            campanha.status === 'em_apuracao' ? 'secondary' :
                            campanha.status === 'fechada' ? 'outline' : 'secondary'
                          }>
                            {campanha.status === 'aberta' ? 'Aberta' :
                             campanha.status === 'em_apuracao' ? 'Em Apuração' :
                             campanha.status === 'fechada' ? 'Fechada' : 'Paga'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {campanha.status === 'aberta' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => fecharCampanha.mutate(campanha.id)}
                              disabled={fecharCampanha.isPending}
                            >
                              Fechar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialog para edição */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? 'Editar' : 'Nova'} {
                  dialogType === 'adesao' ? 'Faixa de Adesão' :
                  dialogType === 'recorrente' ? 'Faixa Recorrente' :
                  dialogType === 'producao' ? 'Faixa de Produção' :
                  dialogType === 'crescimento' ? 'Faixa de Crescimento' :
                  dialogType === 'classificacao' ? 'Prêmio de Ranking' :
                  dialogType === 'parametro' ? 'Parâmetro' : ''
                }
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {dialogType === 'adesao' && (
                <>
                  <div className="space-y-2">
                    <Label>Quantidade de Vendas Mínima</Label>
                    <Input
                      type="number"
                      value={formAdesao.quantidade_vendas_minima}
                      onChange={(e) => setFormAdesao({ ...formAdesao, quantidade_vendas_minima: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Percentual sobre Adesões (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formAdesao.percentual_adesao}
                      onChange={(e) => setFormAdesao({ ...formAdesao, percentual_adesao: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={formAdesao.ativo} onCheckedChange={(v) => setFormAdesao({ ...formAdesao, ativo: v })} />
                    <Label>Faixa ativa</Label>
                  </div>
                </>
              )}

              {dialogType === 'recorrente' && (
                <>
                  <div className="space-y-2">
                    <Label>Tipo de Consultor</Label>
                    <Select value={formRecorrente.tipo_consultor} onValueChange={(v) => setFormRecorrente({ ...formRecorrente, tipo_consultor: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="interno">Interno</SelectItem>
                        <SelectItem value="externo">Externo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Placas Mínima</Label>
                      <Input
                        type="number"
                        value={formRecorrente.placas_minima}
                        onChange={(e) => setFormRecorrente({ ...formRecorrente, placas_minima: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Placas Máxima</Label>
                      <Input
                        type="number"
                        value={formRecorrente.placas_maxima ?? ''}
                        onChange={(e) => setFormRecorrente({ ...formRecorrente, placas_maxima: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder="Sem limite"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Percentual Recorrente (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formRecorrente.percentual_recorrente}
                      onChange={(e) => setFormRecorrente({ ...formRecorrente, percentual_recorrente: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={formRecorrente.ativo} onCheckedChange={(v) => setFormRecorrente({ ...formRecorrente, ativo: v })} />
                    <Label>Faixa ativa</Label>
                  </div>
                </>
              )}

              {dialogType === 'producao' && (
                <>
                  <div className="space-y-2">
                    <Label>Placas Confirmadas Mínima</Label>
                    <Input
                      type="number"
                      value={formProducao.placas_confirmadas_minima}
                      onChange={(e) => setFormProducao({ ...formProducao, placas_confirmadas_minima: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor da Remuneração (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formProducao.valor_remuneracao}
                      onChange={(e) => setFormProducao({ ...formProducao, valor_remuneracao: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={formProducao.ativo} onCheckedChange={(v) => setFormProducao({ ...formProducao, ativo: v })} />
                    <Label>Faixa ativa</Label>
                  </div>
                </>
              )}

              {dialogType === 'crescimento' && (
                <>
                  <div className="space-y-2">
                    <Label>Tipo de Consultor</Label>
                    <Select value={formCrescimento.tipo_consultor} onValueChange={(v) => setFormCrescimento({ ...formCrescimento, tipo_consultor: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="interno">Interno</SelectItem>
                        <SelectItem value="externo">Externo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Marco de Placas Confirmadas</Label>
                    <Input
                      type="number"
                      value={formCrescimento.placas_confirmadas}
                      onChange={(e) => setFormCrescimento({ ...formCrescimento, placas_confirmadas: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor da Remuneração (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formCrescimento.valor_remuneracao}
                      onChange={(e) => setFormCrescimento({ ...formCrescimento, valor_remuneracao: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>% Recorrente Mínimo Garantido</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formCrescimento.percentual_minimo_recorrente}
                      onChange={(e) => setFormCrescimento({ ...formCrescimento, percentual_minimo_recorrente: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={formCrescimento.ativo} onCheckedChange={(v) => setFormCrescimento({ ...formCrescimento, ativo: v })} />
                    <Label>Faixa ativa</Label>
                  </div>
                </>
              )}

              {dialogType === 'classificacao' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo de Consultor</Label>
                      <Select value={formClassificacao.tipo_consultor} onValueChange={(v) => setFormClassificacao({ ...formClassificacao, tipo_consultor: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="interno">Interno</SelectItem>
                          <SelectItem value="externo">Externo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Categoria de Tempo</Label>
                      <Select value={formClassificacao.categoria_tempo} onValueChange={(v) => setFormClassificacao({ ...formClassificacao, categoria_tempo: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mais_1_ano">+1 Ano</SelectItem>
                          <SelectItem value="menos_1_ano">-1 Ano</SelectItem>
                          <SelectItem value="todos">Todos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Posição no Ranking</Label>
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        value={formClassificacao.posicao_ranking}
                        onChange={(e) => setFormClassificacao({ ...formClassificacao, posicao_ranking: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Faixa de Placas Base</Label>
                      <Select value={String(formClassificacao.faixa_placas_base)} onValueChange={(v) => setFormClassificacao({ ...formClassificacao, faixa_placas_base: parseInt(v) })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="300">300+ placas</SelectItem>
                          <SelectItem value="400">400+ placas</SelectItem>
                          <SelectItem value="500">500+ placas</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Valor do Prêmio (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formClassificacao.valor_premio}
                      onChange={(e) => setFormClassificacao({ ...formClassificacao, valor_premio: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={formClassificacao.ativo} onCheckedChange={(v) => setFormClassificacao({ ...formClassificacao, ativo: v })} />
                    <Label>Prêmio ativo</Label>
                  </div>
                </>
              )}

              {dialogType === 'parametro' && (
                <>
                  <div className="space-y-2">
                    <Label>Parâmetro</Label>
                    <Input value={formParametro.chave} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor</Label>
                    <Input
                      value={formParametro.valor}
                      onChange={(e) => setFormParametro({ ...formParametro, valor: e.target.value })}
                    />
                  </div>
                </>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={addFaixa.isPending || updateFaixa.isPending || updateParametro.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de confirmação de exclusão */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PermissionGate>
  );
}

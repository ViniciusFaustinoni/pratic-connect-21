import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  MoreVertical,
  RefreshCw,
  CheckCircle,
  DollarSign,
  Printer,
  Building2,
  Car,
  Phone,
  ExternalLink,
  Plus,
  Trash2,
  FileText,
  Calendar,
  User,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Progress } from '@/components/ui/progress';

import { useOrdemServico, useOSItens, useOSHistorico, useDeleteOSItem, useUpdateOSStatus } from '@/hooks/useOrdensServico';
import { OSTimeline } from '@/components/oficinas/OSTimeline';
import { OSStatusDialog } from '@/components/oficinas/OSStatusDialog';
import { OSItemFormDialog } from '@/components/oficinas/OSItemFormDialog';
import { OSAprovarDialog } from '@/components/oficinas/OSAprovarDialog';
import { OSPagamentoDialog } from '@/components/oficinas/OSPagamentoDialog';
import { OSFotosGallery } from '@/components/oficinas/OSFotosGallery';

import {
  STATUS_ORDEM_SERVICO_LABELS,
  TIPO_ITEM_OS_LABELS,
  type TipoItemOS,
} from '@/types/database';

const STATUS_COLORS: Record<string, string> = {
  rascunho: 'bg-gray-100 text-gray-800',
  aguardando_orcamento: 'bg-yellow-100 text-yellow-800',
  orcamento_enviado: 'bg-blue-100 text-blue-800',
  aguardando_aprovacao: 'bg-purple-100 text-purple-800',
  aprovado: 'bg-cyan-100 text-cyan-800',
  em_execucao: 'bg-indigo-100 text-indigo-800',
  aguardando_peca: 'bg-orange-100 text-orange-800',
  concluido: 'bg-green-100 text-green-800',
  aguardando_pagamento: 'bg-amber-100 text-amber-800',
  pago: 'bg-emerald-100 text-emerald-800',
  cancelado: 'bg-red-100 text-red-800',
};

const formatCurrency = (value: number | null | undefined) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

export default function OrdemServicoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: os, isLoading } = useOrdemServico(id);
  const { data: itens = [] } = useOSItens(id);
  const { data: historico = [] } = useOSHistorico(id);
  const deleteItem = useDeleteOSItem();
  const updateStatus = useUpdateOSStatus();

  const [statusOpen, setStatusOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [aprovarOpen, setAprovarOpen] = useState(false);
  const [pagamentoOpen, setPagamentoOpen] = useState(false);

  // Group items by type
  const itensPorTipo = useMemo(() => {
    const grouped: Record<TipoItemOS, typeof itens> = {
      peca: [],
      mao_de_obra: [],
      servico_terceiro: [],
    };
    itens.forEach((item) => {
      grouped[item.tipo].push(item);
    });
    return grouped;
  }, [itens]);

  const totalPorTipo = useMemo(() => ({
    peca: itensPorTipo.peca.reduce((sum, i) => sum + Number(i.valor_total), 0),
    mao_de_obra: itensPorTipo.mao_de_obra.reduce((sum, i) => sum + Number(i.valor_total), 0),
    servico_terceiro: itensPorTipo.servico_terceiro.reduce((sum, i) => sum + Number(i.valor_total), 0),
  }), [itensPorTipo]);

  const handlePrint = () => {
    window.print();
  };

  const handleEnviarOrcamento = async () => {
    if (!os) return;
    await updateStatus.mutateAsync({
      id: os.id,
      status: 'orcamento_enviado',
      observacao: 'Orçamento enviado para aprovação',
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-64" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        </div>
      </div>
    );
  }

  if (!os) {
    return (
      <div className="flex h-96 flex-col items-center justify-center">
        <FileText className="mb-4 h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Ordem de Serviço não encontrada</h2>
        <Button variant="link" onClick={() => navigate('/oficina/ordens-servico')}>
          Voltar para listagem
        </Button>
      </div>
    );
  }

  const valorProgress = os.valor_aprovado 
    ? (Number(os.valor_pago || 0) / Number(os.valor_aprovado)) * 100 
    : 0;

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/dashboard">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/oficina/ordens-servico">Ordens de Serviço</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{os.numero}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{os.numero}</h1>
            <p className="text-sm text-muted-foreground">
              Criada em {format(new Date(os.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
          <Badge className={STATUS_COLORS[os.status]}>
            {STATUS_ORDEM_SERVICO_LABELS[os.status]}
          </Badge>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              Ações
              <MoreVertical className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setStatusOpen(true)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar Status
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setAprovarOpen(true)}
              disabled={!['orcamento_enviado', 'aguardando_aprovacao'].includes(os.status)}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Aprovar Orçamento
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setPagamentoOpen(true)}
              disabled={!['concluido', 'aguardando_pagamento'].includes(os.status)}
            >
              <DollarSign className="mr-2 h-4 w-4" />
              Registrar Pagamento
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column (2 cols) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Dados da OS */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dados da OS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Número</p>
                  <p className="font-medium">{os.numero}</p>
                </div>
                {(os as any).sinistro && (
                  <div>
                    <p className="text-sm text-muted-foreground">Sinistro</p>
                    <Link
                      to={`/eventos/sinistros/${(os as any).sinistro.id}`}
                      className="flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      {(os as any).sinistro.protocolo}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={STATUS_COLORS[os.status]}>
                    {STATUS_ORDEM_SERVICO_LABELS[os.status]}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data Entrada</p>
                  <p className="font-medium">
                    {os.data_entrada ? format(new Date(os.data_entrada), 'dd/MM/yyyy') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Previsão</p>
                  <p className="font-medium">
                    {os.data_previsao ? format(new Date(os.data_previsao), 'dd/MM/yyyy') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Conclusão</p>
                  <p className="font-medium">
                    {os.data_conclusao ? format(new Date(os.data_conclusao), 'dd/MM/yyyy') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Criado por</p>
                  <p className="font-medium">{(os as any).criado_por_profile?.nome || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Aprovado por</p>
                  <p className="font-medium">{(os as any).aprovado_por_profile?.nome || '-'}</p>
                </div>
              </div>

              {os.observacoes && (
                <div className="mt-4 border-t pt-4">
                  <p className="text-sm text-muted-foreground">Observações</p>
                  <p className="text-sm">{os.observacoes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Orçamento */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Orçamento</CardTitle>
              <div className="flex gap-2">
                {os.status === 'aguardando_orcamento' && (
                  <Button size="sm" variant="outline" onClick={handleEnviarOrcamento} disabled={itens.length === 0}>
                    Enviar Orçamento
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setItemOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {itens.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  Nenhum item no orçamento
                </p>
              ) : (
                <div className="space-y-6">
                  {(['peca', 'mao_de_obra', 'servico_terceiro'] as TipoItemOS[]).map((tipo) => {
                    if (itensPorTipo[tipo].length === 0) return null;
                    return (
                      <div key={tipo}>
                        <h4 className="mb-2 font-medium text-muted-foreground">
                          {TIPO_ITEM_OS_LABELS[tipo]}
                        </h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Descrição</TableHead>
                              <TableHead className="w-20 text-right">Qtd</TableHead>
                              <TableHead className="w-28 text-right">Unit.</TableHead>
                              <TableHead className="w-28 text-right">Total</TableHead>
                              <TableHead className="w-12" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {itensPorTipo[tipo].map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>
                                  <div>
                                    <p>{item.descricao}</p>
                                    {item.marca && (
                                      <p className="text-xs text-muted-foreground">{item.marca}</p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">{item.quantidade}</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.valor_unitario)}</TableCell>
                                <TableCell className="text-right font-medium">{formatCurrency(item.valor_total)}</TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => deleteItem.mutate({ id: item.id, ordem_servico_id: os.id })}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                          <TableFooter>
                            <TableRow>
                              <TableCell colSpan={3} className="text-right font-medium">
                                Subtotal {TIPO_ITEM_OS_LABELS[tipo]}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(totalPorTipo[tipo])}
                              </TableCell>
                              <TableCell />
                            </TableRow>
                          </TableFooter>
                        </Table>
                      </div>
                    );
                  })}

                  <div className="flex justify-end border-t pt-4">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Total Geral</p>
                      <p className="text-2xl font-bold">{formatCurrency(os.valor_orcamento)}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fotos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Fotos</CardTitle>
            </CardHeader>
            <CardContent>
              <OSFotosGallery osId={os.id} />
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Oficina */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-5 w-5" />
                Oficina
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="font-medium">{os.oficina?.nome_fantasia || os.oficina?.razao_social}</p>
              </div>
              {os.oficina?.telefone && (
                <a
                  href={`tel:${os.oficina.telefone}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  <Phone className="h-4 w-4" />
                  {os.oficina.telefone}
                </a>
              )}
              {os.oficina?.whatsapp && (
                <a
                  href={`https://wa.me/55${os.oficina.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-green-600 hover:text-green-700"
                >
                  <ExternalLink className="h-4 w-4" />
                  WhatsApp
                </a>
              )}
              {os.oficina?.cidade && (
                <p className="text-sm text-muted-foreground">
                  {[os.oficina.logradouro, os.oficina.numero, os.oficina.bairro].filter(Boolean).join(', ')}
                  <br />
                  {os.oficina.cidade} - {os.oficina.estado}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Veículo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Car className="h-5 w-5" />
                Veículo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-lg font-bold">{os.veiculo?.placa}</p>
                <p className="text-sm text-muted-foreground">
                  {os.veiculo?.marca} {os.veiculo?.modelo}
                </p>
              </div>
              {(os.veiculo as any)?.ano_fabricacao && (
                <p className="text-sm text-muted-foreground">
                  {(os.veiculo as any).ano_fabricacao}/{(os.veiculo as any).ano_modelo}
                </p>
              )}
              {(os.veiculo as any)?.cor && (
                <p className="text-sm text-muted-foreground">Cor: {(os.veiculo as any).cor}</p>
              )}
            </CardContent>
          </Card>

          {/* Valores */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="h-5 w-5" />
                Valores
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Orçamento</span>
                <span className="font-medium">{formatCurrency(os.valor_orcamento)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aprovado</span>
                <span className="font-medium">{os.valor_aprovado ? formatCurrency(os.valor_aprovado) : '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pago</span>
                <span className="font-medium text-green-600">
                  {os.valor_pago ? formatCurrency(os.valor_pago) : '-'}
                </span>
              </div>
              {os.valor_aprovado && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Progresso</span>
                    <span>{Math.round(valorProgress)}%</span>
                  </div>
                  <Progress value={valorProgress} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OSTimeline historico={historico} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <OSStatusDialog os={os} open={statusOpen} onOpenChange={setStatusOpen} />
      <OSItemFormDialog osId={os.id} open={itemOpen} onOpenChange={setItemOpen} />
      <OSAprovarDialog os={os} open={aprovarOpen} onOpenChange={setAprovarOpen} />
      <OSPagamentoDialog os={os} open={pagamentoOpen} onOpenChange={setPagamentoOpen} />
    </div>
  );
}

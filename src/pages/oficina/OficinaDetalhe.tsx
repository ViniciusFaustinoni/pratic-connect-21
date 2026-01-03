import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, format, isThisMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  Building,
  Phone,
  MessageCircle,
  Mail,
  MapPin,
  Star,
  DollarSign,
  Clock,
  Wrench,
  MoreVertical,
  Edit,
  Ban,
  CheckCircle,
  FileText,
  CreditCard,
  Landmark,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Skeleton } from '@/components/ui/skeleton';
import { OficinaFormDialog } from '@/components/oficinas/OficinaFormDialog';
import { useOficina, useUpdateOficina } from '@/hooks/useOficinas';
import {
  STATUS_OFICINA_LABELS,
  STATUS_OFICINA_COLORS,
  STATUS_ORDEM_SERVICO_LABELS,
  STATUS_ORDEM_SERVICO_COLORS,
  ESPECIALIDADE_LABELS,
  STATUS_PAGAMENTO_OFICINA_LABELS,
  STATUS_PAGAMENTO_OFICINA_COLORS,
  PIX_TIPO_LABELS,
} from '@/types/database';
import type { StatusOrdemServico, StatusPagamentoOficina } from '@/types/database';

export default function OficinaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);

  const { data: oficina, isLoading: loadingOficina } = useOficina(id);
  const updateOficina = useUpdateOficina();

  // Query ordens de serviço da oficina
  const { data: ordensServico, isLoading: loadingOS } = useQuery({
    queryKey: ['oficina-os', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ordens_servico')
        .select(`
          *,
          veiculo:veiculos(placa, marca, modelo),
          associado:associados(nome)
        `)
        .eq('oficina_id', id!)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Query pagamentos da oficina
  const { data: pagamentos, isLoading: loadingPagamentos } = useQuery({
    queryKey: ['oficina-pagamentos', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('oficinas_pagamentos')
        .select('*')
        .eq('oficina_id', id!)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Calcular estatísticas
  const estatisticas = useMemo(() => {
    const totalOS = ordensServico?.length || 0;
    
    const valorTotalPago = pagamentos
      ?.filter((p) => p.status === 'pago')
      .reduce((acc, p) => acc + Number(p.valor || 0), 0) || 0;

    const notaMedia = oficina?.nota_media || 0;

    // Tempo médio de reparo em dias
    const osConcluidas = ordensServico?.filter(
      (os) => os.data_entrada && os.data_conclusao
    );
    let tempoMedioReparo = 0;
    if (osConcluidas?.length) {
      const totalDias = osConcluidas.reduce((acc, os) => {
        const entrada = new Date(os.data_entrada!);
        const conclusao = new Date(os.data_conclusao!);
        return acc + differenceInDays(conclusao, entrada);
      }, 0);
      tempoMedioReparo = Math.round(totalDias / osConcluidas.length);
    }

    return { totalOS, valorTotalPago, notaMedia, tempoMedioReparo };
  }, [ordensServico, pagamentos, oficina]);

  const handleStatusChange = async (newStatus: 'ativo' | 'suspenso' | 'bloqueado') => {
    if (!id) return;
    await updateOficina.mutateAsync({ id, status: newStatus });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatAddress = () => {
    if (!oficina) return '-';
    const parts = [
      oficina.logradouro,
      oficina.numero,
      oficina.complemento,
      oficina.bairro,
      oficina.cidade,
      oficina.estado,
      oficina.cep,
    ].filter(Boolean);
    return parts.join(', ') || '-';
  };

  // Renderizar estrelas
  const renderStars = (nota: number) => {
    const stars = [];
    const fullStars = Math.floor(nota);
    for (let i = 0; i < 5; i++) {
      stars.push(
        <Star
          key={i}
          className={`h-4 w-4 ${
            i < fullStars
              ? 'fill-yellow-400 text-yellow-400'
              : 'text-muted-foreground'
          }`}
        />
      );
    }
    return stars;
  };

  if (loadingOficina) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-6">
          <Skeleton className="col-span-2 h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!oficina) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <Building className="h-12 w-12 text-muted-foreground" />
        <h2 className="mt-4 text-xl font-semibold">Oficina não encontrada</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/oficina/credenciadas')}>
          Voltar para listagem
        </Button>
      </div>
    );
  }

  const statusColor = STATUS_OFICINA_COLORS[oficina.status || 'ativo'];

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
              <Link to="/oficina/credenciadas">Oficinas</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{oficina.nome_fantasia || oficina.razao_social}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/oficina/credenciadas')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">
                {oficina.nome_fantasia || oficina.razao_social}
              </h1>
              <Badge className={statusColor}>
                {STATUS_OFICINA_LABELS[oficina.status || 'ativo']}
              </Badge>
            </div>
            {oficina.nome_fantasia && (
              <p className="text-sm text-muted-foreground">{oficina.razao_social}</p>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <MoreVertical className="mr-2 h-4 w-4" />
              Ações
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {oficina.status === 'ativo' ? (
              <>
                <DropdownMenuItem
                  onClick={() => handleStatusChange('suspenso')}
                  className="text-yellow-600"
                >
                  <Ban className="mr-2 h-4 w-4" />
                  Suspender
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleStatusChange('bloqueado')}
                  className="text-destructive"
                >
                  <Ban className="mr-2 h-4 w-4" />
                  Bloquear
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem
                onClick={() => handleStatusChange('ativo')}
                className="text-green-600"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Reativar
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Coluna 1-2: Dados */}
        <div className="space-y-6 lg:col-span-2">
          {/* Dados Cadastrais */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Dados Cadastrais
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Razão Social</p>
                <p className="font-medium">{oficina.razao_social}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">CNPJ</p>
                <p className="font-medium">{oficina.cnpj || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Inscrição Estadual</p>
                <p className="font-medium">{oficina.inscricao_estadual || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium flex items-center gap-2">
                  {oficina.email ? (
                    <a href={`mailto:${oficina.email}`} className="text-primary hover:underline flex items-center gap-1">
                      <Mail className="h-4 w-4" />
                      {oficina.email}
                    </a>
                  ) : (
                    '-'
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Telefone</p>
                <div className="flex items-center gap-3">
                  {oficina.telefone ? (
                    <a href={`tel:${oficina.telefone}`} className="text-primary hover:underline flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      {oficina.telefone}
                    </a>
                  ) : (
                    '-'
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">WhatsApp</p>
                <div className="flex items-center gap-3">
                  {oficina.whatsapp ? (
                    <a
                      href={`https://wa.me/55${oficina.whatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 hover:underline flex items-center gap-1"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {oficina.whatsapp}
                    </a>
                  ) : (
                    '-'
                  )}
                </div>
              </div>
              <div className="sm:col-span-2">
                <p className="text-sm text-muted-foreground">Endereço</p>
                <p className="font-medium flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                  {formatAddress()}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Dados Bancários */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="h-5 w-5" />
                Dados Bancários
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Banco</p>
                <p className="font-medium">{oficina.banco || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Agência</p>
                <p className="font-medium">{oficina.agencia || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Conta</p>
                <p className="font-medium">{oficina.conta || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tipo PIX</p>
                <p className="font-medium">
                  {oficina.pix_tipo ? PIX_TIPO_LABELS[oficina.pix_tipo] : '-'}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-sm text-muted-foreground">Chave PIX</p>
                <p className="font-medium">{oficina.pix_chave || '-'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Últimas OS */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Últimas Ordens de Serviço
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingOS ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : ordensServico?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Veículo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordensServico.map((os) => {
                      const statusColor = STATUS_ORDEM_SERVICO_COLORS[os.status as StatusOrdemServico];
                      return (
                        <TableRow key={os.id}>
                          <TableCell>
                            <Link
                              to={`/ordens-servico/${os.id}`}
                              className="text-primary hover:underline font-medium"
                            >
                              {os.numero}
                            </Link>
                          </TableCell>
                          <TableCell>
                            {os.veiculo ? (
                              <span>
                                {os.veiculo.placa} - {os.veiculo.marca} {os.veiculo.modelo}
                              </span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColor}>
                              {STATUS_ORDEM_SERVICO_LABELS[os.status as StatusOrdemServico]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(os.valor_orcamento || 0)}
                          </TableCell>
                          <TableCell>
                            {format(new Date(os.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma ordem de serviço encontrada
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna 3: Estatísticas e Info */}
        <div className="space-y-6">
          {/* Estatísticas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Estatísticas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Total de OS</span>
                </div>
                <span className="text-xl font-bold">{estatisticas.totalOS}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Valor Total Pago</span>
                </div>
                <span className="text-xl font-bold text-green-600">
                  {formatCurrency(estatisticas.valorTotalPago)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Nota Média</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex">{renderStars(estatisticas.notaMedia)}</div>
                  <span className="font-bold">{estatisticas.notaMedia.toFixed(1)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Tempo Médio Reparo</span>
                </div>
                <span className="text-xl font-bold">{estatisticas.tempoMedioReparo} dias</span>
              </div>
            </CardContent>
          </Card>

          {/* Especialidades */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Especialidades
              </CardTitle>
            </CardHeader>
            <CardContent>
              {oficina.especialidades?.length ? (
                <div className="flex flex-wrap gap-2">
                  {oficina.especialidades.map((esp) => (
                    <Badge key={esp} variant="secondary">
                      {ESPECIALIDADE_LABELS[esp as keyof typeof ESPECIALIDADE_LABELS] || esp}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Nenhuma especialidade cadastrada</p>
              )}
            </CardContent>
          </Card>

          {/* Últimos Pagamentos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Últimos Pagamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingPagamentos ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : pagamentos?.length ? (
                <div className="space-y-3">
                  {pagamentos.map((pag) => {
                    const statusColor = STATUS_PAGAMENTO_OFICINA_COLORS[pag.status as StatusPagamentoOficina];
                    return (
                      <div key={pag.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                        <div>
                          <p className="font-medium">{formatCurrency(pag.valor)}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(pag.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                          </p>
                        </div>
                        <Badge className={statusColor}>
                          {STATUS_PAGAMENTO_OFICINA_LABELS[pag.status as StatusPagamentoOficina]}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">
                  Nenhum pagamento encontrado
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog de Edição */}
      <OficinaFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        oficina={oficina}
      />
    </div>
  );
}

import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Phone, Mail, MessageCircle, MapPin, Calendar, User, Car, 
  FileCheck, FileText, Clock, Edit, Ban, AlertTriangle, Loader2,
  Receipt, MoreHorizontal, CheckCircle, XCircle, Pause, Play, Lock, Unlock,
  CreditCard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  TableRow 
} from '@/components/ui/table';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { 
  STATUS_ASSOCIADO_LABELS, 
  STATUS_VEICULO_LABELS,
  STATUS_CONTRATO_LABELS,
  type StatusAssociado,
  type StatusVeiculo,
} from '@/types/database';
import { useAssociado, useUpdateAssociadoStatus } from '@/hooks/useAssociados';
import { useVeiculos } from '@/hooks/useVeiculos';
import { useAssociadoHistorico } from '@/hooks/useAssociadoHistorico';
import { useToast } from '@/hooks/use-toast';
import { DocumentUploader } from '@/components/cadastro/DocumentUploader';
import { ConfirmacaoAcaoDialog } from '@/components/associados/ConfirmacaoAcaoDialog';
import { AssociadoEditDialog } from '@/components/associados/AssociadoEditDialog';
import { AssociadoTimeline } from '@/components/associados/AssociadoTimeline';

const statusColors: Record<StatusAssociado, string> = {
  em_analise: 'bg-blue-500 text-white',
  aprovado: 'bg-green-100 text-green-800',
  documentacao_pendente: 'bg-yellow-500 text-white',
  aguardando_instalacao: 'bg-purple-500 text-white',
  ativo: 'bg-green-500 text-white',
  inadimplente: 'bg-orange-500 text-white',
  suspenso: 'bg-gray-500 text-white',
  cancelado: 'bg-destructive text-destructive-foreground',
  bloqueado: 'bg-red-700 text-white',
};

const avatarColors: Record<StatusAssociado, string> = {
  em_analise: 'bg-blue-500',
  aprovado: 'bg-green-500',
  documentacao_pendente: 'bg-yellow-500',
  aguardando_instalacao: 'bg-purple-500',
  ativo: 'bg-green-600',
  inadimplente: 'bg-orange-500',
  suspenso: 'bg-gray-500',
  cancelado: 'bg-red-600',
  bloqueado: 'bg-red-700',
};

const veiculoStatusColors: Record<StatusVeiculo, string> = {
  em_analise: 'bg-blue-100 text-blue-800',
  aprovado: 'bg-green-100 text-green-800',
  instalacao_pendente: 'bg-yellow-100 text-yellow-800',
  ativo: 'bg-green-500 text-white',
  suspenso: 'bg-orange-100 text-orange-800',
  cancelado: 'bg-red-100 text-red-800',
  sinistrado: 'bg-purple-100 text-purple-800',
};

export default function AssociadoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: associado, isLoading, refetch } = useAssociado(id);
  const { data: veiculos } = useVeiculos(id);
  const { data: historico, isLoading: historicoLoading } = useAssociadoHistorico(id);
  const updateStatus = useUpdateAssociadoStatus();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: 'bloquear' | 'suspender' | 'cancelar';
  }>({ open: false, action: 'bloquear' });
  const [selectedVeiculoId, setSelectedVeiculoId] = useState<string | undefined>(undefined);

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return 'N/A';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const handleWhatsApp = () => {
    if (associado?.telefone) {
      const phone = associado.telefone.replace(/\D/g, '');
      window.open(`https://wa.me/55${phone}`, '_blank');
    }
  };

  const handleStatusAction = (action: 'bloquear' | 'suspender' | 'cancelar') => {
    setConfirmDialog({ open: true, action });
  };

  const handleConfirmAction = async (motivo: string) => {
    if (!confirmDialog.action || !associado) return;
    
    const statusMap = {
      bloquear: 'bloqueado' as const,
      suspender: 'suspenso' as const,
      cancelar: 'cancelado' as const,
    };

    try {
      await updateStatus.mutateAsync({
        id: associado.id,
        status: statusMap[confirmDialog.action],
        motivo,
      });
      toast({ title: 'Status atualizado', description: `Associado ${confirmDialog.action === 'bloquear' ? 'bloqueado' : confirmDialog.action === 'suspender' ? 'suspenso' : 'cancelado'} com sucesso.` });
      refetch();
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível atualizar o status.', variant: 'destructive' });
    }
    setConfirmDialog({ open: false, action: 'bloquear' });
  };

  const handleReativar = async () => {
    if (!associado) return;
    try {
      await updateStatus.mutateAsync({ id: associado.id, status: 'ativo' });
      toast({ title: 'Associado reativado', description: 'O associado foi reativado com sucesso.' });
      refetch();
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível reativar o associado.', variant: 'destructive' });
    }
  };

  const handleDesbloquear = async () => {
    if (!associado) return;
    try {
      await updateStatus.mutateAsync({ id: associado.id, status: 'ativo' });
      toast({ title: 'Associado desbloqueado', description: 'O associado foi desbloqueado com sucesso.' });
      refetch();
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível desbloquear o associado.', variant: 'destructive' });
    }
  };

  // Set default vehicle when data loads
  if (veiculos?.length && !selectedVeiculoId) {
    setSelectedVeiculoId(veiculos[0].id);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!associado) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <User className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 font-semibold">Associado não encontrado</h3>
        <Button variant="link" onClick={() => navigate('/cadastro/associados')}>
          Voltar para a lista
        </Button>
      </div>
    );
  }

  const status = associado.status as StatusAssociado;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/cadastro/associados">Cadastro</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/cadastro/associados">Associados</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{associado.nome}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left: Avatar + Name */}
            <div className="flex items-start gap-4">
              <Avatar className={`h-16 w-16 ${avatarColors[status]} text-white`}>
                <AvatarFallback className="bg-transparent text-xl font-bold">
                  {getInitials(associado.nome)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold">{associado.nome}</h1>
                <p className="text-muted-foreground">CPF: {associado.cpf}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={statusColors[status]}>
                    {STATUS_ASSOCIADO_LABELS[status]}
                  </Badge>
                  {associado.bloqueado && (
                    <Badge className="bg-red-700 text-white">
                      <Ban className="mr-1 h-3 w-3" />
                      Bloqueado
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Center: Contact Info */}
            <div className="flex-1 grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{associado.telefone}</span>
              </div>
              <div className="flex items-center gap-2 cursor-pointer text-green-600 hover:underline" onClick={handleWhatsApp}>
                <MessageCircle className="h-4 w-4" />
                <span>WhatsApp</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{associado.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{associado.cidade ? `${associado.cidade}/${associado.uf}` : '-'}</span>
              </div>
            </div>

            {/* Right: Mini Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Plano</p>
                <p className="font-semibold text-sm truncate">{associado.planos?.nome || '-'}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Desde</p>
                <p className="font-semibold text-sm">{formatDate(associado.data_adesao)}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Dia Venc.</p>
                <p className="font-semibold text-sm">
                  {associado.dia_vencimento ? `Dia ${associado.dia_vencimento}` : '-'}
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Veículos</p>
                <p className="font-semibold text-sm">{veiculos?.length || 0}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => navigate('/cadastro/associados')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Editar Dados
          </Button>
          <Button variant="outline" onClick={handleWhatsApp}>
            <MessageCircle className="mr-2 h-4 w-4" />
            Enviar Mensagem
          </Button>
          <Button variant="outline" onClick={() => toast({ title: 'Em desenvolvimento', description: 'Módulo financeiro em implementação.' })}>
            <Receipt className="mr-2 h-4 w-4" />
            Gerar Boleto
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <MoreHorizontal className="mr-2 h-4 w-4" />
                Alterar Status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              {status === 'ativo' && (
                <>
                  <DropdownMenuItem onClick={() => handleStatusAction('suspender')}>
                    <Pause className="mr-2 h-4 w-4" />
                    Suspender
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusAction('bloquear')}>
                    <Lock className="mr-2 h-4 w-4" />
                    Bloquear
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleStatusAction('cancelar')} className="text-destructive">
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancelar
                  </DropdownMenuItem>
                </>
              )}
              {status === 'suspenso' && (
                <>
                  <DropdownMenuItem onClick={handleReativar}>
                    <Play className="mr-2 h-4 w-4" />
                    Reativar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusAction('bloquear')}>
                    <Lock className="mr-2 h-4 w-4" />
                    Bloquear
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleStatusAction('cancelar')} className="text-destructive">
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancelar
                  </DropdownMenuItem>
                </>
              )}
              {status === 'bloqueado' && (
                <>
                  <DropdownMenuItem onClick={handleDesbloquear}>
                    <Unlock className="mr-2 h-4 w-4" />
                    Desbloquear
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleStatusAction('cancelar')} className="text-destructive">
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancelar
                  </DropdownMenuItem>
                </>
              )}
              {status === 'inadimplente' && (
                <>
                  <DropdownMenuItem onClick={() => handleStatusAction('suspender')}>
                    <Pause className="mr-2 h-4 w-4" />
                    Suspender
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusAction('bloquear')}>
                    <Lock className="mr-2 h-4 w-4" />
                    Bloquear
                  </DropdownMenuItem>
                </>
              )}
              {status === 'em_analise' && (
                <>
                  <DropdownMenuItem onClick={handleReativar}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Aprovar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusAction('cancelar')} className="text-destructive">
                    <XCircle className="mr-2 h-4 w-4" />
                    Reprovar
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="dados" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="dados">
            <User className="mr-2 h-4 w-4" />
            Dados
          </TabsTrigger>
          <TabsTrigger value="veiculos">
            <Car className="mr-2 h-4 w-4" />
            Veículos ({veiculos?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="documentos">
            <FileCheck className="mr-2 h-4 w-4" />
            Documentos
          </TabsTrigger>
          <TabsTrigger value="contrato">
            <FileText className="mr-2 h-4 w-4" />
            Contrato
          </TabsTrigger>
          <TabsTrigger value="boletos">
            <CreditCard className="mr-2 h-4 w-4" />
            Boletos
          </TabsTrigger>
          <TabsTrigger value="historico">
            <Clock className="mr-2 h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        {/* Tab: Dados */}
        <TabsContent value="dados" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Dados Pessoais */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dados Pessoais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Nome</p>
                    <p className="font-medium">{associado.nome}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">CPF</p>
                    <p className="font-medium">{associado.cpf}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">RG</p>
                    <p className="font-medium">{associado.rg || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Data de Nascimento</p>
                    <p className="font-medium">{formatDate(associado.data_nascimento)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Sexo</p>
                    <p className="font-medium">{associado.sexo || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Estado Civil</p>
                    <p className="font-medium">{associado.estado_civil || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Profissão</p>
                    <p className="font-medium">{associado.profissao || '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contato */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contato</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Telefone</p>
                    <p className="font-medium">{associado.telefone}</p>
                  </div>
                </div>
                {associado.whatsapp && (
                  <div className="flex items-center gap-3">
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">WhatsApp</p>
                      <p className="font-medium">{associado.whatsapp}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">E-mail</p>
                    <p className="font-medium">{associado.email}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Endereço */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Endereço</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                  <div className="text-sm">
                    {associado.logradouro ? (
                      <>
                        <p className="font-medium">
                          {associado.logradouro}, {associado.numero}
                          {associado.complemento && ` - ${associado.complemento}`}
                        </p>
                        <p className="text-muted-foreground">
                          {associado.bairro} - {associado.cidade}/{associado.uf}
                        </p>
                        <p className="text-muted-foreground">CEP: {associado.cep}</p>
                      </>
                    ) : (
                      <p className="text-muted-foreground">Endereço não cadastrado</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Associação */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Associação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Plano</p>
                    <p className="font-medium">{associado.planos?.nome || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge className={statusColors[status]}>
                      {STATUS_ASSOCIADO_LABELS[status]}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Data de Adesão</p>
                    <p className="font-medium">{formatDate(associado.data_adesao)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Dia de Vencimento</p>
                    <p className="font-medium">
                      {associado.dia_vencimento ? `Dia ${associado.dia_vencimento}` : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Cadastrado em</p>
                    <p className="font-medium">{formatDate(associado.created_at)}</p>
                  </div>
                </div>

                {associado.bloqueado && associado.motivo_bloqueio && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">Motivo do bloqueio:</span>
                    </div>
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {associado.motivo_bloqueio}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Veículos */}
        <TabsContent value="veiculos">
          <Card>
            <CardContent className="p-0">
              {!veiculos?.length ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Car className="h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 font-semibold">Nenhum veículo cadastrado</h3>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Veículo</TableHead>
                      <TableHead>Placa</TableHead>
                      <TableHead>Ano</TableHead>
                      <TableHead>Valor FIPE</TableHead>
                      <TableHead>Uso App</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {veiculos.map((veiculo) => (
                      <TableRow key={veiculo.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{veiculo.marca}</p>
                            <p className="text-sm text-muted-foreground">{veiculo.modelo}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">{veiculo.placa}</TableCell>
                        <TableCell>{veiculo.ano_fabricacao}/{veiculo.ano_modelo}</TableCell>
                        <TableCell>{formatCurrency(veiculo.valor_fipe)}</TableCell>
                        <TableCell>
                          {veiculo.uso_aplicativo ? (
                            <Badge variant="outline">{veiculo.plataforma_app || 'Sim'}</Badge>
                          ) : (
                            <span className="text-muted-foreground">Não</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={veiculoStatusColors[(veiculo.status as StatusVeiculo) || 'em_analise']}>
                            {STATUS_VEICULO_LABELS[(veiculo.status as StatusVeiculo) || 'em_analise']}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Documentos */}
        <TabsContent value="documentos" className="space-y-4">
          {veiculos && veiculos.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Veículo:</span>
              <Select value={selectedVeiculoId} onValueChange={setSelectedVeiculoId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Selecione o veículo" />
                </SelectTrigger>
                <SelectContent>
                  {veiculos.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.placa} - {v.modelo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DocumentUploader
            associadoId={id!}
            veiculoId={selectedVeiculoId || veiculos?.[0]?.id}
            modo="completo"
            onTodosEnviados={() => toast({ title: 'Todos os documentos obrigatórios enviados!' })}
          />
        </TabsContent>

        {/* Tab: Contrato */}
        <TabsContent value="contrato">
          <Card>
            <CardContent className="p-6">
              {!associado.contratos ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 font-semibold">Nenhum contrato vinculado</h3>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Número</p>
                      <p className="font-medium">{associado.contratos.numero}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge>
                        {STATUS_CONTRATO_LABELS[associado.contratos.status]}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Data de Início</p>
                      <p className="font-medium">{formatDate(associado.contratos.data_inicio)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Valor Mensal</p>
                      <p className="font-medium">{formatCurrency(associado.contratos.valor_mensal)}</p>
                    </div>
                  </div>
                  {associado.contratos.autentique_url && (
                    <>
                      <Separator />
                      <Button 
                        variant="outline"
                        onClick={() => window.open(associado.contratos?.autentique_url || '', '_blank')}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Ver Contrato no Autentique
                      </Button>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Boletos */}
        <TabsContent value="boletos">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Boletos</CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => toast({ title: 'Em desenvolvimento', description: 'Módulo financeiro em implementação.' })}
              >
                <Receipt className="mr-2 h-4 w-4" />
                Gerar Novo Boleto
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12">
                <CreditCard className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 font-semibold">Módulo financeiro em desenvolvimento</h3>
                <p className="text-sm text-muted-foreground text-center mt-1">
                  Em breve você poderá visualizar e gerenciar os boletos do associado aqui.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Histórico */}
        <TabsContent value="historico">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de Atividades</CardTitle>
            </CardHeader>
            <CardContent>
              <AssociadoTimeline items={historico || []} isLoading={historicoLoading} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ConfirmacaoAcaoDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
        acao={confirmDialog.action}
        nomeAssociado={associado.nome}
        onConfirm={handleConfirmAction}
      />

      <AssociadoEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        associado={associado}
        onSuccess={() => refetch()}
      />
    </div>
  );
}

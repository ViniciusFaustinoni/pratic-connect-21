import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Phone, Mail, MessageCircle, MapPin, Calendar, User, Car, 
  FileCheck, FileText, Clock, Edit, AlertTriangle, Loader2,
  Receipt, MoreHorizontal, CheckCircle, XCircle, Pause, Play, Plus,
  CreditCard, Shield, Eye, ExternalLink, Wifi, WifiOff, Send, History,
  TrendingUp, DollarSign, Camera, Image
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
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
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { 
  STATUS_ASSOCIADO_LABELS, 
  STATUS_VEICULO_LABELS,
  STATUS_DOCUMENTO_LABELS,
  TIPO_DOCUMENTO_LABELS,
  STATUS_ASSOCIADO_COLORS,
  STATUS_VEICULO_COLORS,
  STATUS_DOCUMENTO_COLORS,
  type StatusAssociado,
  type StatusVeiculo,
} from '@/types/cadastro';
import { useAssociado, useVeiculosDoAssociado, useAssociadoStats, useAssociadoActions } from '@/hooks/useAssociados';
import { useDocumentosPorAssociado } from '@/hooks/useDocumentos';
import { useContratoDoAssociado, useDocumentosCotacao, useResumoFinanceiroAssociado } from '@/hooks/useDocumentosCotacao';
import { useFotosAutovistoriaCotacao, agruparFotosPorCategoria, formatarTipoFoto } from '@/hooks/useFotosAutovistoria';
import { cn } from '@/lib/utils';

// ============================================
// UTILITÁRIOS
// ============================================
const formatCPF = (cpf: string | null) => {
  if (!cpf) return '—';
  const d = cpf.replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}` : cpf;
};

const formatCPFMasked = (cpf: string | null) => {
  if (!cpf) return '—';
  const d = cpf.replace(/\D/g, '');
  return d.length === 11 ? `***.${d.slice(3,6)}.***-${d.slice(9)}` : cpf;
};

const formatPhone = (phone: string | null) => {
  if (!phone) return '—';
  const d = phone.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return phone;
};

const formatCurrency = (v: number | null | undefined) => 
  v ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : 'R$ 0,00';

const formatDate = (d: string | null | undefined) => 
  d ? new Date(d).toLocaleDateString('pt-BR') : '—';

const formatDateShort = (d: string | null | undefined) => 
  d ? new Date(d).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }) : '—';

const formatDateTime = (d: string) => 
  new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const calcularIdade = (dn: string | null | undefined) => {
  if (!dn) return null;
  const hoje = new Date(), nasc = new Date(dn);
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
};

const getInitials = (nome: string) => {
  const p = nome.split(' ');
  return p.length >= 2 ? `${p[0][0]}${p[p.length-1][0]}`.toUpperCase() : nome.slice(0,2).toUpperCase();
};

// ============================================
// MOCK DATA
// ============================================
const MOCK_FATURAS = [
  { id: '1', referencia: 'Jan/2026', vencimento: '2026-01-15', valor: 249.90, status: 'pago' },
  { id: '2', referencia: 'Dez/2025', vencimento: '2025-12-15', valor: 249.90, status: 'pago' },
  { id: '3', referencia: 'Nov/2025', vencimento: '2025-11-15', valor: 249.90, status: 'pago' },
  { id: '4', referencia: 'Out/2025', vencimento: '2025-10-15', valor: 249.90, status: 'pago' },
  { id: '5', referencia: 'Set/2025', vencimento: '2025-09-15', valor: 249.90, status: 'pago' },
];

const MOCK_HISTORICO = [
  { id: '1', tipo: 'pagamento', data: '2026-01-15T14:32:00', titulo: 'Pagamento confirmado', descricao: 'Fatura Jan/2026 - R$ 249,90 via Boleto', icone: CheckCircle, cor: 'text-green-500' },
  { id: '2', tipo: 'documento', data: '2026-01-10T16:45:00', titulo: 'Documento aprovado', descricao: 'CNH aprovada por Maria Santos', icone: FileText, cor: 'text-blue-500' },
  { id: '3', tipo: 'veiculo', data: '2026-01-05T10:20:00', titulo: 'Veículo adicionado', descricao: 'Hyundai HB20 2022 - Placa DEF-5678', icone: Car, cor: 'text-purple-500' },
  { id: '4', tipo: 'atendimento', data: '2026-01-02T09:15:00', titulo: 'Atendimento finalizado', descricao: 'Chamado #1234 - Dúvida sobre cobertura', icone: MessageCircle, cor: 'text-yellow-500' },
  { id: '5', tipo: 'fatura', data: '2026-01-01T00:01:00', titulo: 'Fatura gerada', descricao: 'Fatura Jan/2026 - R$ 249,90', icone: Receipt, cor: 'text-muted-foreground' },
  { id: '6', tipo: 'contrato', data: '2024-01-15T11:30:00', titulo: 'Contrato assinado', descricao: 'Adesão concluída - Plano Completo', icone: Shield, cor: 'text-green-600' },
];

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function AssociadoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('resumo');
  const [suspenderDialogOpen, setSuspenderDialogOpen] = useState(false);
  const [cancelarDialogOpen, setCancelarDialogOpen] = useState(false);
  const [fotoModal, setFotoModal] = useState<{ open: boolean; url: string; tipo: string }>({ open: false, url: '', tipo: '' });

  // Data fetching
  const { data: associado, isLoading, refetch } = useAssociado(id);
  const { data: veiculos, isLoading: isLoadingVeiculos } = useVeiculosDoAssociado(id);
  const { data: documentos, isLoading: isLoadingDocs } = useDocumentosPorAssociado(id);
  const { data: stats } = useAssociadoStats(id);
  
  // Buscar contrato do associado para obter cotacao_id e dados financeiros
  const { data: contrato } = useContratoDoAssociado(id);
  const cotacaoId = contrato?.cotacao_id;
  
  // Resumo financeiro real (meses em dia, próximo vencimento)
  const { data: resumoFinanceiro } = useResumoFinanceiroAssociado(id);
  
  // Buscar documentos da cotação (contratos_documentos)
  const { data: documentosCotacao, isLoading: isLoadingDocsCotacao } = useDocumentosCotacao(cotacaoId);
  
  // Buscar fotos de autovistoria
  const { data: fotosAutovistoria, isLoading: isLoadingFotos } = useFotosAutovistoriaCotacao(cotacaoId);
  const fotosAgrupadas = fotosAutovistoria ? agruparFotosPorCategoria(fotosAutovistoria) : null;
  
  // Actions
  const { 
    suspenderAssociado, 
    reativarAssociado, 
    cancelarAssociado,
    isSuspendendo, 
    isReativando, 
    isCancelando 
  } = useAssociadoActions();

  // Handlers
  const handleWhatsApp = () => {
    if (!associado?.telefone) return;
    window.open(`https://wa.me/55${associado.telefone.replace(/\D/g, '')}`, '_blank');
  };

  const handleEmail = () => {
    if (!associado?.email) return;
    window.open(`mailto:${associado.email}`, '_blank');
  };

  const handleSuspender = () => {
    if (!id) return;
    suspenderAssociado({ id });
    setSuspenderDialogOpen(false);
  };

  const handleReativar = () => {
    if (id) reativarAssociado(id);
  };

  const handleCancelar = () => {
    if (!id) return;
    cancelarAssociado({ id, motivo: 'Cancelado pelo administrador' });
    setCancelarDialogOpen(false);
    navigate('/cadastro/associados');
  };

  // ============================================
  // LOADING STATE
  // ============================================
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  // ============================================
  // ERROR STATE
  // ============================================
  if (!associado) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <User className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 font-semibold">Associado não encontrado</h3>
        <Button variant="link" onClick={() => navigate('/cadastro/associados')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
      </div>
    );
  }

  // Computed values
  const status = associado.status as StatusAssociado;
  const idade = calcularIdade(associado.data_nascimento);
  
  // Combinar documentos das duas fontes
  const todosDocumentos = [
    ...(documentos || []).map(d => ({ ...d, fonte: 'documentos' as const })),
    ...(documentosCotacao || []).map(d => ({ 
      ...d, 
      fonte: 'cotacao' as const,
      veiculo: null,
    })),
  ];
  
  const docsPendentes = todosDocumentos.filter(d => d.status === 'pendente').length;
  const docsAprovados = todosDocumentos.filter(d => d.status === 'aprovado').length;
  const docsReprovados = todosDocumentos.filter(d => d.status === 'reprovado').length;
  const totalFotos = fotosAutovistoria?.length || 0;

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="space-y-6">
      {/* BREADCRUMB */}
      <nav className="flex items-center text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <span className="mx-2">/</span>
        <Link to="/cadastro/associados" className="hover:text-foreground">Cadastro</Link>
        <span className="mx-2">/</span>
        <Link to="/cadastro/associados" className="hover:text-foreground">Associados</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground font-medium">{associado.nome}</span>
      </nav>

      <Button variant="ghost" size="sm" onClick={() => navigate('/cadastro/associados')}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>

      {/* HEADER CARD */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Left: Avatar + Info */}
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16 bg-primary text-primary-foreground">
                <AvatarFallback className="bg-transparent text-xl font-bold">
                  {getInitials(associado.nome)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">{associado.nome}</h1>
                  <Badge className={cn(STATUS_ASSOCIADO_COLORS[status])}>
                    {STATUS_ASSOCIADO_LABELS[status]}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>CPF: {formatCPFMasked(associado.cpf)}</span>
                  <span>Desde {formatDateShort(associado.data_adesao)}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {formatPhone(associado.telefone)}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    {associado.email}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => navigate(`/cadastro/associados/${id}/editar`)}>
                <Edit className="mr-2 h-4 w-4" /> Editar
              </Button>
              <Button variant="outline" onClick={() => setActiveTab('documentos')}>
                <FileCheck className="mr-2 h-4 w-4" /> Documentos
                {docsPendentes > 0 && (
                  <Badge variant="destructive" className="ml-2 h-5 px-1.5">{docsPendentes}</Badge>
                )}
              </Button>
              <Button variant="outline" onClick={() => setActiveTab('financeiro')}>
                <DollarSign className="mr-2 h-4 w-4" /> Financeiro
              </Button>
              
              {status === 'ativo' && (
                <Button variant="outline" className="text-yellow-600" onClick={() => setSuspenderDialogOpen(true)}>
                  <Pause className="mr-2 h-4 w-4" /> Suspender
                </Button>
              )}
              
              {status === 'suspenso' && (
                <Button variant="outline" className="text-green-600" onClick={handleReativar} disabled={isReativando}>
                  {isReativando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                  Reativar
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleWhatsApp}>
                    <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleEmail}>
                    <Mail className="mr-2 h-4 w-4" /> Email
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => setCancelarDialogOpen(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <XCircle className="mr-2 h-4 w-4" /> Cancelar Associação
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TABS */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="resumo">
            <TrendingUp className="mr-2 h-4 w-4" /> Resumo
          </TabsTrigger>
          <TabsTrigger value="dados">
            <User className="mr-2 h-4 w-4" /> Dados Pessoais
          </TabsTrigger>
          <TabsTrigger value="veiculos">
            <Car className="mr-2 h-4 w-4" /> Veículos {veiculos?.length ? `(${veiculos.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="documentos">
            <FileCheck className="mr-2 h-4 w-4" /> Documentos
            {docsPendentes > 0 && <Badge variant="destructive" className="ml-2 h-5 px-1.5">{docsPendentes}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="financeiro">
            <CreditCard className="mr-2 h-4 w-4" /> Financeiro
          </TabsTrigger>
          <TabsTrigger value="historico">
            <History className="mr-2 h-4 w-4" /> Histórico
          </TabsTrigger>
        </TabsList>

        {/* ============================================ */}
        {/* TAB: RESUMO */}
        {/* ============================================ */}
        <TabsContent value="resumo" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Car className="h-8 w-8 mx-auto text-blue-500" />
                <p className="text-2xl font-bold mt-2">{stats?.veiculos || 0}</p>
                <p className="text-sm text-muted-foreground">Veículos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <FileCheck className="h-8 w-8 mx-auto text-green-500" />
                <p className="text-2xl font-bold mt-2">{docsAprovados}/{documentos?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Documentos ✓</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                {resumoFinanceiro?.emAtraso && resumoFinanceiro.emAtraso > 0 ? (
                  <>
                    <AlertTriangle className="h-8 w-8 mx-auto text-orange-500" />
                    <p className="text-2xl font-bold mt-2">{resumoFinanceiro.emAtraso}</p>
                    <p className="text-sm text-muted-foreground">Em atraso</p>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-8 w-8 mx-auto text-green-500" />
                    <p className="text-2xl font-bold mt-2">{resumoFinanceiro?.mesesPagos || 0} {resumoFinanceiro?.mesesPagos === 1 ? 'mês' : 'meses'}</p>
                    <p className="text-sm text-muted-foreground">Em dia</p>
                  </>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <AlertTriangle className="h-8 w-8 mx-auto text-orange-500" />
                <p className="text-2xl font-bold mt-2">{stats?.sinistros || 0}</p>
                <p className="text-sm text-muted-foreground">Sinistros</p>
              </CardContent>
            </Card>
          </div>

          {/* Info Cards */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Informações Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Plano</span><span className="font-medium">{associado.planos?.nome || '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Mensalidade</span><span className="font-medium">{contrato?.valor_mensal ? formatCurrency(contrato.valor_mensal) : '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Dia vencimento</span><span className="font-medium">Todo dia {contrato?.dia_vencimento || associado.dia_vencimento || 15}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Início contrato</span><span className="font-medium">{contrato?.data_inicio ? formatDate(contrato.data_inicio) : '—'}</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Próximos Vencimentos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mensalidade</span>
                  <span className="font-medium">{resumoFinanceiro?.proximaCobranca?.data_vencimento ? formatDate(resumoFinanceiro.proximaCobranca.data_vencimento) : '—'}</span>
                </div>
                {/* CNH e CRLV viriam dos documentos - verificar validade */}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CNH vence</span>
                  <span className="font-medium">—</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CRLV vence</span>
                  <span className="font-medium">—</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Últimas Atividades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {MOCK_HISTORICO.slice(0, 5).map((e) => {
                  const Icon = e.icone;
                  return (
                    <div key={e.id} className="flex items-start gap-3">
                      <Icon className={cn('h-5 w-5 mt-0.5', e.cor)} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{e.titulo}</p>
                        <p className="text-sm text-muted-foreground truncate">{e.descricao}</p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(e.data.split('T')[0])}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================ */}
        {/* TAB: DADOS PESSOAIS */}
        {/* ============================================ */}
        <TabsContent value="dados" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Dados Pessoais */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dados Pessoais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Nome Completo</p>
                  <p className="font-medium">{associado.nome}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-muted-foreground">CPF</p>
                    <p className="font-medium">{formatCPF(associado.cpf)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">RG</p>
                    <p className="font-medium">{associado.rg || '—'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-muted-foreground">Nascimento</p>
                    <p className="font-medium">
                      {formatDate(associado.data_nascimento)}
                      {idade && <span className="text-muted-foreground ml-1">({idade} anos)</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Sexo</p>
                    <p className="font-medium">{associado.sexo === 'M' ? 'Masculino' : associado.sexo === 'F' ? 'Feminino' : '—'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Endereço */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Endereço</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="text-muted-foreground">CEP</p>
                  <p className="font-medium">{associado.cep || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Logradouro</p>
                  <p className="font-medium">
                    {associado.logradouro || '—'}
                    {associado.numero && `, ${associado.numero}`}
                    {associado.complemento && ` - ${associado.complemento}`}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Bairro</p>
                  <p className="font-medium">{associado.bairro || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cidade / Estado</p>
                  <p className="font-medium">{associado.cidade || '—'} {associado.uf && `- ${associado.uf}`}</p>
                </div>
              </CardContent>
            </Card>

            {/* Contatos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contatos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Telefone Principal</p>
                  <p className="font-medium">{formatPhone(associado.telefone)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Telefone Secundário</p>
                  <p className="font-medium">{formatPhone(associado.telefone_secundario)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{associado.email || '—'}</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={handleWhatsApp}>
                    <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleEmail}>
                    <Mail className="mr-2 h-4 w-4" /> Email
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Plano e Contrato */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Plano e Contrato</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Plano</p>
                  <p className="font-medium">{associado.planos?.nome || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Data de Adesão</p>
                  <p className="font-medium">{formatDate(associado.data_adesao)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Contrato</p>
                  <p className="font-medium">{associado.contratos?.[0]?.numero || 'CTR-2024-00123'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-muted-foreground">Vencimento</p>
                    <p className="font-medium">Todo dia {associado.dia_vencimento || 15}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Valor</p>
                    <p className="font-medium">R$ 249,90/mês</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============================================ */}
        {/* TAB: VEÍCULOS */}
        {/* ============================================ */}
        <TabsContent value="veiculos" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Veículos ({veiculos?.length || 0})</h3>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Adicionar
            </Button>
          </div>

          {isLoadingVeiculos ? (
            <Skeleton className="h-48 w-full" />
          ) : veiculos && veiculos.length > 0 ? (
            <div className="grid gap-4">
              {veiculos.map((v) => (
                <Card key={v.id}>
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-3">
                          <h4 className="text-lg font-semibold">{v.marca} {v.modelo} {v.ano_modelo}</h4>
                          <Badge className={cn(STATUS_VEICULO_COLORS[(v.status as StatusVeiculo) || 'em_analise'])}>
                            {STATUS_VEICULO_LABELS[(v.status as StatusVeiculo) || 'em_analise']}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Placa</p>
                            <p className="font-mono font-medium">{v.placa}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Chassi</p>
                            <p className="font-mono text-xs">{v.chassi || '—'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Renavam</p>
                            <p className="font-medium">{v.renavam || '—'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Cor</p>
                            <p className="font-medium">{v.cor || '—'}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Valor FIPE</p>
                            <p className="font-medium">{formatCurrency(v.valor_fipe)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Código FIPE</p>
                            <p className="font-medium">{v.codigo_fipe || '—'}</p>
                          </div>
                        </div>

                        <Separator />

                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            {v.rastreador ? (
                              <>
                                <Wifi className="h-4 w-4 text-green-500" />
                                <span>Rastreador: {v.rastreador?.codigo} — {v.rastreador?.numero_serie}</span>
                              </>
                            ) : (
                              <>
                                <WifiOff className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Sem rastreador</span>
                              </>
                            )}
                          </div>
                          <span className="text-muted-foreground">Uso app: {v.uso_aplicativo ? 'Sim' : 'Não'}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline">
                          <Eye className="mr-2 h-4 w-4" /> Detalhes
                        </Button>
                        <Button size="sm" variant="outline">
                          <Edit className="mr-2 h-4 w-4" /> Editar
                        </Button>
                        <Button size="sm" variant="outline">
                          <FileText className="mr-2 h-4 w-4" /> Documentos
                        </Button>
                        {!v.rastreador && (
                          <Button size="sm" variant="outline">
                            <Calendar className="mr-2 h-4 w-4" /> Agendar Instalação
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Car className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 font-semibold">Nenhum veículo cadastrado</h3>
                <Button className="mt-4">
                  <Plus className="mr-2 h-4 w-4" /> Adicionar
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============================================ */}
        {/* TAB: DOCUMENTOS */}
        {/* ============================================ */}
        <TabsContent value="documentos" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{todosDocumentos.length}</p>
                <p className="text-sm text-muted-foreground">Documentos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{docsAprovados}</p>
                <p className="text-sm text-muted-foreground">Aprovados</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-yellow-600">{docsPendentes}</p>
                <p className="text-sm text-muted-foreground">Pendentes</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{totalFotos}</p>
                <p className="text-sm text-muted-foreground">Fotos Vistoria</p>
              </CardContent>
            </Card>
          </div>

          {/* Rejected Alert */}
          {docsReprovados > 0 && (
            <Card className="border-destructive bg-destructive/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <XCircle className="h-5 w-5 text-destructive" />
                    <div>
                      <p className="font-medium text-destructive">{docsReprovados} documento(s) reprovado(s)</p>
                      <p className="text-sm text-muted-foreground">Solicite o reenvio ao associado.</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline">
                    <Send className="mr-2 h-4 w-4" /> Solicitar Reenvio
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Documents Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documentos Anexados
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingDocs || isLoadingDocsCotacao ? (
                <Skeleton className="h-48 w-full" />
              ) : todosDocumentos.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Documento</TableHead>
                      <TableHead>Veículo</TableHead>
                      <TableHead>Enviado</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todosDocumentos.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">
                          {TIPO_DOCUMENTO_LABELS[d.tipo] || d.tipo.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </TableCell>
                        <TableCell>
                          {'veiculo' in d && d.veiculo ? (
                            <Badge variant="outline">{d.veiculo.placa}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>{formatDate(d.created_at)}</TableCell>
                        <TableCell>
                          <Badge className={cn(
                            d.status === 'aprovado' && 'bg-green-100 text-green-700 border-green-200',
                            d.status === 'pendente' && 'bg-yellow-100 text-yellow-700 border-yellow-200',
                            d.status === 'reprovado' && 'bg-red-100 text-red-700 border-red-200'
                          )}>
                            {STATUS_DOCUMENTO_LABELS[d.status] || d.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {'arquivo_url' in d && d.arquivo_url ? (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => window.open(d.arquivo_url, '_blank')}
                            >
                              <Eye className="mr-2 h-4 w-4" /> Ver
                            </Button>
                          ) : d.fonte === 'documentos' ? (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => navigate(`/cadastro/documentos/${d.id}`)}
                            >
                              {d.status === 'pendente' ? (
                                <><Eye className="mr-2 h-4 w-4" /> Analisar</>
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <FileText className="h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-2 text-muted-foreground">Nenhum documento anexado</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Galeria de Autovistoria */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Galeria de Autovistoria
                {totalFotos > 0 && (
                  <Badge variant="secondary" className="ml-2">{totalFotos} fotos</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingFotos ? (
                <Skeleton className="h-48 w-full" />
              ) : fotosAgrupadas && totalFotos > 0 ? (
                <div className="space-y-6">
                  {/* Identificação */}
                  {fotosAgrupadas.identificacao.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Identificação ({fotosAgrupadas.identificacao.length})
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {fotosAgrupadas.identificacao.map((foto) => (
                          <div 
                            key={foto.id} 
                            className="relative group cursor-pointer rounded-lg overflow-hidden border bg-muted/50"
                            onClick={() => setFotoModal({ open: true, url: foto.arquivo_url, tipo: formatarTipoFoto(foto.tipo) })}
                          >
                            <img 
                              src={foto.arquivo_url} 
                              alt={formatarTipoFoto(foto.tipo)}
                              className="w-full h-24 object-cover transition-transform group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Eye className="h-6 w-6 text-white" />
                            </div>
                            <p className="text-xs text-center py-1 bg-background/80">{formatarTipoFoto(foto.tipo)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Exterior */}
                  {fotosAgrupadas.exterior.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                        <Car className="h-4 w-4" />
                        Exterior ({fotosAgrupadas.exterior.length})
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {fotosAgrupadas.exterior.map((foto) => (
                          <div 
                            key={foto.id} 
                            className="relative group cursor-pointer rounded-lg overflow-hidden border bg-muted/50"
                            onClick={() => setFotoModal({ open: true, url: foto.arquivo_url, tipo: formatarTipoFoto(foto.tipo) })}
                          >
                            <img 
                              src={foto.arquivo_url} 
                              alt={formatarTipoFoto(foto.tipo)}
                              className="w-full h-24 object-cover transition-transform group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Eye className="h-6 w-6 text-white" />
                            </div>
                            <p className="text-xs text-center py-1 bg-background/80">{formatarTipoFoto(foto.tipo)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Interior */}
                  {fotosAgrupadas.interior.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                        <Image className="h-4 w-4" />
                        Interior ({fotosAgrupadas.interior.length})
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {fotosAgrupadas.interior.map((foto) => (
                          <div 
                            key={foto.id} 
                            className="relative group cursor-pointer rounded-lg overflow-hidden border bg-muted/50"
                            onClick={() => setFotoModal({ open: true, url: foto.arquivo_url, tipo: formatarTipoFoto(foto.tipo) })}
                          >
                            <img 
                              src={foto.arquivo_url} 
                              alt={formatarTipoFoto(foto.tipo)}
                              className="w-full h-24 object-cover transition-transform group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Eye className="h-6 w-6 text-white" />
                            </div>
                            <p className="text-xs text-center py-1 bg-background/80">{formatarTipoFoto(foto.tipo)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Outros */}
                  {fotosAgrupadas.outros.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Outras ({fotosAgrupadas.outros.length})
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {fotosAgrupadas.outros.map((foto) => (
                          <div 
                            key={foto.id} 
                            className="relative group cursor-pointer rounded-lg overflow-hidden border bg-muted/50"
                            onClick={() => setFotoModal({ open: true, url: foto.arquivo_url, tipo: formatarTipoFoto(foto.tipo) })}
                          >
                            <img 
                              src={foto.arquivo_url} 
                              alt={formatarTipoFoto(foto.tipo)}
                              className="w-full h-24 object-cover transition-transform group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Eye className="h-6 w-6 text-white" />
                            </div>
                            <p className="text-xs text-center py-1 bg-background/80">{formatarTipoFoto(foto.tipo)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <Camera className="h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-2 text-muted-foreground">Nenhuma foto de autovistoria</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Modal de Foto */}
          <Dialog open={fotoModal.open} onOpenChange={(open) => setFotoModal({ ...fotoModal, open })}>
            <DialogContent className="max-w-3xl">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{fotoModal.tipo}</h3>
                <img 
                  src={fotoModal.url} 
                  alt={fotoModal.tipo}
                  className="w-full max-h-[70vh] object-contain rounded-lg"
                />
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ============================================ */}
        {/* TAB: FINANCEIRO */}
        {/* ============================================ */}
        <TabsContent value="financeiro" className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Situação</p>
                <Badge className="mt-2 bg-green-100 text-green-800">EM DIA</Badge>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Próxima Fatura</p>
                <p className="text-xl font-bold mt-1">15/02/2026</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Total Pago</p>
                <p className="text-xl font-bold mt-1 text-green-600">R$ 2.998,80</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Em Aberto</p>
                <p className="text-xl font-bold mt-1">R$ 0,00</p>
              </CardContent>
            </Card>
          </div>

          {/* Invoices Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Últimas Faturas</CardTitle>
              <Button variant="outline" size="sm">
                <ExternalLink className="mr-2 h-4 w-4" /> Ver todas
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referência</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOCK_FATURAS.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.referencia}</TableCell>
                      <TableCell>{formatDate(f.vencimento)}</TableCell>
                      <TableCell>{formatCurrency(f.valor)}</TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800">Pago</Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline">
              <Receipt className="mr-2 h-4 w-4" /> 2ª Via Boleto
            </Button>
            <Button variant="outline">
              <FileText className="mr-2 h-4 w-4" /> Extrato
            </Button>
            <Button variant="outline">
              <CreditCard className="mr-2 h-4 w-4" /> Alterar Pagamento
            </Button>
          </div>
        </TabsContent>

        {/* ============================================ */}
        {/* TAB: HISTÓRICO */}
        {/* ============================================ */}
        <TabsContent value="historico" className="space-y-4">
          <h3 className="text-lg font-semibold">Histórico de Atividades</h3>
          
          <Card>
            <CardContent className="p-6">
              <div className="space-y-0">
                {MOCK_HISTORICO.map((e, i) => {
                  const Icon = e.icone;
                  const isLast = i === MOCK_HISTORICO.length - 1;
                  return (
                    <div key={e.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={cn('p-2 rounded-full bg-muted')}>
                          <Icon className={cn('h-4 w-4', e.cor)} />
                        </div>
                        {!isLast && <div className="w-px h-full bg-border min-h-[40px]" />}
                      </div>
                      <div className="pb-6 flex-1">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-medium">{e.titulo}</p>
                            <p className="text-sm text-muted-foreground">{e.descricao}</p>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDateTime(e.data)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Button variant="outline" className="w-full">
            <Clock className="mr-2 h-4 w-4" /> Carregar mais
          </Button>
        </TabsContent>
      </Tabs>

      {/* ============================================ */}
      {/* DIALOGS */}
      {/* ============================================ */}
      <AlertDialog open={suspenderDialogOpen} onOpenChange={setSuspenderDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspender Associado</AlertDialogTitle>
            <AlertDialogDescription>
              Suspender <strong>{associado.nome}</strong>? O associado perderá acesso aos benefícios até ser reativado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSuspender} className="bg-yellow-600 hover:bg-yellow-700">
              {isSuspendendo ? 'Suspendendo...' : 'Suspender'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelarDialogOpen} onOpenChange={setCancelarDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Associação</AlertDialogTitle>
            <AlertDialogDescription>
              Cancelar <strong>{associado.nome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelar} className="bg-destructive hover:bg-destructive/90">
              {isCancelando ? 'Cancelando...' : 'Cancelar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

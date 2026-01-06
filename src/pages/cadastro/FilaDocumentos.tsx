import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDocumentos, useDocumentosContagem, useDocumentoActions } from '@/hooks/useDocumentos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import {
  Search,
  RefreshCw,
  MoreHorizontal,
  Eye,
  FileSearch,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  TIPO_DOCUMENTO_LABELS,
  STATUS_DOCUMENTO_LABELS,
  STATUS_DOCUMENTO_COLORS,
} from '@/types/cadastro';
import type { StatusDocumento, DocumentoFilters } from '@/types/cadastro';

// ============================================
// UTILITÁRIOS
// ============================================
const formatTimeAgo = (date: string) => {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}min atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `${diffDays} dias atrás`;
  return past.toLocaleDateString('pt-BR');
};

const isPriorityHigh = (date: string) => {
  const now = new Date();
  const past = new Date(date);
  const diffHours = (now.getTime() - past.getTime()) / 3600000;
  return diffHours > 24;
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function FilaDocumentosPage() {
  const navigate = useNavigate();

  // Estados de filtro
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  // Debounce para busca
  const [searchDebounced, setSearchDebounced] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Filtros
  const filters: DocumentoFilters = {
    search: searchDebounced || undefined,
    tipo: tipoFilter as DocumentoFilters['tipo'] || undefined,
    status: statusFilter as StatusDocumento || undefined,
  };

  // Buscar documentos
  const { data, isLoading, error, refetch, isFetching } = useDocumentos({
    filters,
    pagination: { page, pageSize: 10 },
  });

  // Contagem geral
  const { data: contagemGeral } = useDocumentosContagem();
  
  // Contagem de hoje
  const { data: contagemHoje } = useDocumentosContagem({ hoje: true });

  // Actions
  const { iniciarAnalise, isIniciandoAnalise } = useDocumentoActions();

  // Reset página ao filtrar
  const handleFilterChange = (setter: (v: string) => void, value: string) => {
    setter(value === 'all' ? '' : value);
    setPage(1);
  };

  // Handler analisar
  const handleAnalisar = (documentoId: string) => {
    iniciarAnalise(documentoId);
    navigate(`/cadastro/documentos/${documentoId}`);
  };

  // ============================================
  // LOADING STATE
  // ============================================
  if (isLoading && !data) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>

        <div className="flex gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-40" />
          ))}
        </div>

        <Skeleton className="h-96" />
      </div>
    );
  }

  // ============================================
  // ERROR STATE
  // ============================================
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
        <div className="text-center space-y-2">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-lg font-semibold">Erro ao carregar documentos</h2>
          <Button
            variant="outline"
            onClick={() => refetch()}
          >
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  const documentos = data?.documentos || [];
  const pagination = data?.pagination;

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="space-y-6 p-6">
      {/* BREADCRUMB */}
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
              <Link to="/cadastro/associados">Cadastro</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Fila de Documentos</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fila de Documentos</h1>
          <p className="text-muted-foreground">Analise os documentos enviados pelos associados</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Atualizar
        </Button>
      </div>

      {/* CARDS DE RESUMO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card 
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            statusFilter === 'pendente' && "ring-2 ring-yellow-500"
          )}
          onClick={() => handleFilterChange(setStatusFilter, statusFilter === 'pendente' ? '' : 'pendente')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-full bg-yellow-100">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold">{contagemGeral?.pendente || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            statusFilter === 'em_analise' && "ring-2 ring-blue-500"
          )}
          onClick={() => handleFilterChange(setStatusFilter, statusFilter === 'em_analise' ? '' : 'em_analise')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-full bg-blue-100">
                <Eye className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Em Análise</p>
                <p className="text-2xl font-bold">{contagemGeral?.em_analise || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            statusFilter === 'aprovado' && "ring-2 ring-green-500"
          )}
          onClick={() => handleFilterChange(setStatusFilter, statusFilter === 'aprovado' ? '' : 'aprovado')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-full bg-green-100">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Aprovados Hoje</p>
                <p className="text-2xl font-bold">{contagemHoje?.aprovado || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            statusFilter === 'reprovado' && "ring-2 ring-red-500"
          )}
          onClick={() => handleFilterChange(setStatusFilter, statusFilter === 'reprovado' ? '' : 'reprovado')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-full bg-red-100">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Reprovados Hoje</p>
                <p className="text-2xl font-bold">{contagemHoje?.reprovado || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FILTROS */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou placa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={tipoFilter || 'all'}
          onValueChange={(v) => handleFilterChange(setTipoFilter, v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo de documento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="cnh">CNH</SelectItem>
            <SelectItem value="crlv">CRLV</SelectItem>
            <SelectItem value="comprovante_residencia">Comprovante Residência</SelectItem>
            <SelectItem value="selfie_documento">Selfie com Documento</SelectItem>
            <SelectItem value="foto_veiculo_frente">Foto Veículo (Frente)</SelectItem>
            <SelectItem value="foto_veiculo_traseira">Foto Veículo (Traseira)</SelectItem>
            <SelectItem value="contrato_assinado">Contrato Assinado</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={statusFilter || 'all'}
          onValueChange={(v) => handleFilterChange(setStatusFilter, v)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="em_analise">Em Análise</SelectItem>
            <SelectItem value="aprovado">Aprovado</SelectItem>
            <SelectItem value="reprovado">Reprovado</SelectItem>
          </SelectContent>
        </Select>

        {(search || tipoFilter || statusFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              setTipoFilter('');
              setStatusFilter('');
              setPage(1);
            }}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {/* TABELA */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Associado</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Veículo</TableHead>
              <TableHead>Enviado</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documentos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <FileText className="h-8 w-8" />
                    <p>Nenhum documento encontrado</p>
                    {(search || tipoFilter || statusFilter) && (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => {
                          setSearch('');
                          setTipoFilter('');
                          setStatusFilter('');
                        }}
                      >
                        Limpar filtros
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              documentos.map((documento) => (
                <TableRow
                  key={documento.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/cadastro/documentos/${documento.id}`)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium">{documento.associado?.nome || '—'}</p>
                      <p className="text-sm text-muted-foreground">{documento.associado?.telefone || '—'}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {TIPO_DOCUMENTO_LABELS[documento.tipo] || documento.tipo}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm">
                      {documento.veiculo?.placa || '—'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {documento.status === 'pendente' && isPriorityHigh(documento.created_at) && (
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                      )}
                      <span className={cn(
                        "text-sm",
                        documento.status === 'pendente' && isPriorityHigh(documento.created_at) && "text-orange-600 font-medium"
                      )}>
                        {formatTimeAgo(documento.created_at)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_DOCUMENTO_COLORS[documento.status]}>
                      {STATUS_DOCUMENTO_LABELS[documento.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {documento.status === 'pendente' ? (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAnalisar(documento.id);
                            }}
                            disabled={isIniciandoAnalise}
                          >
                            <FileSearch className="h-4 w-4 mr-2" />
                            Analisar
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/cadastro/documentos/${documento.id}`);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Ver detalhes
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* PAGINAÇÃO */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {((page - 1) * 10) + 1}-{Math.min(page * 10, pagination.total)} de {pagination.total} documentos
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {page} de {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
            >
              Próximo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

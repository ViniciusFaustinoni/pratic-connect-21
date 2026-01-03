import { useState, useMemo } from 'react';
import { 
  Search, 
  FileCheck, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Eye, 
  AlertTriangle,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TIPO_DOCUMENTO_LABELS, type StatusDocumento, type TipoDocumento } from '@/types/database';
import { useDocumentosQueue, useDocumentosStats } from '@/hooks/useDocumentosQueue';
import { DocumentoCard } from '@/components/cadastro/DocumentoCard';
import { DocumentoAnaliseFullscreen } from '@/components/cadastro/DocumentoAnaliseFullscreen';

export default function Documentos() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusDocumento | 'all'>('pendente');
  const [tipoFilter, setTipoFilter] = useState<string>('all');
  const [orderBy, setOrderBy] = useState<'oldest' | 'newest'>('oldest');
  const [analyzeIndex, setAnalyzeIndex] = useState<number | null>(null);
  
  const { data: stats, isLoading: statsLoading } = useDocumentosStats();
  const { data: documentos, isLoading, refetch } = useDocumentosQueue({
    status: statusFilter,
    orderBy,
    search,
    tipo: tipoFilter,
  });

  const documentoIds = useMemo(() => documentos?.map(d => d.id) || [], [documentos]);

  const handleAnalyze = (id: string) => {
    const index = documentoIds.indexOf(id);
    if (index !== -1) {
      setAnalyzeIndex(index);
    }
  };

  const handleSkip = (id: string) => {
    const index = documentoIds.indexOf(id);
    if (index !== -1 && index < documentoIds.length - 1) {
      // Move to next document
      setAnalyzeIndex(index + 1);
    }
  };

  const handleNavigate = (index: number) => {
    setAnalyzeIndex(index);
  };

  const handleCloseAnalise = () => {
    setAnalyzeIndex(null);
  };

  const handleAnalyzed = () => {
    refetch();
  };

  const currentDocumentoId = analyzeIndex !== null ? documentoIds[analyzeIndex] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Documentos Pendentes</h1>
        <p className="text-muted-foreground">
          {statsLoading ? (
            <Skeleton className="h-4 w-48 inline-block" />
          ) : (
            `${stats?.pendentes || 0} documentos aguardando análise`
          )}
        </p>
      </div>

      {/* Alerta de documentos antigos */}
      {!statsLoading && stats && stats.pendentesAntigos > 0 && (
        <Alert variant="destructive" className="border-yellow-500 bg-yellow-50 text-yellow-800">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Atenção</AlertTitle>
          <AlertDescription>
            {stats.pendentesAntigos} documento{stats.pendentesAntigos > 1 ? 's' : ''} aguardando análise há mais de 24h
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <FileCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                {statsLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <p className="text-2xl font-bold">{stats?.total || 0}</p>
                )}
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-yellow-500/10 p-2">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                {statsLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <p className="text-2xl font-bold">{stats?.pendentes || 0}</p>
                )}
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Eye className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                {statsLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <p className="text-2xl font-bold">{stats?.emAnalise || 0}</p>
                )}
                <p className="text-xs text-muted-foreground">Em Análise</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/10 p-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                {statsLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <p className="text-2xl font-bold">{stats?.aprovados || 0}</p>
                )}
                <p className="text-xs text-muted-foreground">Aprovados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de Status */}
      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusDocumento | 'all')}>
        <TabsList className="w-full sm:w-auto grid grid-cols-5 sm:flex">
          <TabsTrigger value="pendente" className="gap-2">
            Pendentes
            {!statsLoading && <Badge variant="secondary" className="ml-1">{stats?.pendentes || 0}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="em_analise" className="gap-2">
            Em Análise
            {!statsLoading && <Badge variant="secondary" className="ml-1">{stats?.emAnalise || 0}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="aprovado">Aprovados</TabsTrigger>
          <TabsTrigger value="reprovado">Reprovados</TabsTrigger>
          <TabsTrigger value="all">Todos</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome do associado ou placa..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Tipo de Documento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(TIPO_DOCUMENTO_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={orderBy} onValueChange={(v) => setOrderBy(v as 'oldest' | 'newest')}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="oldest">Mais antigo primeiro</SelectItem>
            <SelectItem value="newest">Mais recente primeiro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid de Documentos */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-0">
                <Skeleton className="aspect-video w-full" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !documentos || documentos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          {statusFilter === 'pendente' ? (
            <>
              <div className="rounded-full bg-green-100 p-4 mb-4">
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">Tudo em dia!</h3>
              <p className="mt-2 text-muted-foreground text-center max-w-sm">
                Não há documentos pendentes de análise.
                {stats && (
                  <span className="block mt-2">
                    {stats.aprovados} documento{stats.aprovados !== 1 ? 's' : ''} aprovado{stats.aprovados !== 1 ? 's' : ''} • 
                    {stats.reprovados} reprovado{stats.reprovados !== 1 ? 's' : ''}
                  </span>
                )}
              </p>
            </>
          ) : (
            <>
              <FileText className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 font-semibold text-foreground">Nenhum documento encontrado</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {search || tipoFilter !== 'all' 
                  ? 'Tente ajustar os filtros' 
                  : 'Nenhum documento com esse status'}
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documentos.map((doc) => (
            <DocumentoCard
              key={doc.id}
              documento={doc}
              onAnalyze={handleAnalyze}
              onSkip={statusFilter === 'pendente' ? handleSkip : undefined}
            />
          ))}
        </div>
      )}

      {/* Modal de Análise Fullscreen */}
      {currentDocumentoId && (
        <DocumentoAnaliseFullscreen
          documentoId={currentDocumentoId}
          documentoIds={documentoIds}
          currentIndex={analyzeIndex!}
          open={analyzeIndex !== null}
          onClose={handleCloseAnalise}
          onNavigate={handleNavigate}
          onAnalyzed={handleAnalyzed}
        />
      )}
    </div>
  );
}

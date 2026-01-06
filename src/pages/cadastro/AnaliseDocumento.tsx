import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  useDocumento, 
  useDocumentosPorAssociado, 
  useDocumentoActions, 
  useProximoDocumento 
} from '@/hooks/useDocumentos';
import { DocumentoReprovacaoDialog } from '@/components/cadastro/DocumentoReprovacaoDialog';
import { ImageViewer } from '@/components/cadastro/ImageViewer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  XCircle,
  User,
  Car,
  FileText,
  Phone,
  Calendar,
  AlertCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  TIPO_DOCUMENTO_LABELS,
  STATUS_DOCUMENTO_LABELS,
  STATUS_DOCUMENTO_COLORS,
} from '@/types/cadastro';

// ============================================
// UTILITÁRIOS
// ============================================
const formatCPF = (cpf: string | null | undefined) => {
  if (!cpf) return '—';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length === 11) {
    return `***.${digits.slice(3, 6)}.***-${digits.slice(9)}`;
  }
  return cpf;
};

const formatPhone = (phone: string | null | undefined) => {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
};

const formatDateTime = (date: string | null | undefined) => {
  if (!date) return '—';
  return new Date(date).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function AnaliseDocumentoPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Estado do modal
  const [reprovacaoOpen, setReprovacaoOpen] = useState(false);

  // Buscar documento
  const { data: documento, isLoading, error } = useDocumento(id);

  // Buscar próximo da fila
  const { data: proximoDocumento } = useProximoDocumento();

  // Histórico do associado
  const { data: historicoDocumentos } = useDocumentosPorAssociado(documento?.associado_id);

  // Actions
  const { aprovarDocumento, reprovarDocumento, isAprovando, isReprovando } = useDocumentoActions();

  // Handler aprovar
  const handleAprovar = () => {
    if (!id) return;
    aprovarDocumento(id);
    
    // Navegar para próximo ou voltar para fila
    if (proximoDocumento && proximoDocumento.id !== id) {
      navigate(`/cadastro/documentos/${proximoDocumento.id}`);
    } else {
      navigate('/cadastro/fila-documentos');
    }
  };

  // Handler reprovar
  const handleReprovar = async (motivo: string, observacao: string) => {
    if (!id) return;
    
    reprovarDocumento({ id, motivo, observacao });
    setReprovacaoOpen(false);
    
    // Navegar para próximo ou voltar para fila
    if (proximoDocumento && proximoDocumento.id !== id) {
      navigate(`/cadastro/documentos/${proximoDocumento.id}`);
    } else {
      navigate('/cadastro/fila-documentos');
    }
  };

  // ============================================
  // LOADING STATE
  // ============================================
  if (isLoading) {
    return (
      <div className="container py-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid lg:grid-cols-2 gap-6">
          <Skeleton className="h-[500px]" />
          <Skeleton className="h-[500px]" />
        </div>
      </div>
    );
  }

  // ============================================
  // ERROR STATE
  // ============================================
  if (error || !documento) {
    return (
      <div className="container py-12">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Documento não encontrado</h2>
          <p className="text-muted-foreground mb-6">
            O documento solicitado não existe ou foi removido.
          </p>
          <Button onClick={() => navigate('/cadastro/fila-documentos')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para fila
          </Button>
        </div>
      </div>
    );
  }

  const podeAnalisar = documento.status === 'pendente' || documento.status === 'em_analise';
  const outrosDocumentos = historicoDocumentos?.filter(d => d.id !== documento.id) || [];
  const isPdf = documento.arquivo_url?.toLowerCase().endsWith('.pdf');

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="container py-6 space-y-6">
      {/* BREADCRUMB */}
      <nav className="text-sm text-muted-foreground">
        <ol className="flex items-center gap-2">
          <li>
            <Link to="/dashboard" className="hover:text-foreground transition-colors">
              Home
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link to="/cadastro/associados" className="hover:text-foreground transition-colors">
              Cadastro
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link to="/cadastro/fila-documentos" className="hover:text-foreground transition-colors">
              Documentos
            </Link>
          </li>
          <li>/</li>
          <li className="text-foreground font-medium">Análise</li>
        </ol>
      </nav>

      {/* HEADER COM NAVEGAÇÃO */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => navigate('/cadastro/fila-documentos')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Fila
        </Button>

        {proximoDocumento && proximoDocumento.id !== id && (
          <Button
            variant="outline"
            onClick={() => navigate(`/cadastro/documentos/${proximoDocumento.id}`)}
          >
            Próximo Documento
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>

      {/* CONTEÚDO PRINCIPAL */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* VISUALIZADOR DE IMAGEM */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" />
              Documento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative bg-muted rounded-lg overflow-hidden min-h-[400px]">
              {documento.arquivo_url ? (
                <ImageViewer 
                  src={documento.arquivo_url} 
                  alt={TIPO_DOCUMENTO_LABELS[documento.tipo] || documento.tipo}
                  isPdf={isPdf}
                  className="w-full h-full min-h-[400px]"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                  <FileText className="h-16 w-16 mb-4" />
                  <p className="font-medium">Imagem não disponível</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* INFORMAÇÕES */}
        <div className="space-y-6">
          {/* INFO DOCUMENTO */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5" />
                Informações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Tipo</span>
                <span className="font-medium">{TIPO_DOCUMENTO_LABELS[documento.tipo] || documento.tipo}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Enviado</span>
                <span className="font-medium">{formatDateTime(documento.created_at)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status</span>
                <Badge className={cn('border', STATUS_DOCUMENTO_COLORS[documento.status])}>
                  {STATUS_DOCUMENTO_LABELS[documento.status]}
                </Badge>
              </div>

              {documento.data_analise && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Analisado</span>
                  <span className="font-medium">{formatDateTime(documento.data_analise)}</span>
                </div>
              )}

              {documento.motivo_reprovacao && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground mb-1">Motivo reprovação:</p>
                  <p className="text-sm text-destructive">{documento.motivo_reprovacao}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* INFO ASSOCIADO */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5" />
                Associado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="font-medium text-lg">{documento.associado?.nome || '—'}</p>
              </div>

              <Separator />

              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">CPF:</span>
                <span>{formatCPF(documento.associado?.cpf)}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{formatPhone(documento.associado?.telefone)}</span>
              </div>

              {documento.associado?.id && (
                <div className="pt-2">
                  <Link
                    to={`/cadastro/associados/${documento.associado.id}`}
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Ver perfil completo
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* INFO VEÍCULO */}
          {documento.veiculo && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Car className="h-5 w-5" />
                  Veículo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-medium">
                    {documento.veiculo.marca} {documento.veiculo.modelo}
                  </p>
                </div>

                <Separator />

                <div className="flex items-center gap-2 text-sm">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Placa:</span>
                  <span className="font-mono font-medium">{documento.veiculo.placa}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* BOTÕES DE AÇÃO */}
      {podeAnalisar && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-4">
              <Button
                variant="destructive"
                size="lg"
                onClick={() => setReprovacaoOpen(true)}
                disabled={isReprovando || isAprovando}
                className="flex-1"
              >
                {isReprovando ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-5 w-5" />
                )}
                Reprovar
              </Button>
              <Button
                size="lg"
                onClick={handleAprovar}
                disabled={isAprovando || isReprovando}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {isAprovando ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-5 w-5" />
                )}
                Aprovar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* HISTÓRICO DO ASSOCIADO */}
      {outrosDocumentos.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5" />
              Outros Documentos do Associado
            </CardTitle>
            <CardDescription>
              Histórico de documentos enviados por este associado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {outrosDocumentos.slice(0, 10).map((doc) => (
                <Link
                  key={doc.id}
                  to={`/cadastro/documentos/${doc.id}`}
                  className={cn(
                    'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border transition-colors hover:bg-muted',
                    STATUS_DOCUMENTO_COLORS[doc.status]
                  )}
                >
                  {TIPO_DOCUMENTO_LABELS[doc.tipo] || doc.tipo}
                  <span className="text-xs opacity-70">
                    {formatDate(doc.created_at)}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* MODAL REPROVAÇÃO */}
      <DocumentoReprovacaoDialog
        open={reprovacaoOpen}
        onClose={() => setReprovacaoOpen(false)}
        onConfirm={handleReprovar}
        isLoading={isReprovando}
      />
    </div>
  );
}

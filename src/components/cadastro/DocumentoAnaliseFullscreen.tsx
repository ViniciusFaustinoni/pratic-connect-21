import { useEffect, useCallback, useState } from 'react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  XCircle, 
  Phone,
  MessageCircle,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Sheet, 
  SheetContent, 
} from '@/components/ui/sheet';
import { ImageViewer } from './ImageViewer';
import { DocumentoReprovacaoDialog } from './DocumentoReprovacaoDialog';
import { useDocumentosFull, useDocumentosByAssociadoFull } from '@/hooks/useDocumentosQueue';
import { useAnaliseDocumento } from '@/hooks/useDocumentos';
import { 
  TIPO_DOCUMENTO_LABELS, 
  STATUS_DOCUMENTO_LABELS,
  TIPO_DOCUMENTO_COLORS,
  STATUS_DOCUMENTO_COLORS,
  STATUS_ASSOCIADO_LABELS,
  STATUS_VEICULO_LABELS,
  type TipoDocumento, 
  type StatusDocumento,
  type StatusAssociado,
  type StatusVeiculo,
} from '@/types/database';
import { toast } from 'sonner';

interface DocumentoAnaliseFullscreenProps {
  documentoId: string;
  documentoIds: string[];
  currentIndex: number;
  open: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onAnalyzed?: () => void;
}

export function DocumentoAnaliseFullscreen({
  documentoId,
  documentoIds,
  currentIndex,
  open,
  onClose,
  onNavigate,
  onAnalyzed,
}: DocumentoAnaliseFullscreenProps) {
  const [showReprovacaoDialog, setShowReprovacaoDialog] = useState(false);
  
  const { data: documento, isLoading } = useDocumentosFull(documentoId);
  const { data: outrosDocumentos } = useDocumentosByAssociadoFull(documento?.associado_id);
  const analise = useAnaliseDocumento();

  const total = documentoIds.length;
  const hasNext = currentIndex < total - 1;
  const hasPrevious = currentIndex > 0;

  const goNext = useCallback(() => {
    if (hasNext) onNavigate(currentIndex + 1);
  }, [hasNext, currentIndex, onNavigate]);

  const goPrevious = useCallback(() => {
    if (hasPrevious) onNavigate(currentIndex - 1);
  }, [hasPrevious, currentIndex, onNavigate]);

  const handleAprovar = async () => {
    try {
      await analise.mutateAsync({
        id: documentoId,
        status: 'aprovado',
      });
      toast.success('Documento aprovado com sucesso!');
      onAnalyzed?.();
      if (hasNext) {
        goNext();
      } else {
        onClose();
      }
    } catch (error) {
      toast.error('Erro ao aprovar documento');
    }
  };

  const handleReprovar = async (motivo: string, observacao: string) => {
    const motivoCompleto = observacao ? `${motivo}: ${observacao}` : motivo;
    
    try {
      await analise.mutateAsync({
        id: documentoId,
        status: 'reprovado',
        motivo_reprovacao: motivoCompleto,
      });
      toast.success('Documento reprovado. Associado será notificado.');
      setShowReprovacaoDialog(false);
      onAnalyzed?.();
      if (hasNext) {
        goNext();
      } else {
        onClose();
      }
    } catch (error) {
      toast.error('Erro ao reprovar documento');
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
          goNext();
          break;
        case 'ArrowLeft':
          goPrevious();
          break;
        case 'a':
        case 'A':
          if (!showReprovacaoDialog && !analise.isPending) {
            handleAprovar();
          }
          break;
        case 'r':
        case 'R':
          if (!showReprovacaoDialog && !analise.isPending) {
            setShowReprovacaoDialog(true);
          }
          break;
        case 'Escape':
          if (showReprovacaoDialog) {
            setShowReprovacaoDialog(false);
          } else {
            onClose();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, goNext, goPrevious, showReprovacaoDialog, analise.isPending]);

  const isPdf = documento?.arquivo_url?.match(/\.pdf$/i);

  const formatCPF = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const formatPhone = (phone: string) => {
    return phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  };

  const getStatusIcon = (status: StatusDocumento) => {
    switch (status) {
      case 'aprovado':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'reprovado':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'em_analise':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent 
          side="right" 
          className="w-full sm:max-w-full p-0 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <Button variant="ghost" size="sm" onClick={onClose}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <span className="text-sm text-muted-foreground">
              Documento {currentIndex + 1} de {total}
            </span>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Left - Image Viewer */}
            <div className="flex-1 lg:w-[70%] bg-muted">
              {isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : documento ? (
                <ImageViewer
                  src={documento.arquivo_url}
                  alt={documento.nome_arquivo}
                  isPdf={!!isPdf}
                  className="h-full"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p className="text-muted-foreground">Documento não encontrado</p>
                </div>
              )}
            </div>

            {/* Right - Info Panel */}
            <div className="lg:w-[30%] border-t lg:border-t-0 lg:border-l flex flex-col max-h-[40vh] lg:max-h-none">
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  {documento && (
                    <>
                      {/* Documento Info */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">📄 Documento</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Tipo</span>
                            <Badge className={TIPO_DOCUMENTO_COLORS[documento.tipo as TipoDocumento]}>
                              {TIPO_DOCUMENTO_LABELS[documento.tipo as TipoDocumento]}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Status</span>
                            <Badge className={STATUS_DOCUMENTO_COLORS[documento.status as StatusDocumento]}>
                              {STATUS_DOCUMENTO_LABELS[documento.status as StatusDocumento]}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Enviado em</span>
                            <span>{new Date(documento.created_at).toLocaleString('pt-BR')}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Arquivo</span>
                            <p className="font-mono text-xs truncate">{documento.nome_arquivo}</p>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Associado Info */}
                      {documento.associados && (
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">👤 Associado</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            <p className="font-medium">{documento.associados.nome}</p>
                            <p className="text-muted-foreground">
                              CPF: {formatCPF(documento.associados.cpf)}
                            </p>
                            <div className="flex items-center gap-2">
                              <Phone className="h-3 w-3" />
                              <span>{formatPhone(documento.associados.telefone)}</span>
                              <a
                                href={`https://wa.me/55${documento.associados.telefone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-600 hover:text-green-700"
                              >
                                <MessageCircle className="h-4 w-4" />
                              </a>
                            </div>
                            <p className="text-muted-foreground">{documento.associados.email}</p>
                            <Badge className={STATUS_DOCUMENTO_COLORS[documento.associados.status as StatusDocumento] || 'bg-gray-100'}>
                              {STATUS_ASSOCIADO_LABELS[documento.associados.status as StatusAssociado]}
                            </Badge>
                          </CardContent>
                        </Card>
                      )}

                      {/* Endereço */}
                      {documento.associados?.logradouro && (
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">📍 Endereço</CardTitle>
                          </CardHeader>
                          <CardContent className="text-sm space-y-1">
                            <p>
                              {documento.associados.logradouro}
                              {documento.associados.numero && `, ${documento.associados.numero}`}
                              {documento.associados.complemento && ` - ${documento.associados.complemento}`}
                            </p>
                            <p>
                              {documento.associados.bairro}
                              {documento.associados.cidade && ` - ${documento.associados.cidade}`}
                              {documento.associados.uf && `/${documento.associados.uf}`}
                            </p>
                            {documento.associados.cep && (
                              <p className="text-muted-foreground">CEP: {documento.associados.cep}</p>
                            )}
                          </CardContent>
                        </Card>
                      )}

                      {/* Veículo */}
                      {documento.veiculos && (
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">🚗 Veículo</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            <p className="font-medium">{documento.veiculos.placa}</p>
                            <p>
                              {documento.veiculos.marca} {documento.veiculos.modelo}
                            </p>
                            <p className="text-muted-foreground">
                              {documento.veiculos.ano_fabricacao}/{documento.veiculos.ano_modelo}
                              {documento.veiculos.cor && ` - ${documento.veiculos.cor}`}
                            </p>
                            {documento.veiculos.chassi && (
                              <p className="font-mono text-xs text-muted-foreground">
                                Chassi: {documento.veiculos.chassi}
                              </p>
                            )}
                            {documento.veiculos.status && (
                              <Badge variant="outline">
                                {STATUS_VEICULO_LABELS[documento.veiculos.status as StatusVeiculo]}
                              </Badge>
                            )}
                          </CardContent>
                        </Card>
                      )}

                      {/* Outros Documentos */}
                      {outrosDocumentos && outrosDocumentos.length > 1 && (
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">📋 Outros Documentos</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-1">
                            {outrosDocumentos.map((doc) => (
                              <button
                                key={doc.id}
                                className={`w-full flex items-center justify-between py-1.5 px-2 rounded text-sm hover:bg-muted transition-colors ${
                                  doc.id === documentoId ? 'bg-muted font-medium' : ''
                                }`}
                                onClick={() => {
                                  const index = documentoIds.indexOf(doc.id);
                                  if (index !== -1) onNavigate(index);
                                }}
                              >
                                <span className="flex items-center gap-2">
                                  {getStatusIcon(doc.status as StatusDocumento)}
                                  {TIPO_DOCUMENTO_LABELS[doc.tipo as TipoDocumento]}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {STATUS_DOCUMENTO_LABELS[doc.status as StatusDocumento]}
                                </span>
                              </button>
                            ))}
                          </CardContent>
                        </Card>
                      )}

                      <Separator />

                      {/* Ações */}
                      <div className="space-y-2">
                        <Button 
                          className="w-full" 
                          size="lg"
                          onClick={handleAprovar}
                          disabled={analise.isPending}
                        >
                          {analise.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="mr-2 h-4 w-4" />
                          )}
                          APROVAR
                        </Button>
                        <Button 
                          variant="destructive" 
                          className="w-full" 
                          size="lg"
                          onClick={() => setShowReprovacaoDialog(true)}
                          disabled={analise.isPending}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          REPROVAR
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Footer Navigation */}
          <div className="border-t px-4 py-3 flex items-center justify-between bg-muted/50">
            <Button 
              variant="outline" 
              onClick={goPrevious}
              disabled={!hasPrevious}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Anterior (←)
            </Button>
            <div className="text-xs text-muted-foreground hidden sm:block">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border">A</kbd> Aprovar
              <span className="mx-2">|</span>
              <kbd className="px-1.5 py-0.5 rounded bg-muted border">R</kbd> Reprovar
              <span className="mx-2">|</span>
              <kbd className="px-1.5 py-0.5 rounded bg-muted border">ESC</kbd> Fechar
            </div>
            <Button 
              variant="outline" 
              onClick={goNext}
              disabled={!hasNext}
            >
              Próximo (→)
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <DocumentoReprovacaoDialog
        open={showReprovacaoDialog}
        onClose={() => setShowReprovacaoDialog(false)}
        onConfirm={handleReprovar}
        isLoading={analise.isPending}
      />
    </>
  );
}

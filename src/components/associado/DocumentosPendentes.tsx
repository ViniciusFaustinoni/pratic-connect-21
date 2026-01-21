import { useState } from 'react';
import { AlertTriangle, FileText, Upload, Check, Loader2, Send, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  useDocumentosSolicitadosPendentes,
  useEnviarDocumentoSolicitado,
  useVerificarDocumentosCompletos,
  formatTipoDocumento,
  type DocumentoSolicitado,
} from '@/hooks/useDocumentosSolicitados';

interface DocumentosPendentesProps {
  associadoId: string;
  readOnly?: boolean;
  onTodosEnviados?: () => void;
}

export function DocumentosPendentes({ associadoId, readOnly, onTodosEnviados }: DocumentosPendentesProps) {
  const { data: docsPendentes, isLoading, refetch } = useDocumentosSolicitadosPendentes(associadoId);
  const enviarDoc = useEnviarDocumentoSolicitado();
  const verificarCompletos = useVerificarDocumentosCompletos();

  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File>>({});
  const [isUploading, setIsUploading] = useState(false);

  const temDocsPendentes = docsPendentes && docsPendentes.length > 0;

  if (isLoading) {
    return (
      <Card className="border-muted">
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Verificando documentos...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!temDocsPendentes) {
    return null;
  }

  const handleFileSelect = (docSolicitadoId: string, file?: File) => {
    if (file) {
      setUploadedFiles((prev) => ({ ...prev, [docSolicitadoId]: file }));
    }
  };

  const handleEnviarDocumentos = async () => {
    if (Object.keys(uploadedFiles).length === 0) {
      toast.error('Selecione pelo menos um arquivo para enviar');
      return;
    }

    setIsUploading(true);

    try {
      for (const [docSolicitadoId, file] of Object.entries(uploadedFiles)) {
        const docSolicitado = docsPendentes?.find((d) => d.id === docSolicitadoId);
        if (!docSolicitado) continue;

        await enviarDoc.mutateAsync({
          docSolicitadoId,
          associadoId,
          tipoDocumento: docSolicitado.tipo_documento,
          file,
        });
      }

      // Verificar se todos os documentos foram enviados
      const result = await verificarCompletos.mutateAsync(associadoId);

      setShowUploadDialog(false);
      setUploadedFiles({});
      refetch();

      if (result.todosEnviados) {
        toast.success('Todos os documentos foram enviados! Aguarde a análise.');
        onTodosEnviados?.();
      } else {
        toast.success(`Documento(s) enviado(s)! Ainda faltam ${result.pendentes} documento(s).`);
      }
    } catch (error: any) {
      console.error('Erro ao enviar documentos:', error);
      toast.error(error.message || 'Erro ao enviar documentos. Tente novamente.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      {/* Card de Alerta de Documentos Pendentes */}
      <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <CardTitle className="text-orange-700 dark:text-orange-400">
              Documentos Pendentes
            </CardTitle>
          </div>
          <p className="text-sm text-orange-600 dark:text-orange-300">
            Para prosseguir com sua filiação, precisamos dos seguintes documentos:
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {docsPendentes?.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 bg-white dark:bg-background rounded-lg border"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{formatTipoDocumento(doc.tipo_documento)}</p>
                  {doc.observacao_solicitacao && (
                    <p className="text-sm text-muted-foreground">{doc.observacao_solicitacao}</p>
                  )}
                </div>
              </div>
              <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
                Pendente
              </Badge>
            </div>
          ))}

          <Button 
            onClick={() => setShowUploadDialog(true)} 
            className="w-full mt-4"
            disabled={readOnly}
          >
            {readOnly ? (
              <>
                <Lock className="h-4 w-4 mr-2" />
                Envio Bloqueado
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Enviar Documentos
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Dialog de Upload */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Enviar Documentos
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {docsPendentes?.map((doc) => (
              <DocumentoUploadItem
                key={doc.id}
                doc={doc}
                file={uploadedFiles[doc.id]}
                onFileSelect={(file) => handleFileSelect(doc.id, file)}
                disabled={isUploading}
              />
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)} disabled={isUploading}>
              Cancelar
            </Button>
            <Button
              onClick={handleEnviarDocumentos}
              disabled={Object.keys(uploadedFiles).length === 0 || isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Documentos
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================
// Componente auxiliar para upload de um documento
// ============================================
interface DocumentoUploadItemProps {
  doc: DocumentoSolicitado;
  file?: File;
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

function DocumentoUploadItem({ doc, file, onFileSelect, disabled }: DocumentoUploadItemProps) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-medium">{formatTipoDocumento(doc.tipo_documento)}</span>
        {file ? (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <Check className="h-3 w-3 mr-1" /> Selecionado
          </Badge>
        ) : (
          <Badge variant="outline">Pendente</Badge>
        )}
      </div>

      {doc.observacao_solicitacao && (
        <p className="text-sm text-muted-foreground mb-3">{doc.observacao_solicitacao}</p>
      )}

      <Input
        type="file"
        accept="image/*,.pdf"
        onChange={(e) => {
          const selectedFile = e.target.files?.[0];
          if (selectedFile) {
            onFileSelect(selectedFile);
          }
        }}
        disabled={disabled}
        className="cursor-pointer"
      />

      {file && (
        <p className="text-sm text-muted-foreground mt-2">
          📎 {file.name} ({(file.size / 1024).toFixed(1)} KB)
        </p>
      )}
    </div>
  );
}

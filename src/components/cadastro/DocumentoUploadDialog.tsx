import { useState, useCallback } from 'react';
import { Upload, X, FileText, AlertCircle, Check, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { AssociadoCombobox } from './AssociadoCombobox';
import { useVeiculos } from '@/hooks/useVeiculos';
import { useUploadMultipleDocumentos, validateFile, FileEntry } from '@/hooks/useUploadDocumento';
import { TIPO_DOCUMENTO_LABELS } from '@/types/database';
import type { Database } from '@/integrations/supabase/types';

type TipoDocumento = Database['public']['Enums']['tipo_documento'];

interface DocumentoUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ACCEPTED_TYPES = '.jpg,.jpeg,.png,.webp,.pdf';
const MAX_FILES = 10;

export function DocumentoUploadDialog({ open, onOpenChange }: DocumentoUploadDialogProps) {
  const { toast } = useToast();
  const uploadMutation = useUploadMultipleDocumentos();
  
  const [associadoId, setAssociadoId] = useState<string>('');
  const [veiculoId, setVeiculoId] = useState<string>('');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [isComplete, setIsComplete] = useState(false);

  const { data: veiculos } = useVeiculos(associadoId || undefined);

  const resetForm = useCallback(() => {
    setAssociadoId('');
    setVeiculoId('');
    setFiles([]);
    setUploadProgress({ current: 0, total: 0 });
    setIsComplete(false);
  }, []);

  const handleClose = useCallback(() => {
    if (!uploadMutation.isPending) {
      resetForm();
      onOpenChange(false);
    }
  }, [resetForm, onOpenChange, uploadMutation.isPending]);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const filesToAdd = Array.from(newFiles).slice(0, MAX_FILES - files.length);
    
    const newEntries: FileEntry[] = filesToAdd.map((file) => {
      const validation = validateFile(file);
      return {
        id: crypto.randomUUID(),
        file,
        tipo: detectTipoFromName(file.name),
        status: validation.valid ? 'pending' : 'error',
        error: validation.valid ? undefined : validation.error,
      };
    });
    
    setFiles(prev => [...prev, ...newEntries].slice(0, MAX_FILES));
  }, [files.length]);

  const detectTipoFromName = (name: string): TipoDocumento | null => {
    const lower = name.toLowerCase();
    if (lower.includes('cnh')) return 'cnh';
    if (lower.includes('crlv')) return 'crlv';
    if (lower.includes('frontal') || lower.includes('frente')) return 'foto_frontal_veiculo';
    if (lower.includes('traseira') || lower.includes('tras')) return 'foto_traseira_veiculo';
    if (lower.includes('esquerda')) return 'foto_lateral_esquerda';
    if (lower.includes('direita')) return 'foto_lateral_direita';
    if (lower.includes('painel')) return 'foto_painel';
    if (lower.includes('hodometro') || lower.includes('km')) return 'foto_hodometro';
    if (lower.includes('comprovante') || lower.includes('residencia')) return 'comprovante_residencia';
    return null;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files);
    }
    e.target.value = '';
  }, [addFiles]);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const updateFileTipo = useCallback((id: string, tipo: TipoDocumento) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, tipo } : f));
  }, []);

  const handleProgress = useCallback((current: number, total: number, fileId: string, status: 'uploading' | 'success' | 'error', error?: string) => {
    setUploadProgress({ current, total });
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status, error } : f));
  }, []);

  const handleSubmit = async () => {
    if (!associadoId || files.length === 0) return;

    const validFiles = files.filter(f => f.status !== 'error' && f.tipo);
    if (validFiles.length === 0) {
      toast({
        title: 'Erro',
        description: 'Nenhum arquivo válido para enviar.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await uploadMutation.mutateAsync({
        associado_id: associadoId,
        veiculo_id: veiculoId || undefined,
        files: validFiles,
        onProgress: handleProgress,
      });

      setIsComplete(true);

      if (result.failed === 0) {
        toast({
          title: 'Upload concluído',
          description: `${result.success} documento(s) enviado(s) com sucesso.`,
        });
      } else {
        toast({
          title: 'Upload parcialmente concluído',
          description: `${result.success} enviado(s), ${result.failed} falhou(falharam).`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro ao enviar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  const retryFailed = useCallback(() => {
    setFiles(prev => prev.map(f => 
      f.status === 'error' && f.tipo ? { ...f, status: 'pending', error: undefined } : f
    ));
    setIsComplete(false);
    setUploadProgress({ current: 0, total: 0 });
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const validFilesCount = files.filter(f => f.status !== 'error' && f.tipo).length;
  const filesWithoutTipo = files.filter(f => f.status !== 'error' && !f.tipo).length;
  const isFormValid = associadoId && validFilesCount > 0 && filesWithoutTipo === 0;
  const successCount = files.filter(f => f.status === 'success').length;
  const failedCount = files.filter(f => f.status === 'error').length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {isComplete ? 'Upload Concluído' : 'Enviar Documentos'}
          </DialogTitle>
        </DialogHeader>

        {/* Progress during upload */}
        {uploadMutation.isPending && (
          <div className="space-y-2 py-4">
            <div className="flex justify-between text-sm">
              <span>Enviando documentos...</span>
              <span>{uploadProgress.current} de {uploadProgress.total}</span>
            </div>
            <Progress value={(uploadProgress.current / uploadProgress.total) * 100} />
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Não feche esta janela durante o envio
            </p>
          </div>
        )}

        {/* Result after completion */}
        {isComplete && (
          <div className="space-y-4 py-4">
            <div className="flex gap-4 text-sm">
              {successCount > 0 && (
                <span className="text-green-600 flex items-center gap-1">
                  <Check className="h-4 w-4" />
                  {successCount} enviado(s)
                </span>
              )}
              {failedCount > 0 && (
                <span className="text-destructive flex items-center gap-1">
                  <X className="h-4 w-4" />
                  {failedCount} falhou(falharam)
                </span>
              )}
            </div>
          </div>
        )}

        {/* Form - hidden during upload */}
        {!uploadMutation.isPending && !isComplete && (
          <div className="space-y-4 py-4">
            {/* Associado */}
            <div className="space-y-2">
              <Label htmlFor="associado">Associado *</Label>
              <AssociadoCombobox
                value={associadoId}
                onSelect={(id) => {
                  setAssociadoId(id);
                  setVeiculoId('');
                }}
              />
            </div>

            {/* Veículo */}
            <div className="space-y-2">
              <Label htmlFor="veiculo">Veículo (opcional)</Label>
              <Select
                value={veiculoId}
                onValueChange={setVeiculoId}
                disabled={!associadoId || !veiculos?.length}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    !associadoId 
                      ? 'Selecione um associado primeiro' 
                      : !veiculos?.length 
                        ? 'Nenhum veículo cadastrado'
                        : 'Selecione um veículo...'
                  } />
                </SelectTrigger>
                <SelectContent>
                  {veiculos?.map((veiculo) => (
                    <SelectItem key={veiculo.id} value={veiculo.id}>
                      {veiculo.placa} - {veiculo.marca} {veiculo.modelo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dropzone */}
            <div className="space-y-2">
              <Label>Arquivos * <span className="text-muted-foreground font-normal">(máx {MAX_FILES})</span></Label>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`
                  relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
                  transition-colors duration-200
                  ${isDragging 
                    ? 'border-primary bg-primary/5' 
                    : 'border-muted-foreground/25 hover:border-primary/50'
                  }
                  ${files.length >= MAX_FILES ? 'opacity-50 pointer-events-none' : ''}
                `}
              >
                <input
                  type="file"
                  accept={ACCEPTED_TYPES}
                  multiple
                  onChange={handleInputChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={files.length >= MAX_FILES}
                />
                <div className="space-y-2">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      Clique para selecionar ou arraste arquivos
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Formatos: JPG, PNG, PDF (máx 10MB cada)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Files list */}
            {files.length > 0 && (
              <div className="space-y-2">
                <Label>Arquivos selecionados ({files.length})</Label>
                <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
                  {files.map((entry) => (
                    <div key={entry.id} className="p-3 flex items-center gap-3">
                      {/* Preview */}
                      {entry.file.type.startsWith('image/') ? (
                        <div className="h-10 w-10 rounded border bg-muted flex-shrink-0 overflow-hidden">
                          <img
                            src={URL.createObjectURL(entry.file)}
                            alt="Preview"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-10 w-10 rounded border bg-muted flex-shrink-0 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      
                      {/* File info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{entry.file.name}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(entry.file.size)}</p>
                      </div>
                      
                      {/* Status icon or select */}
                      {entry.status === 'success' ? (
                        <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                      ) : entry.status === 'uploading' ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary flex-shrink-0" />
                      ) : entry.status === 'error' && entry.error ? (
                        <span className="text-xs text-destructive max-w-[120px] truncate" title={entry.error}>
                          {entry.error}
                        </span>
                      ) : (
                        <Select
                          value={entry.tipo || ''}
                          onValueChange={(value) => updateFileTipo(entry.id, value as TipoDocumento)}
                        >
                          <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Tipo..." />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(TIPO_DOCUMENTO_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      
                      {/* Remove button */}
                      {entry.status !== 'uploading' && entry.status !== 'success' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="flex-shrink-0"
                          onClick={() => removeFile(entry.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                
                {filesWithoutTipo > 0 && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {filesWithoutTipo} arquivo(s) ainda precisa(m) de tipo definido
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Result file list */}
        {isComplete && (
          <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
            {files.map((entry) => (
              <div key={entry.id} className="p-3 flex items-center gap-3">
                {entry.status === 'success' ? (
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                ) : (
                  <X className="h-5 w-5 text-destructive flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{entry.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.tipo ? TIPO_DOCUMENTO_LABELS[entry.tipo] : 'Sem tipo'}
                  </p>
                </div>
                {entry.status === 'error' && entry.error && (
                  <span className="text-xs text-destructive">{entry.error}</span>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          {isComplete ? (
            <>
              {failedCount > 0 && (
                <Button variant="outline" onClick={retryFailed}>
                  Tentar novamente
                </Button>
              )}
              <Button onClick={handleClose}>Fechar</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={uploadMutation.isPending}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!isFormValid || uploadMutation.isPending}
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Enviar {validFilesCount > 0 ? `${validFilesCount} Documento(s)` : 'Documentos'}
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

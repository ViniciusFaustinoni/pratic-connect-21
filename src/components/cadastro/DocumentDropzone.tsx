import { useCallback, useState } from 'react';
import { Upload, X, FileImage, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export interface UploadedFile {
  id: string;
  file: File;
  url: string | null;
  status: 'uploading' | 'uploaded' | 'error';
  progress: number;
  error?: string;
}

interface DocumentDropzoneProps {
  onFilesUploaded: (urls: string[]) => void;
  isProcessing?: boolean;
  disabled?: boolean;
}

export function DocumentDropzone({ onFilesUploaded, isProcessing, disabled }: DocumentDropzoneProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `Tipo de arquivo não suportado: ${file.type}. Use JPG, PNG ou PDF.`;
    }
    if (file.size > MAX_SIZE_BYTES) {
      return `Arquivo muito grande: ${(file.size / 1024 / 1024).toFixed(1)}MB. Máximo: ${MAX_SIZE_MB}MB.`;
    }
    return null;
  };

  const uploadFile = async (file: File, fileId: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `temp/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Update progress
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, progress: 30 } : f
      ));

      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(fileName, file, { 
          cacheControl: '3600',
          upsert: false 
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, progress: 80 } : f
      ));

      const { data: { publicUrl } } = supabase.storage
        .from('documentos')
        .getPublicUrl(fileName);

      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, progress: 100, status: 'uploaded', url: publicUrl } : f
      ));

      return publicUrl;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro no upload';
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, status: 'error', error: errorMessage } : f
      ));
      return null;
    }
  };

  const handleFiles = useCallback(async (newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    
    // Validate all files first
    const validFiles: { file: File; id: string }[] = [];
    for (const file of fileArray) {
      const error = validateFile(file);
      if (error) {
        toast.error(error);
        continue;
      }
      validFiles.push({ file, id: `${Date.now()}_${Math.random().toString(36).substring(7)}` });
    }

    if (validFiles.length === 0) return;

    // Add files to state
    const newUploadedFiles: UploadedFile[] = validFiles.map(({ file, id }) => ({
      id,
      file,
      url: null,
      status: 'uploading' as const,
      progress: 0,
    }));

    setFiles(prev => [...prev, ...newUploadedFiles]);

    // Upload all files
    const uploadPromises = validFiles.map(({ file, id }) => uploadFile(file, id));
    const urls = await Promise.all(uploadPromises);
    
    // Get successfully uploaded URLs
    const successfulUrls = urls.filter((url): url is string => url !== null);
    
    if (successfulUrls.length > 0) {
      onFilesUploaded(successfulUrls);
    }
  }, [onFilesUploaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!disabled && !isProcessing) {
      handleFiles(e.dataTransfer.files);
    }
  }, [disabled, isProcessing, handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !isProcessing) {
      setIsDragOver(true);
    }
  }, [disabled, isProcessing]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const getFileIcon = (file: File) => {
    if (file.type === 'application/pdf') {
      return <FileText className="h-5 w-5 text-red-400" />;
    }
    return <FileImage className="h-5 w-5 text-blue-400" />;
  };

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'uploaded':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 transition-all cursor-pointer",
          "flex flex-col items-center justify-center text-center",
          isDragOver && !disabled && "border-primary bg-primary/5",
          disabled || isProcessing 
            ? "border-muted bg-muted/20 cursor-not-allowed opacity-60" 
            : "border-border hover:border-primary/50 hover:bg-muted/30"
        )}
      >
        <input
          type="file"
          multiple
          accept={ALLOWED_TYPES.join(',')}
          onChange={handleInputChange}
          disabled={disabled || isProcessing}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />

        {isProcessing ? (
          <>
            <Loader2 className="h-12 w-12 text-primary mb-4 animate-spin" />
            <p className="text-lg font-medium">Analisando documentos com IA...</p>
            <p className="text-sm text-muted-foreground mt-1">
              Extraindo dados automaticamente
            </p>
          </>
        ) : (
          <>
            <Upload className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">
              Arraste os documentos aqui ou clique para enviar
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              CNH / RG • Comprovante de Residência • Documento do Veículo (CRLV)
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Formatos: JPG, PNG, PDF • Máximo: {MAX_SIZE_MB}MB por arquivo
            </p>
          </>
        )}
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Documentos enviados ({files.length})
          </p>
          <div className="grid gap-2">
            {files.map((file) => (
              <Card key={file.id} className="p-3">
                <div className="flex items-center gap-3">
                  {getFileIcon(file.file)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.file.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {file.status === 'uploading' && (
                        <Progress value={file.progress} className="h-1 flex-1" />
                      )}
                      {file.status === 'error' && (
                        <p className="text-xs text-destructive">{file.error}</p>
                      )}
                      {file.status === 'uploaded' && (
                        <p className="text-xs text-green-500">Upload concluído</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(file.status)}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeFile(file.id)}
                      disabled={isProcessing}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

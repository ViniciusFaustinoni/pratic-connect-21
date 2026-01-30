import { useState, useRef, useEffect } from 'react';
import { Camera, ImagePlus, Loader2, X, Check, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { compressImage, createOptimizedPreview, revokePreview } from '@/lib/imageCompressor';
import { toast } from 'sonner';

interface UploadFotosButtonProps {
  onUpload: (files: File[]) => Promise<void>;
  maxFiles?: number;
  disabled?: boolean;
}

interface SelectedFile {
  id: string;
  file: File;
  previewUrl: string;
}

export function UploadFotosButton({ 
  onUpload, 
  maxFiles = 10, 
  disabled 
}: UploadFotosButtonProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [uploaded, setUploaded] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Limpar previews ao desmontar
  useEffect(() => {
    return () => {
      selectedFiles.forEach(f => revokePreview(f.previewUrl));
    };
  }, []);

  const handleFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = maxFiles - selectedFiles.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    for (const file of filesToProcess) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        continue;
      }

      // Validate file size (max 15MB antes de comprimir)
      if (file.size > 15 * 1024 * 1024) {
        toast.error(`${file.name} é muito grande. Máximo 15MB.`);
        continue;
      }

      // Criar preview usando Object URL
      const previewUrl = createOptimizedPreview(file);

      setSelectedFiles(prev => [...prev, {
        id: crypto.randomUUID(),
        file,
        previewUrl,
      }]);
    }

    // Reset input
    e.target.value = '';
  };

  const handleRemoveFile = (id: string) => {
    setSelectedFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file) {
        revokePreview(file.previewUrl);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || isUploading) return;

    setIsUploading(true);
    try {
      // Comprimir arquivos antes de enviar
      const compressedFiles: File[] = [];
      for (const sf of selectedFiles) {
        let arquivo = sf.file;
        if (arquivo.size > 500 * 1024) {
          try {
            arquivo = await compressImage(arquivo, { 
              maxWidth: 1920, 
              maxHeight: 1920, 
              quality: 0.75,
              maxSizeKB: 800 
            });
          } catch (e) {
            console.warn('[UploadFotosButton] Erro na compressão:', e);
          }
        }
        compressedFiles.push(arquivo);
      }

      await onUpload(compressedFiles);
      setUploaded(true);
      
      // Cleanup previews
      selectedFiles.forEach(f => revokePreview(f.previewUrl));
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast.error('Erro ao enviar fotos. Tente novamente.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClear = () => {
    selectedFiles.forEach(f => revokePreview(f.previewUrl));
    setSelectedFiles([]);
    setUploaded(false);
  };

  if (uploaded) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
        <Check className="h-5 w-5 text-primary" />
        <span className="text-sm text-primary">
          {selectedFiles.length} foto(s) enviada(s) ✓
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Envie fotos do veículo e dos danos (máx. {maxFiles}):
      </p>

      {/* Selected files grid */}
      {selectedFiles.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {selectedFiles.map((sf) => (
            <div key={sf.id} className="relative aspect-square">
              <img
                src={sf.previewUrl}
                alt="Preview"
                className="w-full h-full object-cover rounded-lg border"
              />
              <button
                onClick={() => handleRemoveFile(sf.id)}
                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                disabled={isUploading}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      {selectedFiles.length < maxFiles && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={disabled || isUploading}
            onClick={() => cameraInputRef.current?.click()}
          >
            <Camera className="h-4 w-4 mr-1" />
            Câmera
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={disabled || isUploading}
            onClick={() => galleryInputRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4 mr-1" />
            Galeria
          </Button>
        </div>
      )}

      {/* Upload button */}
      {selectedFiles.length > 0 && (
        <Button 
          onClick={handleUpload}
          disabled={isUploading || disabled}
          className="w-full"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Enviando {selectedFiles.length} foto(s)...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Enviar {selectedFiles.length} foto(s)
            </>
          )}
        </Button>
      )}

      {/* Counter */}
      {selectedFiles.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {selectedFiles.length} de {maxFiles} fotos selecionadas
        </p>
      )}

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFilesSelect}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFilesSelect}
      />
    </div>
  );
}

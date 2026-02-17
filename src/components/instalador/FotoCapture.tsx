import { useState, useRef, useEffect } from 'react';
import { Camera, X, RefreshCw, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { compressImage, createOptimizedPreview, revokePreview } from '@/lib/imageCompressor';
import { toast } from 'sonner';

interface FotoCaptureProps {
  tipo: string;
  label: string;
  obrigatoria: boolean;
  fotoUrl?: string;
  uploading?: boolean;
  hasError?: boolean;
  onCapture: (file: File) => void;
  onRemove?: () => void;
}

export function FotoCapture({
  tipo,
  label,
  obrigatoria,
  fotoUrl,
  uploading,
  hasError,
  onCapture,
  onRemove,
}: FotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  // Limpar preview ao desmontar
  useEffect(() => {
    return () => {
      if (preview) {
        revokePreview(preview);
      }
    };
  }, []);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Limpar preview anterior
      if (preview) {
        revokePreview(preview);
      }
      
      // Create preview usando Object URL (mais eficiente)
      const previewUrl = createOptimizedPreview(file);
      setPreview(previewUrl);
      
      // Comprimir se necessário
      let arquivoFinal = file;
      if (file.size > 500 * 1024) {
        setIsCompressing(true);
        try {
          arquivoFinal = await compressImage(file, { 
            maxWidth: 1920, 
            maxHeight: 1920, 
            quality: 0.75,
            maxSizeKB: 800 
          });
        } catch (compressError) {
          console.warn('[FotoCapture] Erro na compressão:', compressError);
        }
        setIsCompressing(false);
      }
      
      onCapture(arquivoFinal);
    }
    // Reset input
    e.target.value = '';
  };

  const handleRemove = () => {
    if (preview) {
      revokePreview(preview);
    }
    setPreview(null);
    onRemove?.();
  };

  const displayUrl = fotoUrl || preview;
  const hasPhoto = !!displayUrl;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      <div
        onClick={!hasPhoto && !uploading ? handleClick : undefined}
        className={cn(
          'relative flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all',
          hasPhoto
            ? 'border-transparent'
            : hasError
            ? 'border-red-500 bg-red-950/30 hover:border-red-400 animate-pulse'
            : obrigatoria
            ? 'border-red-500/50 bg-slate-800 hover:border-red-400'
            : 'border-slate-600 bg-slate-800 hover:border-slate-500',
          !hasPhoto && !uploading && 'cursor-pointer'
        )}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="text-xs text-slate-400">Enviando...</span>
          </div>
        ) : hasPhoto ? (
          <>
            <img
              src={displayUrl}
              alt={label}
              className="h-full w-full rounded-lg object-cover"
            />
            {/* Overlay de sucesso */}
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-green-500/20">
              <CheckCircle className="h-8 w-8 text-green-400" />
            </div>
            {/* Botões de ação */}
            <div className="absolute bottom-2 right-2 flex gap-1">
              <Button
                size="icon"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick();
                }}
                className="h-8 w-8 bg-slate-800/90 hover:bg-slate-700"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              {onRemove && (
                <Button
                  size="icon"
                  variant="destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove();
                  }}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            {hasError ? (
              <AlertCircle className="h-8 w-8 text-red-500" />
            ) : (
              <Camera className="h-8 w-8 text-slate-500" />
            )}
            <span className={cn("mt-1 text-center text-xs px-2", hasError ? "text-red-400" : "text-slate-500")}>{label}</span>
            {hasError ? (
              <span className="mt-1 text-[10px] text-red-400 font-medium">Falhou! Toque para tentar</span>
            ) : obrigatoria ? (
              <span className="mt-1 text-[10px] text-red-400">Obrigatória</span>
            ) : null}
          </>
        )}
      </div>

      {/* Label abaixo */}
      <p className="mt-1 truncate text-center text-xs text-slate-400">{label}</p>
    </div>
  );
}

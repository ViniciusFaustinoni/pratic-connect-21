import { useState, useRef } from 'react';
import { Camera, X, RefreshCw, Loader2, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface FotoCaptureProps {
  tipo: string;
  label: string;
  obrigatoria: boolean;
  fotoUrl?: string;
  uploading?: boolean;
  onCapture: (file: File) => void;
  onRemove?: () => void;
}

export function FotoCapture({
  tipo,
  label,
  obrigatoria,
  fotoUrl,
  uploading,
  onCapture,
  onRemove,
}: FotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      onCapture(file);
    }
    // Reset input
    e.target.value = '';
  };

  const handleRemove = () => {
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
            <Camera className="h-8 w-8 text-slate-500" />
            <span className="mt-1 text-center text-xs text-slate-500 px-2">{label}</span>
            {obrigatoria && (
              <span className="mt-1 text-[10px] text-red-400">Obrigatória</span>
            )}
          </>
        )}
      </div>

      {/* Label abaixo */}
      <p className="mt-1 truncate text-center text-xs text-slate-400">{label}</p>
    </div>
  );
}

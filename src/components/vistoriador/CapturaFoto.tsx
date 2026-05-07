import { useRef, useEffect, useState, ChangeEvent } from 'react';
import { Camera, Check, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { compressImage } from '@/lib/imageCompressor';

interface CapturaFotoProps {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  required?: boolean;
}

export function CapturaFoto({ label, value, onChange, required = false }: CapturaFotoProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  // Mantém referência da URL atual para revogar quando trocar/desmontar
  const ownedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (ownedUrlRef.current) {
        try { URL.revokeObjectURL(ownedUrlRef.current); } catch { /* ignore */ }
        ownedUrlRef.current = null;
      }
    };
  }, []);

  const replaceUrl = (newUrl: string | null) => {
    if (ownedUrlRef.current && ownedUrlRef.current !== newUrl) {
      try { URL.revokeObjectURL(ownedUrlRef.current); } catch { /* ignore */ }
    }
    ownedUrlRef.current = newUrl;
    onChange(newUrl);
  };

  const handleCapturar = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setProcessing(true);
    try {
      let finalFile: File = file;
      try {
        finalFile = await compressImage(file);
      } catch (err) {
        console.warn('[CapturaFoto] compressão falhou, usando original:', err);
      }
      const url = URL.createObjectURL(finalFile);
      replaceUrl(url);
    } finally {
      setProcessing(false);
    }
  };

  const handleRefazer = () => {
    replaceUrl(null);
    setTimeout(() => inputRef.current?.click(), 100);
  };

  const temFoto = !!value;

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center rounded-lg p-4 transition-all',
        temFoto
          ? 'border-2 border-green-500 bg-green-50 dark:bg-green-950/20'
          : 'border-2 border-dashed border-muted-foreground/30 bg-muted/30'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {processing ? (
        <div className="flex flex-col items-center gap-2 py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Otimizando imagem…</span>
        </div>
      ) : temFoto ? (
        <>
          <div className="relative mb-3 aspect-[4/3] w-full overflow-hidden rounded-md">
            <img
              src={value}
              alt={label}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{label}</span>
            <Check className="h-4 w-4 text-green-600" />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefazer}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refazer
          </Button>
        </>
      ) : (
        <>
          <Camera className="mb-3 h-12 w-12 text-muted-foreground/50" />

          <span className="mb-1 text-sm font-medium text-foreground">{label}</span>

          {required && (
            <span className="mb-3 text-xs text-muted-foreground">(obrigatória)</span>
          )}

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleCapturar}
            className="mt-2 gap-2"
          >
            <Camera className="h-4 w-4" />
            Tirar Foto
          </Button>
        </>
      )}
    </div>
  );
}

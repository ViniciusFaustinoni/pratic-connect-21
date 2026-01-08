import { useRef, useState } from 'react';
import { Camera, Check, X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FotoConfig } from '@/data/revistoriaConfig';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';

interface FotoRevistoriaUploadProps {
  config: FotoConfig;
  foto: string | null;
  onCapture: (foto: string) => void;
  onRemove: () => void;
  totalFotos: number;
}

export function FotoRevistoriaUpload({
  config,
  foto,
  onCapture,
  onRemove,
  totalFotos,
}: FotoRevistoriaUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleClick = () => {
    if (foto) {
      setPreviewOpen(true);
    } else {
      inputRef.current?.click();
    }
  };

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      onCapture(base64);
    };
    reader.readAsDataURL(file);

    // Reset input para permitir selecionar a mesma foto novamente
    e.target.value = '';
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove();
  };

  if (foto) {
    // Estado COM foto
    return (
      <>
        <div
          onClick={handleClick}
          className="relative cursor-pointer overflow-hidden rounded-xl border-2 border-green-300 bg-green-50"
        >
          <div className="aspect-video w-full">
            <img
              src={foto}
              alt={config.label}
              className="h-full w-full object-cover"
            />
          </div>
          {/* Overlay com label */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">{config.label}</span>
              <Check className="h-5 w-5 text-green-400" />
            </div>
          </div>
          {/* Botão remover */}
          <button
            onClick={handleRemove}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Dialog de visualização */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-[95vw] p-0 sm:max-w-[600px]">
            <div className="relative">
              <img
                src={foto}
                alt={config.label}
                className="w-full rounded-lg"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                <p className="font-medium text-white">{config.label}</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Estado SEM foto
  return (
    <div
      onClick={handleClick}
      className={cn(
        'cursor-pointer rounded-xl border-2 border-dashed p-4 transition-colors',
        config.destaque
          ? 'border-amber-300 bg-amber-50 hover:border-amber-400'
          : 'border-muted-foreground/30 bg-muted/30 hover:border-primary/50'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        className="hidden"
      />
      
      <div className="flex flex-col items-center gap-2 text-center">
        <div className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full',
          config.destaque ? 'bg-amber-200' : 'bg-muted'
        )}>
          <Camera className={cn(
            'h-6 w-6',
            config.destaque ? 'text-amber-700' : 'text-muted-foreground'
          )} />
        </div>
        
        <div className="text-xs font-medium text-muted-foreground">
          {config.ordem} de {totalFotos}
        </div>
        
        <div className="font-medium text-foreground">{config.label}</div>
        
        <p className="text-xs text-muted-foreground">{config.descricao}</p>
        
        {config.destaque && (
          <div className="mt-1 flex items-center gap-1 rounded-lg bg-amber-100 px-2 py-1 text-xs text-amber-700">
            <AlertTriangle className="h-3 w-3" />
            <span>{config.instrucao}</span>
          </div>
        )}
        
        <p className="mt-1 text-xs text-primary">Toque para abrir a câmera</p>
      </div>
    </div>
  );
}

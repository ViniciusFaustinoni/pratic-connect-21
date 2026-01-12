import { useState, useRef } from 'react';
import { CheckCircle, Clock, Camera, Eye, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { VistoriaFotoConfig } from '@/data/vistoriaConfig';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface VistoriaFotoCardProps {
  foto: VistoriaFotoConfig;
  fotoUrl?: string;
  isUploading?: boolean;
  onUpload: (file: File) => void;
}

export function VistoriaFotoCard({ foto, fotoUrl, isUploading, onUpload }: VistoriaFotoCardProps) {
  const [showPreview, setShowPreview] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const IconComponent = foto.icone;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
    // Reset input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  const isEnviada = !!fotoUrl;

  return (
    <>
      <div
        className={cn(
          "flex flex-col items-center p-4 rounded-xl border-2 transition-all",
          isEnviada
            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20"
            : "border-border bg-card hover:border-muted-foreground/30"
        )}
      >
        {/* Ícone */}
        <div
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center mb-3",
            isEnviada ? "bg-emerald-100 dark:bg-emerald-900/50" : "bg-muted"
          )}
        >
          <IconComponent
            className={cn(
              "h-6 w-6",
              isEnviada ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
            )}
          />
        </div>

        {/* Nome da foto */}
        <p className="text-sm font-medium text-center mb-2 line-clamp-2 h-10">
          {foto.nome}
        </p>

        {/* Badge de status */}
        <div
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium mb-3",
            isEnviada
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
              : "bg-muted text-muted-foreground"
          )}
        >
          {isEnviada ? (
            <>
              <CheckCircle className="h-3 w-3" />
              Enviada
            </>
          ) : (
            <>
              <Clock className="h-3 w-3" />
              Pendente
            </>
          )}
        </div>

        {/* Botões de ação */}
        <div className="flex gap-2 w-full">
          {isEnviada ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setShowPreview(true)}
              >
                <Eye className="h-4 w-4 mr-1" />
                Ver
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClick}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
              </Button>
            </>
          ) : (
            <Button
              variant="default"
              size="sm"
              className="w-full bg-primary hover:bg-primary/90"
              onClick={handleClick}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Camera className="h-4 w-4 mr-1" />
              )}
              {isUploading ? 'Enviando...' : 'Enviar'}
            </Button>
          )}
        </div>

        {/* Input oculto */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Modal de preview */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{foto.nome}</DialogTitle>
          </DialogHeader>
          {fotoUrl && (
            <div className="flex justify-center">
              <img
                src={fotoUrl}
                alt={foto.nome}
                className="max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, X, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';

interface VisualizadorFotoProps {
  fotos: { url: string; label: string }[];
  indexInicial?: number;
  open: boolean;
  onClose: () => void;
}

export function VisualizadorFoto({ fotos, indexInicial = 0, open, onClose }: VisualizadorFotoProps) {
  const [index, setIndex] = useState(indexInicial);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Reset quando muda o index inicial
  useEffect(() => {
    setIndex(indexInicial);
    setZoom(1);
    setRotation(0);
  }, [indexInicial, open]);

  const fotoAtual = fotos[index];

  const anterior = () => {
    setIndex((prev) => (prev > 0 ? prev - 1 : fotos.length - 1));
    setZoom(1);
    setRotation(0);
  };

  const proximo = () => {
    setIndex((prev) => (prev < fotos.length - 1 ? prev + 1 : 0));
    setZoom(1);
    setRotation(0);
  };

  const aumentarZoom = () => setZoom((prev) => Math.min(prev + 0.5, 4));
  const diminuirZoom = () => setZoom((prev) => Math.max(prev - 0.5, 0.5));
  const rotacionar = () => setRotation((prev) => (prev + 90) % 360);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'ArrowLeft') anterior();
      if (e.key === 'ArrowRight') proximo();
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') aumentarZoom();
      if (e.key === '-') diminuirZoom();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, fotos.length]);

  if (!fotoAtual) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 bg-black/95 border-none">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent">
          <div className="text-white">
            <h3 className="text-lg font-medium">{fotoAtual.label}</h3>
            <p className="text-sm text-white/70">
              {index + 1} / {fotos.length}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/20"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* Imagem */}
        <div className="flex items-center justify-center w-full h-full overflow-hidden p-12">
          <img
            src={fotoAtual.url}
            alt={fotoAtual.label}
            className="max-w-full max-h-full object-contain transition-transform duration-200"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
            }}
            draggable={false}
          />
        </div>

        {/* Navegação */}
        {fotos.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={anterior}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
            >
              <ChevronLeft className="w-8 h-8" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={proximo}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
            >
              <ChevronRight className="w-8 h-8" />
            </Button>
          </>
        )}

        {/* Controles de zoom */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 rounded-full px-4 py-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={diminuirZoom}
            className="text-white hover:bg-white/20 h-8 w-8"
            disabled={zoom <= 0.5}
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-white text-sm min-w-[60px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={aumentarZoom}
            className="text-white hover:bg-white/20 h-8 w-8"
            disabled={zoom >= 4}
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <div className="w-px h-6 bg-white/30 mx-1" />
          <Button
            variant="ghost"
            size="icon"
            onClick={rotacionar}
            className="text-white hover:bg-white/20 h-8 w-8"
          >
            <RotateCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Thumbnails */}
        {fotos.length > 1 && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-black/50 rounded-lg max-w-[80vw] overflow-x-auto">
            {fotos.map((foto, i) => (
              <button
                key={i}
                onClick={() => {
                  setIndex(i);
                  setZoom(1);
                  setRotation(0);
                }}
                className={`flex-shrink-0 w-12 h-12 rounded overflow-hidden border-2 transition-all ${
                  i === index ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <img
                  src={foto.url}
                  alt={foto.label}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

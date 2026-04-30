import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MediaItem {
  url: string;
  tipo: string;
  mediaType?: 'image' | 'video' | 'pdf';
}

interface MediaViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: MediaItem[];
  initialIndex?: number;
}

/**
 * Visualizador de mídia com navegação por setas (UI + teclado).
 * Suporta imagem, vídeo e PDF. Use quando precisar exibir uma galeria
 * navegável a partir de qualquer thumbnail clicada.
 */
export function MediaViewerModal({ open, onOpenChange, items, initialIndex = 0 }: MediaViewerModalProps) {
  const [index, setIndex] = useState(initialIndex);

  // Sincroniza index quando abre/troca a galeria
  useEffect(() => {
    if (open) setIndex(initialIndex);
  }, [open, initialIndex]);

  // Navegação por teclado
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (!items || items.length === 0) return;
      if (e.key === 'ArrowLeft') setIndex(i => (i - 1 + items.length) % items.length);
      else if (e.key === 'ArrowRight') setIndex(i => (i + 1) % items.length);
      else if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, items, onOpenChange]);

  if (!items || items.length === 0) return null;
  const safeIndex = Math.min(Math.max(index, 0), items.length - 1);
  const current = items[safeIndex];
  const hasMany = items.length > 1;

  const prev = () => setIndex(i => (i - 1 + items.length) % items.length);
  const next = () => setIndex(i => (i + 1) % items.length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-sm font-semibold truncate">{current.tipo}</h3>
            {hasMany && (
              <span className="text-xs text-muted-foreground shrink-0">
                {safeIndex + 1} / {items.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button asChild size="icon" variant="ghost" className="h-8 w-8" title="Abrir em nova aba">
              <a href={current.url} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4" />
              </a>
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onOpenChange(false)} title="Fechar">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="relative bg-black/95 flex items-center justify-center min-h-[60vh]">
          {current.mediaType === 'video' ? (
            <video
              key={current.url}
              src={current.url}
              controls
              autoPlay
              className="w-full max-h-[75vh] object-contain"
            />
          ) : current.mediaType === 'pdf' ? (
            <iframe
              key={current.url}
              src={current.url}
              className="w-full h-[75vh] border-0 bg-white"
              title={current.tipo}
            />
          ) : (
            <img
              key={current.url}
              src={current.url}
              alt={current.tipo}
              className="w-full max-h-[75vh] object-contain"
            />
          )}

          {hasMany && (
            <>
              <button
                onClick={prev}
                className={cn(
                  'absolute left-2 top-1/2 -translate-y-1/2',
                  'h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 text-white',
                  'flex items-center justify-center transition-colors'
                )}
                aria-label="Anterior"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={next}
                className={cn(
                  'absolute right-2 top-1/2 -translate-y-1/2',
                  'h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 text-white',
                  'flex items-center justify-center transition-colors'
                )}
                aria-label="Próxima"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
        </div>

        {/* Tira de miniaturas */}
        {hasMany && (
          <div className="flex gap-1.5 p-2 overflow-x-auto bg-background border-t">
            {items.map((it, i) => {
              const isVid = it.mediaType === 'video';
              const isPdf = it.mediaType === 'pdf';
              return (
                <button
                  key={`${it.url}-${i}`}
                  onClick={() => setIndex(i)}
                  className={cn(
                    'shrink-0 h-12 w-16 rounded border-2 overflow-hidden bg-muted',
                    i === safeIndex ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'
                  )}
                  title={it.tipo}
                >
                  {isPdf ? (
                    <div className="h-full w-full flex items-center justify-center text-[10px] font-medium">PDF</div>
                  ) : isVid ? (
                    <video src={it.url} className="h-full w-full object-cover" muted preload="metadata" />
                  ) : (
                    <img src={it.url} className="h-full w-full object-cover" alt="" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

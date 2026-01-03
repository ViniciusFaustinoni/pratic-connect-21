import { useState } from 'react';
import { ZoomIn, ZoomOut, RotateCw, Maximize, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ImageViewerProps {
  src: string;
  alt: string;
  isPdf?: boolean;
  className?: string;
}

export function ImageViewer({ src, alt, isPdf, className }: ImageViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleFullscreen = () => {
    window.open(src, '_blank');
  };

  if (isPdf) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full bg-muted', className)}>
        <File className="h-24 w-24 text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-4">Visualizar PDF</p>
        <Button variant="outline" onClick={handleFullscreen}>
          <Maximize className="mr-2 h-4 w-4" />
          Abrir em nova aba
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('relative flex flex-col h-full bg-muted', className)}>
      {/* Image container */}
      <div className="flex-1 overflow-hidden flex items-center justify-center p-4">
        <img
          src={src}
          alt={alt}
          className="max-h-full max-w-full object-contain transition-transform duration-200"
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
          }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 p-3 border-t bg-background">
        <Button variant="outline" size="sm" onClick={handleZoomOut} disabled={zoom <= 0.5}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="min-w-[60px] text-center text-sm text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={zoom >= 3}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-2" />
        <Button variant="outline" size="sm" onClick={handleRotate}>
          <RotateCw className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleFullscreen}>
          <Maximize className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Image, X, Camera } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ImageViewer } from '@/components/cadastro/ImageViewer';
import { cn } from '@/lib/utils';

interface FotoManutencao {
  url: string;
  categoria?: string;
  uploaded_at?: string;
}

interface FotosManutencaoGaleriaProps {
  fotos: FotoManutencao[];
  className?: string;
}

const CATEGORIA_LABELS: Record<string, string> = {
  geral: 'Geral',
  conexao: 'Conexão',
  led: 'LED',
  bateria: 'Bateria',
  antena: 'Antena',
  fixacao: 'Fixação',
};

export function FotosManutencaoGaleria({ fotos, className }: FotosManutencaoGaleriaProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (!fotos || fotos.length === 0) {
    return null;
  }

  const selectedFoto = selectedIndex !== null ? fotos[selectedIndex] : null;

  return (
    <>
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Camera className="h-3 w-3" />
          <span>Fotos da manutenção ({fotos.length})</span>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          {fotos.map((foto, index) => (
            <button
              key={index}
              onClick={() => setSelectedIndex(index)}
              className="relative group w-16 h-16 rounded-lg overflow-hidden border bg-muted hover:ring-2 hover:ring-primary transition-all focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <img
                src={foto.url}
                alt={foto.categoria ? CATEGORIA_LABELS[foto.categoria] || foto.categoria : `Foto ${index + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {foto.categoria && (
                <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate text-center">
                  {CATEGORIA_LABELS[foto.categoria] || foto.categoria}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Modal de visualização */}
      <Dialog open={selectedIndex !== null} onOpenChange={(open) => !open && setSelectedIndex(null)}>
        <DialogContent className="max-w-4xl h-[80vh] p-0 overflow-hidden">
          <div className="flex flex-col h-full">
            {/* Header com navegação */}
            <div className="flex items-center justify-between p-3 border-b bg-background">
              <div className="flex items-center gap-2">
                <Image className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {selectedFoto?.categoria 
                    ? CATEGORIA_LABELS[selectedFoto.categoria] || selectedFoto.categoria 
                    : `Foto ${(selectedIndex ?? 0) + 1} de ${fotos.length}`
                  }
                </span>
                {selectedFoto?.uploaded_at && (
                  <span className="text-xs text-muted-foreground">
                    • {format(new Date(selectedFoto.uploaded_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {fotos.length > 1 && (
                  <div className="flex items-center gap-1 mr-2">
                    <button
                      onClick={() => setSelectedIndex(prev => prev !== null && prev > 0 ? prev - 1 : fotos.length - 1)}
                      className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded"
                    >
                      ← Anterior
                    </button>
                    <span className="text-xs text-muted-foreground mx-2">
                      {(selectedIndex ?? 0) + 1}/{fotos.length}
                    </span>
                    <button
                      onClick={() => setSelectedIndex(prev => prev !== null && prev < fotos.length - 1 ? prev + 1 : 0)}
                      className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded"
                    >
                      Próxima →
                    </button>
                  </div>
                )}
                <button
                  onClick={() => setSelectedIndex(null)}
                  className="p-1 hover:bg-muted rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Image Viewer */}
            {selectedFoto && (
              <ImageViewer
                src={selectedFoto.url}
                alt={selectedFoto.categoria || `Foto da manutenção`}
                className="flex-1"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

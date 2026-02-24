import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, Camera, MapPin, Truck as TruckIcon, Flag } from 'lucide-react';
import { VisualizadorFoto } from '@/components/analise/VisualizadorFoto';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { FotoReboquista } from '@/hooks/useFotosReboquista';

const MOMENTO_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  chegada: { label: '📍 Na chegada ao local', icon: MapPin },
  carregamento: { label: '🚛 Durante o carregamento', icon: TruckIcon },
  entrega: { label: '🏁 Na entrega no destino', icon: Flag },
  outro: { label: '📸 Outro', icon: Camera },
};

interface Props {
  fotos: FotoReboquista[];
  readonly?: boolean;
  canDelete?: (foto: FotoReboquista) => boolean;
  onDelete?: (foto: FotoReboquista) => void;
}

export function FotosReboquistaGallery({ fotos, readonly, canDelete, onDelete }: Props) {
  const [viewer, setViewer] = useState({ open: false, index: 0 });

  if (fotos.length === 0) return null;

  // Agrupar por momento
  const temMomento = fotos.some(f => f.momento);
  const grupos = temMomento
    ? (['chegada', 'carregamento', 'entrega', 'outro'] as const)
        .map(m => ({
          momento: m,
          config: MOMENTO_CONFIG[m],
          fotos: fotos.filter(f => f.momento === m),
        }))
        .filter(g => g.fotos.length > 0)
    : [{ momento: null, config: null, fotos }];

  // Flat list para lightbox
  const allFotos = grupos.flatMap(g => g.fotos);
  const lightboxFotos = allFotos.map(f => ({
    url: f.arquivo_url,
    label: f.observacao || MOMENTO_CONFIG[f.momento || '']?.label || 'Foto do Reboquista',
  }));

  const getGlobalIndex = (foto: FotoReboquista) => allFotos.findIndex(f => f.id === foto.id);

  return (
    <>
      <div className="space-y-4">
        {grupos.map((grupo, gi) => (
          <div key={gi}>
            {grupo.config && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">{grupo.config.label}</span>
                <Badge variant="secondary" className="text-xs">{grupo.fotos.length} foto{grupo.fotos.length !== 1 ? 's' : ''}</Badge>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {grupo.fotos.map((foto) => (
                <div key={foto.id} className="relative group">
                  <div
                    className="aspect-square rounded-lg overflow-hidden border cursor-pointer hover:ring-2 ring-primary transition-all"
                    onClick={() => setViewer({ open: true, index: getGlobalIndex(foto) })}
                  >
                    <img
                      src={foto.arquivo_url}
                      alt={foto.observacao || 'Foto do reboquista'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="mt-1 space-y-0.5">
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(foto.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      {foto.uploader_nome && ` • ${foto.uploader_nome}`}
                    </p>
                    {foto.observacao && (
                      <p className="text-xs italic text-muted-foreground truncate">{foto.observacao}</p>
                    )}
                  </div>
                  {!readonly && canDelete?.(foto) && (
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete?.(foto);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <VisualizadorFoto
        fotos={lightboxFotos}
        indexInicial={viewer.index}
        open={viewer.open}
        onClose={() => setViewer({ open: false, index: 0 })}
      />
    </>
  );
}

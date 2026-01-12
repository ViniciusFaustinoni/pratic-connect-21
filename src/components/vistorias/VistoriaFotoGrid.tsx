import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VistoriaFotoCard } from './VistoriaFotoCard';
import { VistoriaFotoConfig, VistoriaCategoriaConfig } from '@/data/vistoriaConfig';
import { VistoriaFoto } from '@/hooks/useVistorias';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface CategoriaComFotos extends VistoriaCategoriaConfig {
  fotos: VistoriaFotoConfig[];
}

interface VistoriaFotoGridProps {
  categorias: CategoriaComFotos[];
  fotosEnviadas: VistoriaFoto[];
  uploadingFoto: string | null;
  onUpload: (fotoId: string, file: File) => void;
}

export function VistoriaFotoGrid({ 
  categorias, 
  fotosEnviadas, 
  uploadingFoto, 
  onUpload 
}: VistoriaFotoGridProps) {
  const [openCategorias, setOpenCategorias] = useState<string[]>(
    categorias.map(c => c.id) // Todas abertas por padrão
  );

  const toggleCategoria = (id: string) => {
    setOpenCategorias(prev =>
      prev.includes(id)
        ? prev.filter(c => c !== id)
        : [...prev, id]
    );
  };

  const getFotoUrl = (fotoId: string): string | undefined => {
    const foto = fotosEnviadas.find(f => f.tipo === fotoId);
    return foto?.arquivo_url;
  };

  const getProgressoCategoria = (fotos: VistoriaFotoConfig[]) => {
    const enviadas = fotos.filter(f => getFotoUrl(f.id)).length;
    return { enviadas, total: fotos.length };
  };

  return (
    <div className="space-y-4">
      {categorias.map((categoria) => {
        const { enviadas, total } = getProgressoCategoria(categoria.fotos);
        const isComplete = enviadas === total;
        const isOpen = openCategorias.includes(categoria.id);

        return (
          <Collapsible
            key={categoria.id}
            open={isOpen}
            onOpenChange={() => toggleCategoria(categoria.id)}
          >
            <CollapsibleTrigger className="w-full">
              <div
                className={cn(
                  "flex items-center justify-between p-4 rounded-lg border transition-all",
                  isComplete
                    ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800"
                    : "bg-card border-border hover:bg-muted/50"
                )}
              >
                <div className="flex items-center gap-3">
                  {isOpen ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span className="font-medium">{categoria.nome}</span>
                </div>

                <div className="flex items-center gap-3">
                  {isComplete && (
                    <CheckCircle className="h-5 w-5 text-emerald-500" />
                  )}
                  <span
                    className={cn(
                      "text-sm font-medium px-2 py-1 rounded-full",
                      isComplete
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {enviadas}/{total} fotos
                  </span>
                </div>
              </div>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-4 px-2">
                {categoria.fotos.map((foto) => (
                  <VistoriaFotoCard
                    key={foto.id}
                    foto={foto}
                    fotoUrl={getFotoUrl(foto.id)}
                    isUploading={uploadingFoto === foto.id}
                    onUpload={(file) => onUpload(foto.id, file)}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

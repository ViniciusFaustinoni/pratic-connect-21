import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Camera, X, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { VistoriaFoto } from '@/hooks/useVistorias';

interface VistoriaFotosViewProps {
  fotos: VistoriaFoto[];
}

// Configuração das categorias e tipos de fotos
const CATEGORIAS = [
  {
    id: 'exterior',
    nome: 'Exterior',
    tipos: [
      { id: 'frente', label: 'Frente' },
      { id: 'traseira', label: 'Traseira' },
      { id: 'lateral_direita', label: 'Lateral Direita' },
      { id: 'lateral_esquerda', label: 'Lateral Esquerda' },
    ],
  },
  {
    id: 'identificacao',
    nome: 'Identificação',
    tipos: [
      { id: 'selfie_veiculo', label: 'Selfie com Veículo' },
      { id: 'odometro', label: 'Odômetro' },
      { id: 'painel', label: 'Painel' },
    ],
  },
  {
    id: 'motor_chassi',
    nome: 'Motor e Chassi',
    tipos: [
      { id: 'motor', label: 'Motor' },
      { id: 'chassi', label: 'Chassi' },
    ],
  },
  {
    id: 'pneus',
    nome: 'Pneus',
    tipos: [
      { id: 'pneu_dianteiro_direito', label: 'Dianteiro Direito' },
      { id: 'pneu_dianteiro_esquerdo', label: 'Dianteiro Esquerdo' },
      { id: 'pneu_traseiro_direito', label: 'Traseiro Direito' },
      { id: 'pneu_traseiro_esquerdo', label: 'Traseiro Esquerdo' },
    ],
  },
  {
    id: 'interior',
    nome: 'Interior',
    tipos: [
      { id: 'banco_dianteiro', label: 'Banco Dianteiro' },
      { id: 'banco_traseiro', label: 'Banco Traseiro' },
    ],
  },
];

export function VistoriaFotosView({ fotos }: VistoriaFotosViewProps) {
  const [categoriasAbertas, setCategoriasAbertas] = useState<string[]>(['exterior', 'identificacao']);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const toggleCategoria = (id: string) => {
    setCategoriasAbertas((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const getFotoByTipo = (tipo: string): VistoriaFoto | undefined => {
    return fotos.find((f) => f.tipo === tipo);
  };

  const getProgressoCategoria = (tipos: { id: string }[]) => {
    const enviadas = tipos.filter((t) => getFotoByTipo(t.id)).length;
    return { enviadas, total: tipos.length };
  };

  if (!fotos || fotos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Camera className="h-12 w-12 mb-2 opacity-50" />
        <p>Nenhuma foto enviada</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {CATEGORIAS.map((categoria) => {
          const progresso = getProgressoCategoria(categoria.tipos);
          const isOpen = categoriasAbertas.includes(categoria.id);
          const isCompleta = progresso.enviadas === progresso.total;

          return (
            <Collapsible
              key={categoria.id}
              open={isOpen}
              onOpenChange={() => toggleCategoria(categoria.id)}
            >
              <CollapsibleTrigger className="w-full">
                <div
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg border transition-colors',
                    isOpen ? 'bg-muted/50' : 'hover:bg-muted/30',
                    isCompleta && 'border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/20'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {isCompleta && (
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                    )}
                    <span className="font-medium">{categoria.nome}</span>
                    <span className="text-sm text-muted-foreground">
                      ({progresso.enviadas}/{progresso.total})
                    </span>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {categoria.tipos.map((tipo) => {
                    const foto = getFotoByTipo(tipo.id);
                    return (
                      <div
                        key={tipo.id}
                        className={cn(
                          'relative aspect-video rounded-lg overflow-hidden border',
                          foto
                            ? 'cursor-pointer hover:opacity-90 transition-opacity'
                            : 'bg-muted/30 flex items-center justify-center'
                        )}
                        onClick={() => foto && setPreviewUrl(foto.arquivo_url)}
                      >
                        {foto ? (
                          <>
                            <img
                              src={foto.arquivo_url}
                              alt={tipo.label}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                              <span className="text-xs text-white font-medium">
                                {tipo.label}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-muted-foreground">
                            <Camera className="h-6 w-6 opacity-50" />
                            <span className="text-xs">{tipo.label}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>

      {/* Modal de preview */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <button
            onClick={() => setPreviewUrl(null)}
            className="absolute top-2 right-2 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full h-auto max-h-[80vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

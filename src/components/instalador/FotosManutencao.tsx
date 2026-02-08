import { useRef, useCallback } from 'react';
import { Camera, X, Plus, Image, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type CategoriaFoto = 'rastreador' | 'fiacao' | 'painel' | 'geral';

export interface FotoManutencao {
  file: File;
  preview: string;
  categoria: CategoriaFoto;
}

const CATEGORIAS: { value: CategoriaFoto; label: string }[] = [
  { value: 'rastreador', label: 'Rastreador' },
  { value: 'fiacao', label: 'Fiação' },
  { value: 'painel', label: 'Painel do veículo' },
  { value: 'geral', label: 'Geral' },
];

interface FotosManutencaoProps {
  fotos: FotoManutencao[];
  onFotosChange: (fotos: FotoManutencao[]) => void;
  minFotos?: number;
  maxFotos?: number;
  disabled?: boolean;
  obrigatorio?: boolean;
}

// Compress image to max 800px width and quality 0.7
async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxWidth = 800;
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.7
        );
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function FotosManutencao({
  fotos,
  onFotosChange,
  minFotos = 2,
  maxFotos = 6,
  disabled = false,
  obrigatorio = true,
}: FotosManutencaoProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const atingiuMinimo = fotos.length >= minFotos;
  const podeAdicionar = fotos.length < maxFotos && !disabled;

  const handleAddClick = () => {
    if (podeAdicionar) {
      inputRef.current?.click();
    }
  };

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remaining = maxFotos - fotos.length;
    const filesToAdd = files.slice(0, remaining);

    const newFotos: FotoManutencao[] = [];
    for (const file of filesToAdd) {
      const compressed = await compressImage(file);
      const preview = URL.createObjectURL(compressed);
      newFotos.push({
        file: compressed,
        preview,
        categoria: 'geral',
      });
    }

    onFotosChange([...fotos, ...newFotos]);
    
    // Reset input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [fotos, maxFotos, onFotosChange]);

  const handleRemove = (index: number) => {
    if (disabled) return;
    const fotoToRemove = fotos[index];
    URL.revokeObjectURL(fotoToRemove.preview);
    onFotosChange(fotos.filter((_, i) => i !== index));
  };

  const handleCategoriaChange = (index: number, categoria: CategoriaFoto) => {
    if (disabled) return;
    onFotosChange(fotos.map((foto, i) => 
      i === index ? { ...foto, categoria } : foto
    ));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image className="h-5 w-5 text-primary" />
            Fotos do Reparo
            {obrigatorio && <span className="text-destructive">*</span>}
          </div>
          <span className={cn(
            "text-sm font-normal flex items-center gap-1",
            atingiuMinimo ? "text-green-600" : "text-muted-foreground"
          )}>
            {atingiuMinimo && <CheckCircle2 className="h-4 w-4" />}
            {fotos.length} de {minFotos} fotos mínimas
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input hidden */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled}
        />

        {/* Button to add photo */}
        <Button
          variant="outline"
          size="lg"
          className="w-full h-12"
          onClick={handleAddClick}
          disabled={!podeAdicionar}
        >
          <Camera className="h-5 w-5 mr-2" />
          Adicionar Foto
        </Button>

        {/* Preview grid */}
        {fotos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {fotos.map((foto, index) => (
              <div key={index} className="relative">
                <div className="aspect-square rounded-lg overflow-hidden border bg-muted">
                  <img
                    src={foto.preview}
                    alt={`Foto ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                {/* Remove button */}
                {!disabled && (
                  <button
                    onClick={() => handleRemove(index)}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow-md hover:bg-destructive/90"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}

                {/* Category selector */}
                <Select
                  value={foto.categoria}
                  onValueChange={(v) => handleCategoriaChange(index, v as CategoriaFoto)}
                  disabled={disabled}
                >
                  <SelectTrigger className="h-7 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}

            {/* Add more placeholder */}
            {podeAdicionar && (
              <button
                onClick={handleAddClick}
                className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-muted-foreground/50 transition-colors"
              >
                <Plus className="h-6 w-6 text-muted-foreground/50" />
              </button>
            )}
          </div>
        )}

        {/* Helper text */}
        {!atingiuMinimo && obrigatorio && (
          <p className="text-xs text-muted-foreground text-center">
            Adicione pelo menos {minFotos} fotos do serviço realizado
          </p>
        )}
      </CardContent>
    </Card>
  );
}

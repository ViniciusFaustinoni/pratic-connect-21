import { useState, useRef } from 'react';
import { Camera, Upload, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAddOSFoto } from '@/hooks/useOSFotos';
import type { TipoFotoOS } from '@/types/database';

const TIPO_FOTO_LABELS: Record<TipoFotoOS, string> = {
  entrada: 'Entrada',
  execucao: 'Execução',
  conclusao: 'Conclusão',
};

interface Props {
  osId: string;
  defaultTipo?: TipoFotoOS;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OSFotoUpload({ osId, defaultTipo = 'entrada', open, onOpenChange }: Props) {
  const [tipo, setTipo] = useState<TipoFotoOS>(defaultTipo);
  const [previews, setPreviews] = useState<{ file: File; preview: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const addFoto = useAddOSFoto();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPreviews = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removePreview = (index: number) => {
    setPreviews((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleUpload = async () => {
    for (const { file } of previews) {
      await addFoto.mutateAsync({
        ordem_servico_id: osId,
        tipo,
        arquivo: file,
      });
    }
    // Cleanup
    previews.forEach(({ preview }) => URL.revokeObjectURL(preview));
    setPreviews([]);
    onOpenChange(false);
  };

  const handleClose = () => {
    previews.forEach(({ preview }) => URL.revokeObjectURL(preview));
    setPreviews([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar Fotos</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de Foto</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoFotoOS)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_FOTO_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 transition-colors hover:border-muted-foreground/50"
            onClick={() => inputRef.current?.click()}
          >
            <Camera className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Clique para selecionar ou arraste as fotos
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {previews.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {previews.map(({ preview }, index) => (
                <div key={index} className="relative aspect-square">
                  <img
                    src={preview}
                    alt={`Preview ${index + 1}`}
                    className="h-full w-full rounded-md object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePreview(index)}
                    className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground shadow-sm"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              onClick={handleUpload}
              disabled={previews.length === 0 || addFoto.isPending}
            >
              <Upload className="mr-2 h-4 w-4" />
              Enviar {previews.length > 0 && `(${previews.length})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

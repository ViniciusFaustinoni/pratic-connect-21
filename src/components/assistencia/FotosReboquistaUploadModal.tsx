import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, X, Loader2, ImageIcon } from 'lucide-react';
import { useAddFotoReboquista } from '@/hooks/useFotosReboquista';

const MOMENTOS = [
  { value: 'chegada', label: 'Na chegada ao local' },
  { value: 'carregamento', label: 'Durante o carregamento' },
  { value: 'entrega', label: 'Na entrega no destino' },
  { value: 'outro', label: 'Outro' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  chamadoId: string;
}

export function FotosReboquistaUploadModal({ open, onClose, chamadoId }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [momento, setMomento] = useState('');
  const [observacao, setObservacao] = useState('');
  const [previews, setPreviews] = useState<string[]>([]);

  const addFoto = useAddFotoReboquista();

  const handleFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return;
    const arr = Array.from(newFiles).filter(f => {
      if (f.size > 5 * 1024 * 1024) return false;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return false;
      return true;
    });
    const total = [...files, ...arr].slice(0, 20);
    setFiles(total);
    setPreviews(total.map(f => URL.createObjectURL(f)));
  }, [files]);

  const removeFile = (idx: number) => {
    URL.revokeObjectURL(previews[idx]);
    setFiles(f => f.filter((_, i) => i !== idx));
    setPreviews(p => p.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (files.length === 0) return;
    await addFoto.mutateAsync({ chamadoId, files, momento, observacao });
    resetAndClose();
  };

  const resetAndClose = () => {
    previews.forEach(URL.revokeObjectURL);
    setFiles([]);
    setPreviews([]);
    setMomento('');
    setObservacao('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Adicionar Fotos do Reboquista
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File input */}
          <div>
            <Label>Fotos (máx. 20, até 5MB cada, JPG/PNG)</Label>
            <div className="mt-1">
              <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-6 cursor-pointer hover:border-primary transition-colors">
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Clique para selecionar fotos</span>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </label>
            </div>
          </div>

          {/* Previews */}
          {previews.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {previews.map((src, i) => (
                <div key={i} className="relative group">
                  <img src={src} alt="" className="w-full aspect-square object-cover rounded-md border" />
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Momento */}
          <div>
            <Label>Momento da foto (opcional)</Label>
            <Select value={momento} onValueChange={setMomento}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione o momento..." />
              </SelectTrigger>
              <SelectContent>
                {MOMENTOS.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Observação */}
          <div>
            <Label>Observação (opcional)</Label>
            <Input
              className="mt-1"
              placeholder="Ex: Dano na lateral esquerda visível"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              maxLength={200}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={files.length === 0 || addFoto.isPending}
          >
            {addFoto.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</>
            ) : (
              <>Enviar {files.length} foto{files.length !== 1 ? 's' : ''}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

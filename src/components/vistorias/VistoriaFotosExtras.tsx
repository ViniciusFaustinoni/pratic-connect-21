import { useRef, useState } from 'react';
import { Camera, Plus, Trash2, Loader2, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { transformedUrl, THUMB } from '@/lib/storage/imageTransform';
import { cn } from '@/lib/utils';

export interface FotoExtra {
  tipo: string; // 'extra_<n>'
  arquivo_url: string;
}

interface VistoriaFotosExtrasProps {
  fotosExtras: FotoExtra[];
  uploadingTipo: string | null;
  onUpload: (tipo: string, file: File) => void;
  onRemove?: (tipo: string) => Promise<void> | void;
}

const EXTRA_PREFIX = 'extra_';

function nextExtraTipo(fotosExtras: FotoExtra[]): string {
  const usados = fotosExtras
    .map(f => Number((f.tipo || '').replace(EXTRA_PREFIX, '')))
    .filter(n => Number.isFinite(n) && n > 0);
  const max = usados.length ? Math.max(...usados) : 0;
  return `${EXTRA_PREFIX}${max + 1}`;
}

export function VistoriaFotosExtras({
  fotosExtras,
  uploadingTipo,
  onUpload,
  onRemove,
}: VistoriaFotosExtrasProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const isUploadingExtra = !!uploadingTipo && uploadingTipo.startsWith(EXTRA_PREFIX);

  const handleAdd = () => inputRef.current?.click();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const tipo = nextExtraTipo(fotosExtras);
      onUpload(tipo, file);
    }
    if (e.target) e.target.value = '';
  };

  const handleRemoveConfirmed = async () => {
    if (!confirmRemove || !onRemove) {
      setConfirmRemove(null);
      return;
    }
    setRemovendo(confirmRemove);
    try {
      await onRemove(confirmRemove);
    } finally {
      setRemovendo(null);
      setConfirmRemove(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-blue-400" />
          <h3 className="text-white font-semibold text-sm">Outras imagens</h3>
          <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-300 border border-blue-700/60">
            Opcional
          </span>
        </div>
        <span className="text-xs text-slate-400">{fotosExtras.length} adicionada{fotosExtras.length === 1 ? '' : 's'}</span>
      </div>

      <p className="text-xs text-slate-400">
        Adicione fotos extras que ajudem a complementar a vistoria (avarias, detalhes, etc.).
      </p>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
        {fotosExtras.map((foto) => (
          <div
            key={foto.tipo}
            className="relative aspect-square rounded-lg overflow-hidden border-2 border-slate-600 bg-slate-800 group"
          >
            <img
              src={transformedUrl(foto.arquivo_url, THUMB)}
              alt={foto.tipo}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
            {onRemove && (
              <button
                type="button"
                onClick={() => setConfirmRemove(foto.tipo)}
                disabled={removendo === foto.tipo}
                className={cn(
                  "absolute top-1 right-1 p-1 rounded-md bg-black/70 text-white",
                  "opacity-0 group-hover:opacity-100 transition-opacity",
                  "disabled:opacity-50"
                )}
                aria-label="Remover foto"
              >
                {removendo === foto.tipo ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={handleAdd}
          disabled={isUploadingExtra}
          className={cn(
            "aspect-square rounded-lg border-2 border-dashed transition-all",
            "flex flex-col items-center justify-center gap-1",
            isUploadingExtra
              ? "border-blue-500/50 bg-blue-900/10 cursor-wait"
              : "border-slate-600 bg-slate-800 hover:border-blue-500 hover:bg-slate-700"
          )}
        >
          {isUploadingExtra ? (
            <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
          ) : (
            <>
              <div className="p-1.5 rounded-full bg-blue-600/20">
                <Plus className="h-4 w-4 text-blue-400" />
              </div>
              <span className="text-[10px] text-slate-300 font-medium">Adicionar</span>
            </>
          )}
        </button>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={handleAdd}
        disabled={isUploadingExtra}
        className="w-full gap-2 border-slate-600 text-slate-200 bg-slate-800 hover:bg-slate-700"
      >
        {isUploadingExtra ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Camera className="h-4 w-4" />
        )}
        {isUploadingExtra ? 'Enviando…' : 'Tirar nova foto extra'}
      </Button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />

      <AlertDialog open={!!confirmRemove} onOpenChange={(open) => !open && setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover esta foto extra?</AlertDialogTitle>
            <AlertDialogDescription>
              A imagem será apagada da vistoria. Você pode adicioná-la novamente depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveConfirmed}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

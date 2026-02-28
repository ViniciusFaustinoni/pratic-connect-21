import { useRef } from 'react';
import { CheckCircle2, XCircle, Camera, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';

export type ChecklistStatus = 'pendente' | 'ok' | 'nok';

interface ChecklistItemProps {
  label: string;
  status: ChecklistStatus;
  observacao?: string;
  fotos?: string[];
  uploadingFoto?: boolean;
  onStatusChange: (status: ChecklistStatus) => void;
  onObservacaoChange?: (value: string) => void;
  onAddFoto?: (file: File) => void;
  onRemoveFoto?: (index: number) => void;
}

export function ChecklistItem({
  label,
  status,
  observacao,
  fotos = [],
  uploadingFoto,
  onStatusChange,
  onObservacaoChange,
  onAddFoto,
  onRemoveFoto,
}: ChecklistItemProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && onAddFoto) onAddFoto(file);
          e.target.value = '';
        }}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-white">{label}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onStatusChange('ok')}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg border-2 transition-all',
              status === 'ok'
                ? 'border-green-500 bg-green-500/20 text-green-400'
                : 'border-slate-600 text-slate-500 hover:border-green-500/50 hover:text-green-400'
            )}
          >
            <CheckCircle2 className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => onStatusChange('nok')}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg border-2 transition-all',
              status === 'nok'
                ? 'border-red-500 bg-red-500/20 text-red-400'
                : 'border-slate-600 text-slate-500 hover:border-red-500/50 hover:text-red-400'
            )}
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>
      </div>
      
      {status === 'nok' && (
        <div className="mt-3 space-y-3">
          {onObservacaoChange && (
            <Textarea
              placeholder="Descreva o problema encontrado..."
              value={observacao || ''}
              onChange={(e) => onObservacaoChange(e.target.value)}
              className="min-h-[80px] border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500"
            />
          )}

          {onAddFoto && (
            <div>
              <p className="text-xs text-slate-400 mb-2">Fotos de evidência (opcional, até 3)</p>
              <div className="grid grid-cols-3 gap-2">
                {fotos.map((url, index) => (
                  <div key={index} className="relative aspect-square">
                    <img src={url} alt={`Evidência ${index + 1}`} className="h-full w-full rounded-lg object-cover" />
                    {onRemoveFoto && (
                      <button
                        type="button"
                        onClick={() => onRemoveFoto(index)}
                        className="absolute -right-1 -top-1 rounded-full bg-red-500 p-1 text-white shadow-lg"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
                {fotos.length < 3 && (
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={uploadingFoto}
                    className="flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-600 bg-slate-700/30 hover:border-slate-500"
                  >
                    {uploadingFoto ? (
                      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    ) : (
                      <>
                        <Camera className="h-5 w-5 text-slate-400" />
                        <span className="mt-1 text-[10px] text-slate-500">Foto</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

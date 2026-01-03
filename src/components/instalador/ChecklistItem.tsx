import { CheckCircle2, XCircle, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';

export type ChecklistStatus = 'pendente' | 'ok' | 'nok';

interface ChecklistItemProps {
  label: string;
  status: ChecklistStatus;
  observacao?: string;
  onStatusChange: (status: ChecklistStatus) => void;
  onObservacaoChange?: (value: string) => void;
}

export function ChecklistItem({
  label,
  status,
  observacao,
  onStatusChange,
  onObservacaoChange,
}: ChecklistItemProps) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-3">
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
      
      {status === 'nok' && onObservacaoChange && (
        <div className="mt-3">
          <Textarea
            placeholder="Descreva o problema encontrado..."
            value={observacao || ''}
            onChange={(e) => onObservacaoChange(e.target.value)}
            className="min-h-[80px] border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500"
          />
        </div>
      )}
    </div>
  );
}

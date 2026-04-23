import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { History, RotateCcw, X } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DraftRestoreBannerProps {
  savedAt: Date;
  onRestore: () => void;
  onDiscard: () => void;
}

function formatRelative(date: Date): string {
  if (isToday(date)) return `hoje às ${format(date, 'HH:mm')}`;
  if (isYesterday(date)) return `ontem às ${format(date, 'HH:mm')}`;
  return format(date, "dd/MM 'às' HH:mm", { locale: ptBR });
}

export function DraftRestoreBanner({ savedAt, onRestore, onDiscard }: DraftRestoreBannerProps) {
  return (
    <Alert className="border-primary/40 bg-primary/5">
      <History className="h-4 w-4 text-primary" />
      <AlertTitle className="text-sm font-semibold">Rascunho não finalizado</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm text-muted-foreground">
          Encontramos um rascunho desta cotação salvo {formatRelative(savedAt)}. Deseja continuar de onde parou?
        </span>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="default" onClick={onRestore} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Continuar rascunho
          </Button>
          <Button size="sm" variant="ghost" onClick={onDiscard} className="gap-1.5">
            <X className="h-3.5 w-3.5" />
            Começar do zero
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bug } from 'lucide-react';
import { useMyPendingValidations } from '@/hooks/useErrorReports';
import { TestarCorrecoesSheet } from './TestarCorrecoesSheet';
import { cn } from '@/lib/utils';

export function TestarCorrecoesButton() {
  const [open, setOpen] = useState(false);
  const { data: count = 0 } = useMyPendingValidations();
  if (count === 0) return null;
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn(
          'relative gap-1.5 border-warning/40 text-warning hover:bg-warning/10 hover:text-warning animate-pulse',
        )}
      >
        <Bug className="h-4 w-4" />
        <span className="hidden md:inline">Testar</span>
        <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1.5">{count}</Badge>
      </Button>
      <TestarCorrecoesSheet open={open} onOpenChange={setOpen} />
    </>
  );
}

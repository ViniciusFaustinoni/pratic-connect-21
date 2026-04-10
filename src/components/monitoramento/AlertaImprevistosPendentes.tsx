import { AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useImprevistosSemResposta } from '@/hooks/useImprevistosSemResposta';

export default function AlertaImprevistosPendentes() {
  const { data: imprevistos } = useImprevistosSemResposta();
  const navigate = useNavigate();

  if (!imprevistos?.length) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
      <p className="text-sm font-medium text-amber-700 dark:text-amber-400 flex-1">
        {imprevistos.length} imprevisto{imprevistos.length !== 1 ? 's' : ''} aguardando contato manual
      </p>
      <Button
        variant="outline"
        size="sm"
        className="border-amber-500/30 text-amber-700 dark:text-amber-400 shrink-0"
        onClick={() => navigate('/monitoramento/imprevistos?pendentes=true')}
      >
        Ver imprevistos
      </Button>
    </div>
  );
}

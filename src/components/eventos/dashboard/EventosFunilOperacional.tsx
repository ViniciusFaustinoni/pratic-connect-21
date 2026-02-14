import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFunilOperacional, FiltrosGlobais } from '@/hooks/useEventosDashboard';

const CORES_FUNIL = [
  'bg-gray-200 text-gray-800',
  'bg-yellow-200 text-yellow-800',
  'bg-sky-200 text-sky-800',
  'bg-purple-200 text-purple-800',
  'bg-green-200 text-green-800',
  'bg-cyan-200 text-cyan-800',
  'bg-indigo-200 text-indigo-800',
  'bg-violet-200 text-violet-800',
  'bg-emerald-200 text-emerald-800',
];

interface Props {
  filtros: FiltrosGlobais;
  onFaseClick: (statuses: string[]) => void;
  faseAtiva?: string[];
}

export default function EventosFunilOperacional({ filtros, onFaseClick, faseAtiva }: Props) {
  const { data: fases, isLoading } = useFunilOperacional(filtros);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Funil Operacional</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-1 overflow-x-auto pb-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-16 min-w-[100px] flex-1" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const total = (fases || []).reduce((t, f) => t + f.count, 0);
  const isAtiva = (statuses: string[]) =>
    faseAtiva && faseAtiva.length > 0 && JSON.stringify(faseAtiva) === JSON.stringify(statuses);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Funil Operacional</CardTitle>
          <span className="text-xs text-muted-foreground">{total} eventos no total</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-1 overflow-x-auto pb-2">
          {(fases || []).map((fase, i) => (
            <button
              key={fase.nome}
              onClick={() => onFaseClick(isAtiva(fase.statuses) ? [] : fase.statuses)}
              className={`flex-1 min-w-[90px] rounded-md p-2 text-center transition-all cursor-pointer hover:opacity-80 ${
                isAtiva(fase.statuses) ? 'ring-2 ring-primary ring-offset-1' : ''
              } ${CORES_FUNIL[i]}`}
            >
              <div className="text-lg font-bold">{fase.count}</div>
              <div className="text-[10px] font-medium leading-tight">{fase.nome}</div>
            </button>
          ))}
        </div>
        {faseAtiva && faseAtiva.length > 0 && (
          <button
            onClick={() => onFaseClick([])}
            className="text-xs text-muted-foreground hover:text-foreground mt-2 underline"
          >
            Limpar filtro do funil
          </button>
        )}
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFunilOperacional, FiltrosGlobais } from '@/hooks/useEventosDashboard';
import { ArrowRight, GitBranch } from 'lucide-react';

const CORES_FUNIL = [
  { bg: 'bg-slate-100', text: 'text-slate-700', accent: 'bg-slate-400' },
  { bg: 'bg-amber-50', text: 'text-amber-700', accent: 'bg-amber-400' },
  { bg: 'bg-sky-50', text: 'text-sky-700', accent: 'bg-sky-400' },
  { bg: 'bg-violet-50', text: 'text-violet-700', accent: 'bg-violet-400' },
  { bg: 'bg-emerald-50', text: 'text-emerald-700', accent: 'bg-emerald-400' },
  { bg: 'bg-teal-50', text: 'text-teal-700', accent: 'bg-teal-400' },
  { bg: 'bg-indigo-50', text: 'text-indigo-700', accent: 'bg-indigo-400' },
  { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', accent: 'bg-fuchsia-400' },
  { bg: 'bg-green-50', text: 'text-green-700', accent: 'bg-green-500' },
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
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Funil Operacional</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-20 min-w-[100px] flex-1 rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const total = (fases || []).reduce((t, f) => t + f.count, 0);
  const maxCount = Math.max(...(fases || []).map(f => f.count), 1);
  const isAtiva = (statuses: string[]) =>
    faseAtiva && faseAtiva.length > 0 && JSON.stringify(faseAtiva) === JSON.stringify(statuses);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base font-semibold">Pipeline Operacional</CardTitle>
          </div>
          <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
            {total} eventos
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
          {(fases || []).map((fase, i) => {
            const cor = CORES_FUNIL[i];
            const active = isAtiva(fase.statuses);
            const barHeight = Math.max(8, (fase.count / maxCount) * 40);
            
            return (
              <button
                key={fase.nome}
                onClick={() => onFaseClick(active ? [] : fase.statuses)}
                className={`
                  group relative flex-1 min-w-[90px] rounded-xl p-3 text-center 
                  transition-all duration-200 cursor-pointer
                  ${cor.bg} ${cor.text}
                  ${active 
                    ? 'ring-2 ring-primary ring-offset-2 shadow-md scale-[1.02]' 
                    : 'hover:shadow-sm hover:scale-[1.01]'}
                `}
              >
                {/* Mini bar indicator */}
                <div className="flex justify-center mb-2">
                  <div className="w-8 bg-black/5 rounded-full overflow-hidden" style={{ height: '40px' }}>
                    <div 
                      className={`w-full ${cor.accent} rounded-full transition-all duration-500`} 
                      style={{ height: `${barHeight}px`, marginTop: `${40 - barHeight}px` }}
                    />
                  </div>
                </div>
                <div className="text-xl font-bold leading-none">{fase.count}</div>
                <div className="text-[10px] font-medium leading-tight mt-1 opacity-80">{fase.nome}</div>
              </button>
            );
          })}
        </div>

        {faseAtiva && faseAtiva.length > 0 && (
          <div className="flex justify-center mt-3">
            <button
              onClick={() => onFaseClick([])}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors 
                         px-3 py-1.5 rounded-full bg-muted/60 hover:bg-muted"
            >
              ✕ Limpar filtro do funil
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

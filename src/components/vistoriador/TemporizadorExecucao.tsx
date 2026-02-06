import { useState, useEffect, useMemo } from 'react';
import { Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TemporizadorExecucaoProps {
  iniciadaEm: string | null;
  className?: string;
}

export function TemporizadorExecucao({ iniciadaEm, className }: TemporizadorExecucaoProps) {
  const [tempoDecorrido, setTempoDecorrido] = useState(0);

  // Calcular tempo inicial ao montar
  const tempoInicial = useMemo(() => {
    if (!iniciadaEm) return 0;
    const inicio = new Date(iniciadaEm).getTime();
    const agora = Date.now();
    return Math.floor((agora - inicio) / 1000);
  }, [iniciadaEm]);

  // Inicializar e atualizar contador
  useEffect(() => {
    if (!iniciadaEm) return;

    setTempoDecorrido(tempoInicial);

    const intervalo = setInterval(() => {
      setTempoDecorrido(prev => prev + 1);
    }, 1000);

    return () => clearInterval(intervalo);
  }, [iniciadaEm, tempoInicial]);

  // Formatar tempo no formato HH:MM:SS
  const formatarTempo = (segundos: number) => {
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const segs = segundos % 60;
    return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(segs).padStart(2, '0')}`;
  };

  if (!iniciadaEm) return null;

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <div className="relative">
          <Timer className="h-5 w-5 text-green-400" />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        </div>
        <span className="text-sm font-medium text-green-300">TEMPO DE EXECUÇÃO:</span>
      </div>
      <span className="font-mono text-xl font-bold text-green-400 tabular-nums">
        {formatarTempo(tempoDecorrido)}
      </span>
    </div>
  );
}

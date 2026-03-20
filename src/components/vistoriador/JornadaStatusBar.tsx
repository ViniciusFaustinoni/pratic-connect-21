import { Clock, Target, Coffee, TrendingUp, TrendingDown, AlertTriangle, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useJornadaTrabalho, formatarMinutos } from '@/hooks/useJornadaTrabalho';
import { cn } from '@/lib/utils';

interface JornadaStatusBarProps {
  className?: string;
}

/**
 * Barra de status de jornada de trabalho
 * Mostra tempo trabalhado, tempo restante e progresso do dia
 */
export function JornadaStatusBar({ className }: JornadaStatusBarProps) {
  const {
    status,
    minutosTrabalhados,
    minutosRestantes,
    percentualJornada,
    saldoAnterior,
    emAlmoco,
    minutosAlmocoRestantes,
    minutosAtrasoAlmoco,
    turno,
    isLoading
  } = useJornadaTrabalho();

  // Mostrar loading enquanto busca o turno
  if (isLoading) {
    return (
      <div className={cn(
        "bg-slate-800/80 border border-slate-700 rounded-lg p-3 flex items-center justify-center gap-2",
        className
      )}>
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Carregando jornada...</span>
      </div>
    );
  }

  // Se não tem turno ainda (pode estar sendo criado pelo useGarantirTurno)
  if (status === 'inativo') {
    return (
      <div className={cn(
        "bg-slate-800/80 border border-slate-700 rounded-lg p-3 flex items-center justify-center gap-2",
        className
      )}>
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Iniciando jornada...</span>
      </div>
    );
  }

  // Se encerrado, mostrar resumo
  if (status === 'encerrado') {
    return (
      <div className={cn(
        "bg-slate-700/50 border border-slate-600 rounded-lg p-3",
        className
      )}>
        <div className="flex items-center justify-center gap-2 text-slate-400">
          <Clock className="h-4 w-4" />
          <span className="text-sm">Turno encerrado</span>
        </div>
      </div>
    );
  }

  // Se em almoço, mostrar contador de almoço
  if (emAlmoco) {
    return (
      <div className={cn(
        "bg-amber-900/30 border border-amber-700/50 rounded-lg p-3",
        className
      )}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-amber-400">
            <Coffee className="h-4 w-4" />
            <span className="text-sm font-medium">Horário de Almoço</span>
          </div>
          <span className="text-sm text-amber-300">
            Retorno em: {formatarMinutos(minutosAlmocoRestantes)}
          </span>
        </div>
        <Progress 
          value={((60 - minutosAlmocoRestantes) / 60) * 100} 
          className="h-2 bg-amber-900/50"
        />
      </div>
    );
  }

  // Atraso de almoço registrado (já voltou do almoço)
  const atrasoRegistrado = turno?.minutos_atraso_almoco || 0;

  return (
    <div className={cn(
      "bg-slate-800/80 border border-slate-700 rounded-lg p-3 space-y-2",
      className
    )}>
      {/* Linha superior: Tempo trabalhado e restante */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-slate-300">
          <Clock className="h-4 w-4 text-blue-400" />
          <span>{formatarMinutos(minutosTrabalhados)} trabalhadas</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <Target className="h-4 w-4 text-green-400" />
          <span>{formatarMinutos(minutosRestantes)} restantes</span>
        </div>
      </div>

      {/* Barra de progresso */}
      <Progress 
        value={percentualJornada} 
        className="h-2"
      />

      {/* Acréscimo por atraso de almoço */}
      {atrasoRegistrado > 0 && (
        <div className="flex items-center justify-center gap-1 text-xs">
          <AlertTriangle className="h-3 w-3 text-amber-400" />
          <span className="text-amber-400">
            +{formatarMinutos(atrasoRegistrado)} de acréscimo por atraso no almoço
          </span>
        </div>
      )}

      {/* Saldo (se houver) */}
      {saldoAnterior !== 0 && (
        <div className="flex items-center justify-center gap-1 text-xs">
          {saldoAnterior > 0 ? (
            <>
              <TrendingUp className="h-3 w-3 text-green-400" />
              <span className="text-green-400">
                Crédito de {formatarMinutos(saldoAnterior)} do dia anterior
              </span>
            </>
          ) : (
            <>
              <TrendingDown className="h-3 w-3 text-red-400" />
              <span className="text-red-400">
                Débito de {formatarMinutos(Math.abs(saldoAnterior))} do dia anterior
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

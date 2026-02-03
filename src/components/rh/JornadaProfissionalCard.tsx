import { Clock, Coffee, User, TrendingUp, TrendingDown, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface TurnoProfissional {
  id: string;
  profissional_id: string;
  data: string;
  inicio_turno: string | null;
  inicio_almoco: string | null;
  fim_almoco: string | null;
  fim_turno: string | null;
  minutos_trabalhados: number;
  minutos_almoco: number;
  minutos_extras: number;
  minutos_faltantes: number;
  saldo_anterior_minutos: number;
  status: string;
  profile?: {
    nome: string;
    avatar_url?: string;
  };
}

interface JornadaProfissionalCardProps {
  turno: TurnoProfissional;
  className?: string;
}

function formatarMinutos(minutos: number): string {
  const horas = Math.floor(Math.abs(minutos) / 60);
  const mins = Math.abs(minutos) % 60;
  
  if (horas === 0) return `${mins}min`;
  return mins > 0 ? `${horas}h ${mins}min` : `${horas}h`;
}

function calcularTempoReal(turno: TurnoProfissional): { trabalhados: number; almoco: number } {
  if (!turno.inicio_turno) {
    return { trabalhados: 0, almoco: 0 };
  }

  const agora = new Date();
  const inicio = new Date(turno.inicio_turno);
  let minutosDesdeInicio = Math.floor((agora.getTime() - inicio.getTime()) / 60000);

  let minutosAlmoco = 0;

  if (turno.status === 'em_almoco' && turno.inicio_almoco) {
    const inicioAlmoco = new Date(turno.inicio_almoco);
    minutosAlmoco = Math.floor((agora.getTime() - inicioAlmoco.getTime()) / 60000);
  } else if (turno.fim_almoco && turno.inicio_almoco) {
    const inicioAlmoco = new Date(turno.inicio_almoco);
    const fimAlmoco = new Date(turno.fim_almoco);
    minutosAlmoco = Math.floor((fimAlmoco.getTime() - inicioAlmoco.getTime()) / 60000);
  }

  const trabalhados = Math.max(0, minutosDesdeInicio - minutosAlmoco);

  return { trabalhados, almoco: minutosAlmoco };
}

export function JornadaProfissionalCard({ turno, className }: JornadaProfissionalCardProps) {
  const { trabalhados, almoco } = calcularTempoReal(turno);
  const jornadaPadrao = 480;
  const jornadaAjustada = jornadaPadrao - (turno.saldo_anterior_minutos || 0);
  const restantes = Math.max(0, jornadaAjustada - trabalhados);
  const percentual = Math.min(100, (trabalhados / jornadaAjustada) * 100);

  const getStatusBadge = () => {
    switch (turno.status) {
      case 'ativo':
        return <Badge className="bg-green-600">Trabalhando</Badge>;
      case 'em_almoco':
        return <Badge className="bg-amber-600">Em Almoço</Badge>;
      case 'encerrado':
        return <Badge variant="secondary">Encerrado</Badge>;
      default:
        return <Badge variant="outline">Offline</Badge>;
    }
  };

  const formatarHora = (isoString: string | null): string => {
    if (!isoString) return '--:--';
    return format(new Date(isoString), 'HH:mm');
  };

  return (
    <Card className={cn("border-slate-700 bg-slate-800/50", className)}>
      <CardContent className="p-4 space-y-3">
        {/* Header: Nome e Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center">
              <User className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h4 className="font-medium text-white">
                {turno.profile?.nome || 'Profissional'}
              </h4>
            </div>
          </div>
          {getStatusBadge()}
        </div>

        {/* Horários */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2 text-slate-400">
            <Clock className="h-4 w-4" />
            <span>Início: {formatarHora(turno.inicio_turno)}</span>
          </div>
          {turno.inicio_almoco && (
            <div className="flex items-center gap-2 text-slate-400">
              <Coffee className="h-4 w-4" />
              <span>
                Almoço: {formatarHora(turno.inicio_almoco)}
                {turno.fim_almoco && `-${formatarHora(turno.fim_almoco)}`}
              </span>
            </div>
          )}
        </div>

        {/* Progresso */}
        {turno.status !== 'encerrado' && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300">
                Trabalhado: {formatarMinutos(trabalhados)}
              </span>
              <span className="text-slate-400">
                Restante: {formatarMinutos(restantes)}
              </span>
            </div>
            <Progress value={percentual} className="h-2" />
          </>
        )}

        {/* Saldo */}
        {turno.saldo_anterior_minutos !== 0 && (
          <div className="flex items-center gap-1 text-xs">
            {turno.saldo_anterior_minutos > 0 ? (
              <>
                <TrendingUp className="h-3 w-3 text-green-400" />
                <span className="text-green-400">
                  Crédito: +{formatarMinutos(turno.saldo_anterior_minutos)}
                </span>
              </>
            ) : (
              <>
                <TrendingDown className="h-3 w-3 text-red-400" />
                <span className="text-red-400">
                  Débito: {formatarMinutos(turno.saldo_anterior_minutos)}
                </span>
              </>
            )}
          </div>
        )}

        {/* Se encerrado, mostrar resultado do dia */}
        {turno.status === 'encerrado' && (
          <div className="pt-2 border-t border-slate-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Total trabalhado:</span>
              <span className="text-white font-medium">
                {formatarMinutos(turno.minutos_trabalhados)}
              </span>
            </div>
            {turno.minutos_extras > 0 && (
              <div className="flex items-center gap-1 text-green-400 text-sm mt-1">
                <TrendingUp className="h-4 w-4" />
                <span>+{formatarMinutos(turno.minutos_extras)} extras</span>
              </div>
            )}
            {turno.minutos_faltantes > 0 && (
              <div className="flex items-center gap-1 text-red-400 text-sm mt-1">
                <TrendingDown className="h-4 w-4" />
                <span>-{formatarMinutos(turno.minutos_faltantes)} faltantes</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

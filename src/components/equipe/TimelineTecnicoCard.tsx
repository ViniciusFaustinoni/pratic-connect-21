import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ESTADO_COLOR,
  ESTADO_LABEL,
  formatarMinutos,
  type EquipeMembroTempoReal,
  type EstadoTecnico,
} from '@/hooks/useEquipeTempoReal';
import { TimelineBar } from './TimelineBar';

interface Props {
  membro: EquipeMembroTempoReal;
}

const ORDEM_KPIS: EstadoTecnico[] = [
  'em_servico',
  'deslocamento',
  'almoco',
  'ocioso',
  'inativo',
];

function statusBadgeVariant(status: EstadoTecnico) {
  switch (status) {
    case 'em_servico':
      return 'default' as const;
    case 'deslocamento':
      return 'secondary' as const;
    case 'almoco':
      return 'outline' as const;
    case 'inativo':
      return 'destructive' as const;
    case 'fora_turno':
      return 'outline' as const;
    default:
      return 'outline' as const;
  }
}

export function TimelineTecnicoCard({ membro }: Props) {
  const iniciais = membro.nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  const inicioTurnoFmt = membro.inicioTurno
    ? format(new Date(membro.inicioTurno), 'HH:mm', { locale: ptBR })
    : '--:--';
  const fimTurnoFmt = membro.fimTurno
    ? format(new Date(membro.fimTurno), 'HH:mm', { locale: ptBR })
    : 'agora';

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              {membro.avatarUrl && <AvatarImage src={membro.avatarUrl} alt={membro.nome} />}
              <AvatarFallback>{iniciais}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium leading-tight">{membro.nome}</p>
              <p className="text-xs text-muted-foreground">
                Turno {inicioTurnoFmt} → {fimTurnoFmt}
              </p>
            </div>
          </div>
          <Badge variant={statusBadgeVariant(membro.statusAtual)} className="shrink-0">
            <span
              className={`mr-1.5 inline-block h-2 w-2 rounded-full ${ESTADO_COLOR[membro.statusAtual]}`}
            />
            {ESTADO_LABEL[membro.statusAtual]}
          </Badge>
        </div>

        <TimelineBar
          segmentos={membro.segmentos}
          inicioTurno={membro.inicioTurno!}
          fimTurno={membro.fimTurno}
        />

        <div className="grid grid-cols-5 gap-2 text-center">
          {ORDEM_KPIS.map((tipo) => (
            <div key={tipo} className="rounded-md border bg-card/50 p-2">
              <div
                className={`mx-auto mb-1 h-1.5 w-6 rounded-full ${ESTADO_COLOR[tipo]}`}
              />
              <div className="text-sm font-semibold">{formatarMinutos(membro.totais[tipo])}</div>
              <div className="text-[10px] leading-tight text-muted-foreground">
                {ESTADO_LABEL[tipo]}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {membro.tarefas.concluidas}/{membro.tarefas.total} tarefas concluídas
          </span>
          <span>
            GPS:{' '}
            {membro.ultimoGpsEm
              ? formatDistanceToNow(new Date(membro.ultimoGpsEm), {
                  addSuffix: true,
                  locale: ptBR,
                })
              : 'sem registro'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

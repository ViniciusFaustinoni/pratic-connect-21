import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle } from 'lucide-react';
import { STATUS_SINISTRO_LABELS, STATUS_SINISTRO_COLORS, TIPO_SINISTRO_LABELS } from '@/types/sinistros';
import type { StatusSinistro, TipoSinistro } from '@/types/sinistros';
import type { SinistroSLA } from '@/hooks/useEventosSLA';
import { SLAHistoricoTransicoes } from './SLAHistoricoTransicoes';

interface Props {
  sinistros: SinistroSLA[];
}

function getProgressColor(classificacao: string) {
  if (classificacao === 'verde') return 'bg-green-500';
  if (classificacao === 'amarelo') return 'bg-yellow-500';
  return 'bg-red-500';
}

export function SLATabelaSinistros({ sinistros }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Protocolo</TableHead>
            <TableHead>Associado / Placa</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-center">Dias</TableHead>
            <TableHead className="text-center">SLA</TableHead>
            <TableHead className="w-[150px]">Progresso</TableHead>
            <TableHead className="w-[40px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sinistros.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                Nenhum sinistro encontrado
              </TableCell>
            </TableRow>
          )}
          {sinistros.map(s => (
            <>
              <TableRow
                key={s.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
              >
                <TableCell>
                  <Link
                    to={`/eventos/sinistros/${s.id}`}
                    className="text-primary hover:underline font-mono text-xs"
                    onClick={e => e.stopPropagation()}
                  >
                    {s.protocolo}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="text-sm">{s.associado?.nome || '—'}</div>
                  <div className="text-xs text-muted-foreground">{s.veiculo?.placa || '—'}</div>
                </TableCell>
                <TableCell>
                  <span className="text-sm">
                    {TIPO_SINISTRO_LABELS?.[s.tipo as TipoSinistro] || s.tipo}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge className={STATUS_SINISTRO_COLORS[s.status as StatusSinistro] || 'bg-muted'}>
                    {STATUS_SINISTRO_LABELS[s.status as StatusSinistro] || s.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-center font-medium">{s.diasNaEtapa}d</TableCell>
                <TableCell className="text-center text-muted-foreground">{s.slaDaEtapa}d</TableCell>
                <TableCell>
                  <Progress
                    value={Math.min(s.percentual, 100)}
                    className="h-2"
                    indicatorClassName={getProgressColor(s.classificacao)}
                  />
                  <span className="text-xs text-muted-foreground">{Math.round(s.percentual)}%</span>
                </TableCell>
                <TableCell>
                  {s.classificacao === 'vermelho' && (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  )}
                </TableCell>
              </TableRow>
              {expandedId === s.id && (
                <TableRow key={`${s.id}-hist`}>
                  <TableCell colSpan={8} className="bg-muted/30 p-0">
                    <SLAHistoricoTransicoes sinistroId={s.id} />
                  </TableCell>
                </TableRow>
              )}
            </>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

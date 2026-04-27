import { parseDataLocal } from '@/lib/date-utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  User, Car, MapPin, Calendar, Clock, UserCog,
  ClipboardList, ExternalLink, DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  STATUS_SERVICO_LABELS, STATUS_SERVICO_COLORS, PERIODO_LABELS,
  type Servico,
} from '@/hooks/useServicos';
import { ServicoTipoBadge } from './ServicoTipoBadge';

interface ServicosTableProps {
  servicos: Servico[];
  isLoading?: boolean;
  onRowClick: (servico: Servico) => void;
}

export function ServicosTable({ servicos, isLoading, onRowClick }: ServicosTableProps) {
  return (
    <div className="rounded-lg border bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[180px]">Tipo</TableHead>
            <TableHead>Associado</TableHead>
            <TableHead className="w-[140px]">Data / Período</TableHead>
            <TableHead>Veículo</TableHead>
            <TableHead>Endereço</TableHead>
            <TableHead>Técnico</TableHead>
            <TableHead className="w-[140px]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 7 }).map((__, j) => (
                  <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                ))}
              </TableRow>
            ))
          ) : servicos.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-32 text-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <ClipboardList className="h-8 w-8" />
                  <p>Nenhum serviço encontrado</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            servicos.map((s) => {
              const statusClass = STATUS_SERVICO_COLORS[s.status];
              const isPrestador = !!(s as any).vistoriador_prestador_id || (s as any).origem === 'prestador_externo';
              return (
                <TableRow
                  key={s.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onRowClick(s)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      <ServicoTipoBadge servico={s} />
                      {(s as any).multa_aplicada && (
                        <Badge variant="destructive" className="h-5 px-1 text-[10px]">
                          <DollarSign className="h-2.5 w-2.5" />
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate max-w-[160px]">
                        {s.associado?.nome || '—'}
                      </span>
                    </div>
                    {s.protocolo && (
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">
                        {s.protocolo}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {s.data_agendada ? (
                      <div>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {(() => {
                            const d = parseDataLocal(s.data_agendada);
                            return d ? format(d, 'dd/MM/yyyy', { locale: ptBR }) : '—';
                          })()}
                        </div>
                        {s.periodo && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <Clock className="h-3 w-3" />
                            {PERIODO_LABELS[s.periodo]}
                            {s.hora_agendada && ` • ${s.hora_agendada.slice(0, 5)}`}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sem data</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {s.veiculo ? (
                      <div className="flex items-center gap-1.5">
                        <Car className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div>
                          <div className="text-sm truncate max-w-[140px]">
                            {s.veiculo.marca} {s.veiculo.modelo}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {s.veiculo.placa}
                          </div>
                        </div>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {s.cidade || s.bairro ? (
                      <div className="flex items-start gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <div className="truncate max-w-[160px]">
                            {s.bairro || '—'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {s.cidade}{s.uf ? ` / ${s.uf}` : ''}
                          </div>
                        </div>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {s.profissional?.nome ? (
                      <div className="flex items-center gap-1.5">
                        <UserCog className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate max-w-[120px]">
                          {s.profissional.nome}
                        </span>
                      </div>
                    ) : isPrestador ? (
                      <Badge variant="outline" className="text-[10px]">
                        <ExternalLink className="h-2.5 w-2.5 mr-1" /> Prestador
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Não atribuído</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn('text-xs border-transparent', statusClass)}>
                      {STATUS_SERVICO_LABELS[s.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

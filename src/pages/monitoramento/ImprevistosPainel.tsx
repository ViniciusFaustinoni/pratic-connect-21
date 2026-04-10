import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, CalendarPlus, CheckCircle2, Clock, Mail, RefreshCw } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

import { useImprevistos, type ImprevistoFilters } from '@/hooks/useImprevistos';
import { useInstaladores } from '@/hooks/useInstaladores';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import ModalReagendamentoManual from '@/components/monitoramento/ModalReagendamentoManual';

const MOTIVOS_IMPREVISTO = [
  'Imprevisto do técnico',
  'Imprevisto do associado',
];

export default function ImprevistosPainel() {
  const [searchParams] = useSearchParams();
  const showPendentes = searchParams.get('pendentes') === 'true';

  const [motivo, setMotivo] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [instaladorId, setInstaladorId] = useState<string>('');
  const [reagendarServico, setReagendarServico] = useState<any>(null);

  const filters: ImprevistoFilters = {
    motivo: motivo || undefined,
    dateRange,
    instaladorId: instaladorId || undefined,
  };

  const { data: imprevistos, isLoading, refetch } = useImprevistos(filters);
  const { data: instaladores } = useInstaladores();

  const clearFilters = () => {
    setMotivo('');
    setDateRange(undefined);
    setInstaladorId('');
  };

  const hasFilters = motivo || dateRange || instaladorId;

  // Filter for pending follow-ups if URL param is set
  const filteredImprevistos = showPendentes
    ? imprevistos?.filter((item: any) => (item.reagendamento_followup_count ?? 0) >= 3)
    : imprevistos;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Imprevistos</h1>
          <p className="text-muted-foreground text-sm">
            {showPendentes
              ? 'Imprevistos aguardando contato manual (follow-ups esgotados)'
              : 'Gerencie todos os imprevistos registrados nos serviços'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Motivo</label>
          <Select value={motivo} onValueChange={setMotivo}>
            <SelectTrigger>
              <SelectValue placeholder="Todos os motivos" />
            </SelectTrigger>
            <SelectContent>
              {MOTIVOS_IMPREVISTO.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Período</label>
          <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Instalador</label>
          <Select value={instaladorId} onValueChange={setInstaladorId}>
            <SelectTrigger>
              <SelectValue placeholder="Todos os instaladores" />
            </SelectTrigger>
            <SelectContent>
              {instaladores?.map((inst) => (
                <SelectItem key={inst.id} value={inst.id}>{inst.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="w-fit">
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Tabela */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Associado</TableHead>
              <TableHead>Instalador</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Duplo Check</TableHead>
              <TableHead className="text-center">Follow-ups</TableHead>
              <TableHead className="text-center">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : !filteredImprevistos?.length ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                  Nenhum imprevisto encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredImprevistos.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {item.imprevisto_registrado_em
                      ? format(new Date(item.imprevisto_registrado_em), "dd/MM/yy HH:mm", { locale: ptBR })
                      : '—'}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {item.associado?.nome ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.profissional?.nome ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.imprevisto_motivo ?? '—'}
                  </TableCell>
                  <TableCell>
                    {item.status === 'imprevisto_pendente' ? (
                      <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50">
                        <Clock className="mr-1 h-3 w-3" />
                        Pendente
                      </Badge>
                    ) : item.status === 'nao_compareceu' ? (
                      <Badge variant="destructive">
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        Não compareceu
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{item.status}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.imprevisto_duplo_check ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.reagendamento_followup_count > 0 ? (
                      <Badge variant={item.reagendamento_followup_count >= 3 ? 'destructive' : 'outline'} className="text-xs">
                        {item.reagendamento_followup_count}/3
                      </Badge>
                    ) : item.reagendamento_enviado_em ? (
                      <Mail className="h-4 w-4 text-blue-500 mx-auto" />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {(item.reagendamento_followup_count ?? 0) >= 3 && item.status !== 'reagendada' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setReagendarServico(item)}
                      >
                        <CalendarPlus className="mr-1 h-3 w-3" />
                        Reagendar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {filteredImprevistos && (
        <p className="text-xs text-muted-foreground">
          {filteredImprevistos.length} imprevisto{filteredImprevistos.length !== 1 ? 's' : ''} encontrado{filteredImprevistos.length !== 1 ? 's' : ''}
        </p>
      )}

      <ModalReagendamentoManual
        open={!!reagendarServico}
        onOpenChange={(open) => !open && setReagendarServico(null)}
        servico={reagendarServico}
        onSuccess={() => refetch()}
      />
    </div>
  );
}

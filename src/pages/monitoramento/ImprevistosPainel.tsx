import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, CheckCircle2, Clock, Mail, RefreshCw } from 'lucide-react';
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

const MOTIVOS_IMPREVISTO = [
  'Associado ausente',
  'Endereço incorreto',
  'Problema no veículo',
  'Desistência do associado',
  'Outro',
];

export default function ImprevistosPainel() {
  const [motivo, setMotivo] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [instaladorId, setInstaladorId] = useState<string>('');

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Imprevistos</h1>
          <p className="text-muted-foreground text-sm">
            Gerencie todos os imprevistos registrados nos serviços
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
              <TableHead className="text-center">Reagendamento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : !imprevistos?.length ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  Nenhum imprevisto encontrado
                </TableCell>
              </TableRow>
            ) : (
              imprevistos.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {item.imprevisto_registrado_em
                      ? format(new Date(item.imprevisto_registrado_em), "dd/MM/yy HH:mm", { locale: ptBR })
                      : '—'}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {(item.associado as any)?.nome ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {(item.profissional as any)?.nome ?? '—'}
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
                    {item.reagendamento_enviado_em ? (
                      <Mail className="h-4 w-4 text-blue-500 mx-auto" />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {imprevistos && (
        <p className="text-xs text-muted-foreground">
          {imprevistos.length} imprevisto{imprevistos.length !== 1 ? 's' : ''} encontrado{imprevistos.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart3, Clock, CheckCircle2, Calendar, X, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useTarefasProfissional, TarefaProfissional } from '@/hooks/useTarefasProfissional';
import { cn } from '@/lib/utils';

interface RelatorioTarefasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profissionalId: string;
  profissionalNome: string;
}

const TIPO_LABELS: Record<string, string> = {
  instalacao: 'Instalação',
  vistoria: 'Vistoria',
  manutencao: 'Manutenção',
};

const TIPO_COLORS: Record<string, string> = {
  instalacao: 'bg-blue-100 text-blue-800',
  vistoria: 'bg-purple-100 text-purple-800',
  manutencao: 'bg-amber-100 text-amber-800',
};

function getTempoColor(minutos: number | null): string {
  if (minutos === null) return 'text-muted-foreground';
  if (minutos <= 15) return 'text-green-600';
  if (minutos <= 30) return 'text-amber-600';
  return 'text-red-600';
}

function formatarTempo(minutos: number | null): string {
  if (minutos === null) return '--';
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  return `${horas}h ${mins}min`;
}

export function RelatorioTarefasModal({
  open,
  onOpenChange,
  profissionalId,
  profissionalNome,
}: RelatorioTarefasModalProps) {
  const [diasFiltro, setDiasFiltro] = useState<number>(30);
  const [tipoFiltro, setTipoFiltro] = useState<string>('todos');

  const { data, isLoading } = useTarefasProfissional(open ? profissionalId : null, diasFiltro);

  const tarefasFiltradas = (data?.tarefas || []).filter(
    (t) => tipoFiltro === 'todos' || t.tipo === tipoFiltro
  );

  const formatarData = (dataStr: string) => {
    const date = new Date(dataStr);
    const hoje = new Date();
    if (format(date, 'yyyy-MM-dd') === format(hoje, 'yyyy-MM-dd')) {
      return `Hoje ${format(date, 'HH:mm')}`;
    }
    return format(date, "dd/MM HH:mm");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Relatório de Produtividade - {profissionalNome}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Estatísticas */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4">
              <div className="rounded-lg border bg-card p-4 text-center">
                <CheckCircle2 className="mx-auto h-6 w-6 text-primary mb-2" />
                <p className="text-2xl font-bold">{data?.estatisticas.totalTarefas || 0}</p>
                <p className="text-xs text-muted-foreground">Total de Tarefas</p>
              </div>
              <div className="rounded-lg border bg-card p-4 text-center">
                <Clock className="mx-auto h-6 w-6 text-amber-500 mb-2" />
                <p className="text-2xl font-bold">{data?.estatisticas.tempoMedioMin || 0} min</p>
                <p className="text-xs text-muted-foreground">Tempo Médio</p>
              </div>
              <div className="rounded-lg border bg-card p-4 text-center">
                <Calendar className="mx-auto h-6 w-6 text-green-500 mb-2" />
                <p className="text-sm font-medium">
                  {data?.estatisticas.ultimaTarefa 
                    ? formatDistanceToNow(new Date(data.estatisticas.ultimaTarefa), { addSuffix: true, locale: ptBR })
                    : 'N/A'
                  }
                </p>
                <p className="text-xs text-muted-foreground">Última Tarefa</p>
              </div>
            </div>

            {/* Filtros */}
            <div className="flex gap-3 pb-4">
              <Select value={String(diasFiltro)} onValueChange={(v) => setDiasFiltro(Number(v))}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                  <SelectItem value="0">Todos</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  <SelectItem value="instalacao">Instalação</SelectItem>
                  <SelectItem value="vistoria">Vistoria</SelectItem>
                  <SelectItem value="manutencao">Manutenção</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tabela */}
            <div className="flex-1 overflow-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Veículo</TableHead>
                    <TableHead className="text-right">Tempo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tarefasFiltradas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhuma tarefa encontrada no período
                      </TableCell>
                    </TableRow>
                  ) : (
                    tarefasFiltradas.map((tarefa) => (
                      <TableRow key={tarefa.id}>
                        <TableCell className="text-sm">
                          {tarefa.concluida_em ? formatarData(tarefa.concluida_em) : '--'}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={cn('text-xs', TIPO_COLORS[tarefa.tipo] || '')}
                          >
                            {TIPO_LABELS[tarefa.tipo] || tarefa.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm max-w-[150px] truncate">
                          {tarefa.associado_nome}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {tarefa.veiculo_placa}
                        </TableCell>
                        <TableCell className={cn('text-right font-medium', getTempoColor(tarefa.tempo_execucao_min))}>
                          {formatarTempo(tarefa.tempo_execucao_min)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

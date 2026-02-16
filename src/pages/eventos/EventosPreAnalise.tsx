import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

const STATUS_PRE_ANALISE = ['comunicado', 'em_analise', 'documentacao_pendente', 'aguardando_vistoria'] as const;

const STATUS_LABELS: Record<string, string> = {
  comunicado: 'Comunicado',
  em_analise: 'Em Análise',
  documentacao_pendente: 'Doc. Pendente',
  aguardando_vistoria: 'Aguardando Vistoria',
};

const STATUS_COLORS: Record<string, string> = {
  comunicado: 'bg-amber-100 text-amber-800 border-amber-200',
  em_analise: 'bg-blue-100 text-blue-800 border-blue-200',
  documentacao_pendente: 'bg-orange-100 text-orange-800 border-orange-200',
  aguardando_vistoria: 'bg-purple-100 text-purple-800 border-purple-200',
};

export default function EventosPreAnalise() {
  const navigate = useNavigate();
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');

  const { data: sinistros, isLoading } = useQuery({
    queryKey: ['eventos-pre-analise', filtroStatus, filtroTipo],
    queryFn: async () => {
      let query = supabase
        .from('sinistros')
        .select(`
          id,
          tipo,
          data_ocorrencia,
          created_at,
          status,
          associado:associados!sinistros_associado_id_fkey(id, nome, cpf),
          veiculo:veiculos!sinistros_veiculo_id_fkey(id, placa, marca, modelo)
        `)
        .in('status', filtroStatus === 'todos' ? [...STATUS_PRE_ANALISE] : [filtroStatus] as any)
        .order('created_at', { ascending: false });

      if (filtroTipo !== 'todos') {
        query = query.eq('tipo', filtroTipo as any);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-purple-600" />
          <h1 className="text-xl font-bold">Pré-Análise de Eventos</h1>
        </div>
        <span className="text-sm text-muted-foreground">
          {sinistros?.length || 0} evento(s)
        </span>
      </div>

      {/* Filtros */}
      <div className="flex gap-3">
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Status</SelectItem>
            {STATUS_PRE_ANALISE.map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Tipos</SelectItem>
            <SelectItem value="colisao">Colisão</SelectItem>
            <SelectItem value="roubo_furto">Roubo/Furto</SelectItem>
            <SelectItem value="incendio">Incêndio</SelectItem>
            <SelectItem value="alagamento">Alagamento</SelectItem>
            <SelectItem value="perda_total">Perda Total</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !sinistros?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          Nenhum evento em pré-análise.
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Associado</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sinistros.map((s: any) => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/eventos/sinistros/${s.id}`)}
                >
                  <TableCell className="capitalize font-medium">
                    {s.tipo?.replace(/_/g, ' ')}
                  </TableCell>
                  <TableCell>{s.associado?.nome || '—'}</TableCell>
                  <TableCell>
                    {s.veiculo ? `${s.veiculo.marca} ${s.veiculo.modelo}` : '—'}
                  </TableCell>
                  <TableCell className="font-mono">{s.veiculo?.placa || '—'}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[s.status] || ''}>
                      {STATUS_LABELS[s.status] || s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.created_at ? format(new Date(s.created_at), 'dd/MM/yyyy') : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

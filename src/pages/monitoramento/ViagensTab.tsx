import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Truck, Users, Wallet, Loader2, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { DateRange } from 'react-day-picker';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { SlaIndicador } from '@/components/ui/SlaIndicador';
import { useInstaladores } from '@/hooks/useInstaladores';
import { STATUS_INSTALACAO_LABELS, STATUS_INSTALACAO_COLORS } from '@/types/database';
import { formatarMoeda } from '@/utils/format';

type StatusInstalacao = keyof typeof STATUS_INSTALACAO_LABELS;

const OPEN_STATUSES: StatusInstalacao[] = ['agendada', 'em_rota', 'em_andamento', 'reagendada'];

export default function ViagensTab() {
  const navigate = useNavigate();
  const hoje = new Date();

  const [statusFilter, setStatusFilter] = useState<string>('abertas');
  const [tecnicoFilter, setTecnicoFilter] = useState<string>('todos');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(hoje),
    to: endOfMonth(hoje),
  });

  // Config: viagem_valor_diaria
  const { data: valorDiaria } = useQuery({
    queryKey: ['config-viagem-valor-diaria'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'viagem_valor_diaria')
        .maybeSingle();
      return parseFloat(data?.valor || '0') || 0;
    },
    staleTime: 1000 * 60 * 10,
  });

  const showDiaria = (valorDiaria ?? 0) > 0;

  const { data: instaladores } = useInstaladores();

  // Main query: viagem installations
  const { data: viagens, isLoading } = useQuery({
    queryKey: ['viagens-tab', dateRange, statusFilter, tecnicoFilter],
    queryFn: async () => {
      let query = supabase
        .from('instalacoes')
        .select(`
          id, status, data_agendada, periodo, tipo_deslocamento, tipo_servico, created_at,
          cidade, uf, instalador_id, instalador_responsavel_id,
          associados (id, nome),
          instalador:profiles!instalacoes_instalador_id_fkey (id, nome),
          instalador_responsavel:profiles!instalacoes_instalador_responsavel_id_fkey (id, nome)
        `)
        .eq('tipo_deslocamento', 'viagem')
        .order('data_agendada', { ascending: false }) as any;

      if (dateRange?.from) {
        query = query.gte('data_agendada', format(dateRange.from, 'yyyy-MM-dd'));
      }
      if (dateRange?.to) {
        query = query.lte('data_agendada', format(dateRange.to, 'yyyy-MM-dd'));
      }

      if (statusFilter === 'abertas') {
        query = query.in('status', OPEN_STATUSES);
      } else if (statusFilter === 'concluidas') {
        query = query.eq('status', 'concluida');
      }

      if (tecnicoFilter && tecnicoFilter !== 'todos') {
        query = query.or(`instalador_id.eq.${tecnicoFilter},instalador_responsavel_id.eq.${tecnicoFilter}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Summary cards
  const { data: summaryData } = useQuery({
    queryKey: ['viagens-summary'],
    queryFn: async () => {
      const hojeStr = format(hoje, 'yyyy-MM-dd');

      const { count: ativas } = await (supabase
        .from('instalacoes')
        .select('*', { count: 'exact', head: true })
        .eq('tipo_deslocamento', 'viagem')
        .in('status', OPEN_STATUSES) as any);

      const { data: tecnicosHoje } = await (supabase
        .from('instalacoes')
        .select('instalador_id, instalador_responsavel_id')
        .eq('tipo_deslocamento', 'viagem')
        .eq('data_agendada', hojeStr)
        .in('status', OPEN_STATUSES) as any);

      const tecnicoIds = new Set(
        (tecnicosHoje || [])
          .flatMap((t: any) => [t.instalador_id, t.instalador_responsavel_id])
          .filter(Boolean)
      );

      return {
        ativas: ativas || 0,
        tecnicosHoje: tecnicoIds.size,
      };
    },
    enabled: showDiaria,
  });

  const getTecnicoNome = (item: any) =>
    item.instalador?.nome || item.instalador_responsavel?.nome || null;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {showDiaria && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Viagens Ativas</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryData?.ativas ?? '-'}</div>
              <p className="text-xs text-muted-foreground">Instalações de viagem em aberto</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Técnicos em Viagem Hoje</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryData?.tecnicosHoje ?? '-'}</div>
              <p className="text-xs text-muted-foreground">Com instalações viagem agendadas hoje</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Diária</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatarMoeda(valorDiaria!)}</div>
              <p className="text-xs text-muted-foreground">Configurado por viagem</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-[160px]">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="abertas">Em aberto</SelectItem>
              <SelectItem value="concluidas">Concluídas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-[200px]">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Técnico</label>
          <Select value={tecnicoFilter} onValueChange={setTecnicoFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {(instaladores || []).map((inst: any) => (
                <SelectItem key={inst.id} value={inst.id}>{inst.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-[280px]">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Período</label>
          <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !viagens || viagens.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed">
              <div className="text-center">
                <Truck className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">Nenhuma viagem no período selecionado</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Altere os filtros para visualizar instalações de viagem.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Associado / Município</TableHead>
                    <TableHead>Técnico</TableHead>
                    <TableHead>Data Agendada</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>SLA</TableHead>
                    {showDiaria && <TableHead>Diária</TableHead>}
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viagens.map((v: any) => (
                    <TableRow
                      key={v.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/monitoramento/instalacoes/${v.id}`)}
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{v.associados?.nome || '—'}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            {v.cidade}{v.uf ? `/${v.uf}` : ''}
                            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-orange-500/15 text-orange-700 border-orange-500/30 dark:text-orange-400">
                              Viagem
                            </Badge>
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getTecnicoNome(v) || (
                          <span className="text-muted-foreground">Não atribuído</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {v.data_agendada
                          ? format(new Date(v.data_agendada + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_INSTALACAO_COLORS[v.status as StatusInstalacao]}>
                          {STATUS_INSTALACAO_LABELS[v.status as StatusInstalacao] || v.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <SlaIndicador
                          criadoEm={v.created_at}
                          tipoServico={v.tipo_servico || 'instalacao'}
                          tipoDeslocamento="viagem"
                        />
                      </TableCell>
                      {showDiaria && (
                        <TableCell>
                          <span className="text-sm font-medium text-muted-foreground">
                            {formatarMoeda(valorDiaria!)}
                          </span>
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/monitoramento/instalacoes/${v.id}`);
                          }}
                          title="Ver detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

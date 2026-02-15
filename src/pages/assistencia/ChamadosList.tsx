import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Search,
  Plus,
  Truck,
  Key,
  Circle,
  Fuel,
  Battery,
  HelpCircle,
  Eye,
  Phone,
  ChevronLeft,
  ChevronRight,
  LucideIcon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { NovoChamadoModal } from '@/components/assistencia/NovoChamadoModal';

const statusOptions = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'aberto', label: 'Aberto' },
  { value: 'aguardando_prestador', label: 'Aguardando Prestador' },
  { value: 'prestador_a_caminho', label: 'A Caminho' },
  { value: 'em_atendimento', label: 'Em Atendimento' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'cancelado_associado', label: 'Cancelado' },
];

const tipoOptions = [
  { value: 'todos', label: 'Todos os tipos' },
  { value: 'reboque', label: 'Reboque/Guincho' },
  { value: 'chaveiro', label: 'Chaveiro' },
  { value: 'troca_pneu', label: 'Troca de Pneu' },
  { value: 'pane_seca', label: 'Pane Seca' },
  { value: 'bateria', label: 'Bateria' },
  { value: 'outro', label: 'Outros' },
];

const tiposServico: Record<string, { icon: LucideIcon; label: string }> = {
  reboque: { icon: Truck, label: 'Reboque/Guincho' },
  chaveiro: { icon: Key, label: 'Chaveiro' },
  troca_pneu: { icon: Circle, label: 'Troca de Pneu' },
  pane_seca: { icon: Fuel, label: 'Pane Seca' },
  bateria: { icon: Battery, label: 'Bateria' },
  outro: { icon: HelpCircle, label: 'Outros' },
};

const statusConfig: Record<string, { label: string; className: string }> = {
  aberto: { label: 'Aberto', className: 'bg-yellow-100 text-yellow-800' },
  aguardando_prestador: { label: 'Aguard. Prestador', className: 'bg-orange-100 text-orange-800' },
  prestador_despachado: { label: 'Despachado', className: 'bg-blue-100 text-blue-800' },
  prestador_a_caminho: { label: 'A Caminho', className: 'bg-purple-100 text-purple-800' },
  em_atendimento: { label: 'Em Atendimento', className: 'bg-indigo-100 text-indigo-800' },
  concluido: { label: 'Concluído', className: 'bg-green-100 text-green-800' },
  cancelado_associado: { label: 'Canc. Associado', className: 'bg-red-100 text-red-800' },
  cancelado_sistema: { label: 'Canc. Sistema', className: 'bg-red-100 text-red-800' },
};

import { Database } from '@/integrations/supabase/types';

type StatusChamado = Database['public']['Enums']['status_chamado'];

const STATUS_ATIVOS: StatusChamado[] = ['aberto', 'aguardando_prestador', 'prestador_despachado', 'prestador_a_caminho', 'em_atendimento'];
const STATUS_CANCELADOS: StatusChamado[] = ['cancelado_associado', 'cancelado_sistema'];

export default function ChamadosList() {
  const navigate = useNavigate();
  const perPage = 20;
  const [modalNovoChamado, setModalNovoChamado] = useState(false);

  const [filters, setFilters] = useState({
    status: 'todos',
    tipo: 'todos',
    busca: '',
    dataInicio: '',
    dataFim: '',
  });
  const [page, setPage] = useState(1);
  const [tabAtiva, setTabAtiva] = useState('todos');

  // Query para contadores das tabs
  const { data: contadores } = useQuery({
    queryKey: ['chamados-contadores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chamados_assistencia')
        .select('status');
      if (error) throw error;

      return {
        todos: data.length,
        ativos: data.filter((c) => STATUS_ATIVOS.includes(c.status)).length,
        concluidos: data.filter((c) => c.status === 'concluido').length,
        cancelados: data.filter((c) => STATUS_CANCELADOS.includes(c.status)).length,
      };
    },
  });

  // Query principal para buscar chamados
  const { data: chamados, isLoading } = useQuery({
    queryKey: ['chamados-assistencia', filters, tabAtiva, page],
    queryFn: async () => {
      let query = supabase
        .from('chamados_assistencia')
        .select(
          `
          *,
          associado:associados(id, nome, telefone, whatsapp),
          veiculo:veiculos(id, placa, marca, modelo, ano_modelo)
        `,
          { count: 'exact' }
        )
        .order('data_abertura', { ascending: false });

      // Aplicar filtro baseado na tab ativa
      if (tabAtiva === 'ativos') {
        query = query.in('status', STATUS_ATIVOS);
      } else if (tabAtiva === 'concluidos') {
        query = query.eq('status', 'concluido');
      } else if (tabAtiva === 'cancelados') {
        query = query.in('status', STATUS_CANCELADOS);
      } else {
        // Tab "todos" - aplicar filtros manuais
        if (filters.status && filters.status !== 'todos') {
          query = query.eq('status', filters.status as StatusChamado);
        }
      }

      if (filters.tipo && filters.tipo !== 'todos') {
        query = query.eq('tipo_servico', filters.tipo);
      }
      if (filters.busca) {
        query = query.ilike('protocolo', `%${filters.busca}%`);
      }
      if (filters.dataInicio) {
        query = query.gte('data_abertura', filters.dataInicio);
      }
      if (filters.dataFim) {
        query = query.lte('data_abertura', filters.dataFim + 'T23:59:59');
      }

      // Paginação
      const from = (page - 1) * perPage;
      const to = from + perPage - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data, count };
    },
  });

  const totalPages = Math.ceil((chamados?.count || 0) / perPage);

  const handleTabChange = (value: string) => {
    setTabAtiva(value);
    setPage(1);
    // Reset status filter when changing tabs
    if (value !== 'todos') {
      setFilters((f) => ({ ...f, status: 'todos' }));
    }
  };

  const handleClearFilters = () => {
    setFilters({
      status: 'todos',
      tipo: 'todos',
      busca: '',
      dataInicio: '',
      dataFim: '',
    });
    setTabAtiva('todos');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fila de Chamados</h1>
          <p className="text-muted-foreground">
            {chamados?.count || 0} chamados encontrados
          </p>
        </div>
        <Button onClick={() => setModalNovoChamado(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Chamado
        </Button>
      </div>

      {/* Modal Novo Chamado */}
      <NovoChamadoModal
        open={modalNovoChamado}
        onClose={() => setModalNovoChamado(false)}
        onSuccess={(chamado) => navigate(`/assistencia/chamados/${chamado.id}`)}
      />

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            {/* Busca */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por protocolo..."
                className="pl-9"
                value={filters.busca}
                onChange={(e) => {
                  setFilters({ ...filters, busca: e.target.value });
                  setPage(1);
                }}
              />
            </div>

            {/* Select Status */}
            <Select
              value={filters.status}
              onValueChange={(v) => {
                setFilters({ ...filters, status: v });
                setPage(1);
              }}
              disabled={tabAtiva !== 'todos'}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Select Tipo */}
            <Select
              value={filters.tipo}
              onValueChange={(v) => {
                setFilters({ ...filters, tipo: v });
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                {tipoOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Data Início */}
            <Input
              type="date"
              className="w-[150px]"
              value={filters.dataInicio}
              onChange={(e) => {
                setFilters({ ...filters, dataInicio: e.target.value });
                setPage(1);
              }}
            />

            {/* Data Fim */}
            <Input
              type="date"
              className="w-[150px]"
              value={filters.dataFim}
              onChange={(e) => {
                setFilters({ ...filters, dataFim: e.target.value });
                setPage(1);
              }}
            />

            {/* Limpar Filtros */}
            <Button variant="outline" onClick={handleClearFilters}>
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs de Status Rápido */}
      <Tabs value={tabAtiva} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="todos">
            Todos
            <Badge variant="secondary" className="ml-2">
              {contadores?.todos || 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="ativos">
            Ativos
            <Badge variant="secondary" className="ml-2">
              {contadores?.ativos || 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="concluidos">
            Concluídos
            <Badge variant="secondary" className="ml-2">
              {contadores?.concluidos || 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="cancelados">
            Cancelados
            <Badge variant="secondary" className="ml-2">
              {contadores?.cancelados || 0}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Protocolo</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Associado</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tempo</TableHead>
                <TableHead className="w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : chamados?.data?.length ? (
                chamados.data.map((chamado) => {
                  const TipoIcon = tiposServico[chamado.tipo_servico]?.icon || HelpCircle;
                  const status = statusConfig[chamado.status] || {
                    label: chamado.status,
                    className: '',
                  };

                  return (
                    <TableRow
                      key={chamado.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/assistencia/chamados/${chamado.id}`)}
                    >
                      <TableCell className="font-mono font-medium">
                        {chamado.protocolo}
                      </TableCell>
                      <TableCell>
                        {format(new Date(chamado.data_abertura), 'dd/MM/yyyy HH:mm', {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TipoIcon className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {tiposServico[chamado.tipo_servico]?.label || chamado.tipo_servico}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{chamado.associado?.nome || '-'}</TableCell>
                      <TableCell>{chamado.veiculo?.placa || '-'}</TableCell>
                      <TableCell>{chamado.origem_cidade || 'Não informado'}</TableCell>
                      <TableCell>
                        <Badge className={status.className}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(chamado.data_abertura), {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/assistencia/chamados/${chamado.id}`);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Phone className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">Nenhum chamado encontrado</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Exibindo {(page - 1) * perPage + 1}-
            {Math.min(page * perPage, chamados?.count || 0)} de {chamados?.count || 0} chamados
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <span className="text-sm">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Próximo
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

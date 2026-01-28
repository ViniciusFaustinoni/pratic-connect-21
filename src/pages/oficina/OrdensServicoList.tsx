import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { 
  Plus, Search, FileText, Clock, Wrench, 
  CheckCircle, DollarSign, Eye 
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from '@/components/ui/table';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { NovaOSModal } from '@/components/oficina/NovaOSModal';
import { useOficinas } from '@/hooks/useOficinas';
import { 
  STATUS_ORDEM_SERVICO_LABELS, 
  STATUS_ORDEM_SERVICO_COLORS,
  type StatusOrdemServico 
} from '@/types/database';

const statusConfig: Record<StatusOrdemServico, { label: string; class: string }> = {
  rascunho: { label: 'Rascunho', class: 'bg-gray-100 text-gray-800' },
  aguardando_orcamento: { label: 'Aguard. Orçamento', class: 'bg-yellow-100 text-yellow-800' },
  orcamento_enviado: { label: 'Orçamento Enviado', class: 'bg-blue-100 text-blue-800' },
  aguardando_aprovacao: { label: 'Aguard. Aprovação', class: 'bg-purple-100 text-purple-800' },
  aprovado: { label: 'Aprovado', class: 'bg-cyan-100 text-cyan-800' },
  em_execucao: { label: 'Em Execução', class: 'bg-indigo-100 text-indigo-800' },
  aguardando_peca: { label: 'Aguard. Peça', class: 'bg-orange-100 text-orange-800' },
  concluido: { label: 'Concluído', class: 'bg-green-100 text-green-800' },
  aguardando_pagamento: { label: 'Aguard. Pagamento', class: 'bg-amber-100 text-amber-800' },
  pago: { label: 'Pago', class: 'bg-emerald-100 text-emerald-800' },
  cancelado: { label: 'Cancelado', class: 'bg-red-100 text-red-800' },
};

interface Filters {
  busca: string;
  oficina_id: string;
  status: StatusOrdemServico | 'todos';
  data_inicio: string;
  data_fim: string;
}

export default function OrdensServicoList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [formOpen, setFormOpen] = useState(false);
  const [sinistroIdFromUrl, setSinistroIdFromUrl] = useState<string | undefined>();
  const [filters, setFilters] = useState<Filters>({
    busca: '',
    oficina_id: '',
    status: 'todos',
    data_inicio: '',
    data_fim: '',
  });

  // Processar parâmetros da URL para abrir modal automaticamente
  useEffect(() => {
    const novoParam = searchParams.get('novo');
    const sinistroIdParam = searchParams.get('sinistro_id');
    
    if (novoParam === 'true') {
      setSinistroIdFromUrl(sinistroIdParam || undefined);
      setFormOpen(true);
      // Limpar parâmetros da URL após processar
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const { data: oficinas = [] } = useOficinas({ status: 'ativo' });

  const { data: ordensServico = [], isLoading } = useQuery({
    queryKey: ['ordens-servico-list', filters],
    queryFn: async () => {
      let query = supabase
        .from('ordens_servico')
        .select(`
          *,
          oficina:oficinas(id, nome_fantasia, cidade),
          veiculo:veiculos(id, placa, marca, modelo),
          associado:associados(id, nome),
          sinistro:sinistros(id, protocolo)
        `)
        .order('created_at', { ascending: false });

      if (filters.status && filters.status !== 'todos') {
        query = query.eq('status', filters.status);
      }
      if (filters.oficina_id) {
        query = query.eq('oficina_id', filters.oficina_id);
      }
      if (filters.busca) {
        query = query.ilike('numero', `%${filters.busca}%`);
      }
      if (filters.data_inicio) {
        query = query.gte('created_at', filters.data_inicio);
      }
      if (filters.data_fim) {
        query = query.lte('created_at', `${filters.data_fim}T23:59:59`);
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data;
    },
  });

  const kpis = useMemo(() => ({
    rascunho: ordensServico.filter(os => os.status === 'rascunho').length,
    aguardando_orcamento: ordensServico.filter(os => os.status === 'aguardando_orcamento').length,
    em_execucao: ordensServico.filter(os => os.status === 'em_execucao').length,
    concluido: ordensServico.filter(os => os.status === 'concluido').length,
    aguardando_pagamento: ordensServico.filter(os => os.status === 'aguardando_pagamento').length,
  }), [ordensServico]);

  const formatCurrency = (value: number | null) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Home</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/oficinas">Oficina</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Ordens de Serviço</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-2xl font-bold mt-2">Ordens de Serviço</h1>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova OS
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <FileText className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kpis.rascunho}</p>
                <p className="text-xs text-muted-foreground">Rascunho</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kpis.aguardando_orcamento}</p>
                <p className="text-xs text-muted-foreground">Aguard. Orçamento</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Wrench className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kpis.em_execucao}</p>
                <p className="text-xs text-muted-foreground">Em Execução</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kpis.concluido}</p>
                <p className="text-xs text-muted-foreground">Concluídas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kpis.aguardando_pagamento}</p>
                <p className="text-xs text-muted-foreground">Aguard. Pagamento</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar número da OS..."
            value={filters.busca}
            onChange={(e) => setFilters(prev => ({ ...prev, busca: e.target.value }))}
            className="pl-9"
          />
        </div>
        <Select
          value={filters.oficina_id || 'todas'}
          onValueChange={(value) => setFilters(prev => ({ ...prev, oficina_id: value === 'todas' ? '' : value }))}
        >
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Oficina" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas Oficinas</SelectItem>
            {oficinas.map((oficina) => (
              <SelectItem key={oficina.id} value={oficina.id}>
                {oficina.nome_fantasia || oficina.razao_social}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.status}
          onValueChange={(value) => setFilters(prev => ({ ...prev, status: value as StatusOrdemServico | 'todos' }))}
        >
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Status</SelectItem>
            {Object.entries(STATUS_ORDEM_SERVICO_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={filters.data_inicio}
          onChange={(e) => setFilters(prev => ({ ...prev, data_inicio: e.target.value }))}
          className="w-full md:w-[150px]"
        />
        <Input
          type="date"
          value={filters.data_fim}
          onChange={(e) => setFilters(prev => ({ ...prev, data_fim: e.target.value }))}
          className="w-full md:w-[150px]"
        />
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Sinistro</TableHead>
              <TableHead>Veículo</TableHead>
              <TableHead>Oficina</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="w-[60px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : ordensServico.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhuma ordem de serviço encontrada
                </TableCell>
              </TableRow>
            ) : (
              ordensServico.map((os) => {
                const status = os.status as StatusOrdemServico;
                const config = statusConfig[status] || { label: status, class: 'bg-gray-100 text-gray-800' };
                
                return (
                  <TableRow key={os.id}>
                    <TableCell>
                      <button
                        onClick={() => navigate(`/oficinas/ordens/${os.id}`)}
                        className="font-medium text-primary hover:underline"
                      >
                        {os.numero}
                      </button>
                    </TableCell>
                    <TableCell>
                      {os.sinistro ? (
                        <Badge variant="outline">{os.sinistro.protocolo}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {os.veiculo ? (
                        <div>
                          <span className="font-medium">{os.veiculo.placa}</span>
                          <span className="text-muted-foreground text-sm block">
                            {os.veiculo.marca} {os.veiculo.modelo}
                          </span>
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {os.oficina?.nome_fantasia || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={config.class}>
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(os.valor_orcamento)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(os.created_at), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/oficinas/ordens/${os.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <NovaOSModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setSinistroIdFromUrl(undefined);
        }}
        sinistroId={sinistroIdFromUrl}
      />
    </div>
  );
}

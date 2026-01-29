import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Scale, Plus, Search, Eye, Edit, Filter } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BatchActionsBarProcessos } from '@/components/juridico/BatchActionsBarProcessos';
import { useAdvogados } from '@/hooks/useAdvogados';
import { 
  TIPO_PROCESSO_LABELS, 
  NATUREZA_PROCESSO_LABELS,
  STATUS_PROCESSO_LABELS,
  STATUS_PROCESSO_COLORS,
  FASE_PROCESSO_LABELS
} from '@/types/juridico';
import type { DateRange } from 'react-day-picker';

interface ProcessoFilters {
  busca: string;
  status: string;
  tipo: string;
  natureza: string;
  advogado_id: string;
  periodo: DateRange | undefined;
}

const naturezaConfig: Record<string, string> = {
  autor: 'bg-green-100 text-green-800',
  reu: 'bg-red-100 text-red-800',
  terceiro_interessado: 'bg-blue-100 text-blue-800',
  assistente: 'bg-purple-100 text-purple-800'
};

const tipoConfig: Record<string, string> = {
  civel: 'bg-blue-100 text-blue-800',
  trabalhista: 'bg-orange-100 text-orange-800',
  criminal: 'bg-red-100 text-red-800',
  consumidor: 'bg-green-100 text-green-800',
  transito: 'bg-yellow-100 text-yellow-800',
  administrativo: 'bg-purple-100 text-purple-800',
  tributario: 'bg-indigo-100 text-indigo-800',
  outros: 'bg-gray-100 text-gray-800'
};

export default function ProcessosList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ProcessoFilters>({
    busca: '',
    status: 'todos',
    tipo: 'todos',
    natureza: 'todos',
    advogado_id: 'todos',
    periodo: undefined
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const { advogados } = useAdvogados({ ativo: true });

  const { data: processos = [], isLoading } = useQuery({
    queryKey: ['processos-lista', filters],
    queryFn: async () => {
      let query = supabase
        .from('processos')
        .select(`
          *,
          associado:associados(nome),
          advogado:advogados(nome),
          responsavel:profiles!processos_responsavel_id_fkey(nome)
        `)
        .order('created_at', { ascending: false });
      
      if (filters.status && filters.status !== 'todos') {
        query = query.eq('status', filters.status);
      }
      if (filters.tipo && filters.tipo !== 'todos') {
        query = query.eq('tipo', filters.tipo);
      }
      if (filters.natureza && filters.natureza !== 'todos') {
        query = query.eq('natureza', filters.natureza);
      }
      if (filters.advogado_id && filters.advogado_id !== 'todos') {
        query = query.eq('advogado_id', filters.advogado_id);
      }
      if (filters.periodo?.from) {
        query = query.gte('data_distribuicao', filters.periodo.from.toISOString().split('T')[0]);
      }
      if (filters.periodo?.to) {
        query = query.lte('data_distribuicao', filters.periodo.to.toISOString().split('T')[0]);
      }
      if (filters.busca) {
        query = query.or(
          `numero.ilike.%${filters.busca}%,numero_processo.ilike.%${filters.busca}%,parte_contraria_nome.ilike.%${filters.busca}%`
        );
      }
      
      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data || [];
    }
  });

  // Mutation para arquivar processos
  const arquivarMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('processos')
        .update({ status: 'arquivado', updated_at: new Date().toISOString() })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processos-lista'] });
      setSelectedIds([]);
    }
  });

  // Calcular estatísticas
  const stats = useMemo(() => {
    const total = processos.length;
    const ativos = processos.filter(p => p.status === 'ativo').length;
    const comoAutor = processos.filter(p => p.natureza === 'autor').length;
    const comoReu = processos.filter(p => p.natureza === 'reu').length;
    const encerrados = processos.filter(p => 
      ['encerrado_procedente', 'encerrado_improcedente', 'acordo', 'extinto', 'arquivado'].includes(p.status)
    ).length;

    // Somar valores
    const valorAutor = processos
      .filter(p => p.natureza === 'autor' && p.status === 'ativo')
      .reduce((sum, p) => sum + (p.valor_causa || 0), 0);
    const valorReu = processos
      .filter(p => p.natureza === 'reu' && p.status === 'ativo')
      .reduce((sum, p) => sum + (p.valor_causa || 0), 0);
    
    return { total, ativos, comoAutor, comoReu, encerrados, valorAutor, valorReu };
  }, [processos]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleFilterChange = (key: keyof ProcessoFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(processos.map(p => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(i => i !== id));
    }
  };

  const handleExport = async (ids: string[], format: 'excel' | 'pdf') => {
    // Implementação básica de exportação
    const selected = processos.filter(p => ids.includes(p.id));
    
    if (format === 'excel') {
      // Criar CSV
      const headers = ['Número', 'CNJ', 'Tipo', 'Natureza', 'Parte Contrária', 'Status', 'Advogado'];
      const rows = selected.map(p => [
        p.numero,
        p.numero_processo || '',
        TIPO_PROCESSO_LABELS[p.tipo as keyof typeof TIPO_PROCESSO_LABELS] || p.tipo,
        NATUREZA_PROCESSO_LABELS[p.natureza as keyof typeof NATUREZA_PROCESSO_LABELS] || p.natureza,
        p.parte_contraria_nome || '',
        STATUS_PROCESSO_LABELS[p.status as keyof typeof STATUS_PROCESSO_LABELS] || p.status,
        p.advogado?.nome || ''
      ]);
      
      const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `processos_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } else {
      toast.info('Exportação PDF em desenvolvimento');
    }
  };

  const handleArchive = async (ids: string[]) => {
    await arquivarMutation.mutateAsync(ids);
  };

  const isAllSelected = processos.length > 0 && selectedIds.length === processos.length;
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < processos.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Scale className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Processos</h1>
            <p className="text-muted-foreground">Gestão de processos judiciais</p>
          </div>
        </div>
        <Button onClick={() => navigate('/juridico/processos/novo')}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Processo
        </Button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{isLoading ? '-' : stats.total}</p>
              <p className="text-sm text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{isLoading ? '-' : stats.ativos}</p>
              <p className="text-sm text-muted-foreground">Ativos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{isLoading ? '-' : stats.comoAutor}</p>
              <p className="text-sm text-muted-foreground">Como Autor</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(stats.valorAutor)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{isLoading ? '-' : stats.comoReu}</p>
              <p className="text-sm text-muted-foreground">Como Réu</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(stats.valorReu)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-gray-400">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-600">{isLoading ? '-' : stats.encerrados}</p>
              <p className="text-sm text-muted-foreground">Encerrados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número, CNJ ou parte contrária..."
              value={filters.busca}
              onChange={(e) => handleFilterChange('busca', e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-muted/50 rounded-lg">
            <Select value={filters.status} onValueChange={(v) => handleFilterChange('status', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                {Object.entries(STATUS_PROCESSO_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.tipo} onValueChange={(v) => handleFilterChange('tipo', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Tipos</SelectItem>
                {Object.entries(TIPO_PROCESSO_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.natureza} onValueChange={(v) => handleFilterChange('natureza', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Natureza" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as Naturezas</SelectItem>
                {Object.entries(NATUREZA_PROCESSO_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.advogado_id} onValueChange={(v) => handleFilterChange('advogado_id', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Advogado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Advogados</SelectItem>
                {advogados.map((adv) => (
                  <SelectItem key={adv.id} value={adv.id}>{adv.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DatePickerWithRange
              date={filters.periodo}
              onDateChange={(date) => handleFilterChange('periodo', date)}
            />
          </div>
        )}
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={isAllSelected}
                    ref={(ref) => {
                      if (ref) {
                        (ref as any).indeterminate = isSomeSelected;
                      }
                    }}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Número</TableHead>
                <TableHead>Número CNJ</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Natureza</TableHead>
                <TableHead>Parte Contrária</TableHead>
                <TableHead>Fase</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Advogado</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : processos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    Nenhum processo encontrado
                  </TableCell>
                </TableRow>
              ) : (
                processos.map((processo) => (
                  <TableRow key={processo.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(processo.id)}
                        onCheckedChange={(checked) => handleSelectItem(processo.id, !!checked)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{processo.numero}</TableCell>
                    <TableCell>{processo.numero_processo || '-'}</TableCell>
                    <TableCell>
                      <Badge className={tipoConfig[processo.tipo] || 'bg-gray-100 text-gray-800'}>
                        {TIPO_PROCESSO_LABELS[processo.tipo as keyof typeof TIPO_PROCESSO_LABELS] || processo.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={naturezaConfig[processo.natureza] || 'bg-gray-100 text-gray-800'}>
                        {NATUREZA_PROCESSO_LABELS[processo.natureza as keyof typeof NATUREZA_PROCESSO_LABELS] || processo.natureza}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {processo.parte_contraria_nome || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {FASE_PROCESSO_LABELS[processo.fase as keyof typeof FASE_PROCESSO_LABELS] || processo.fase}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_PROCESSO_COLORS[processo.status as keyof typeof STATUS_PROCESSO_COLORS] || 'bg-gray-100 text-gray-800'}>
                        {STATUS_PROCESSO_LABELS[processo.status as keyof typeof STATUS_PROCESSO_LABELS] || processo.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{processo.advogado?.nome || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/juridico/processos/${processo.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/juridico/processos/${processo.id}/editar`)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Barra de ações em lote */}
      <BatchActionsBarProcessos
        selectedCount={selectedIds.length}
        selectedIds={selectedIds}
        onClearSelection={() => setSelectedIds([])}
        onExport={handleExport}
        onArchive={handleArchive}
      />
    </div>
  );
}

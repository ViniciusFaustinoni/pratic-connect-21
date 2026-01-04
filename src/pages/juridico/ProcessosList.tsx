import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Scale, Plus, Search, Eye, Edit } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { 
  TIPO_PROCESSO_LABELS, 
  NATUREZA_PROCESSO_LABELS,
  STATUS_PROCESSO_LABELS,
  STATUS_PROCESSO_COLORS,
  FASE_PROCESSO_LABELS
} from '@/types/juridico';

interface ProcessoFilters {
  busca: string;
  status: string;
  tipo: string;
  natureza: string;
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
  const [filters, setFilters] = useState<ProcessoFilters>({
    busca: '',
    status: 'todos',
    tipo: 'todos',
    natureza: 'todos'
  });

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

  // Calcular estatísticas
  const stats = useMemo(() => {
    const total = processos.length;
    const ativos = processos.filter(p => p.status === 'ativo').length;
    const comoAutor = processos.filter(p => p.natureza === 'autor').length;
    const comoReu = processos.filter(p => p.natureza === 'reu').length;
    const encerrados = processos.filter(p => 
      ['encerrado_procedente', 'encerrado_improcedente', 'acordo', 'extinto', 'arquivado'].includes(p.status)
    ).length;
    
    return { total, ativos, comoAutor, comoReu, encerrados };
  }, [processos]);

  const handleFilterChange = (key: keyof ProcessoFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

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
      <div className="grid grid-cols-5 gap-4">
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
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{isLoading ? '-' : stats.comoReu}</p>
              <p className="text-sm text-muted-foreground">Como Réu</p>
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
        <Select value={filters.status} onValueChange={(v) => handleFilterChange('status', v)}>
          <SelectTrigger className="w-[180px]">
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
          <SelectTrigger className="w-[180px]">
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
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Natureza" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as Naturezas</SelectItem>
            {Object.entries(NATUREZA_PROCESSO_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
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
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : processos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhum processo encontrado
                  </TableCell>
                </TableRow>
              ) : (
                processos.map((processo) => (
                  <TableRow key={processo.id}>
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
    </div>
  );
}

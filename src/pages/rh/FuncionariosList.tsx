import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Users, Search, Plus, LayoutGrid, List, Eye, Edit } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Skeleton } from '@/components/ui/skeleton';

const statusConfig: Record<string, { label: string; className: string }> = {
  ativo: { label: 'Ativo', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  ferias: { label: 'Férias', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  afastado: { label: 'Afastado', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
  licenca: { label: 'Licença', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' },
  desligado: { label: 'Desligado', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
};

const FuncionariosList = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<string>('lista');
  const [filters, setFilters] = useState({
    busca: '',
    status: 'todos',
    departamento: ''
  });

  const { data: funcionarios, isLoading } = useQuery({
    queryKey: ['funcionarios', filters],
    queryFn: async () => {
      let query = supabase
        .from('funcionarios')
        .select(`
          *,
          cargo:cargos(nome),
          departamento:departamentos(nome)
        `)
        .order('nome_completo');

      if (filters.status && filters.status !== 'todos') {
        query = query.eq('status', filters.status);
      }
      if (filters.departamento) {
        query = query.eq('departamento_id', filters.departamento);
      }
      if (filters.busca) {
        query = query.or(`nome_completo.ilike.%${filters.busca}%,cpf.ilike.%${filters.busca}%,matricula.ilike.%${filters.busca}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const { data: departamentos } = useQuery({
    queryKey: ['departamentos-select'],
    queryFn: async () => {
      const { data } = await supabase.from('departamentos').select('id, nome').eq('ativo', true);
      return data;
    }
  });

  const getInitials = (nome: string) => {
    return nome?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '??';
  };

  const formatCPF = (cpf: string) => {
    return cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') || '-';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Funcionários</h1>
            <p className="text-muted-foreground text-sm">
              {funcionarios?.length || 0} funcionários cadastrados
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v)}>
            <ToggleGroupItem value="lista" aria-label="Lista">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="cards" aria-label="Cards">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          <Button onClick={() => navigate('/rh/funcionarios/novo')}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Funcionário
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CPF ou matrícula..."
                value={filters.busca}
                onChange={(e) => setFilters(prev => ({ ...prev, busca: e.target.value }))}
                className="pl-9"
              />
            </div>
            <Select
              value={filters.departamento}
              onValueChange={(value) => setFilters(prev => ({ ...prev, departamento: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos os departamentos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os departamentos</SelectItem>
                {departamentos?.map((dep) => (
                  <SelectItem key={dep.id} value={dep.id}>{dep.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="ferias">Férias</SelectItem>
                <SelectItem value="afastado">Afastado</SelectItem>
                <SelectItem value="licenca">Licença</SelectItem>
                <SelectItem value="desligado">Desligado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {/* Lista */}
      {!isLoading && viewMode === 'lista' && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Admissão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {funcionarios?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum funcionário encontrado
                  </TableCell>
                </TableRow>
              )}
              {funcionarios?.map((funcionario) => (
                <TableRow key={funcionario.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={funcionario.foto_url || ''} />
                        <AvatarFallback>{getInitials(funcionario.nome_completo)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{funcionario.nome_completo}</p>
                        <p className="text-sm text-muted-foreground">{funcionario.matricula}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{formatCPF(funcionario.cpf)}</TableCell>
                  <TableCell>{funcionario.cargo?.nome || '-'}</TableCell>
                  <TableCell>{funcionario.departamento?.nome || '-'}</TableCell>
                  <TableCell>
                    {funcionario.data_admissao 
                      ? format(parseISO(funcionario.data_admissao), 'dd/MM/yyyy') 
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusConfig[funcionario.status]?.className || ''}>
                      {statusConfig[funcionario.status]?.label || funcionario.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => navigate(`/rh/funcionarios/${funcionario.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => navigate(`/rh/funcionarios/${funcionario.id}/editar`)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Cards */}
      {!isLoading && viewMode === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {funcionarios?.length === 0 && (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              Nenhum funcionário encontrado
            </div>
          )}
          {funcionarios?.map((funcionario) => (
            <Card 
              key={funcionario.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/rh/funcionarios/${funcionario.id}`)}
            >
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <Avatar className="h-16 w-16 mb-3">
                    <AvatarImage src={funcionario.foto_url || ''} />
                    <AvatarFallback className="text-lg">{getInitials(funcionario.nome_completo)}</AvatarFallback>
                  </Avatar>
                  <h3 className="font-semibold">{funcionario.nome_completo}</h3>
                  <p className="text-sm text-muted-foreground">{funcionario.cargo?.nome || '-'}</p>
                  <p className="text-xs text-muted-foreground">{funcionario.departamento?.nome || '-'}</p>
                  <Badge className={`mt-3 ${statusConfig[funcionario.status]?.className || ''}`}>
                    {statusConfig[funcionario.status]?.label || funcionario.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default FuncionariosList;

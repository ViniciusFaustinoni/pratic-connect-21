import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Search, Plus, Star, Truck, MapPin, CheckCircle,
  XCircle, Eye, Pencil, Users,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { NovoPrestadorModal } from '@/components/assistencia/NovoPrestadorModal';
import { ImportarPrestadoresDialog } from '@/components/assistencia/ImportarPrestadoresDialog';

interface Prestador {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  cpf: string | null;
  telefone: string | null;
  cidade: string;
  estado: string;
  tipos_servico: string[] | null;
  nota_media: number | null;
  total_atendimentos: number | null;
  status: string | null;
  disponivel: boolean | null;
}

const statusOptions = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'ativo', label: 'Ativo' },
  { value: 'inativo', label: 'Inativo' },
  { value: 'suspenso', label: 'Suspenso' },
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

const statusConfig: Record<string, { label: string; className: string }> = {
  ativo: { label: 'Ativo', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  inativo: { label: 'Inativo', className: 'bg-muted text-muted-foreground' },
  suspenso: { label: 'Suspenso', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
};

const tiposServicoConfig: Record<string, string> = {
  reboque: 'Reboque',
  chaveiro: 'Chaveiro',
  troca_pneu: 'Troca Pneu',
  pane_seca: 'Pane Seca',
  bateria: 'Bateria',
  outro: 'Outros',
};

const formatCNPJ = (cnpj: string) => {
  const cleaned = cnpj.replace(/\D/g, '');
  return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

const formatCPF = (cpf: string) => {
  const cleaned = cpf.replace(/\D/g, '');
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

export default function PrestadoresList() {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingPrestador, setEditingPrestador] = useState<Prestador | null>(null);
  const [filters, setFilters] = useState({
    status: 'todos',
    tipo: 'todos',
    cidade: '',
    busca: '',
  });

  const { data: metricas } = useQuery({
    queryKey: ['prestadores-metricas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prestadores_assistencia')
        .select('id, status, disponivel, nota_media');
      
      if (error) throw error;
      
      const notasValidas = data.filter(p => p.nota_media !== null);
      const mediaGeral = notasValidas.length > 0 
        ? notasValidas.reduce((acc, p) => acc + (p.nota_media || 0), 0) / notasValidas.length 
        : 0;
      
      return {
        total: data.length,
        ativos: data.filter(p => p.status === 'ativo').length,
        disponiveis: data.filter(p => p.disponivel === true && p.status === 'ativo').length,
        mediaAvaliacao: mediaGeral,
      };
    },
  });

  const { data: prestadores, isLoading } = useQuery({
    queryKey: ['prestadores', filters],
    queryFn: async () => {
      let query = supabase
        .from('prestadores_assistencia')
        .select('*')
        .order('nome_fantasia', { ascending: true, nullsFirst: false });
      
      if (filters.status !== 'todos') {
        query = query.eq('status', filters.status);
      }
      if (filters.tipo !== 'todos') {
        query = query.contains('tipos_servico', [filters.tipo]);
      }
      if (filters.cidade) {
        query = query.ilike('cidade', `%${filters.cidade}%`);
      }
      if (filters.busca) {
        query = query.or(`razao_social.ilike.%${filters.busca}%,nome_fantasia.ilike.%${filters.busca}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Prestador[];
    },
  });

  const handleClearFilters = () => {
    setFilters({ status: 'todos', tipo: 'todos', cidade: '', busca: '' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Prestadores de Serviço</h1>
          <p className="text-muted-foreground">Gerencie os prestadores de assistência 24h</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar
          </Button>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Prestador
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Truck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metricas?.total || 0}</p>
                <p className="text-sm text-muted-foreground">Total de Prestadores</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metricas?.ativos || 0}</p>
                <p className="text-sm text-muted-foreground">Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metricas?.disponiveis || 0}</p>
                <p className="text-sm text-muted-foreground">Disponíveis Agora</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                <Star className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metricas?.mediaAvaliacao?.toFixed(1) || '0.0'}</p>
                <p className="text-sm text-muted-foreground">Média de Avaliação</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome..."
                className="pl-9"
                value={filters.busca}
                onChange={(e) => setFilters({ ...filters, busca: e.target.value })}
              />
            </div>
            
            <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={filters.tipo} onValueChange={(v) => setFilters({ ...filters, tipo: v })}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo de Serviço" />
              </SelectTrigger>
              <SelectContent>
                {tipoOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div className="relative w-[200px]">
              <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cidade..."
                className="pl-9"
                value={filters.cidade}
                onChange={(e) => setFilters({ ...filters, cidade: e.target.value })}
              />
            </div>
            
            <Button variant="outline" onClick={handleClearFilters}>
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ/CPF</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead>Tipos de Serviço</TableHead>
                <TableHead className="text-center">Disponível</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead className="text-center">Atendimentos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
              
              {!isLoading && prestadores?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Truck className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">Nenhum prestador encontrado</p>
                      <Button variant="outline" size="sm" onClick={handleClearFilters}>
                        Limpar filtros
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              
              {!isLoading && prestadores?.map((prestador) => (
                <TableRow key={prestador.id}>
                  <TableCell className="font-medium">
                    {prestador.nome_fantasia || prestador.razao_social}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {prestador.cnpj 
                      ? formatCNPJ(prestador.cnpj) 
                      : prestador.cpf 
                        ? formatCPF(prestador.cpf) 
                        : '-'
                    }
                  </TableCell>
                  <TableCell>
                    {prestador.cidade}/{prestador.estado}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {prestador.tipos_servico?.slice(0, 2).map((tipo) => (
                        <Badge key={tipo} variant="outline" className="text-xs">
                          {tiposServicoConfig[tipo] || tipo}
                        </Badge>
                      ))}
                      {(prestador.tipos_servico?.length || 0) > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{(prestador.tipos_servico?.length || 0) - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {prestador.disponivel ? (
                      <CheckCircle className="h-5 w-5 text-green-600 mx-auto" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 mx-auto" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      <span>{prestador.nota_media?.toFixed(1) || '0.0'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {prestador.total_atendimentos || 0}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusConfig[prestador.status || 'ativo']?.className || 'bg-muted'}>
                      {statusConfig[prestador.status || 'ativo']?.label || prestador.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/assistencia/prestadores/${prestador.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditingPrestador(prestador)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de Novo Prestador */}
      <NovoPrestadorModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />

      {/* Modal de Editar Prestador */}
      <ImportarPrestadoresDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />

      <NovoPrestadorModal
        open={!!editingPrestador}
        onClose={() => setEditingPrestador(null)}
        prestador={editingPrestador}
      />
    </div>
  );
}

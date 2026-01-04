import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Plus, Search, Target, MoreVertical, Play, Pause, Eye, Edit,
  Megaphone, CheckCircle, XCircle, Clock
} from 'lucide-react';
import { useCampanhas, useCanais, useUpdateCampanha } from '@/hooks/useMarketing';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CampanhaFormDialog } from '@/components/marketing/CampanhaFormDialog';

const statusConfig: Record<string, { label: string; className: string }> = {
  rascunho: { label: 'Rascunho', className: 'bg-gray-100 text-gray-800' },
  agendada: { label: 'Agendada', className: 'bg-blue-100 text-blue-800' },
  ativa: { label: 'Ativa', className: 'bg-green-100 text-green-800' },
  pausada: { label: 'Pausada', className: 'bg-yellow-100 text-yellow-800' },
  finalizada: { label: 'Finalizada', className: 'bg-purple-100 text-purple-800' },
  cancelada: { label: 'Cancelada', className: 'bg-red-100 text-red-800' },
};

const tipoConfig: Record<string, { label: string; className: string }> = {
  aquisicao: { label: 'Aquisição', className: 'bg-blue-100 text-blue-800' },
  reativacao: { label: 'Reativação', className: 'bg-orange-100 text-orange-800' },
  indicacao: { label: 'Indicação', className: 'bg-pink-100 text-pink-800' },
  remarketing: { label: 'Remarketing', className: 'bg-purple-100 text-purple-800' },
  branding: { label: 'Branding', className: 'bg-cyan-100 text-cyan-800' },
  promocional: { label: 'Promocional', className: 'bg-green-100 text-green-800' },
  sazonal: { label: 'Sazonal', className: 'bg-amber-100 text-amber-800' },
};

export default function Campanhas() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [tipoFilter, setTipoFilter] = useState<string>('');
  const [showForm, setShowForm] = useState(false);

  const { data: campanhas, isLoading } = useCampanhas({ 
    status: statusFilter || undefined,
  });
  const { data: canais } = useCanais();
  const updateCampanha = useUpdateCampanha();

  // Filtrar por busca e tipo
  const filteredCampanhas = campanhas?.filter(c => {
    const matchSearch = c.nome.toLowerCase().includes(search.toLowerCase()) ||
      c.codigo?.toLowerCase().includes(search.toLowerCase());
    const matchTipo = !tipoFilter || c.tipo === tipoFilter;
    return matchSearch && matchTipo;
  });

  // Contagem por status
  const contagem = campanhas?.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const handleToggleStatus = (campanha: any) => {
    const newStatus = campanha.status === 'ativa' ? 'pausada' : 'ativa';
    updateCampanha.mutate({ id: campanha.id, status: newStatus });
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campanhas</h1>
          <p className="text-muted-foreground">
            Gerencie suas campanhas de marketing
          </p>
        </div>
        <Button onClick={() => navigate('/marketing/campanhas/nova')}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Campanha
        </Button>
      </div>

      {/* Cards Resumo */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Megaphone className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{campanhas?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700">{contagem.ativa || 0}</p>
                <p className="text-xs text-muted-foreground">Ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-700">{contagem.pausada || 0}</p>
                <p className="text-xs text-muted-foreground">Pausadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-100">
                <XCircle className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-700">{contagem.finalizada || 0}</p>
                <p className="text-xs text-muted-foreground">Finalizadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou código..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos os status</SelectItem>
                {Object.entries(statusConfig).map(([value, { label }]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos os tipos</SelectItem>
                {Object.entries(tipoConfig).map(([value, { label }]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Campanhas */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : filteredCampanhas?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium">Nenhuma campanha encontrada</p>
            <p className="text-muted-foreground">
              Crie sua primeira campanha de marketing
            </p>
            <Button className="mt-4" onClick={() => navigate('/marketing/campanhas/nova')}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Campanha
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código / Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-center">Leads | Conv.</TableHead>
                  <TableHead>Investido / Orçamento</TableHead>
                  <TableHead className="text-right">CPL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCampanhas?.map((campanha: any) => {
                  const metricas = (campanha as any).metricas;
                  const totalLeads = metricas?.reduce((sum: number, m: any) => sum + (m.leads || 0), 0) || 0;
                  const totalConversoes = metricas?.reduce((sum: number, m: any) => sum + (m.conversoes || 0), 0) || 0;
                  const totalGasto = metricas?.reduce((sum: number, m: any) => sum + (m.valor_gasto || 0), 0) || campanha.valor_gasto || 0;
                  const cpl = totalLeads > 0 ? totalGasto / totalLeads : 0;
                  const progressoOrcamento = campanha.orcamento_total ? (totalGasto / campanha.orcamento_total) * 100 : 0;

                  return (
                    <TableRow 
                      key={campanha.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/marketing/campanhas/${campanha.id}`)}
                    >
                      <TableCell>
                        <div className="font-medium">{campanha.nome}</div>
                        <div className="text-xs text-muted-foreground">{campanha.codigo}</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={tipoConfig[campanha.tipo]?.className || 'bg-gray-100 text-gray-800'}>
                          {tipoConfig[campanha.tipo]?.label || campanha.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {campanha.canal?.nome || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(campanha.data_inicio), 'dd/MM/yy', { locale: ptBR })}
                        {campanha.data_fim && ` - ${format(new Date(campanha.data_fim), 'dd/MM/yy', { locale: ptBR })}`}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium">{totalLeads}</span>
                        <span className="text-muted-foreground"> | </span>
                        <span className="font-medium text-green-600">{totalConversoes}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={Math.min(progressoOrcamento, 100)} className="w-20 h-2" />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            R$ {totalGasto.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} / {(campanha.orcamento_total || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        R$ {cpl.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusConfig[campanha.status]?.className}>
                          {statusConfig[campanha.status]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/marketing/campanhas/${campanha.id}`)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/marketing/campanhas/${campanha.id}/editar`)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            {campanha.status === 'ativa' ? (
                              <DropdownMenuItem onClick={() => handleToggleStatus(campanha)}>
                                <Pause className="mr-2 h-4 w-4" />
                                Pausar
                              </DropdownMenuItem>
                            ) : campanha.status === 'pausada' && (
                              <DropdownMenuItem onClick={() => handleToggleStatus(campanha)}>
                                <Play className="mr-2 h-4 w-4" />
                                Ativar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <CampanhaFormDialog 
        open={showForm} 
        onClose={() => setShowForm(false)} 
      />
    </div>
  );
}

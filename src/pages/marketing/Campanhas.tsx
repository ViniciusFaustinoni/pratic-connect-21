import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, Search, Calendar, Target, TrendingUp,
  MoreVertical, Play, Pause, Eye
} from 'lucide-react';
import { useCampanhas, useCanais, useUpdateCampanha } from '@/hooks/useMarketing';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CampanhaFormDialog } from '@/components/marketing/CampanhaFormDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const statusConfig: Record<string, { label: string; className: string }> = {
  rascunho: { label: 'Rascunho', className: 'bg-gray-100 text-gray-800' },
  agendada: { label: 'Agendada', className: 'bg-blue-100 text-blue-800' },
  ativa: { label: 'Ativa', className: 'bg-green-100 text-green-800' },
  pausada: { label: 'Pausada', className: 'bg-yellow-100 text-yellow-800' },
  finalizada: { label: 'Finalizada', className: 'bg-purple-100 text-purple-800' },
  cancelada: { label: 'Cancelada', className: 'bg-red-100 text-red-800' },
};

const tipoConfig: Record<string, string> = {
  aquisicao: 'Aquisição',
  reativacao: 'Reativação',
  indicacao: 'Indicação',
  branding: 'Branding',
  promocional: 'Promocional',
  sazonal: 'Sazonal',
  remarketing: 'Remarketing',
};

export default function Campanhas() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [canalFilter, setCanalFilter] = useState<string>('');
  const [showForm, setShowForm] = useState(false);

  const { data: campanhas, isLoading } = useCampanhas({ 
    status: statusFilter || undefined,
    canal_id: canalFilter || undefined,
  });
  const { data: canais } = useCanais();
  const updateCampanha = useUpdateCampanha();

  const filteredCampanhas = campanhas?.filter(c => 
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.codigo.toLowerCase().includes(search.toLowerCase())
  );

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
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Campanha
        </Button>
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
                <SelectItem value="">Todos</SelectItem>
                {Object.entries(statusConfig).map(([value, { label }]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={canalFilter} onValueChange={setCanalFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos os canais</SelectItem>
                {canais?.map(canal => (
                  <SelectItem key={canal.id} value={canal.id}>{canal.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Campanhas */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : filteredCampanhas?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium">Nenhuma campanha encontrada</p>
            <p className="text-muted-foreground">
              Crie sua primeira campanha de marketing
            </p>
            <Button className="mt-4" onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Campanha
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCampanhas?.map(campanha => (
            <Card key={campanha.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">{campanha.codigo}</p>
                    <CardTitle className="text-base truncate">{campanha.nome}</CardTitle>
                  </div>
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
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={statusConfig[campanha.status]?.className}>
                    {statusConfig[campanha.status]?.label}
                  </Badge>
                  <Badge variant="outline">
                    {tipoConfig[campanha.tipo] || campanha.tipo}
                  </Badge>
                </div>

                <div className="text-sm text-muted-foreground space-y-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {format(new Date(campanha.data_inicio), 'dd/MM/yyyy', { locale: ptBR })}
                      {campanha.data_fim && ` - ${format(new Date(campanha.data_fim), 'dd/MM/yyyy', { locale: ptBR })}`}
                    </span>
                  </div>
                  {campanha.canal && (
                    <div className="flex items-center gap-2">
                      <Target className="h-3.5 w-3.5" />
                      <span>{campanha.canal.nome}</span>
                    </div>
                  )}
                </div>

                {campanha.orcamento_total && (
                  <div className="pt-2 border-t">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Orçamento</span>
                      <span className="font-medium">
                        R$ {campanha.orcamento_total.toLocaleString('pt-BR')}
                      </span>
                    </div>
                    {campanha.valor_gasto > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Gasto</span>
                        <span className="font-medium text-orange-600">
                          R$ {campanha.valor_gasto.toLocaleString('pt-BR')}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {campanha.meta_leads && (
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Meta: {campanha.meta_leads} leads</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CampanhaFormDialog 
        open={showForm} 
        onClose={() => setShowForm(false)} 
      />
    </div>
  );
}

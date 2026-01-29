import { useState } from 'react';
import { 
  GraduationCap, 
  Plus, 
  Search, 
  Calendar, 
  Clock, 
  Users, 
  MapPin,
  Video,
  Filter,
  MoreVertical,
  CheckCircle2,
  PlayCircle,
  Pause,
  Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, isPast, isFuture } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TreinamentoFormModal } from '@/components/rh/TreinamentoFormModal';

const statusConfig = {
  planejado: { label: 'Planejado', color: 'bg-gray-500', icon: Pause },
  programado: { label: 'Programado', color: 'bg-blue-500', icon: Calendar },
  em_andamento: { label: 'Em Andamento', color: 'bg-yellow-500', icon: PlayCircle },
  concluido: { label: 'Concluído', color: 'bg-green-500', icon: CheckCircle2 },
  cancelado: { label: 'Cancelado', color: 'bg-red-500', icon: Pause },
};

const tipoConfig = {
  obrigatorio: { label: 'Obrigatório', color: 'destructive' },
  capacitacao: { label: 'Capacitação', color: 'default' },
  desenvolvimento: { label: 'Desenvolvimento', color: 'secondary' },
};

const modalidadeConfig = {
  presencial: { label: 'Presencial', icon: MapPin },
  online: { label: 'Online', icon: Video },
  hibrido: { label: 'Híbrido', icon: Users },
};

export default function Treinamentos() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [tipoFilter, setTipoFilter] = useState<string>('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTreinamento, setSelectedTreinamento] = useState<any>(null);

  // Buscar treinamentos
  const { data: treinamentos, isLoading } = useQuery({
    queryKey: ['treinamentos', search, statusFilter, tipoFilter],
    queryFn: async () => {
      let query = supabase
        .from('treinamentos')
        .select('*')
        .order('data_inicio', { ascending: false });

      if (search) {
        query = query.ilike('nome', `%${search}%`);
      }
      if (statusFilter !== 'todos') {
        query = query.eq('status_treinamento', statusFilter);
      }
      if (tipoFilter !== 'todos') {
        query = query.eq('tipo', tipoFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Buscar participantes separadamente
      if (data && data.length > 0) {
        const ids = data.map(t => t.id);
        const { data: participantes } = await supabase
          .from('treinamentos_participantes')
          .select('treinamento_id, id, status_participante, funcionario_id')
          .in('treinamento_id', ids);
        
        return data.map(t => ({
          ...t,
          participantes: participantes?.filter(p => p.treinamento_id === t.id) || []
        }));
      }
      
      return data?.map(t => ({ ...t, participantes: [] })) || [];
    }
  });

  // Estatísticas
  const { data: stats } = useQuery({
    queryKey: ['treinamentos-stats'],
    queryFn: async () => {
      const { data } = await supabase
        .from('treinamentos')
        .select('status_treinamento, carga_horaria');
      
      const ativos = data?.filter(t => ['programado', 'em_andamento'].includes(t.status_treinamento || '')).length || 0;
      const concluidos = data?.filter(t => t.status_treinamento === 'concluido').length || 0;
      const totalHoras = data?.reduce((acc, t) => acc + (t.carga_horaria || 0), 0) || 0;
      
      return { ativos, concluidos, totalHoras, total: data?.length || 0 };
    }
  });

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.planejado;
    return (
      <Badge variant="outline" className="gap-1">
        <span className={`w-2 h-2 rounded-full ${config.color}`} />
        {config.label}
      </Badge>
    );
  };

  const handleEdit = (treinamento: any) => {
    setSelectedTreinamento(treinamento);
    setModalOpen(true);
  };

  const handleNew = () => {
    setSelectedTreinamento(null);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Treinamentos</h1>
          <p className="text-muted-foreground">Gestão de capacitações e desenvolvimento</p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Treinamento
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Treinamentos</p>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
              </div>
              <GraduationCap className="h-8 w-8 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Em Andamento</p>
                <p className="text-2xl font-bold text-yellow-600">{stats?.ativos || 0}</p>
              </div>
              <PlayCircle className="h-8 w-8 text-yellow-600 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Concluídos</p>
                <p className="text-2xl font-bold text-green-600">{stats?.concluidos || 0}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Horas Totais</p>
                <p className="text-2xl font-bold">{stats?.totalHoras || 0}h</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar treinamentos..." 
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                {Object.entries(statusConfig).map(([key, value]) => (
                  <SelectItem key={key} value={key}>{value.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Tipos</SelectItem>
                {Object.entries(tipoConfig).map(([key, value]) => (
                  <SelectItem key={key} value={key}>{value.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Treinamentos */}
      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : treinamentos?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum treinamento encontrado</p>
            <Button variant="outline" className="mt-4" onClick={handleNew}>
              Criar Primeiro Treinamento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {treinamentos?.map((treinamento) => {
            const tipoInfo = tipoConfig[treinamento.tipo as keyof typeof tipoConfig];
            const modalidadeInfo = modalidadeConfig[treinamento.modalidade as keyof typeof modalidadeConfig];
            const totalParticipantes = treinamento.participantes?.length || 0;
            const aprovados = treinamento.participantes?.filter((p: any) => p.status_participante === 'aprovado').length || 0;
            const progressoPercent = totalParticipantes > 0 ? (aprovados / totalParticipantes) * 100 : 0;

            return (
              <Card key={treinamento.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg truncate">{treinamento.nome}</h3>
                        {tipoInfo && (
                          <Badge variant={tipoInfo.color as any}>{tipoInfo.label}</Badge>
                        )}
                        {getStatusBadge(treinamento.status_treinamento || 'planejado')}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-3">
                        {treinamento.data_inicio && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {format(parseISO(treinamento.data_inicio), "dd/MM/yyyy", { locale: ptBR })}
                            {treinamento.data_fim && ` - ${format(parseISO(treinamento.data_fim), "dd/MM/yyyy", { locale: ptBR })}`}
                          </div>
                        )}
                        {treinamento.carga_horaria && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {treinamento.carga_horaria}h
                          </div>
                        )}
                        {modalidadeInfo && (
                          <div className="flex items-center gap-1">
                            <modalidadeInfo.icon className="h-4 w-4" />
                            {modalidadeInfo.label}
                          </div>
                        )}
                        {treinamento.instrutor_nome && (
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {treinamento.instrutor_nome}
                          </div>
                        )}
                      </div>

                      {/* Participantes */}
                      <div className="flex items-center gap-4">
                        <div className="flex -space-x-2">
                          {treinamento.participantes?.slice(0, 5).map((p: any) => (
                            <Avatar key={p.id} className="h-8 w-8 border-2 border-background">
                              <AvatarImage src={p.funcionario?.foto_url} />
                              <AvatarFallback className="text-xs">
                                {p.funcionario?.nome_completo?.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {totalParticipantes > 5 && (
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center border-2 border-background text-xs font-medium">
                              +{totalParticipantes - 5}
                            </div>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {totalParticipantes} participante{totalParticipantes !== 1 ? 's' : ''}
                        </span>
                        {treinamento.status_treinamento === 'concluido' && totalParticipantes > 0 && (
                          <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                            <Progress value={progressoPercent} className="h-2" />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {aprovados}/{totalParticipantes} aprovados
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(treinamento)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Users className="h-4 w-4 mr-2" />
                          Gerenciar Participantes
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <TreinamentoFormModal 
        open={modalOpen} 
        onOpenChange={setModalOpen}
        treinamento={selectedTreinamento}
      />
    </div>
  );
}

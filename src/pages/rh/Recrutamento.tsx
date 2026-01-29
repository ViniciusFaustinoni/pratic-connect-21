import { useState } from 'react';
import { 
  Briefcase, 
  Plus, 
  Search, 
  Users, 
  Clock,
  MapPin,
  DollarSign,
  MoreVertical,
  Eye,
  UserPlus,
  Filter,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { VagaFormModal } from '@/components/rh/VagaFormModal';
import { CandidatoFormModal } from '@/components/rh/CandidatoFormModal';

const etapasKanban = [
  { id: 'triagem', label: 'Triagem', color: 'bg-gray-500' },
  { id: 'entrevista_rh', label: 'Entrevista RH', color: 'bg-blue-500' },
  { id: 'entrevista_gestor', label: 'Entrevista Gestor', color: 'bg-purple-500' },
  { id: 'proposta', label: 'Proposta', color: 'bg-yellow-500' },
  { id: 'contratado', label: 'Contratado', color: 'bg-green-500' },
];

const statusVagaConfig = {
  aberta: { label: 'Aberta', color: 'default' },
  em_andamento: { label: 'Em Andamento', color: 'secondary' },
  encerrada: { label: 'Encerrada', color: 'outline' },
  cancelada: { label: 'Cancelada', color: 'destructive' },
};

const urgenciaConfig = {
  baixa: { label: 'Baixa', color: 'secondary' },
  normal: { label: 'Normal', color: 'default' },
  alta: { label: 'Alta', color: 'destructive' },
  urgente: { label: 'Urgente', color: 'destructive' },
};

export default function Recrutamento() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('aberta');
  const [vagaModalOpen, setVagaModalOpen] = useState(false);
  const [candidatoModalOpen, setCandidatoModalOpen] = useState(false);
  const [selectedVaga, setSelectedVaga] = useState<any>(null);
  const [selectedVagaId, setSelectedVagaId] = useState<string | null>(null);

  // Buscar vagas
  const { data: vagas, isLoading: loadingVagas } = useQuery({
    queryKey: ['vagas', search, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('vagas')
        .select('*')
        .order('created_at', { ascending: false });

      if (search) {
        query = query.ilike('titulo', `%${search}%`);
      }
      if (statusFilter !== 'todos') {
        query = query.eq('status_vaga', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Buscar departamentos e candidatos separadamente
      if (data && data.length > 0) {
        const depIds = data.map(v => v.departamento_id).filter(Boolean);
        const vagaIds = data.map(v => v.id);
        
        const [depsResult, candidatosResult] = await Promise.all([
          depIds.length > 0 
            ? supabase.from('departamentos').select('id, nome').in('id', depIds)
            : { data: [] },
          supabase.from('candidatos').select('id, nome, etapa, status_candidato, vaga_id').in('vaga_id', vagaIds)
        ]);
        
        const depsMap = new Map<string, { id: string; nome: string }>(depsResult.data?.map(d => [d.id, d] as [string, { id: string; nome: string }]) || []);
        
        return data.map(v => ({
          ...v,
          departamento: depsMap.get(v.departamento_id),
          candidatos: candidatosResult.data?.filter(c => c.vaga_id === v.id) || []
        }));
      }
      
      return data?.map(v => ({ ...v, departamento: null, candidatos: [] })) || [];
    }
  });

  // Buscar candidatos para o Kanban
  const { data: candidatos, isLoading: loadingCandidatos } = useQuery({
    queryKey: ['candidatos-kanban', selectedVagaId],
    queryFn: async () => {
      if (!selectedVagaId) return [];
      
      const { data, error } = await supabase
        .from('candidatos')
        .select('*')
        .eq('vaga_id', selectedVagaId)
        .eq('status_candidato', 'ativo')
        .order('created_at');

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedVagaId
  });

  // Estatísticas
  const { data: stats } = useQuery({
    queryKey: ['recrutamento-stats'],
    queryFn: async () => {
      const [vagasResult, candidatosResult] = await Promise.all([
        supabase.from('vagas').select('status_vaga'),
        supabase.from('candidatos').select('etapa, status_candidato')
      ]);

      const vagasAbertas = vagasResult.data?.filter(v => v.status_vaga === 'aberta').length || 0;
      const candidatosAtivos = candidatosResult.data?.filter(c => c.status_candidato === 'ativo').length || 0;
      const contratados = candidatosResult.data?.filter(c => c.etapa === 'contratado').length || 0;

      return { vagasAbertas, candidatosAtivos, contratados };
    }
  });

  const handleEditVaga = (vaga: any) => {
    setSelectedVaga(vaga);
    setVagaModalOpen(true);
  };

  const handleNewVaga = () => {
    setSelectedVaga(null);
    setVagaModalOpen(true);
  };

  const handleAddCandidato = (vagaId: string) => {
    setSelectedVagaId(vagaId);
    setCandidatoModalOpen(true);
  };

  const handleSelectVaga = (vagaId: string) => {
    setSelectedVagaId(selectedVagaId === vagaId ? null : vagaId);
  };

  const formatSalario = (min?: number, max?: number) => {
    if (!min && !max) return null;
    const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
    if (min && max) return `${formatter.format(min)} - ${formatter.format(max)}`;
    if (min) return `A partir de ${formatter.format(min)}`;
    if (max) return `Até ${formatter.format(max)}`;
    return null;
  };

  const candidatosPorEtapa = (etapa: string) => {
    return candidatos?.filter(c => c.etapa === etapa) || [];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recrutamento</h1>
          <p className="text-muted-foreground">Gestão de vagas e candidatos</p>
        </div>
        <Button onClick={handleNewVaga}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Vaga
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Vagas Abertas</p>
                <p className="text-2xl font-bold">{stats?.vagasAbertas || 0}</p>
              </div>
              <Briefcase className="h-8 w-8 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Candidatos em Processo</p>
                <p className="text-2xl font-bold text-blue-600">{stats?.candidatosAtivos || 0}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Contratados (mês)</p>
                <p className="text-2xl font-bold text-green-600">{stats?.contratados || 0}</p>
              </div>
              <UserPlus className="h-8 w-8 text-green-600 opacity-80" />
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
                placeholder="Buscar vagas..." 
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
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(statusVagaConfig).map(([key, value]) => (
                  <SelectItem key={key} value={key}>{value.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Vagas */}
      <div className="grid gap-4">
        <h2 className="text-lg font-semibold">Vagas</h2>
        
        {loadingVagas ? (
          <div className="grid gap-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : vagas?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma vaga encontrada</p>
              <Button variant="outline" className="mt-4" onClick={handleNewVaga}>
                Criar Primeira Vaga
              </Button>
            </CardContent>
          </Card>
        ) : (
          vagas?.map((vaga) => {
            const totalCandidatos = vaga.candidatos?.filter((c: any) => c.status_candidato === 'ativo').length || 0;
            const urgencia = urgenciaConfig[vaga.urgencia as keyof typeof urgenciaConfig];
            const isSelected = selectedVagaId === vaga.id;

            return (
              <Card 
                key={vaga.id} 
                className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
                onClick={() => handleSelectVaga(vaga.id)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">{vaga.codigo}</Badge>
                        <h3 className="font-semibold truncate">{vaga.titulo}</h3>
                        {urgencia && (
                          <Badge variant={urgencia.color as any} className="text-xs">
                            {urgencia.label}
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        {vaga.departamento?.nome && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {vaga.departamento.nome}
                          </span>
                        )}
                        {vaga.tipo_contrato && (
                          <Badge variant="secondary" className="text-xs">
                            {vaga.tipo_contrato.toUpperCase()}
                          </Badge>
                        )}
                        {formatSalario(vaga.salario_min, vaga.salario_max) && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {formatSalario(vaga.salario_min, vaga.salario_max)}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {totalCandidatos} candidato{totalCandidatos !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddCandidato(vaga.id);
                        }}
                      >
                        <UserPlus className="h-4 w-4 mr-1" />
                        Candidato
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditVaga(vaga)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Editar Vaga
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Kanban de Candidatos */}
      {selectedVagaId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Pipeline de Candidatos - {vagas?.find(v => v.id === selectedVagaId)?.titulo}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="w-full">
              <div className="flex gap-4 pb-4 min-w-max">
                {etapasKanban.map((etapa) => {
                  const candidatosEtapa = candidatosPorEtapa(etapa.id);
                  
                  return (
                    <div key={etapa.id} className="w-[280px] flex-shrink-0">
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`w-3 h-3 rounded-full ${etapa.color}`} />
                        <h4 className="font-medium text-sm">{etapa.label}</h4>
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {candidatosEtapa.length}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 min-h-[200px] bg-muted/30 rounded-lg p-2">
                        {loadingCandidatos ? (
                          <Skeleton className="h-20 w-full" />
                        ) : candidatosEtapa.length === 0 ? (
                          <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
                            Nenhum candidato
                          </div>
                        ) : (
                          candidatosEtapa.map((candidato) => (
                            <Card key={candidato.id} className="cursor-pointer hover:shadow-sm">
                              <CardContent className="p-3">
                                <div className="flex items-start gap-2">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="text-xs">
                                      {candidato.nome?.charAt(0)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{candidato.nome}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {candidato.email}
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <VagaFormModal 
        open={vagaModalOpen} 
        onOpenChange={setVagaModalOpen}
        vaga={selectedVaga}
      />

      <CandidatoFormModal 
        open={candidatoModalOpen} 
        onOpenChange={setCandidatoModalOpen}
        vagaId={selectedVagaId}
      />
    </div>
  );
}

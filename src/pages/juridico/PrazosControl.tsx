import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, differenceInDays, startOfDay, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Clock, AlertTriangle, Check, Calendar, Search, 
  ExternalLink, AlertCircle, CheckCircle, XCircle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

import { supabase } from '@/integrations/supabase/client';
import { PRIORIDADE_LABELS, PRIORIDADE_COLORS, TIPO_PROCESSO_LABELS } from '@/types/juridico';

interface PrazosFilters {
  busca: string;
  periodo: 'todos' | 'hoje' | 'semana' | 'mes' | 'vencidos';
  status: 'todos' | 'pendente' | 'cumprido' | 'perdido' | 'cancelado';
  prioridade: 'todos' | 'baixa' | 'normal' | 'alta' | 'urgente';
}

interface PrazoEnriquecido {
  id: string;
  descricao: string;
  data_inicio: string;
  data_fim: string;
  prioridade: string;
  status: string;
  observacao_cumprimento?: string;
  cumprido_em?: string;
  dias_uteis?: boolean;
  processo?: {
    id: string;
    numero: string;
    numero_processo?: string;
    parte_contraria_nome: string;
    tipo: string;
  };
  responsavel?: {
    id: string;
    nome: string;
  };
  diasRestantes: number;
  vencido: boolean;
}

const getDiasRestantesBadge = (dias: number, status: string) => {
  if (status === 'cumprido') return { label: 'Cumprido', className: 'bg-green-100 text-green-800' };
  if (status === 'perdido') return { label: 'Perdido', className: 'bg-red-100 text-red-800' };
  if (status === 'cancelado') return { label: 'Cancelado', className: 'bg-muted text-muted-foreground' };
  
  if (dias < 0) return { label: `${Math.abs(dias)}d atrasado`, className: 'bg-red-600 text-white' };
  if (dias === 0) return { label: 'Hoje', className: 'bg-red-500 text-white' };
  if (dias === 1) return { label: 'Amanhã', className: 'bg-orange-500 text-white' };
  if (dias <= 3) return { label: `${dias} dias`, className: 'bg-yellow-500 text-white' };
  if (dias <= 7) return { label: `${dias} dias`, className: 'bg-yellow-100 text-yellow-800' };
  return { label: `${dias} dias`, className: 'bg-green-100 text-green-800' };
};

const getStatusIcon = (prazo: PrazoEnriquecido) => {
  if (prazo.status === 'cumprido') {
    return <CheckCircle className="h-5 w-5 text-green-600" />;
  }
  if (prazo.status === 'perdido' || prazo.vencido) {
    return <XCircle className="h-5 w-5 text-red-600" />;
  }
  if (prazo.status === 'cancelado') {
    return <XCircle className="h-5 w-5 text-muted-foreground" />;
  }
  if (prazo.diasRestantes <= 3) {
    return <AlertCircle className="h-5 w-5 text-orange-500" />;
  }
  return <Clock className="h-5 w-5 text-yellow-500" />;
};

export default function PrazosControl() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<PrazosFilters>({
    busca: '',
    periodo: 'todos',
    status: 'todos',
    prioridade: 'todos'
  });

  const [cumprirModalOpen, setCumprirModalOpen] = useState(false);
  const [prazoSelecionado, setPrazoSelecionado] = useState<PrazoEnriquecido | null>(null);
  const [observacaoCumprimento, setObservacaoCumprimento] = useState('');

  // Query de prazos
  const { data: prazos = [], isLoading } = useQuery({
    queryKey: ['prazos-controle', filters.periodo, filters.status, filters.prioridade],
    queryFn: async () => {
      let query = supabase
        .from('processos_prazos')
        .select(`
          *,
          processo:processos(id, numero, numero_processo, parte_contraria_nome, tipo),
          responsavel:profiles!processos_prazos_responsavel_id_fkey(id, nome)
        `)
        .order('data_fim', { ascending: true });

      // Filtro de status
      if (filters.status && filters.status !== 'todos') {
        query = query.eq('status', filters.status);
      }
      
      // Filtro de prioridade
      if (filters.prioridade && filters.prioridade !== 'todos') {
        query = query.eq('prioridade', filters.prioridade);
      }
      
      // Filtro de período
      const today = startOfDay(new Date()).toISOString().split('T')[0];
      if (filters.periodo === 'hoje') {
        query = query.eq('data_fim', today);
      } else if (filters.periodo === 'semana') {
        const weekEnd = addDays(new Date(), 7).toISOString().split('T')[0];
        query = query.gte('data_fim', today).lte('data_fim', weekEnd);
      } else if (filters.periodo === 'mes') {
        const monthEnd = addDays(new Date(), 30).toISOString().split('T')[0];
        query = query.gte('data_fim', today).lte('data_fim', monthEnd);
      } else if (filters.periodo === 'vencidos') {
        query = query.lt('data_fim', today).eq('status', 'pendente');
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Enriquecer dados com cálculos
      return (data || []).map(p => ({
        ...p,
        diasRestantes: differenceInDays(new Date(p.data_fim), startOfDay(new Date())),
        vencido: new Date(p.data_fim) < startOfDay(new Date()) && p.status === 'pendente',
      })) as PrazoEnriquecido[];
    }
  });

  // Filtrar por busca (client-side)
  const prazosFiltrados = useMemo(() => {
    if (!filters.busca) return prazos;
    
    const termo = filters.busca.toLowerCase();
    return prazos.filter(p => 
      p.descricao?.toLowerCase().includes(termo) ||
      p.processo?.numero?.toLowerCase().includes(termo) ||
      p.processo?.numero_processo?.toLowerCase().includes(termo) ||
      p.processo?.parte_contraria_nome?.toLowerCase().includes(termo)
    );
  }, [prazos, filters.busca]);

  // Calcular métricas para cards
  const metricas = useMemo(() => {
    // Para métricas, queremos todos os prazos sem filtro de período
    return {
      vencidos: prazos.filter(p => p.vencido).length,
      hoje: prazos.filter(p => p.diasRestantes === 0 && p.status === 'pendente').length,
      semana: prazos.filter(p => p.diasRestantes > 0 && p.diasRestantes <= 7 && p.status === 'pendente').length,
      pendentes: prazos.filter(p => p.status === 'pendente').length,
    };
  }, [prazos]);

  // Mutation para cumprir prazo
  const cumprirMutation = useMutation({
    mutationFn: async ({ prazoId, observacao }: { prazoId: string; observacao?: string }) => {
      const { error } = await supabase
        .from('processos_prazos')
        .update({
          status: 'cumprido',
          cumprido_em: new Date().toISOString(),
          observacao_cumprimento: observacao,
          updated_at: new Date().toISOString(),
        })
        .eq('id', prazoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prazos-controle'] });
      toast.success('Prazo marcado como cumprido!');
      setCumprirModalOpen(false);
      setPrazoSelecionado(null);
      setObservacaoCumprimento('');
    },
    onError: (error) => {
      toast.error('Erro ao cumprir prazo: ' + error.message);
    }
  });

  const handleCumprir = (prazo: PrazoEnriquecido) => {
    setPrazoSelecionado(prazo);
    setObservacaoCumprimento('');
    setCumprirModalOpen(true);
  };

  const handleCardClick = (filtro: 'vencidos' | 'hoje' | 'semana' | 'pendentes') => {
    if (filtro === 'vencidos') {
      setFilters(prev => ({ ...prev, periodo: 'vencidos', status: 'todos' }));
    } else if (filtro === 'hoje') {
      setFilters(prev => ({ ...prev, periodo: 'hoje', status: 'todos' }));
    } else if (filtro === 'semana') {
      setFilters(prev => ({ ...prev, periodo: 'semana', status: 'todos' }));
    } else {
      setFilters(prev => ({ ...prev, periodo: 'todos', status: 'pendente' }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Controle de Prazos</h1>
        <p className="text-muted-foreground">
          Gerencie os prazos processuais e acompanhe vencimentos
        </p>
      </div>

      {/* Cards de Urgência */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card 
          className="cursor-pointer border-red-200 bg-red-50 hover:bg-red-100 transition-colors"
          onClick={() => handleCardClick('vencidos')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-800 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Vencidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{metricas.vencidos}</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer border-orange-200 bg-orange-50 hover:bg-orange-100 transition-colors"
          onClick={() => handleCardClick('hoje')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-800 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">{metricas.hoje}</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer border-yellow-200 bg-yellow-50 hover:bg-yellow-100 transition-colors"
          onClick={() => handleCardClick('semana')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-800 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Esta Semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-600">{metricas.semana}</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors"
          onClick={() => handleCardClick('pendentes')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-800 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{metricas.pendentes}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por processo ou descrição..."
                value={filters.busca}
                onChange={(e) => setFilters(prev => ({ ...prev, busca: e.target.value }))}
                className="pl-10"
              />
            </div>

            <Select 
              value={filters.periodo} 
              onValueChange={(v) => setFilters(prev => ({ ...prev, periodo: v as PrazosFilters['periodo'] }))}
            >
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="vencidos">Vencidos</SelectItem>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="semana">Esta Semana</SelectItem>
                <SelectItem value="mes">Este Mês</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={filters.status} 
              onValueChange={(v) => setFilters(prev => ({ ...prev, status: v as PrazosFilters['status'] }))}
            >
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="cumprido">Cumprido</SelectItem>
                <SelectItem value="perdido">Perdido</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={filters.prioridade} 
              onValueChange={(v) => setFilters(prev => ({ ...prev, prioridade: v as PrazosFilters['prioridade'] }))}
            >
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : prazosFiltrados.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum prazo encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">St</TableHead>
                  <TableHead>Processo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-28">Vencimento</TableHead>
                  <TableHead className="w-28">Dias</TableHead>
                  <TableHead className="w-24">Prioridade</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prazosFiltrados.map((prazo) => {
                  const diasBadge = getDiasRestantesBadge(prazo.diasRestantes, prazo.status);
                  const prioridadeLabel = PRIORIDADE_LABELS[prazo.prioridade as keyof typeof PRIORIDADE_LABELS] || prazo.prioridade;
                  const prioridadeColor = PRIORIDADE_COLORS[prazo.prioridade as keyof typeof PRIORIDADE_COLORS] || '';
                  
                  return (
                    <TableRow 
                      key={prazo.id}
                      className={prazo.vencido ? 'bg-red-50' : ''}
                    >
                      <TableCell>
                        {getStatusIcon(prazo)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {prazo.processo?.numero || 'Sem processo'}
                          </p>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {prazo.processo?.parte_contraria_nome || '-'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="line-clamp-2">{prazo.descricao}</p>
                      </TableCell>
                      <TableCell>
                        {format(new Date(prazo.data_fim), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge className={diasBadge.className}>
                          {diasBadge.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={prioridadeColor}>
                          {prioridadeLabel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {prazo.responsavel?.nome || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {prazo.status === 'pendente' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCumprir(prazo)}
                              title="Marcar como cumprido"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                          {prazo.processo && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/juridico/processos/${prazo.processo!.id}`)}
                              title="Ver processo"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal Cumprir Prazo */}
      <Dialog open={cumprirModalOpen} onOpenChange={setCumprirModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cumprir Prazo</DialogTitle>
          </DialogHeader>
          
          {prazoSelecionado && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{prazoSelecionado.descricao}</p>
                <p className="text-sm text-muted-foreground">
                  Processo: {prazoSelecionado.processo?.numero || 'N/A'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Vencimento: {format(new Date(prazoSelecionado.data_fim), 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="observacao">Observação (opcional)</Label>
                <Textarea 
                  id="observacao"
                  value={observacaoCumprimento}
                  onChange={(e) => setObservacaoCumprimento(e.target.value)}
                  placeholder="Descreva como o prazo foi cumprido..."
                  rows={3}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCumprirModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => prazoSelecionado && cumprirMutation.mutate({
                prazoId: prazoSelecionado.id,
                observacao: observacaoCumprimento || undefined
              })}
              disabled={cumprirMutation.isPending}
            >
              {cumprirMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Confirmar Cumprimento'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

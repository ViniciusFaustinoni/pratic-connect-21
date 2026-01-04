import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  HelpCircle, MessageSquare, Clock, Check,
  Plus, Search, Eye, Reply, Calendar, User, Building2
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

import { useConsultasJuridicas } from '@/hooks/useConsultasJuridicas';
import { 
  STATUS_CONSULTA_LABELS, 
  STATUS_CONSULTA_COLORS,
  PRIORIDADE_LABELS,
  PRIORIDADE_COLORS,
  StatusConsultaJuridica,
  PrioridadePrazo
} from '@/types/juridico';
import { ResponderConsultaModal } from '@/components/juridico/ResponderConsultaModal';

interface ConsultasFilters {
  busca: string;
  status: 'todos' | StatusConsultaJuridica;
}

interface ConsultaSelecionada {
  id: string;
  numero?: string | null;
  assunto: string;
  descricao: string;
  departamento?: string | null;
  prioridade?: string | null;
  parecer?: string | null;
  created_at?: string | null;
  solicitante?: { id: string; nome: string } | null;
}

export default function ConsultasJuridicas() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<ConsultasFilters>({
    busca: '',
    status: 'todos',
  });
  const [consultaSelecionada, setConsultaSelecionada] = useState<ConsultaSelecionada | null>(null);

  const { consultas, isLoading } = useConsultasJuridicas({
    status: filters.status !== 'todos' ? filters.status : undefined,
  });

  const consultasFiltradas = useMemo(() => {
    if (!filters.busca) return consultas;
    
    const termo = filters.busca.toLowerCase();
    return consultas.filter(c => 
      c.numero?.toLowerCase().includes(termo) ||
      c.assunto?.toLowerCase().includes(termo) ||
      c.descricao?.toLowerCase().includes(termo) ||
      (c.solicitante as any)?.nome?.toLowerCase().includes(termo)
    );
  }, [consultas, filters.busca]);

  const metricas = useMemo(() => {
    const inicioMes = startOfMonth(new Date());
    const fimMes = endOfMonth(new Date());
    
    return {
      pendentes: consultas.filter(c => c.status === 'pendente').length,
      emAnalise: consultas.filter(c => c.status === 'em_analise').length,
      respondidasMes: consultas.filter(c => 
        c.status === 'respondida' && 
        c.respondido_em &&
        isWithinInterval(new Date(c.respondido_em), { start: inicioMes, end: fimMes })
      ).length,
    };
  }, [consultas]);

  const getStatusBadge = (status: string) => {
    const colors = STATUS_CONSULTA_COLORS[status as StatusConsultaJuridica] || 'bg-gray-100 text-gray-800';
    const label = STATUS_CONSULTA_LABELS[status as StatusConsultaJuridica] || status;
    return <Badge className={colors}>{label}</Badge>;
  };

  const getPrioridadeBadge = (prioridade: string) => {
    const colors = PRIORIDADE_COLORS[prioridade as PrioridadePrazo] || 'bg-gray-100 text-gray-800';
    const label = PRIORIDADE_LABELS[prioridade as PrioridadePrazo] || prioridade;
    return <Badge className={colors}>{label}</Badge>;
  };

  const truncateText = (text: string, maxLength: number = 120) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Consultas Jurídicas</h1>
        <Button onClick={() => navigate('/juridico/consultas/nova')}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Consulta
        </Button>
      </div>

      {/* Cards KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pendentes
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metricas.pendentes}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Em Análise
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metricas.emAnalise}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Respondidas (mês)
            </CardTitle>
            <Check className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metricas.respondidasMes}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, assunto, descrição..."
            value={filters.busca}
            onChange={(e) => setFilters(prev => ({ ...prev, busca: e.target.value }))}
            className="pl-10"
          />
        </div>
        <Select
          value={filters.status}
          onValueChange={(value) => setFilters(prev => ({ ...prev, status: value as any }))}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="em_analise">Em Análise</SelectItem>
            <SelectItem value="respondida">Respondida</SelectItem>
            <SelectItem value="arquivada">Arquivada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista de Consultas */}
      {consultasFiltradas.length === 0 ? (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <HelpCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma consulta jurídica encontrada</h3>
            <p className="text-muted-foreground mb-4">
              Crie uma nova consulta para solicitar parecer jurídico.
            </p>
            <Button onClick={() => navigate('/juridico/consultas/nova')}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Consulta
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {consultasFiltradas.map((consulta) => (
            <Card key={consulta.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5 text-muted-foreground" />
                    <span className="font-mono text-sm text-muted-foreground">
                      {consulta.numero || 'Sem número'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {consulta.prioridade && getPrioridadeBadge(consulta.prioridade)}
                    {getStatusBadge(consulta.status || 'pendente')}
                  </div>
                </div>
                <CardTitle className="text-lg mt-2">{consulta.assunto}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    <span>
                      Solicitante: {(consulta.solicitante as any)?.nome || 'Não informado'}
                    </span>
                  </div>
                  {consulta.departamento && (
                    <div className="flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      <span>Departamento: {consulta.departamento}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {consulta.created_at 
                        ? format(new Date(consulta.created_at), "dd/MM/yyyy", { locale: ptBR })
                        : '-'
                      }
                    </span>
                  </div>
                </div>

                {consulta.status === 'respondida' && consulta.parecer && (
                  <div className="bg-muted/50 rounded-lg p-3 text-sm">
                    <p className="text-muted-foreground italic">
                      "{truncateText(consulta.parecer)}"
                    </p>
                    {consulta.respondido_em && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Respondido em {format(new Date(consulta.respondido_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        {(consulta.respondido_usuario as any)?.nome && 
                          ` por ${(consulta.respondido_usuario as any).nome}`
                        }
                      </p>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/juridico/consultas/${consulta.id}`)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Ver Detalhes
                  </Button>
                  {(consulta.status === 'pendente' || consulta.status === 'em_analise') && (
                    <Button
                      size="sm"
                      onClick={() => setConsultaSelecionada({
                        id: consulta.id,
                        numero: consulta.numero,
                        assunto: consulta.assunto,
                        descricao: consulta.descricao,
                        departamento: consulta.departamento,
                        prioridade: consulta.prioridade,
                        parecer: consulta.parecer,
                        created_at: consulta.created_at,
                        solicitante: consulta.solicitante as any,
                      })}
                    >
                      <Reply className="h-4 w-4 mr-2" />
                      Responder
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Responder */}
      {consultaSelecionada && (
        <ResponderConsultaModal
          open={!!consultaSelecionada}
          onClose={() => setConsultaSelecionada(null)}
          consulta={consultaSelecionada}
        />
      )}
    </div>
  );
}

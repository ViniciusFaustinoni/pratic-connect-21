import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Phone,
  AlertCircle,
  Truck,
  CheckCircle,
  Key,
  Circle,
  Fuel,
  Battery,
  HelpCircle,
  Clock,
  Plus,
  RefreshCw,
  LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { NovoChamadoModal } from '@/components/assistencia/NovoChamadoModal';

const tiposServico: Record<string, { icon: LucideIcon; label: string }> = {
  reboque: { icon: Truck, label: 'Reboque/Guincho' },
  chaveiro: { icon: Key, label: 'Chaveiro' },
  troca_pneu: { icon: Circle, label: 'Troca de Pneu' },
  pane_seca: { icon: Fuel, label: 'Pane Seca' },
  bateria: { icon: Battery, label: 'Bateria' },
  outro: { icon: HelpCircle, label: 'Outros' },
};

const statusConfig: Record<string, { label: string; className: string }> = {
  aberto: { label: 'Aberto', className: 'bg-yellow-100 text-yellow-800' },
  aguardando_prestador: { label: 'Aguard. Prestador', className: 'bg-orange-100 text-orange-800' },
  prestador_despachado: { label: 'Despachado', className: 'bg-blue-100 text-blue-800' },
  prestador_a_caminho: { label: 'A Caminho', className: 'bg-purple-100 text-purple-800' },
  em_atendimento: { label: 'Em Atendimento', className: 'bg-indigo-100 text-indigo-800' },
  concluido: { label: 'Concluído', className: 'bg-green-100 text-green-800' },
  cancelado_associado: { label: 'Canc. Associado', className: 'bg-red-100 text-red-800' },
  cancelado_sistema: { label: 'Canc. Sistema', className: 'bg-red-100 text-red-800' },
};

const getPrioridadeBadge = (dataAbertura: string) => {
  const minutos = differenceInMinutes(new Date(), new Date(dataAbertura));

  if (minutos > 60) {
    return <Badge variant="destructive">URGENTE</Badge>;
  } else if (minutos > 30) {
    return <Badge className="bg-orange-500 hover:bg-orange-600">Alto</Badge>;
  } else if (minutos > 15) {
    return <Badge className="bg-yellow-500 hover:bg-yellow-600">Médio</Badge>;
  }
  return <Badge variant="secondary">Normal</Badge>;
};

export default function AssistenciaDashboard() {
  const navigate = useNavigate();
  const [modalNovoChamado, setModalNovoChamado] = useState(false);

  // Estatísticas do dia
  const { data: estatisticas, dataUpdatedAt } = useQuery({
    queryKey: ['assistencia-estatisticas'],
    queryFn: async () => {
      const hoje = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('chamados_assistencia')
        .select('status, tipo_servico')
        .gte('data_abertura', hoje);

      if (error) throw error;

      const statusEmAndamento = [
        'aguardando_prestador',
        'prestador_despachado',
        'prestador_a_caminho',
        'em_atendimento',
      ];

      return {
        total: data?.length || 0,
        abertos: data?.filter((c) => c.status === 'aberto').length || 0,
        em_andamento: data?.filter((c) => statusEmAndamento.includes(c.status)).length || 0,
        concluidos: data?.filter((c) => c.status === 'concluido').length || 0,
        cancelados: data?.filter((c) => c.status.includes('cancelado')).length || 0,
        por_tipo: data?.reduce(
          (acc, c) => {
            acc[c.tipo_servico] = (acc[c.tipo_servico] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ) || {},
      };
    },
    refetchInterval: 30000,
  });

  // Chamados ativos
  const { data: chamadosAtivos, isLoading: loadingChamados } = useQuery({
    queryKey: ['chamados-ativos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chamados_assistencia')
        .select(
          `
          *,
          associado:associados(nome, telefone),
          veiculo:veiculos(placa, marca, modelo)
        `
        )
        .in('status', [
          'aberto',
          'aguardando_prestador',
          'prestador_despachado',
          'prestador_a_caminho',
          'em_atendimento',
        ])
        .order('data_abertura', { ascending: true });

      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  // Prestadores disponíveis
  const { data: prestadoresDisponiveis } = useQuery({
    queryKey: ['prestadores-disponiveis'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('prestadores_assistencia')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ativo')
        .eq('disponivel', true);

      if (error) throw error;
      return count || 0;
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Central de Assistência 24h</h1>
          <p className="text-muted-foreground">Monitoramento em tempo real</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <RefreshCw className="h-3 w-3" />
            Atualizado: {dataUpdatedAt ? format(new Date(dataUpdatedAt), 'HH:mm:ss') : '--:--:--'}
          </Badge>
          <Button onClick={() => setModalNovoChamado(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Chamado
          </Button>
        </div>
      </div>

      {/* Modal Novo Chamado */}
      <NovoChamadoModal
        open={modalNovoChamado}
        onClose={() => setModalNovoChamado(false)}
        onSuccess={(chamado) => navigate(`/assistencia/chamados/${chamado.id}`)}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-muted rounded-lg">
                <Phone className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Chamados Hoje</p>
                <p className="text-2xl font-bold">{estatisticas?.total || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Em Aberto</p>
                <p className="text-2xl font-bold text-yellow-600">{estatisticas?.abertos || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Truck className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Em Andamento</p>
                <p className="text-2xl font-bold text-blue-600">{estatisticas?.em_andamento || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Concluídos</p>
                <p className="text-2xl font-bold text-green-600">{estatisticas?.concluidos || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chamados Ativos - 2 columns */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Chamados Ativos
              {chamadosAtivos && chamadosAtivos.length > 0 && (
                <Badge variant="secondary">{chamadosAtivos.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] pr-4">
              {loadingChamados ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : chamadosAtivos && chamadosAtivos.length > 0 ? (
                <div className="space-y-3">
                  {chamadosAtivos.map((chamado) => {
                    const TipoIcon = tiposServico[chamado.tipo_servico]?.icon || HelpCircle;
                    const status = statusConfig[chamado.status] || {
                      label: chamado.status,
                      className: 'bg-gray-100 text-gray-800',
                    };

                    return (
                      <div
                        key={chamado.id}
                        className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {getPrioridadeBadge(chamado.data_abertura)}
                              <span className="font-mono text-sm">{chamado.protocolo}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <TipoIcon className="h-4 w-4 shrink-0" />
                              <span>{tiposServico[chamado.tipo_servico]?.label || chamado.tipo_servico}</span>
                            </div>
                            <p className="text-sm font-medium mt-1 truncate">
                              {chamado.associado?.nome || 'Sem associado'}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {chamado.veiculo?.placa || 'Sem placa'} -{' '}
                              {chamado.veiculo?.marca} {chamado.veiculo?.modelo}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <Badge className={status.className}>{status.label}</Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(chamado.data_abertura), {
                                locale: ptBR,
                                addSuffix: false,
                              })}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/assistencia/${chamado.id}`)}
                            >
                              {chamado.status === 'aberto' ? 'Atender' : 'Ver'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[400px] text-center">
                  <CheckCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-lg font-medium">Nenhum chamado ativo</p>
                  <p className="text-sm text-muted-foreground">
                    Todos os chamados foram atendidos
                  </p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Por Tipo de Serviço */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Por Tipo de Serviço</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(tiposServico).map(([key, config]) => {
                  const quantidade = estatisticas?.por_tipo?.[key] || 0;
                  const Icon = config.icon;
                  return (
                    <div key={key} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{config.label}</span>
                      </div>
                      <Badge variant="outline">{quantidade}</Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Prestadores Disponíveis */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Prestadores Disponíveis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-center mb-2">
                {prestadoresDisponiveis || 0}
              </div>
              <Button
                variant="link"
                className="w-full"
                onClick={() => navigate('/assistencia/prestadores')}
              >
                Ver todos prestadores
              </Button>
            </CardContent>
          </Card>

          {/* Ações Rápidas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate('/assistencia/chamados')}
              >
                Ver Fila Completa
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate('/assistencia/prestadores/novo')}
              >
                Cadastrar Prestador
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Relatório do Dia
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Clock, 
  Users, 
  Coffee, 
  CheckCircle2, 
  AlertCircle,
  Calendar,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  Settings2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { JornadaProfissionalCard } from '@/components/rh/JornadaProfissionalCard';
import { getHojeBrasilia } from '@/lib/date-utils';
import { useNavigate } from 'react-router-dom';

interface TurnoComProfile {
  id: string;
  profissional_id: string;
  data: string;
  inicio_turno: string | null;
  inicio_almoco: string | null;
  fim_almoco: string | null;
  fim_turno: string | null;
  minutos_trabalhados: number;
  minutos_almoco: number;
  minutos_extras: number;
  minutos_faltantes: number;
  saldo_anterior_minutos: number;
  status: string;
  profile: {
    nome: string;
    avatar_url?: string;
  } | null;
}

export default function JornadasProfissionais() {
  const navigate = useNavigate();
  const [dataSelecionada, setDataSelecionada] = useState(
    getHojeBrasilia().toISOString().split('T')[0]
  );
  const [parametrosAberto, setParametrosAberto] = useState(false);

  const hojeStr = getHojeBrasilia().toISOString().split('T')[0];
  const isHoje = dataSelecionada === hojeStr;

  // Buscar parâmetros de jornada vigentes
  const { data: parametros } = useQuery({
    queryKey: ['config-jornada-rh'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', [
          'jornada_duracao_turno_horas',
          'jornada_horas_ate_almoco',
          'jornada_duracao_almoco_minutos',
          'jornada_tolerancia_atraso_minutos',
          'jornada_produtividade_minima',
          'jornada_horas_alerta_improdutividade',
          'sla_horas_instalacao',
          'sla_horas_manutencao',
          'gps_validacao_ativa',
          'gps_raio_metros',
          'jornada_limite_debito_horas',
          'jornada_exibir_saldo_vistoriador',
          'recusa_exigir_motivo',
          'recusa_limite_alerta',
        ]);
      const map = Object.fromEntries((data || []).map(d => [d.chave, d.valor]));
      return {
        duracaoTurno: map.jornada_duracao_turno_horas || '8',
        horasAteAlmoco: map.jornada_horas_ate_almoco || '4',
        duracaoAlmoco: map.jornada_duracao_almoco_minutos || '60',
        toleranciaAtraso: map.jornada_tolerancia_atraso_minutos || '0',
        produtividadeMinima: map.jornada_produtividade_minima || '1',
        alertaImprodutividade: map.jornada_horas_alerta_improdutividade || '2',
        slaInstalacao: map.sla_horas_instalacao || '48',
        slaManutencao: map.sla_horas_manutencao || '24',
        gpsValidacaoAtiva: map.gps_validacao_ativa || 'true',
        gpsRaioMetros: map.gps_raio_metros || '500',
        limiteDebito: map.jornada_limite_debito_horas || '0',
        exibirSaldo: map.jornada_exibir_saldo_vistoriador || 'true',
        recusaExigirMotivo: map.recusa_exigir_motivo || 'true',
        recusaLimiteAlerta: map.recusa_limite_alerta || '3',
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  // Buscar turnos do dia
  const { data: turnos, isLoading, refetch } = useQuery({
    queryKey: ['turnos-profissionais-rh', dataSelecionada],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('turnos_profissionais')
        .select(`
          *,
          profile:profiles(nome, avatar_url)
        `)
        .eq('data', dataSelecionada)
        .order('inicio_turno', { ascending: true });

      if (error) throw error;
      return data as TurnoComProfile[];
    },
    refetchInterval: isHoje ? 60000 : false,
  });

  // Buscar contagem de recusas por turno
  const turnoIds = (turnos || []).map(t => t.id);
  const { data: recusasPorTurno } = useQuery({
    queryKey: ['recusas-por-turno-rh', turnoIds],
    queryFn: async () => {
      if (!turnoIds.length) return {};
      const { data } = await (supabase as any)
        .from('registros_recusa_tarefa')
        .select('turno_id')
        .in('turno_id', turnoIds);
      
      const counts: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        counts[r.turno_id] = (counts[r.turno_id] || 0) + 1;
      });
      return counts;
    },
    enabled: turnoIds.length > 0,
  });

  // Calcular estatísticas
  const saldosPorTurno = (turnos || []).map(t => {
    const saldoDia = (t.minutos_extras || 0) - (t.minutos_faltantes || 0);
    const saldoAcumulado = saldoDia + (t.saldo_anterior_minutos || 0);
    return { ...t, saldoDia, saldoAcumulado };
  });

  const stats = {
    total: turnos?.length || 0,
    trabalhando: turnos?.filter(t => t.status === 'ativo').length || 0,
    emAlmoco: turnos?.filter(t => t.status === 'em_almoco').length || 0,
    encerrados: turnos?.filter(t => t.status === 'encerrado').length || 0,
    semAlmoco: turnos?.filter(t => t.status === 'ativo' && !t.inicio_almoco && t.minutos_trabalhados >= 240).length || 0,
    horasExtras: turnos?.reduce((acc, t) => acc + (t.minutos_extras || 0), 0) || 0,
    horasFaltantes: turnos?.reduce((acc, t) => acc + (t.minutos_faltantes || 0), 0) || 0,
    comDebito: saldosPorTurno.filter(t => t.status === 'encerrado' && t.saldoAcumulado < 0).length,
    debitoTotal: Math.abs(saldosPorTurno.filter(t => t.status === 'encerrado' && t.saldoAcumulado < 0).reduce((acc, t) => acc + t.saldoAcumulado, 0)),
    creditoTotal: saldosPorTurno.filter(t => t.status === 'encerrado' && t.saldoAcumulado > 0).reduce((acc, t) => acc + t.saldoAcumulado, 0),
  };

  const formatarMinutos = (minutos: number): string => {
    const horas = Math.floor(Math.abs(minutos) / 60);
    const mins = Math.abs(minutos) % 60;
    if (horas === 0) return `${mins}min`;
    return mins > 0 ? `${horas}h ${mins}min` : `${horas}h`;
  };

  const turnosAtivos = turnos?.filter(t => t.status === 'ativo') || [];
  const turnosAlmoco = turnos?.filter(t => t.status === 'em_almoco') || [];
  const turnosEncerrados = turnos?.filter(t => t.status === 'encerrado') || [];

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Controle de Jornada</h1>
          <p className="text-muted-foreground">
            {format(new Date(dataSelecionada + 'T12:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dataSelecionada}
            onChange={(e) => setDataSelecionada(e.target.value)}
            max={hojeStr}
            className="px-3 py-2 rounded-md border border-input bg-background text-sm"
          />
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Painel de Parâmetros Ativos */}
      <Collapsible open={parametrosAberto} onOpenChange={setParametrosAberto}>
        <Card className="border-border/50">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Settings2 className="h-4 w-4 text-muted-foreground" />
                  Parâmetros Ativos da Jornada
                </CardTitle>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${parametrosAberto ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-4 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Duração do turno</p>
                  <p className="text-sm font-semibold">{parametros?.duracaoTurno || '8'}h</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Horas até almoço</p>
                  <p className="text-sm font-semibold">{parametros?.horasAteAlmoco || '4'}h</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Duração do almoço</p>
                  <p className="text-sm font-semibold">{parametros?.duracaoAlmoco || '60'} min</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Tolerância atraso</p>
                  <p className="text-sm font-semibold">{parametros?.toleranciaAtraso || '0'} min</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Produtividade mínima</p>
                  <p className="text-sm font-semibold">{parametros?.produtividadeMinima || '1'} serviço(s)</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Alerta improdutividade</p>
                  <p className="text-sm font-semibold">{parametros?.alertaImprodutividade || '2'}h</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Prazo instalação/vistoria</p>
                  <p className="text-sm font-semibold">{parametros?.slaInstalacao || '48'}h</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Prazo manutenção/retirada</p>
                  <p className="text-sm font-semibold">{parametros?.slaManutencao || '24'}h</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Validação GPS</p>
                  <p className="text-sm font-semibold">{parametros?.gpsValidacaoAtiva === 'false' ? 'Desativada' : 'Ativa'}</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Raio GPS</p>
                  <p className="text-sm font-semibold">{parametros?.gpsRaioMetros || '500'}m</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Limite débito bloqueio</p>
                  <p className="text-sm font-semibold">{parametros?.limiteDebito === '0' ? 'Desativado' : `${parametros?.limiteDebito}h`}</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Exibir saldo vistoriador</p>
                  <p className="text-sm font-semibold">{parametros?.exibirSaldo === 'false' ? 'Não' : 'Sim'}</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Exigir motivo recusa</p>
                  <p className="text-sm font-semibold">{parametros?.recusaExigirMotivo === 'false' ? 'Não' : 'Sim'}</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Limite recusas/turno</p>
                  <p className="text-sm font-semibold">{parametros?.recusaLimiteAlerta || '3'}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => navigate('/diretoria/gestao-comercial')}>
                  <Settings2 className="h-3.5 w-3.5 mr-1" />
                  Editar configurações
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.trabalhando}</p>
                <p className="text-xs text-muted-foreground">Trabalhando</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Coffee className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.emAlmoco}</p>
                <p className="text-xs text-muted-foreground">Em Almoço</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.encerrados}</p>
                <p className="text-xs text-muted-foreground">Encerrados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Clock className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Turnos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      {stats.semAlmoco > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <p className="text-sm text-amber-600">
              {stats.semAlmoco} profissional(is) com mais de 4h trabalhadas sem registrar almoço
            </p>
          </CardContent>
        </Card>
      )}

      {/* Resumo de Horas */}
      {stats.encerrados > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-lg font-bold text-green-600">
                  +{formatarMinutos(stats.horasExtras)}
                </p>
                <p className="text-xs text-muted-foreground">Horas Extras Total</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <TrendingDown className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-lg font-bold text-red-600">
                  -{formatarMinutos(stats.horasFaltantes)}
                </p>
                <p className="text-xs text-muted-foreground">Horas Faltantes Total</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-lg font-bold">{stats.comDebito}</p>
                <p className="text-xs text-muted-foreground">Com Débito</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <TrendingDown className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-lg font-bold text-red-600">
                  -{formatarMinutos(stats.debitoTotal)}
                </p>
                <p className="text-xs text-muted-foreground">Débito Consolidado</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-lg font-bold text-green-600">
                  +{formatarMinutos(stats.creditoTotal)}
                </p>
                <p className="text-xs text-muted-foreground">Crédito Consolidado</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs com turnos por status */}
      <Tabs defaultValue="todos" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="todos">Todos ({stats.total})</TabsTrigger>
          <TabsTrigger value="ativos">Ativos ({stats.trabalhando})</TabsTrigger>
          <TabsTrigger value="almoco">Almoço ({stats.emAlmoco})</TabsTrigger>
          <TabsTrigger value="encerrados">Encerrados ({stats.encerrados})</TabsTrigger>
        </TabsList>

        <TabsContent value="todos" className="mt-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : turnos && turnos.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {turnos.map((turno) => (
                <JornadaProfissionalCard key={turno.id} turno={turno} recusasNoTurno={recusasPorTurno?.[turno.id] || 0} limiteRecusas={parseInt(parametros?.recusaLimiteAlerta || "3", 10)} emViagem={(turno as any).em_viagem} bonusViagem={(turno as any).bonus_viagem} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum turno registrado para esta data
            </div>
          )}
        </TabsContent>

        <TabsContent value="ativos" className="mt-4">
          {turnosAtivos.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {turnosAtivos.map((turno) => (
                <JornadaProfissionalCard key={turno.id} turno={turno} recusasNoTurno={recusasPorTurno?.[turno.id] || 0} limiteRecusas={parseInt(parametros?.recusaLimiteAlerta || "3", 10)} emViagem={(turno as any).em_viagem} bonusViagem={(turno as any).bonus_viagem} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum profissional trabalhando no momento
            </div>
          )}
        </TabsContent>

        <TabsContent value="almoco" className="mt-4">
          {turnosAlmoco.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {turnosAlmoco.map((turno) => (
                <JornadaProfissionalCard key={turno.id} turno={turno} recusasNoTurno={recusasPorTurno?.[turno.id] || 0} limiteRecusas={parseInt(parametros?.recusaLimiteAlerta || "3", 10)} emViagem={(turno as any).em_viagem} bonusViagem={(turno as any).bonus_viagem} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum profissional em almoço
            </div>
          )}
        </TabsContent>

        <TabsContent value="encerrados" className="mt-4">
          {turnosEncerrados.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {turnosEncerrados.map((turno) => (
                <JornadaProfissionalCard key={turno.id} turno={turno} recusasNoTurno={recusasPorTurno?.[turno.id] || 0} limiteRecusas={parseInt(parametros?.recusaLimiteAlerta || "3", 10)} emViagem={(turno as any).em_viagem} bonusViagem={(turno as any).bonus_viagem} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum turno encerrado
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

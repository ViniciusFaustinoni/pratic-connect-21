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
  const [dataSelecionada, setDataSelecionada] = useState(
    getHojeBrasilia().toISOString().split('T')[0]
  );

  const hojeStr = getHojeBrasilia().toISOString().split('T')[0];
  const isHoje = dataSelecionada === hojeStr;

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
    refetchInterval: isHoje ? 60000 : false, // Atualizar a cada 1 minuto se for hoje
  });

  // Calcular estatísticas
  const stats = {
    total: turnos?.length || 0,
    trabalhando: turnos?.filter(t => t.status === 'ativo').length || 0,
    emAlmoco: turnos?.filter(t => t.status === 'em_almoco').length || 0,
    encerrados: turnos?.filter(t => t.status === 'encerrado').length || 0,
    semAlmoco: turnos?.filter(t => t.status === 'ativo' && !t.inicio_almoco && t.minutos_trabalhados >= 240).length || 0,
    horasExtras: turnos?.reduce((acc, t) => acc + (t.minutos_extras || 0), 0) || 0,
    horasFaltantes: turnos?.reduce((acc, t) => acc + (t.minutos_faltantes || 0), 0) || 0,
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
        <div className="grid grid-cols-2 gap-4">
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
                <JornadaProfissionalCard key={turno.id} turno={turno} />
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
                <JornadaProfissionalCard key={turno.id} turno={turno} />
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
                <JornadaProfissionalCard key={turno.id} turno={turno} />
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
                <JornadaProfissionalCard key={turno.id} turno={turno} />
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

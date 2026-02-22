import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, FileSearch, Clock, AlertTriangle, Calendar, ArrowRight, TrendingUp, Inbox } from 'lucide-react';
import { format, differenceInDays, isPast, addDays, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { STATUS_SINDICANCIA_LABELS, STATUS_SINDICANCIA_COLORS, MOTIVOS_PADRONIZADOS, type StatusSindicancia } from '@/types/sindicancia';

export default function SindicanteDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [sindicancias, setSindicancias] = useState<any[]>([]);
  const [diligenciaCounts, setDiligenciaCounts] = useState<Record<string, number>>({});
  const [empresaNome, setEmpresaNome] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('todos');

  useEffect(() => {
    if (!profile?.id) return;
    
    const fetchData = async () => {
      // Buscar empresa do sindicante
      const { data: empresa } = await supabase
        .from('empresas_sindicancia')
        .select('nome_fantasia, razao_social')
        .eq('profile_id', profile.id)
        .eq('ativo', true)
        .maybeSingle();

      if (empresa) {
        setEmpresaNome(empresa.nome_fantasia || empresa.razao_social);
      }

      // Buscar sindicâncias com joins
      const { data, error } = await supabase
        .from('sindicancias')
        .select('*, sinistros(protocolo, numero, tipo, data_ocorrencia, associado:associados(nome, cpf), veiculo:veiculos(marca, modelo, ano_modelo, placa))')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setSindicancias(data);

        // Buscar contagem de diligências
        const ids = data.map(s => s.id);
        if (ids.length > 0) {
          const { data: dils } = await supabase
            .from('sindicancia_diligencias')
            .select('sindicancia_id')
            .in('sindicancia_id', ids);
          
          const counts: Record<string, number> = {};
          dils?.forEach(d => {
            counts[d.sindicancia_id] = (counts[d.sindicancia_id] || 0) + 1;
          });
          setDiligenciaCounts(counts);
        }
      }
      setLoading(false);
    };

    fetchData();
  }, [profile?.id]);

  const hoje = new Date();
  const inicioMes = startOfMonth(hoje);

  const novos = sindicancias.filter(s => s.status === 'atribuido');
  const emAndamento = sindicancias.filter(s => s.status === 'em_andamento');
  const prazoUrgente = sindicancias.filter(s => 
    ['atribuido', 'em_andamento'].includes(s.status) && 
    s.data_limite && differenceInDays(new Date(s.data_limite), hoje) <= 5
  );
  const concluidosMes = sindicancias.filter(s => 
    ['laudo_emitido', 'encerrado'].includes(s.status) &&
    (s.data_laudo ? new Date(s.data_laudo) >= inicioMes : new Date(s.updated_at) >= inicioMes)
  );

  // Alertas: prazo <= 3 dias
  const alertaVencendo = sindicancias.filter(s =>
    ['atribuido', 'em_andamento'].includes(s.status) &&
    s.data_limite && differenceInDays(new Date(s.data_limite), hoje) <= 3 && !isPast(new Date(s.data_limite))
  );
  const alertaVencido = sindicancias.filter(s =>
    ['atribuido', 'em_andamento'].includes(s.status) &&
    s.data_limite && isPast(new Date(s.data_limite))
  );

  // Filtrar por tab
  const filtered = useMemo(() => {
    let list = sindicancias;
    if (activeTab === 'novos') list = list.filter(s => s.status === 'atribuido');
    else if (activeTab === 'andamento') list = list.filter(s => s.status === 'em_andamento');
    else if (activeTab === 'concluidos') list = list.filter(s => ['laudo_emitido', 'encerrado'].includes(s.status));

    // Ordenar: atribuido primeiro, depois por data_limite ASC
    return list.sort((a, b) => {
      if (a.status === 'atribuido' && b.status !== 'atribuido') return -1;
      if (a.status !== 'atribuido' && b.status === 'atribuido') return 1;
      if (a.data_limite && b.data_limite) return new Date(a.data_limite).getTime() - new Date(b.data_limite).getTime();
      return 0;
    });
  }, [sindicancias, activeTab]);

  const getMotivoLabel = (value: string) => {
    const m = MOTIVOS_PADRONIZADOS.find(m => m.value === value);
    return m ? m.label : value;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meus Casos de Sindicância</h1>
        {empresaNome && (
          <p className="text-muted-foreground">Bem-vindo, {empresaNome}</p>
        )}
      </div>

      {/* Alertas de prazo */}
      {alertaVencido.length > 0 && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="py-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span className="font-semibold text-destructive">
              🚨 PRAZO VENCIDO: {alertaVencido.length} caso(s) com prazo expirado!
            </span>
          </CardContent>
        </Card>
      )}
      {alertaVencendo.length > 0 && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10">
          <CardContent className="py-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <span className="font-semibold text-yellow-700 dark:text-yellow-400">
              ⚠️ ATENÇÃO: {alertaVencendo.length} caso(s) com prazo vencendo em breve! Emita o laudo o quanto antes.
            </span>
          </CardContent>
        </Card>
      )}

      {/* 4 Cards KPI */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Novos</CardTitle>
            <Inbox className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{novos.length}</span>
              {novos.length > 0 && (
                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 animate-pulse">
                  Novo
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
            <FileSearch className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{emAndamento.length}</span>
              {emAndamento.length > 0 && (
                <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                  Ativo
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prazo Urgente</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{prazoUrgente.length}</span>
              {prazoUrgente.length > 0 && (
                <Badge variant="destructive">Urgente</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídos no Mês</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{concluidosMes.length}</span>
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                Mês
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros (Tabs) */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="todos">Todos ({sindicancias.length})</TabsTrigger>
          <TabsTrigger value="novos">Novos ({novos.length})</TabsTrigger>
          <TabsTrigger value="andamento">Em Andamento ({emAndamento.length})</TabsTrigger>
          <TabsTrigger value="concluidos">Concluídos ({concluidosMes.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Lista de Casos como Cards */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="text-center py-10 text-muted-foreground">
            <FileSearch className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>Nenhum caso encontrado nesta categoria.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map(s => {
            const status = s.status as StatusSindicancia;
            const sinistro = s.sinistros as any;
            const diasRest = s.data_limite ? differenceInDays(new Date(s.data_limite), hoje) : null;
            const vencido = s.data_limite && isPast(new Date(s.data_limite));
            const prazoProximo = diasRest !== null && diasRest <= 5 && !vencido;
            const countDil = diligenciaCounts[s.id] || 0;

            return (
              <Card 
                key={s.id} 
                className={`transition-colors ${
                  vencido && !['encerrado', 'cancelado'].includes(status) 
                    ? 'border-destructive' 
                    : prazoProximo && !['encerrado', 'cancelado'].includes(status)
                    ? 'border-yellow-500'
                    : ''
                }`}
              >
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Número + Status */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold">{s.numero}</span>
                        <Badge className={STATUS_SINDICANCIA_COLORS[status]} variant="secondary">
                          {status === 'atribuido' ? 'Novo' : STATUS_SINDICANCIA_LABELS[status]}
                        </Badge>
                        {vencido && !['encerrado', 'cancelado'].includes(status) && (
                          <Badge variant="destructive" className="animate-pulse">
                            PRAZO VENCIDO
                          </Badge>
                        )}
                      </div>

                      {/* Evento */}
                      <p className="text-sm">
                        📋 Evento #{sinistro?.protocolo || sinistro?.numero || '—'} — {sinistro?.tipo || '—'}
                      </p>

                      {/* Veículo */}
                      {sinistro?.veiculo && (
                        <p className="text-sm text-muted-foreground">
                          🚗 {sinistro.veiculo.marca} {sinistro.veiculo.modelo} {sinistro.veiculo.ano_modelo || ''} — Placa {sinistro.veiculo.placa || '—'}
                        </p>
                      )}

                      {/* Associado */}
                      {sinistro?.associado && (
                        <p className="text-sm text-muted-foreground">
                          👤 {sinistro.associado.nome} — CPF: {sinistro.associado.cpf || '—'}
                        </p>
                      )}

                      {/* Metadados */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>📅 Aberto em: {format(new Date(s.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span>
                        {s.data_limite && (
                          <span className={diasRest !== null && diasRest <= 5 ? 'text-destructive font-medium' : ''}>
                            ⏰ Prazo: {format(new Date(s.data_limite), 'dd/MM/yyyy')} ({diasRest !== null ? (diasRest <= 0 ? 'Vencido' : `${diasRest} dias`) : '—'})
                          </span>
                        )}
                        <span>📊 Diligências: {countDil}</span>
                      </div>

                      {/* Motivos */}
                      {s.motivos_padronizados?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {(s.motivos_padronizados as string[]).slice(0, 3).map((m: string) => (
                            <Badge key={m} variant="outline" className="text-xs">
                              {getMotivoLabel(m)}
                            </Badge>
                          ))}
                          {s.motivos_padronizados.length > 3 && (
                            <Badge variant="outline" className="text-xs">+{s.motivos_padronizados.length - 3}</Badge>
                          )}
                        </div>
                      )}
                    </div>

                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => navigate(`/sindicante/caso/${s.id}`)}
                      className="shrink-0"
                    >
                      Abrir Caso <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

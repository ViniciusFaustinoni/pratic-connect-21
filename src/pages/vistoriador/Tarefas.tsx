import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Car, CheckCircle2, Clock, MapPin, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTarefasHistorico, useTarefaAtual } from '@/hooks/useTarefaAtual';
import { TarefaAtualCard } from '@/components/vistoriador/TarefaAtualCard';
import { BotaoIniciarServico } from '@/components/vistoriador/BotaoIniciarServico';

export default function VistoriadorTarefas() {
  const { data: tarefaAtual, isLoading: isLoadingAtual } = useTarefaAtual();
  const { data: historicoHoje, isLoading: isLoadingHistorico } = useTarefasHistorico(1);
  const { data: historicoSemana } = useTarefasHistorico(7);

  const tarefasHoje = historicoHoje?.filter(t => {
    const hoje = new Date().toISOString().split('T')[0];
    return t.concluida_em?.startsWith(hoje);
  }) || [];

  const tarefasAnteriores = historicoSemana?.filter(t => {
    const hoje = new Date().toISOString().split('T')[0];
    return !t.concluida_em?.startsWith(hoje);
  }) || [];

  const isLoading = isLoadingAtual || isLoadingHistorico;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-bold text-foreground">Minhas Tarefas</h1>
        <p className="text-muted-foreground">
          Gerencie suas tarefas atuais e veja o histórico
        </p>
      </header>

      <Tabs defaultValue="atual" className="space-y-4">
        <TabsList>
          <TabsTrigger value="atual" className="gap-2">
            <Clock className="h-4 w-4" />
            Atual
          </TabsTrigger>
          <TabsTrigger value="hoje" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Hoje ({tarefasHoje.length})
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2">
            <Clock className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        {/* Tab: Tarefa Atual */}
        <TabsContent value="atual">
          <div className="max-w-lg mx-auto">
            {tarefaAtual ? (
              <TarefaAtualCard tarefa={tarefaAtual} />
            ) : (
              <BotaoIniciarServico />
            )}
          </div>
        </TabsContent>

        {/* Tab: Concluídas Hoje */}
        <TabsContent value="hoje">
          {tarefasHoje.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Nenhuma tarefa concluída hoje
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {tarefasHoje.map((tarefa) => (
                <TarefaHistoricoCard key={tarefa.id} tarefa={tarefa} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab: Histórico */}
        <TabsContent value="historico">
          {tarefasAnteriores.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Nenhuma tarefa nos últimos 7 dias
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {tarefasAnteriores.map((tarefa) => (
                <TarefaHistoricoCard key={tarefa.id} tarefa={tarefa} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface TarefaHistoricoCardProps {
  tarefa: {
    id: string;
    tipo: 'instalacao' | 'vistoria';
    status: string;
    data_agendada: string;
    concluida_em: string | null;
    associado: { nome: string } | null;
    veiculo: { placa: string; marca: string; modelo: string } | null;
    bairro: string | null;
    cidade: string | null;
  };
}

function TarefaHistoricoCard({ tarefa }: TarefaHistoricoCardProps) {
  const dataFormatada = tarefa.concluida_em
    ? format(new Date(tarefa.concluida_em), "dd/MM HH:mm", { locale: ptBR })
    : '-';

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={tarefa.tipo === 'instalacao' ? 'default' : 'secondary'}>
              {tarefa.tipo === 'instalacao' ? 'Instalação' : 'Vistoria'}
            </Badge>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              Concluída
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">{dataFormatada}</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 flex-1">
            <Car className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {tarefa.veiculo?.marca} {tarefa.veiculo?.modelo}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {tarefa.veiculo?.placa}
            </span>
          </div>
          {(tarefa.bairro || tarefa.cidade) && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {tarefa.bairro || tarefa.cidade}
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {tarefa.associado?.nome || 'Cliente'}
        </p>
      </CardContent>
    </Card>
  );
}

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ClipboardList, Loader2, CheckCircle2, Car, Clock, ChevronRight 
} from 'lucide-react';
import { useTarefaAtual, useTarefasHistorico } from '@/hooks/useTarefaAtual';
import { TipoServico, TIPO_SERVICO_LABELS, isInstalacao } from '@/hooks/useServicos';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TarefaAtualCard } from '@/components/vistoriador/TarefaAtualCard';
import { BotaoIniciarServico } from '@/components/vistoriador/BotaoIniciarServico';

export default function InstaladorTarefas() {
  const navigate = useNavigate();
  const { data: tarefaAtual, isLoading: isLoadingAtual } = useTarefaAtual();
  const { data: historico, isLoading: isLoadingHistorico } = useTarefasHistorico(7);

  // Separar tarefas de hoje do histórico
  const { tarefasHoje, tarefasHistorico } = useMemo(() => {
    if (!historico) return { tarefasHoje: [], tarefasHistorico: [] };
    
    const hoje = startOfDay(new Date());
    const fimHoje = endOfDay(new Date());
    
    return {
      tarefasHoje: historico.filter(t => {
        if (!t.concluida_em) return false;
        const data = new Date(t.concluida_em);
        return data >= hoje && data <= fimHoje;
      }),
      tarefasHistorico: historico.filter(t => {
        if (!t.concluida_em) return false;
        const data = new Date(t.concluida_em);
        return data < hoje;
      }),
    };
  }, [historico]);

  const isLoading = isLoadingAtual || isLoadingHistorico;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-slate-400">Carregando tarefas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-blue-400" />
              Minhas Tarefas
            </h1>
            <p className="text-sm text-slate-400">
              Acompanhe suas atividades
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="atual" className="w-full">
          <TabsList className="w-full bg-slate-800 border border-slate-700">
            <TabsTrigger value="atual" className="flex-1 data-[state=active]:bg-blue-600">
              Atual
            </TabsTrigger>
            <TabsTrigger value="hoje" className="flex-1 data-[state=active]:bg-green-600">
              Hoje ({tarefasHoje.length})
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex-1 data-[state=active]:bg-purple-600">
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* Tab: Atual */}
          <TabsContent value="atual" className="mt-4 space-y-3">
            {tarefaAtual ? (
              <TarefaAtualCard tarefa={tarefaAtual} />
            ) : (
              <div className="space-y-4">
                <BotaoIniciarServico />
                <Card className="border-slate-700 bg-slate-800">
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <CheckCircle2 className="h-10 w-10 text-green-500" />
                    <h3 className="mt-3 text-base font-semibold text-white">Nenhuma tarefa ativa</h3>
                    <p className="mt-1 text-center text-sm text-slate-400">
                      Clique em "Iniciar Serviço" para receber sua próxima tarefa automaticamente.
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Tab: Hoje */}
          <TabsContent value="hoje" className="mt-4 space-y-3">
            {tarefasHoje.length > 0 ? (
              tarefasHoje.map((tarefa) => (
                <TarefaHistoricoCard 
                  key={tarefa.id} 
                  tarefa={tarefa} 
                  onClick={() => {
                    const rota = isInstalacao(tarefa.tipo)
                      ? `/instalador/instalacao/${tarefa.id}`
                      : `/instalador/vistoria/${tarefa.id}`;
                    navigate(rota);
                  }}
                />
              ))
            ) : (
              <Card className="border-slate-700 bg-slate-800">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <ClipboardList className="h-12 w-12 text-slate-600" />
                  <h3 className="mt-4 text-lg font-semibold text-white">Nenhuma conclusão</h3>
                  <p className="mt-1 text-center text-sm text-slate-400">
                    Você ainda não concluiu nenhuma tarefa hoje.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab: Histórico */}
          <TabsContent value="historico" className="mt-4 space-y-3">
            {tarefasHistorico.length > 0 ? (
              tarefasHistorico.map((tarefa) => (
                <TarefaHistoricoCard 
                  key={tarefa.id} 
                  tarefa={tarefa} 
                  onClick={() => {
                    const rota = isInstalacao(tarefa.tipo)
                      ? `/instalador/instalacao/${tarefa.id}`
                      : `/instalador/vistoria/${tarefa.id}`;
                    navigate(rota);
                  }}
                />
              ))
            ) : (
              <Card className="border-slate-700 bg-slate-800">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <ClipboardList className="h-12 w-12 text-slate-600" />
                  <h3 className="mt-4 text-lg font-semibold text-white">Sem histórico</h3>
                  <p className="mt-1 text-center text-sm text-slate-400">
                    Nenhuma tarefa concluída nos últimos 7 dias.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Tipo do histórico de tarefas retornado pelo hook
interface TarefaHistorico {
  id: string;
  status: string;
  data_agendada: string;
  concluida_em: string | null;
  associado: { nome: string } | null;
  veiculo: { placa: string; marca: string; modelo: string } | null;
  bairro: string | null;
  cidade: string | null;
  tipo: TipoServico;
}

interface TarefaHistoricoCardProps {
  tarefa: TarefaHistorico;
  onClick?: () => void;
}

function TarefaHistoricoCard({ tarefa, onClick }: TarefaHistoricoCardProps) {
  const dataFormatada = tarefa.concluida_em 
    ? format(new Date(tarefa.concluida_em), "dd/MM 'às' HH:mm", { locale: ptBR })
    : '-';
  
  const veiculoInfo = tarefa.veiculo 
    ? `${tarefa.veiculo.marca} ${tarefa.veiculo.modelo} • ${tarefa.veiculo.placa}`
    : 'Veículo não informado';

  const clienteNome = tarefa.associado?.nome || 'Cliente';
  
  return (
    <Card 
      className="border-slate-700 bg-slate-800 hover:bg-slate-750 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-white truncate">
                {clienteNome}
              </p>
              <Badge 
                variant="outline" 
                className={`text-xs shrink-0 ${
                  isInstalacao(tarefa.tipo)
                    ? 'border-blue-500 text-blue-400' 
                    : 'border-purple-500 text-purple-400'
                }`}
              >
                {TIPO_SERVICO_LABELS[tarefa.tipo] || tarefa.tipo}
              </Badge>
            </div>
            <div className="flex items-center gap-1 text-slate-400 text-xs mt-0.5">
              <Car className="h-3 w-3" />
              <span>{veiculoInfo}</span>
            </div>
            <div className="flex items-center gap-1 text-slate-500 text-xs mt-0.5">
              <Clock className="h-3 w-3" />
              <span>Concluída em {dataFormatada}</span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-500 shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

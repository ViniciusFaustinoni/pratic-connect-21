import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMyAssociado } from '@/hooks/useMyData';
import { 
  ArrowLeft, ChevronRight, Inbox, MapPin, Plus,
  Truck, Key, Fuel, Battery, Wrench, HelpCircle 
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// Labels dos tipos de assistência
const tiposAssistencia: Record<string, string> = {
  guincho: 'Guincho',
  reboque: 'Reboque/Guincho',
  chaveiro: 'Chaveiro',
  troca_pneu: 'Troca de Pneu',
  pneu: 'Troca de Pneu',
  pane_seca: 'Falta de Combustível',
  bateria: 'Bateria',
  outro: 'Outros',
};

// Configuração de badges por status
const getStatusBadge = (status: string) => {
  const config: Record<string, { label: string; className: string }> = {
    aberto: { label: 'Aberto', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    aguardando_prestador: { label: 'Aguardando', className: 'bg-orange-100 text-orange-800 border-orange-200' },
    prestador_despachado: { label: 'Despachado', className: 'bg-blue-100 text-blue-800 border-blue-200' },
    prestador_a_caminho: { label: 'A Caminho', className: 'bg-purple-100 text-purple-800 border-purple-200' },
    em_atendimento: { label: 'Em Atendimento', className: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    concluido: { label: 'Concluído', className: 'bg-green-100 text-green-800 border-green-200' },
    cancelado: { label: 'Cancelado', className: 'bg-red-100 text-red-800 border-red-200' },
    cancelado_associado: { label: 'Cancelado', className: 'bg-red-100 text-red-800 border-red-200' },
    cancelado_sistema: { label: 'Cancelado', className: 'bg-red-100 text-red-800 border-red-200' },
  };
  return config[status] || { label: status, className: 'bg-gray-100 text-gray-800 border-gray-200' };
};

// Ícones e cores por tipo de serviço
const getIconeServico = (tipo: string) => {
  const icones: Record<string, { icon: React.ElementType; bgColor: string; iconColor: string }> = {
    guincho: { icon: Truck, bgColor: 'bg-blue-100', iconColor: 'text-blue-600' },
    reboque: { icon: Truck, bgColor: 'bg-blue-100', iconColor: 'text-blue-600' },
    chaveiro: { icon: Key, bgColor: 'bg-amber-100', iconColor: 'text-amber-600' },
    pane_seca: { icon: Fuel, bgColor: 'bg-orange-100', iconColor: 'text-orange-600' },
    bateria: { icon: Battery, bgColor: 'bg-green-100', iconColor: 'text-green-600' },
    troca_pneu: { icon: Wrench, bgColor: 'bg-purple-100', iconColor: 'text-purple-600' },
    pneu: { icon: Wrench, bgColor: 'bg-purple-100', iconColor: 'text-purple-600' },
  };
  return icones[tipo] || { icon: HelpCircle, bgColor: 'bg-gray-100', iconColor: 'text-gray-600' };
};

// Status considerados "em andamento"
const statusEmAndamento = [
  'aberto', 
  'aguardando_prestador', 
  'prestador_despachado', 
  'prestador_a_caminho', 
  'em_atendimento'
];

// Status considerados "cancelados"
const statusCancelados = ['cancelado', 'cancelado_associado', 'cancelado_sistema'];

export default function HistoricoChamados() {
  const navigate = useNavigate();
  const [filtroAtivo, setFiltroAtivo] = useState('todos');
  const { data: associado } = useMyAssociado();

  const { data: chamados, isLoading } = useQuery({
    queryKey: ['meus-chamados-historico', associado?.id],
    queryFn: async () => {
      if (!associado?.id) return [];
      const { data, error } = await supabase
        .from('chamados_assistencia')
        .select(`
          id, protocolo, tipo_servico, status, data_abertura,
          origem_endereco, origem_logradouro, origem_cidade,
          veiculo:veiculos(placa, marca, modelo)
        `)
        .eq('associado_id', associado.id)
        .order('data_abertura', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!associado?.id,
  });

  // Filtrar chamados por status
  const chamadosFiltrados = useMemo(() => {
    if (!chamados) return [];
    
    switch (filtroAtivo) {
      case 'andamento':
        return chamados.filter(c => statusEmAndamento.includes(c.status));
      case 'concluidos':
        return chamados.filter(c => c.status === 'concluido');
      case 'cancelados':
        return chamados.filter(c => statusCancelados.includes(c.status));
      default:
        return chamados;
    }
  }, [chamados, filtroAtivo]);

  // Contadores para os tabs
  const contadores = useMemo(() => {
    if (!chamados) return { todos: 0, andamento: 0, concluidos: 0, cancelados: 0 };
    return {
      todos: chamados.length,
      andamento: chamados.filter(c => statusEmAndamento.includes(c.status)).length,
      concluidos: chamados.filter(c => c.status === 'concluido').length,
      cancelados: chamados.filter(c => statusCancelados.includes(c.status)).length,
    };
  }, [chamados]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/assistencia')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Histórico de Chamados</h1>
      </div>

      {/* Tabs de Filtro */}
      <div className="px-4 pt-4">
        <Tabs value={filtroAtivo} onValueChange={setFiltroAtivo} className="w-full">
          <TabsList className="w-full grid grid-cols-4 h-auto p-1">
            <TabsTrigger value="todos" className="text-xs py-2 px-1">
              Todos
              {contadores.todos > 0 && (
                <span className="ml-1 text-[10px] opacity-70">({contadores.todos})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="andamento" className="text-xs py-2 px-1">
              Andamento
              {contadores.andamento > 0 && (
                <span className="ml-1 text-[10px] opacity-70">({contadores.andamento})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="concluidos" className="text-xs py-2 px-1">
              Concluídos
              {contadores.concluidos > 0 && (
                <span className="ml-1 text-[10px] opacity-70">({contadores.concluidos})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="cancelados" className="text-xs py-2 px-1">
              Cancelados
              {contadores.cancelados > 0 && (
                <span className="ml-1 text-[10px] opacity-70">({contadores.cancelados})</span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 p-4 pb-28 space-y-3">
        {isLoading ? (
          // Loading State
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-11 w-11 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : chamadosFiltrados && chamadosFiltrados.length > 0 ? (
          // Lista de Chamados
          <div className="space-y-3">
            {chamadosFiltrados.map((chamado) => {
              const statusInfo = getStatusBadge(chamado.status);
              const servicoInfo = getIconeServico(chamado.tipo_servico);
              const IconeServico = servicoInfo.icon;
              const veiculo = chamado.veiculo as { placa: string; marca: string; modelo: string } | null;
              
              // Montar endereço resumido
              const endereco = chamado.origem_endereco || 
                (chamado.origem_logradouro && chamado.origem_cidade 
                  ? `${chamado.origem_logradouro}, ${chamado.origem_cidade}` 
                  : null);

              return (
                <Card
                  key={chamado.id}
                  className="cursor-pointer hover:shadow-md transition-all active:scale-[0.99]"
                  onClick={() => navigate(`/app/assistencia/${chamado.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Ícone do serviço */}
                      <div className={cn("p-2.5 rounded-xl flex-shrink-0", servicoInfo.bgColor)}>
                        <IconeServico className={cn("h-5 w-5", servicoInfo.iconColor)} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        {/* Tipo + Badge */}
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-foreground">
                            {tiposAssistencia[chamado.tipo_servico] || chamado.tipo_servico}
                          </p>
                          <Badge variant="outline" className={cn("text-xs font-medium", statusInfo.className)}>
                            {statusInfo.label}
                          </Badge>
                        </div>
                        
                        {/* Protocolo */}
                        <p className="text-xs font-mono text-muted-foreground mt-0.5">
                          {chamado.protocolo}
                        </p>
                        
                        {/* Veículo */}
                        {veiculo && (
                          <p className="text-sm text-muted-foreground mt-1.5">
                            <span className="font-medium text-foreground">{veiculo.placa}</span>
                            <span className="mx-1.5">•</span>
                            {veiculo.marca} {veiculo.modelo}
                          </p>
                        )}
                        
                        {/* Endereço */}
                        {endereco && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                            <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/70" />
                            <span className="truncate">{endereco}</span>
                          </p>
                        )}
                        
                        {/* Data/hora */}
                        <p className="text-xs text-muted-foreground mt-2">
                          {format(new Date(chamado.data_abertura), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      
                      {/* Seta */}
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          // Empty State
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="p-5 rounded-full bg-muted/50 mb-5">
              <Inbox className="h-12 w-12 text-muted-foreground/50" />
            </div>
            <h3 className="font-semibold text-lg text-foreground">
              Nenhum chamado encontrado
            </h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs">
              {filtroAtivo === 'todos' 
                ? 'Você ainda não solicitou nenhuma assistência' 
                : filtroAtivo === 'andamento'
                  ? 'Não há chamados em andamento'
                  : filtroAtivo === 'concluidos'
                    ? 'Nenhum chamado concluído'
                    : 'Nenhum chamado cancelado'}
            </p>
            {filtroAtivo === 'todos' && (
              <Button className="mt-6" onClick={() => navigate('/app/assistencia/nova')}>
                <Plus className="h-4 w-4 mr-2" />
                Solicitar Assistência
              </Button>
            )}
          </div>
        )}
      </div>

      {/* FAB - Nova Solicitação */}
      <Button
        className="fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-lg z-50"
        onClick={() => navigate('/app/assistencia/nova')}
      >
        <Plus className="h-6 w-6" />
        <span className="sr-only">Nova Solicitação</span>
      </Button>
    </div>
  );
}

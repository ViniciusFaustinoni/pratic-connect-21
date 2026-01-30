import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle, 
  Plus, 
  ChevronRight,
  Car,
  ShieldAlert,
  ShieldOff,
  Flame,
  CloudRain,
  Users,
  Square,
  HelpCircle,
  AlertCircle,
  FileX,
  Clock,
  Bot
} from 'lucide-react';
import { useMyAssociado } from '@/hooks/useMyData';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { TIPO_SINISTRO_LABELS } from '@/types/sinistros';
import type { ElementType } from 'react';

// ============================================
// TIPOS
// ============================================
interface SolicitacaoPendenteData {
  tipo?: string;
  descricao?: string;
  veiculo_id?: string;
  veiculo_placa?: string;
  veiculo_marca?: string;
  veiculo_modelo?: string;
  data_ocorrencia?: string;
  local_ocorrencia?: string;
}

// Mapeamento de tipos para ícones e cores
const getIconeTipo = (tipo: string): { icon: ElementType; bgColor: string; iconColor: string } => {
  const icones: Record<string, { icon: ElementType; bgColor: string; iconColor: string }> = {
    colisao: { icon: Car, bgColor: 'bg-blue-100', iconColor: 'text-blue-600' },
    roubo: { icon: ShieldAlert, bgColor: 'bg-red-100', iconColor: 'text-red-600' },
    furto: { icon: ShieldOff, bgColor: 'bg-orange-100', iconColor: 'text-orange-600' },
    incendio: { icon: Flame, bgColor: 'bg-amber-100', iconColor: 'text-amber-600' },
    fenomeno_natural: { icon: CloudRain, bgColor: 'bg-cyan-100', iconColor: 'text-cyan-600' },
    terceiros: { icon: Users, bgColor: 'bg-purple-100', iconColor: 'text-purple-600' },
    vidros: { icon: Square, bgColor: 'bg-teal-100', iconColor: 'text-teal-600' },
    alagamento: { icon: CloudRain, bgColor: 'bg-sky-100', iconColor: 'text-sky-600' },
    outro: { icon: HelpCircle, bgColor: 'bg-gray-100', iconColor: 'text-gray-600' },
  };
  return icones[tipo] || { icon: HelpCircle, bgColor: 'bg-gray-100', iconColor: 'text-gray-600' };
};

// Configuração de badges de status
const getStatusBadge = (status: string): { label: string; className: string } => {
  const config: Record<string, { label: string; className: string }> = {
    comunicado: { label: 'Comunicado', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    em_analise: { label: 'Em Análise', className: 'bg-blue-100 text-blue-800 border-blue-200' },
    documentacao_pendente: { label: 'Docs Pendentes', className: 'bg-orange-100 text-orange-800 border-orange-200' },
    aprovado: { label: 'Aprovado', className: 'bg-green-100 text-green-800 border-green-200' },
    negado: { label: 'Negado', className: 'bg-red-100 text-red-800 border-red-200' },
    reprovado: { label: 'Reprovado', className: 'bg-red-100 text-red-800 border-red-200' },
    em_regulacao: { label: 'Em Regulação', className: 'bg-purple-100 text-purple-800 border-purple-200' },
    em_reparo: { label: 'Em Reparo', className: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    aguardando_pagamento: { label: 'Aguard. Pgto', className: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
    pago: { label: 'Pago', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    indenizado: { label: 'Indenizado', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    encerrado: { label: 'Encerrado', className: 'bg-gray-100 text-gray-800 border-gray-200' },
    cancelado: { label: 'Cancelado', className: 'bg-gray-100 text-gray-500 border-gray-200' },
  };
  return config[status] || { label: status, className: 'bg-gray-100 text-gray-800 border-gray-200' };
};

// Agrupamento de status para filtros
const statusEmAnalise = ['comunicado', 'em_analise', 'documentacao_pendente'];
const statusAprovados = ['aprovado', 'em_regulacao', 'em_reparo', 'aguardando_pagamento'];
const statusConcluidos = ['pago', 'indenizado', 'encerrado'];
const statusNegados = ['negado', 'reprovado', 'cancelado'];

export default function AppSinistros() {
  const navigate = useNavigate();
  const [filtroAtivo, setFiltroAtivo] = useState('todos');
  const { data: associado } = useMyAssociado();

  // Query sinistros aprovados
  const { data: sinistros, isLoading } = useQuery({
    queryKey: ['my-sinistros-historico', associado?.id],
    queryFn: async () => {
      if (!associado?.id) return [];
      const { data, error } = await supabase
        .from('sinistros')
        .select(`
          id, protocolo, tipo, status, data_ocorrencia, alerta_recem_ativado,
          veiculo:veiculos(placa, marca, modelo)
        `)
        .eq('associado_id', associado.id)
        .order('data_ocorrencia', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!associado?.id,
  });

  // Query para solicitações pendentes (via IA)
  const { data: solicitacoesPendentes, isLoading: isLoadingPendentes } = useQuery({
    queryKey: ['my-sinistros-pendentes', associado?.id],
    queryFn: async () => {
      if (!associado?.id) return [];
      const { data, error } = await supabase
        .from('chat_solicitacoes_ia')
        .select('id, tipo, dados, status, created_at')
        .eq('associado_id', associado.id)
        .eq('tipo', 'sinistro')
        .eq('status', 'pendente')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!associado?.id,
  });

  // Filtrar sinistros por status
  const sinistrosFiltrados = useMemo(() => {
    if (!sinistros) return [];
    
    switch (filtroAtivo) {
      case 'analise':
        return sinistros.filter(s => statusEmAnalise.includes(s.status));
      case 'aprovados':
        return sinistros.filter(s => statusAprovados.includes(s.status));
      case 'concluidos':
        return sinistros.filter(s => statusConcluidos.includes(s.status));
      case 'negados':
        return sinistros.filter(s => statusNegados.includes(s.status));
      default:
        return sinistros;
    }
  }, [sinistros, filtroAtivo]);

  // Contadores para os tabs (incluindo pendentes no "todos")
  const contadores = useMemo(() => {
    const pendentesCount = solicitacoesPendentes?.length || 0;
    if (!sinistros) return { todos: pendentesCount, analise: 0, aprovados: 0, concluidos: 0, negados: 0 };
    return {
      todos: sinistros.length + pendentesCount,
      analise: sinistros.filter(s => statusEmAnalise.includes(s.status)).length,
      aprovados: sinistros.filter(s => statusAprovados.includes(s.status)).length,
      concluidos: sinistros.filter(s => statusConcluidos.includes(s.status)).length,
      negados: sinistros.filter(s => statusNegados.includes(s.status)).length,
    };
  }, [sinistros, solicitacoesPendentes]);

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  const formatDateTime = (dateStr: string) => {
    return format(new Date(dateStr), "dd/MM 'às' HH:mm", { locale: ptBR });
  };

  // Verificar se há dados para exibir
  const temDados = (sinistrosFiltrados?.length > 0) || 
                   (filtroAtivo === 'todos' && (solicitacoesPendentes?.length || 0) > 0);

  return (
    <div className="flex flex-col min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Meus Sinistros</h1>
            <p className="text-sm text-muted-foreground">
              Acompanhe suas ocorrências
            </p>
          </div>
        </div>

        {/* Info Card */}
        <Card className="border-0 bg-amber-50 shadow-sm">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Importante</p>
              <p>Em caso de roubo ou furto, registre o Boletim de Ocorrência antes de abrir o sinistro.</p>
            </div>
          </CardContent>
        </Card>

        {/* Tabs de Filtro */}
        <Tabs value={filtroAtivo} onValueChange={setFiltroAtivo} className="w-full">
          <TabsList className="w-full grid grid-cols-5 h-auto p-1 bg-muted/50">
            <TabsTrigger value="todos" className="text-xs py-2 px-1 data-[state=active]:bg-background">
              Todos
              {contadores.todos > 0 && (
                <span className="ml-1 text-[10px] opacity-70">({contadores.todos})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="analise" className="text-xs py-2 px-1 data-[state=active]:bg-background">
              Análise
              {contadores.analise > 0 && (
                <span className="ml-1 text-[10px] opacity-70">({contadores.analise})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="aprovados" className="text-xs py-2 px-1 data-[state=active]:bg-background">
              Aprovados
              {contadores.aprovados > 0 && (
                <span className="ml-1 text-[10px] opacity-70">({contadores.aprovados})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="concluidos" className="text-xs py-2 px-1 data-[state=active]:bg-background">
              Concluídos
              {contadores.concluidos > 0 && (
                <span className="ml-1 text-[10px] opacity-70">({contadores.concluidos})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="negados" className="text-xs py-2 px-1 data-[state=active]:bg-background">
              Negados
              {contadores.negados > 0 && (
                <span className="ml-1 text-[10px] opacity-70">({contadores.negados})</span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Lista de Sinistros */}
      <div className="flex-1 px-4 space-y-3">
        {isLoading || isLoadingPendentes ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !temDados ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="p-5 rounded-full bg-muted/50 mb-5">
              <FileX className="h-12 w-12 text-muted-foreground/50" />
            </div>
            <h3 className="font-semibold text-lg text-foreground">
              {filtroAtivo === 'todos' 
                ? 'Nenhum sinistro registrado'
                : `Nenhum sinistro ${filtroAtivo === 'analise' ? 'em análise' : filtroAtivo}`}
            </h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs">
              {filtroAtivo === 'todos'
                ? 'Esperamos que você nunca precise registrar um sinistro. Mas caso precise, estamos aqui para ajudar.'
                : 'Não há sinistros nesta categoria no momento.'}
            </p>
            {filtroAtivo === 'todos' && (
              <Button className="mt-6" onClick={() => navigate('/app/sinistros/novo')}>
                <Plus className="h-4 w-4 mr-2" />
                Abrir Sinistro
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Solicitações Pendentes (via IA) - Mostrar apenas no "Todos" */}
            {filtroAtivo === 'todos' && solicitacoesPendentes && solicitacoesPendentes.length > 0 && (
              <div className="space-y-3 mb-4">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Aguardando Aprovação
                </p>
                
                {solicitacoesPendentes.map((solicitacao) => {
                  const dados = solicitacao.dados as SolicitacaoPendenteData | null;
                  const tipoSinistro = dados?.tipo || 'outro';
                  const tipoInfo = getIconeTipo(tipoSinistro);
                  const IconeTipo = tipoInfo.icon;
                  
                  return (
                    <Card 
                      key={solicitacao.id} 
                      className="border-0 shadow-sm bg-amber-50/50 border-l-4 border-l-amber-400"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={cn("p-2.5 rounded-xl flex-shrink-0", tipoInfo.bgColor)}>
                            <IconeTipo className={cn("h-5 w-5", tipoInfo.iconColor)} />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-semibold text-foreground">
                                {TIPO_SINISTRO_LABELS[tipoSinistro as keyof typeof TIPO_SINISTRO_LABELS] || 'Sinistro'}
                              </p>
                              <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                Aguardando
                              </Badge>
                            </div>
                            
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Bot className="h-3 w-3" />
                              <span>Solicitado via IA</span>
                            </div>
                            
                            {/* Veículo - dados do JSONB */}
                            {dados?.veiculo_placa && (
                              <p className="text-sm text-muted-foreground mt-1.5">
                                <span className="font-medium">{dados.veiculo_placa}</span>
                                {dados.veiculo_marca && (
                                  <>
                                    <span className="mx-1.5">-</span>
                                    {dados.veiculo_marca} {dados.veiculo_modelo}
                                  </>
                                )}
                              </p>
                            )}
                            
                            <p className="text-sm text-muted-foreground mt-2">
                              Sua solicitação está sendo analisada pelo diretor.
                            </p>
                            
                            <p className="text-xs text-muted-foreground mt-2">
                              Enviado em {formatDateTime(solicitacao.created_at)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Sinistros já registrados */}
            {sinistrosFiltrados.length > 0 && (
              <>
                {filtroAtivo === 'todos' && (solicitacoesPendentes?.length || 0) > 0 && (
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-2 pt-2">
                    Sinistros Registrados
                  </p>
                )}
                
                {sinistrosFiltrados.map((sinistro) => {
                  const tipoInfo = getIconeTipo(sinistro.tipo);
                  const IconeTipo = tipoInfo.icon;
                  const statusInfo = getStatusBadge(sinistro.status);
                  const veiculo = sinistro.veiculo as { placa: string; marca: string; modelo: string } | null;

                  return (
                    <Card 
                      key={sinistro.id} 
                      className="border-0 shadow-sm hover:shadow-md transition-all cursor-pointer"
                      onClick={() => navigate(`/app/sinistros/${sinistro.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          {/* Ícone do tipo */}
                          <div className={cn("p-2.5 rounded-xl flex-shrink-0", tipoInfo.bgColor)}>
                            <IconeTipo className={cn("h-5 w-5", tipoInfo.iconColor)} />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            {/* Tipo + Badge */}
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-semibold text-foreground">
                                {TIPO_SINISTRO_LABELS[sinistro.tipo as keyof typeof TIPO_SINISTRO_LABELS] || sinistro.tipo}
                              </p>
                              <Badge variant="outline" className={cn("text-xs whitespace-nowrap", statusInfo.className)}>
                                {statusInfo.label}
                              </Badge>
                            </div>
                            
                            {/* Protocolo */}
                            <p className="text-xs font-mono text-muted-foreground mt-0.5">
                              #{sinistro.protocolo}
                            </p>
                            
                            {/* Veículo */}
                            {veiculo && (
                              <p className="text-sm text-muted-foreground mt-1.5">
                                <span className="font-medium">{veiculo.placa}</span>
                                <span className="mx-1.5">-</span>
                                {veiculo.marca} {veiculo.modelo}
                              </p>
                            )}
                            
                            {/* Indicador de pendências */}
                            {sinistro.status === 'documentacao_pendente' && (
                              <div className="flex items-center gap-1 text-orange-600 mt-1.5">
                                <AlertCircle className="h-3.5 w-3.5" />
                                <span className="text-xs font-medium">Documentos pendentes</span>
                              </div>
                            )}
                            
                            {/* Data */}
                            <p className="text-xs text-muted-foreground mt-2">
                              {formatDate(sinistro.data_ocorrencia)}
                            </p>
                          </div>
                          
                          {/* Seta */}
                          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

      {/* FAB - Nova Solicitação */}
      <Button
        className="fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-lg z-50"
        onClick={() => navigate('/app/sinistros/novo')}
      >
        <Plus className="h-6 w-6" />
        <span className="sr-only">Abrir Sinistro</span>
      </Button>
    </div>
  );
}

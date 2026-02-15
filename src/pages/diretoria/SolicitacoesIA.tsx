import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Bot,
  Car,
  Truck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Phone,
  MapPin,
  Calendar,
  AlertTriangle,
  FileText,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface SolicitacaoDados {
  tipo?: string;
  tipo_servico?: string;
  data_ocorrencia?: string;
  local?: string;
  localizacao?: string;
  descricao?: string;
  veiculo_id?: string;
  motivo?: string;
  confirmacao?: boolean;
}

interface SolicitacaoIA {
  id: string;
  tipo: 'sinistro' | 'assistencia' | 'cancelamento' | 'troca_titularidade';
  dados: SolicitacaoDados;
  dados_novo_titular?: {
    nome?: string;
    cpf?: string;
    email?: string;
    telefone?: string;
  } | null;
  status: string;
  created_at: string;
  aprovado_em?: string | null;
  associado_id: string;
  associado?: {
    nome: string;
    telefone: string;
    whatsapp?: string;
  };
}

export default function SolicitacoesIA() {
  const queryClient = useQueryClient();
  const [tabAtiva, setTabAtiva] = useState<string>('pendentes');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSolicitacao, setSelectedSolicitacao] = useState<SolicitacaoIA | null>(null);
  const [acao, setAcao] = useState<'aprovar' | 'rejeitar'>('aprovar');
  const [motivo, setMotivo] = useState('');

  // Query para buscar solicitações
  const { data: solicitacoes, isLoading } = useQuery({
    queryKey: ['solicitacoes-ia', tabAtiva],
    queryFn: async () => {
      let query = supabase
        .from('chat_solicitacoes_ia')
        .select(`
          id, tipo, dados, dados_novo_titular, status, created_at, aprovado_em, associado_id,
          associado:associados!chat_solicitacoes_ia_associado_id_fkey(nome, telefone, whatsapp)
        `)
        .order('created_at', { ascending: false });

      if (tabAtiva === 'pendentes') {
        query = query.eq('status', 'pendente');
      } else if (tabAtiva === 'aprovadas') {
        query = query.eq('status', 'aprovado');
      } else if (tabAtiva === 'rejeitadas') {
        query = query.eq('status', 'rejeitado');
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data as SolicitacaoIA[];
    },
  });

  // Mutation para aprovar/rejeitar
  const processarMutation = useMutation({
    mutationFn: async ({ solicitacao_id, acao, motivo }: { solicitacao_id: string; acao: string; motivo?: string }) => {
      const { data, error } = await supabase.functions.invoke('aprovar-solicitacao-ia', {
        body: { solicitacao_id, acao, motivo },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao processar');
      return data;
    },
    onSuccess: (data) => {
      toast.success(acao === 'aprovar' ? `${data.protocolo} criado com sucesso!` : 'Solicitação rejeitada');
      queryClient.invalidateQueries({ queryKey: ['solicitacoes-ia'] });
      setDialogOpen(false);
      setSelectedSolicitacao(null);
      setMotivo('');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao processar solicitação');
    },
  });

  const handleAcao = (solicitacao: SolicitacaoIA, tipoAcao: 'aprovar' | 'rejeitar') => {
    setSelectedSolicitacao(solicitacao);
    setAcao(tipoAcao);
    setMotivo('');
    setDialogOpen(true);
  };

  const confirmarAcao = () => {
    if (!selectedSolicitacao) return;
    processarMutation.mutate({
      solicitacao_id: selectedSolicitacao.id,
      acao,
      motivo: acao === 'rejeitar' ? motivo : undefined,
    });
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const getTipoIcon = (tipo: string) => {
    if (tipo === 'sinistro') return <ShieldAlert className="h-5 w-5 text-destructive" />;
    if (tipo === 'cancelamento') return <XCircle className="h-5 w-5 text-orange-500" />;
    if (tipo === 'troca_titularidade') return <User className="h-5 w-5 text-blue-500" />;
    return <Truck className="h-5 w-5 text-primary" />;
  };

  const getTipoLabel = (tipo: string) => {
    if (tipo === 'sinistro') return 'Sinistro';
    if (tipo === 'cancelamento') return 'Cancelamento';
    if (tipo === 'troca_titularidade') return 'Troca de Titularidade';
    return 'Assistência 24h';
  };

  const contadores = {
    pendentes: solicitacoes?.filter(s => s.status === 'pendente').length || 0,
    aprovadas: solicitacoes?.filter(s => s.status === 'aprovado').length || 0,
    rejeitadas: solicitacoes?.filter(s => s.status === 'rejeitado').length || 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-7 w-7 text-primary" />
            Solicitações via IA
          </h1>
          <p className="text-muted-foreground">
            Aprove ou rejeite solicitações de sinistros e assistências criadas pela IA
          </p>
        </div>
      </div>

      <Tabs value={tabAtiva} onValueChange={setTabAtiva}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="pendentes" className="gap-2">
            <Clock className="h-4 w-4" />
            Pendentes
            {contadores.pendentes > 0 && (
              <Badge variant="secondary" className="ml-1">{contadores.pendentes}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="aprovadas" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Aprovadas
          </TabsTrigger>
          <TabsTrigger value="rejeitadas" className="gap-2">
            <XCircle className="h-4 w-4" />
            Rejeitadas
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tabAtiva} className="mt-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-24 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !solicitacoes || solicitacoes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Bot className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <p className="font-medium text-lg">Nenhuma solicitação {tabAtiva}</p>
                <p className="text-muted-foreground text-sm mt-1">
                  {tabAtiva === 'pendentes'
                    ? 'Todas as solicitações foram processadas'
                    : `Não há solicitações ${tabAtiva} no momento`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {solicitacoes.map((solicitacao) => {
                const dados = solicitacao.dados;
                const associadoData = solicitacao.associado as { nome: string; telefone: string; whatsapp?: string } | null;

                return (
                  <Card key={solicitacao.id} className={cn(
                    "transition-all border-l-4",
                    ({
                      sinistro: 'border-l-red-500 bg-red-50/30 dark:bg-red-950/10',
                      assistencia: 'border-l-blue-500 bg-blue-50/30 dark:bg-blue-950/10',
                      cancelamento: 'border-l-orange-500 bg-orange-50/30 dark:bg-orange-950/10',
                      troca_titularidade: 'border-l-purple-500 bg-purple-50/30 dark:bg-purple-950/10',
                    } as Record<string, string>)[solicitacao.tipo] || 'border-l-amber-400'
                  )}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {getTipoIcon(solicitacao.tipo)}
                          <div>
                            <CardTitle className="text-lg">{getTipoLabel(solicitacao.tipo)}</CardTitle>
                            <CardDescription className="flex items-center gap-2 mt-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {formatDate(solicitacao.created_at)}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge
                          variant={
                            solicitacao.status === 'pendente'
                              ? 'outline'
                              : solicitacao.status === 'aprovado'
                              ? 'default'
                              : 'destructive'
                          }
                        >
                          {solicitacao.status === 'pendente' && <Clock className="h-3 w-3 mr-1" />}
                          {solicitacao.status === 'aprovado' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {solicitacao.status === 'rejeitado' && <XCircle className="h-3 w-3 mr-1" />}
                          {solicitacao.status.charAt(0).toUpperCase() + solicitacao.status.slice(1)}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Dados do Associado */}
                      {associadoData && (
                        <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                          <User className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{associadoData.nome}</p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {associadoData.whatsapp || associadoData.telefone}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Detalhes da Solicitação */}
                      <div className="grid gap-3 sm:grid-cols-2">
                        {solicitacao.tipo === 'sinistro' && (
                          <>
                            <div className="flex items-start gap-2">
                              <Car className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <div>
                                <p className="text-xs text-muted-foreground">Tipo do Sinistro</p>
                                <p className="text-sm font-medium capitalize">{(dados.tipo as string) || 'Não informado'}</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <div>
                                <p className="text-xs text-muted-foreground">Data/Hora</p>
                                <p className="text-sm font-medium">{(dados.data_ocorrencia as string) || 'Não informada'}</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-2 sm:col-span-2">
                              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <div>
                                <p className="text-xs text-muted-foreground">Local</p>
                                <p className="text-sm font-medium">{(dados.local as string) || 'Não informado'}</p>
                              </div>
                            </div>
                          </>
                        )}

                        {solicitacao.tipo === 'assistencia' && (
                          <>
                            <div className="flex items-start gap-2">
                              <Truck className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <div>
                                <p className="text-xs text-muted-foreground">Tipo de Serviço</p>
                                <p className="text-sm font-medium capitalize">
                                  {((dados.tipo_servico as string) || 'guincho').replace('_', ' ')}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <div>
                                <p className="text-xs text-muted-foreground">Localização</p>
                                <p className="text-sm font-medium">{(dados.localizacao as string) || 'Não informada'}</p>
                              </div>
                            </div>
                          </>
                        )}

                        {dados.descricao && (
                          <div className="flex items-start gap-2 sm:col-span-2">
                            <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="text-xs text-muted-foreground">Descrição</p>
                              <p className="text-sm">{dados.descricao as string}</p>
                            </div>
                          </div>
                        )}

                        {/* Cancelamento */}
                        {solicitacao.tipo === 'cancelamento' && dados.motivo && (
                          <div className="flex items-start gap-2 sm:col-span-2">
                            <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                            <div>
                              <p className="text-xs text-muted-foreground">Motivo do Cancelamento</p>
                              <p className="text-sm font-medium">{dados.motivo as string}</p>
                            </div>
                          </div>
                        )}

                        {/* Troca de Titularidade - dados do novo titular */}
                        {solicitacao.tipo === 'troca_titularidade' && solicitacao.dados_novo_titular && (
                          <div className="sm:col-span-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2">Dados do Novo Titular</p>
                            <div className="grid gap-1 text-sm">
                              <p><strong>Nome:</strong> {solicitacao.dados_novo_titular.nome}</p>
                              <p><strong>CPF:</strong> {solicitacao.dados_novo_titular.cpf}</p>
                              <p><strong>Email:</strong> {solicitacao.dados_novo_titular.email}</p>
                              <p><strong>Telefone:</strong> {solicitacao.dados_novo_titular.telefone}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Botões de Ação (apenas pendentes) */}
                      {solicitacao.status === 'pendente' && (
                        <div className="flex gap-3 pt-2">
                          <Button
                            variant="default"
                            className="flex-1"
                            onClick={() => handleAcao(solicitacao, 'aprovar')}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Aprovar
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => handleAcao(solicitacao, 'rejeitar')}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Rejeitar
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog de Confirmação */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {acao === 'aprovar' ? (
                <CheckCircle2 className="h-5 w-5 text-primary" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-destructive" />
              )}
              {acao === 'aprovar' ? 'Aprovar Solicitação' : 'Rejeitar Solicitação'}
            </DialogTitle>
            <DialogDescription>
              {acao === 'aprovar'
                ? `Isso irá criar um ${selectedSolicitacao?.tipo === 'sinistro' ? 'sinistro' : 'chamado de assistência'} real no sistema.`
                : 'Informe o motivo da rejeição.'}
            </DialogDescription>
          </DialogHeader>

          {acao === 'rejeitar' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo da rejeição</label>
              <Textarea
                placeholder="Informe o motivo..."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant={acao === 'aprovar' ? 'default' : 'destructive'}
              onClick={confirmarAcao}
              disabled={processarMutation.isPending || (acao === 'rejeitar' && !motivo.trim())}
            >
              {processarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {acao === 'aprovar' ? 'Confirmar Aprovação' : 'Confirmar Rejeição'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

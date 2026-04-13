import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, XCircle, Clock, Car, Loader2, Users, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useAprovacoesDiretoria, useVotarAprovacaoDiretoria, type AprovacaoDiretoria } from '@/hooks/useAprovacoesDiretoria';
import { useConfigDuplaAprovacao } from '@/hooks/useAprovacoesFipeDiretoria';
import { formatarMoeda } from '@/utils/format';

const STATUS_CONFIG = {
  pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  aprovado: { label: 'Aprovado', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  recusado: { label: 'Recusado', color: 'bg-red-100 text-red-800', icon: XCircle },
};

interface CotacaoAgrupada {
  cotacao_id: string;
  cotacao: AprovacaoDiretoria['cotacao'];
  created_at: string | null;
  votos: Array<{
    id: string;
    diretor_nome: string;
    status: string;
    respondido_em: string | null;
  }>;
  statusGeral: 'pendente' | 'aprovado' | 'recusado';
  total_aprovados: number;
  total_votos: number;
}

function agruparPorCotacao(items: AprovacaoDiretoria[], minimoVotos: number): CotacaoAgrupada[] {
  const map = new Map<string, CotacaoAgrupada>();

  for (const item of items) {
    if (!map.has(item.cotacao_id)) {
      map.set(item.cotacao_id, {
        cotacao_id: item.cotacao_id,
        cotacao: item.cotacao,
        created_at: item.created_at,
        votos: [],
        statusGeral: 'pendente',
        total_aprovados: item.total_aprovados || 0,
        total_votos: item.total_votos || 0,
      });
    }
    const grupo = map.get(item.cotacao_id)!;
    grupo.votos.push({
      id: item.id,
      diretor_nome: item.diretor?.nome || 'Diretor',
      status: item.status,
      respondido_em: item.respondido_em,
    });
  }

  // Determinar status geral
  for (const grupo of map.values()) {
    const aprovados = grupo.votos.filter((v) => v.status === 'aprovado').length;
    const todosResponderam = grupo.votos.every((v) => v.status !== 'pendente');
    if (aprovados >= minimoVotos) {
      grupo.statusGeral = 'aprovado';
    } else if (todosResponderam) {
      grupo.statusGeral = 'recusado';
    } else {
      grupo.statusGeral = 'pendente';
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const da = a.created_at ? new Date(a.created_at).getTime() : 0;
    const db = b.created_at ? new Date(b.created_at).getTime() : 0;
    return db - da;
  });
}

export function PainelAprovacoesDiretoria() {
  const [tab, setTab] = useState('pendente');
  const { data: items = [], isLoading } = useAprovacoesDiretoria();
  const { data: config } = useConfigDuplaAprovacao();
  const votar = useVotarAprovacaoDiretoria();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'aprovar' | 'recusar'>('aprovar');
  const [selectedVoto, setSelectedVoto] = useState<{ id: string; cotacao_id: string; cotacao?: AprovacaoDiretoria['cotacao'] } | null>(null);

  const minimoVotos = config?.minimoVotos || 2;

  const agrupados = useMemo(() => agruparPorCotacao(items, minimoVotos), [items, minimoVotos]);

  const filtrados = useMemo(() => {
    if (tab === 'todas') return agrupados;
    return agrupados.filter((g) => g.statusGeral === tab);
  }, [agrupados, tab]);

  const openDialog = (votoId: string, cotacaoId: string, cotacao: AprovacaoDiretoria['cotacao'], mode: 'aprovar' | 'recusar') => {
    setSelectedVoto({ id: votoId, cotacao_id: cotacaoId, cotacao });
    setDialogMode(mode);
    setDialogOpen(true);
  };

  const handleConfirm = async () => {
    if (!selectedVoto) return;
    await votar.mutateAsync({
      id: selectedVoto.id,
      cotacao_id: selectedVoto.cotacao_id,
      voto: dialogMode === 'aprovar' ? 'aprovado' : 'recusado',
    });
    setDialogOpen(false);
    setSelectedVoto(null);
  };

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pendente"><Clock className="h-4 w-4 mr-1" />Pendentes</TabsTrigger>
          <TabsTrigger value="aprovado"><CheckCircle2 className="h-4 w-4 mr-1" />Aprovados</TabsTrigger>
          <TabsTrigger value="recusado"><XCircle className="h-4 w-4 mr-1" />Recusados</TabsTrigger>
          <TabsTrigger value="todas">Todas</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtrados.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhuma solicitação encontrada
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filtrados.map((grupo) => {
                const cfg = STATUS_CONFIG[grupo.statusGeral];
                const StatusIcon = cfg.icon;
                const responderam = grupo.votos.filter((v) => v.status !== 'pendente').length;
                const progressPct = grupo.votos.length > 0 ? (responderam / grupo.votos.length) * 100 : 0;

                return (
                  <Card key={grupo.cotacao_id} className="overflow-hidden">
                    <CardContent className="p-5">
                      <div className="space-y-4">
                        {/* Header */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <Badge className={cfg.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />{cfg.label}
                          </Badge>
                          {grupo.cotacao?.numero && (
                            <span className="text-sm font-mono text-muted-foreground">{grupo.cotacao.numero}</span>
                          )}
                          {grupo.created_at && (
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(grupo.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                          )}
                        </div>

                        {/* Info do veículo e associado */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Associado</p>
                            <p className="font-medium">{grupo.cotacao?.nome_solicitante || '—'}</p>
                            {grupo.cotacao?.cpf_solicitante && (
                              <p className="text-xs text-muted-foreground">CPF: {grupo.cotacao.cpf_solicitante}</p>
                            )}
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Veículo</p>
                            <p className="font-medium flex items-center gap-1">
                              <Car className="h-3.5 w-3.5" />
                              {grupo.cotacao?.veiculo_marca} {grupo.cotacao?.veiculo_modelo} {grupo.cotacao?.veiculo_ano}
                              {grupo.cotacao?.veiculo_placa && (
                                <span className="text-muted-foreground ml-1">({grupo.cotacao.veiculo_placa})</span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Valor FIPE */}
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground">Valor FIPE</p>
                          <p className="font-bold text-primary">
                            {grupo.cotacao?.valor_fipe ? formatarMoeda(grupo.cotacao.valor_fipe) : '—'}
                          </p>
                        </div>

                        {/* Progresso de respostas */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <Users className="h-4 w-4" />
                              Respostas dos diretores
                            </span>
                            <span className="font-mono text-xs">
                              {responderam}/{grupo.votos.length} responderam • {grupo.total_aprovados}/{minimoVotos} aprovações necessárias
                            </span>
                          </div>
                          <Progress value={progressPct} className="h-2" />
                        </div>

                        {/* Lista de diretores */}
                        <div className="border rounded-lg divide-y">
                          {grupo.votos.map((voto) => {
                            const vcfg = STATUS_CONFIG[voto.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pendente;
                            const VIcon = vcfg.icon;
                            return (
                              <div key={voto.id} className="flex items-center justify-between p-3 text-sm">
                                <div className="flex items-center gap-2">
                                  <VIcon className="h-4 w-4" style={{ color: voto.status === 'aprovado' ? '#16a34a' : voto.status === 'recusado' ? '#dc2626' : '#ca8a04' }} />
                                  <span className="font-medium">{voto.diretor_nome}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className={vcfg.color + ' text-xs'}>
                                    {vcfg.label}
                                  </Badge>
                                  {voto.respondido_em && (
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(voto.respondido_em), "dd/MM 'às' HH:mm", { locale: ptBR })}
                                    </span>
                                  )}
                                  {voto.status === 'pendente' && (
                                    <div className="flex gap-1 ml-2">
                                      <Button size="sm" variant="ghost" className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => openDialog(voto.id, grupo.cotacao_id, grupo.cotacao, 'aprovar')}>
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => openDialog(voto.id, grupo.cotacao_id, grupo.cotacao, 'recusar')}>
                                        <XCircle className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog de confirmação */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {dialogMode === 'aprovar' ? (
                <><CheckCircle2 className="h-5 w-5 text-green-600" />Aprovar FIPE</>
              ) : (
                <><XCircle className="h-5 w-5 text-destructive" />Recusar FIPE</>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedVoto && (
            <div className="space-y-4">
              <div className="text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Associado:</span>{' '}
                  <strong>{selectedVoto.cotacao?.nome_solicitante}</strong>
                </p>
                <p>
                  <span className="text-muted-foreground">Veículo:</span>{' '}
                  <strong>{selectedVoto.cotacao?.veiculo_marca} {selectedVoto.cotacao?.veiculo_modelo} {selectedVoto.cotacao?.veiculo_ano}</strong>
                </p>
                {selectedVoto.cotacao?.valor_fipe && (
                  <p>
                    <span className="text-muted-foreground">Valor FIPE:</span>{' '}
                    <strong>{formatarMoeda(selectedVoto.cotacao.valor_fipe)}</strong>
                  </p>
                )}
              </div>

              {dialogMode === 'recusar' && (
                <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Seu voto de recusa será registrado.
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleConfirm}
              disabled={votar.isPending}
              variant={dialogMode === 'recusar' ? 'destructive' : 'default'}
            >
              {votar.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {dialogMode === 'aprovar' ? 'Confirmar Aprovação' : 'Confirmar Recusa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

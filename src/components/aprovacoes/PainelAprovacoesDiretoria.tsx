import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, XCircle, Clock, Car, Loader2, Users, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAprovacoesDiretoria, useVotarAprovacaoDiretoria, type AprovacaoDiretoria } from '@/hooks/useAprovacoesDiretoria';
import { useConfigDuplaAprovacao } from '@/hooks/useAprovacoesFipeDiretoria';
import { formatarMoeda } from '@/utils/format';

const STATUS_CONFIG = {
  pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  aprovado: { label: 'Aprovado', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  recusado: { label: 'Recusado', color: 'bg-red-100 text-red-800', icon: XCircle },
};

export function PainelAprovacoesDiretoria() {
  const [tab, setTab] = useState('pendente');
  const { data: items = [], isLoading } = useAprovacoesDiretoria(tab === 'todas' ? undefined : tab);
  const { data: config } = useConfigDuplaAprovacao();
  const votar = useVotarAprovacaoDiretoria();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'aprovar' | 'recusar'>('aprovar');
  const [selectedItem, setSelectedItem] = useState<AprovacaoDiretoria | null>(null);

  const openDialog = (item: AprovacaoDiretoria, mode: 'aprovar' | 'recusar') => {
    setSelectedItem(item);
    setDialogMode(mode);
    setDialogOpen(true);
  };

  const handleConfirm = async () => {
    if (!selectedItem) return;
    await votar.mutateAsync({
      id: selectedItem.id,
      cotacao_id: selectedItem.cotacao_id,
      voto: dialogMode === 'aprovar' ? 'aprovado' : 'recusado',
    });
    setDialogOpen(false);
    setSelectedItem(null);
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
          ) : items.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhuma solicitação encontrada
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {items.map((item) => {
                const cfg = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pendente;
                const StatusIcon = cfg.icon;
                const minimoVotos = config?.minimoVotos || 2;
                return (
                  <Card key={item.id} className="overflow-hidden">
                    <CardContent className="p-5">
                      <div className="flex flex-col md:flex-row md:items-start gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            <Badge className={cfg.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />{cfg.label}
                            </Badge>
                            {item.cotacao?.numero && (
                              <span className="text-sm font-mono text-muted-foreground">{item.cotacao.numero}</span>
                            )}
                            {item.created_at && (
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-muted-foreground">Associado</p>
                              <p className="font-medium">{item.cotacao?.nome_solicitante || '—'}</p>
                              {item.cotacao?.cpf_solicitante && (
                                <p className="text-xs text-muted-foreground">CPF: {item.cotacao.cpf_solicitante}</p>
                              )}
                              {item.cotacao?.telefone_solicitante && (
                                <p className="text-xs text-muted-foreground">Tel: {item.cotacao.telefone_solicitante}</p>
                              )}
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Veículo</p>
                              <p className="font-medium flex items-center gap-1">
                                <Car className="h-3.5 w-3.5" />
                                {item.cotacao?.veiculo_marca} {item.cotacao?.veiculo_modelo} {item.cotacao?.veiculo_ano}
                                {item.cotacao?.veiculo_placa && (
                                  <span className="text-muted-foreground ml-1">({item.cotacao.veiculo_placa})</span>
                                )}
                              </p>
                              {item.cotacao?.categoria_placa && (
                                <p className="text-xs text-muted-foreground">Categoria: {item.cotacao.categoria_placa}</p>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-muted/50">
                            <div>
                              <p className="text-xs text-muted-foreground">Valor FIPE</p>
                              <p className="font-bold text-primary">
                                {item.cotacao?.valor_fipe ? formatarMoeda(item.cotacao.valor_fipe) : '—'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Categoria</p>
                              <p className="text-sm font-medium capitalize">{item.cotacao?.categoria_placa || '—'}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-sm">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Votos:</span>
                            <Badge variant="outline" className="font-mono">
                              {item.total_aprovados}/{minimoVotos} aprovações necessárias
                            </Badge>
                          </div>

                          {item.diretor?.nome && (
                            <p className="text-xs text-muted-foreground">
                              Diretor: <span className="font-medium text-foreground">{item.diretor.nome}</span>
                            </p>
                          )}
                        </div>

                        {item.status === 'pendente' && (
                          <div className="flex flex-row md:flex-col gap-2 shrink-0">
                            <Button size="sm" onClick={() => openDialog(item, 'aprovar')} className="gap-1">
                              <CheckCircle2 className="h-4 w-4" />Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openDialog(item, 'recusar')}
                              className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                            >
                              <XCircle className="h-4 w-4" />Recusar
                            </Button>
                          </div>
                        )}
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
                <><CheckCircle2 className="h-5 w-5 text-green-600" />Aprovar FIPE Diretoria</>
              ) : (
                <><XCircle className="h-5 w-5 text-destructive" />Recusar FIPE Diretoria</>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4">
              <div className="text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Associado:</span>{' '}
                  <strong>{selectedItem.cotacao?.nome_solicitante}</strong>
                </p>
                <p>
                  <span className="text-muted-foreground">Veículo:</span>{' '}
                  <strong>{selectedItem.cotacao?.veiculo_marca} {selectedItem.cotacao?.veiculo_modelo} {selectedItem.cotacao?.veiculo_ano}</strong>
                </p>
                {selectedItem.cotacao?.valor_fipe && (
                  <p>
                    <span className="text-muted-foreground">Valor FIPE:</span>{' '}
                    <strong>{formatarMoeda(selectedItem.cotacao.valor_fipe)}</strong>
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

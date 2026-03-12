import { useState } from 'react';
import { CheckCircle2, XCircle, Clock, ShieldCheck, Loader2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  useListarAprovacoesElegibilidade,
  useAprovarElegibilidade,
  useRecusarElegibilidade,
  useDoubleCheckElegibilidade,
  type AprovacaoElegibilidade,
} from '@/hooks/useAprovacaoElegibilidade';
import { usePermissions } from '@/hooks/usePermissions';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function PainelAprovacoesElegibilidade() {
  const [statusTab, setStatusTab] = useState('pendente');
  const { data: aprovacoes = [], isLoading } = useListarAprovacoesElegibilidade(statusTab === 'todas' ? undefined : statusTab);
  const permissions = usePermissions();
  const canApprove = permissions.canApproveElegibilidade || permissions.isDiretor;
  const canDoubleCheck = permissions.canViewElegibilidadePendente && !canApprove;

  const [dialogAction, setDialogAction] = useState<{ type: 'aprovar' | 'recusar'; item: AprovacaoElegibilidade } | null>(null);
  const [observacao, setObservacao] = useState('');

  const aprovar = useAprovarElegibilidade();
  const recusar = useRecusarElegibilidade();
  const doubleCheck = useDoubleCheckElegibilidade();

  const handleAction = () => {
    if (!dialogAction) return;
    const { type, item } = dialogAction;

    const mutation = type === 'aprovar' ? aprovar : recusar;
    mutation.mutate(
      {
        id: item.id,
        observacao: observacao.trim() || undefined,
        solicitante_id: item.solicitante_id,
      },
      {
        onSuccess: () => {
          setDialogAction(null);
          setObservacao('');
        },
      }
    );
  };

  const pendentes = aprovacoes.filter(a => a.status === 'pendente').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Aprovações de Elegibilidade
          {pendentes > 0 && (
            <Badge variant="destructive" className="ml-2">{pendentes} pendente(s)</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={statusTab} onValueChange={setStatusTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="pendente">Pendentes</TabsTrigger>
            <TabsTrigger value="aprovado">Aprovadas</TabsTrigger>
            <TabsTrigger value="recusado">Recusadas</TabsTrigger>
            <TabsTrigger value="todas">Todas</TabsTrigger>
          </TabsList>

          <TabsContent value={statusTab}>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : aprovacoes.length === 0 ? (
              <p className="text-muted-foreground text-center py-8 text-sm">
                Nenhuma solicitação {statusTab !== 'todas' ? statusTab : ''} encontrada
              </p>
            ) : (
              <div className="space-y-3">
                {aprovacoes.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border bg-card p-4 space-y-3"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">
                            {item.marca} {item.modelo} {item.ano}
                          </span>
                          {item.placa && (
                            <Badge variant="outline" className="text-xs">{item.placa}</Badge>
                          )}
                          <StatusBadge status={item.status} />
                          {item.supervisor_check && (
                            <Badge variant="outline" className="text-green-400 border-green-500/30 bg-green-500/10 gap-1 text-xs">
                              <CheckCircle2 className="h-3 w-3" />
                              Revisado pela supervisão
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Plano: <strong>{item.plano?.nome || 'N/A'}</strong>
                          {item.cotacao?.numero && ` • Cotação #${item.cotacao.numero}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Solicitante: {item.solicitante?.nome || 'N/A'}
                          {' • '}
                          {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>

                    {/* Justificativa */}
                    <div className="bg-muted/50 rounded-md p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Justificativa</p>
                      <p className="text-sm">{item.justificativa}</p>
                    </div>

                    {/* Observação do aprovador */}
                    {item.observacao_aprovador && (
                      <div className="bg-primary/5 rounded-md p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Observação do aprovador</p>
                        <p className="text-sm">{item.observacao_aprovador}</p>
                      </div>
                    )}

                    {/* Supervisor info */}
                    {item.supervisor_check && item.supervisor?.nome && (
                      <p className="text-xs text-muted-foreground">
                        Revisado por: {item.supervisor.nome}
                        {item.supervisor_check_em && ` em ${format(new Date(item.supervisor_check_em), "dd/MM 'às' HH:mm", { locale: ptBR })}`}
                      </p>
                    )}

                    {/* Ações */}
                    {item.status === 'pendente' && (
                      <div className="flex gap-2 pt-1">
                        {canApprove && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => {
                                setDialogAction({ type: 'aprovar', item });
                                setObservacao('');
                              }}
                              className="gap-1"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setDialogAction({ type: 'recusar', item });
                                setObservacao('');
                              }}
                              className="gap-1"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Recusar
                            </Button>
                          </>
                        )}
                        {canDoubleCheck && !item.supervisor_check && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => doubleCheck.mutate({ id: item.id })}
                            disabled={doubleCheck.isPending}
                            className="gap-1"
                          >
                            {doubleCheck.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                            Confirmar Revisão
                          </Button>
                        )}
                        {canDoubleCheck && item.supervisor_check && (
                          <span className="text-xs text-green-400 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Revisão já confirmada
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Dialog de ação */}
      <Dialog open={!!dialogAction} onOpenChange={(open) => !open && setDialogAction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogAction?.type === 'aprovar' ? 'Aprovar' : 'Recusar'} Elegibilidade
            </DialogTitle>
            <DialogDescription>
              {dialogAction?.item && (
                <>
                  {dialogAction.item.marca} {dialogAction.item.modelo} {dialogAction.item.ano}
                  {' — '}Plano: {dialogAction.item.plano?.nome}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <Textarea
            placeholder="Observação (opcional)"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={3}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAction(null)}>
              Cancelar
            </Button>
            <Button
              variant={dialogAction?.type === 'recusar' ? 'destructive' : 'default'}
              onClick={handleAction}
              disabled={aprovar.isPending || recusar.isPending}
            >
              {(aprovar.isPending || recusar.isPending) ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {dialogAction?.type === 'aprovar' ? 'Confirmar Aprovação' : 'Confirmar Recusa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'pendente':
      return (
        <Badge variant="outline" className="text-yellow-400 border-yellow-500/30 bg-yellow-500/10 gap-1 text-xs">
          <Clock className="h-3 w-3" /> Pendente
        </Badge>
      );
    case 'aprovado':
      return (
        <Badge variant="outline" className="text-green-400 border-green-500/30 bg-green-500/10 gap-1 text-xs">
          <CheckCircle2 className="h-3 w-3" /> Aprovado
        </Badge>
      );
    case 'recusado':
      return (
        <Badge variant="outline" className="text-red-400 border-red-500/30 bg-red-500/10 gap-1 text-xs">
          <XCircle className="h-3 w-3" /> Recusado
        </Badge>
      );
    default:
      return null;
  }
}

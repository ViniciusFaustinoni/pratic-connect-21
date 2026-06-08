import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle, CheckCircle2, Clock, Loader2, Car, Eye, ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  useAprovacoesBypassTroca,
  useMarcarCienteBypassTroca,
  type AprovacaoBypassTroca,
} from '@/hooks/useAprovacoesBypassTroca';

const TIPO_LABEL: Record<AprovacaoBypassTroca['tipo'], { label: string; className: string }> = {
  bypass_janela: {
    label: 'Aprovada fora da janela',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300/40',
  },
  troca_convertida_cotacao: {
    label: 'Convertida em cotação',
    className: 'bg-slate-200 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200 border-slate-400/40',
  },
};

export function PainelAprovacoesBypassTroca() {
  const [tab, setTab] = useState('ciente_pendente');
  const { data: itens = [], isLoading } = useAprovacoesBypassTroca(tab === 'todas' ? undefined : tab);
  const marcarCiente = useMarcarCienteBypassTroca();

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<AprovacaoBypassTroca | null>(null);
  const [observacao, setObservacao] = useState('');

  const openDialog = (item: AprovacaoBypassTroca) => {
    setSelected(item);
    setObservacao('');
    setOpen(true);
  };

  const confirm = async () => {
    if (!selected) return;
    await marcarCiente.mutateAsync({ id: selected.id, observacao });
    setOpen(false);
    setSelected(null);
  };

  return (
    <div className="space-y-4">
      <Alert className="border-amber-500/30 bg-amber-50 dark:bg-amber-950/20">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-sm text-amber-700 dark:text-amber-400">
          Trocas de titularidade aprovadas <strong>fora da janela do mesmo-dia</strong> ou
          <strong> convertidas em cotação normal</strong> pelo Cadastro aparecem aqui.
          Esta tela é apenas para ciência — <strong>não bloqueia</strong> o fluxo.
        </AlertDescription>
      </Alert>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="ciente_pendente"><Clock className="h-4 w-4 mr-1" />Pendentes</TabsTrigger>
          <TabsTrigger value="ciente"><CheckCircle2 className="h-4 w-4 mr-1" />Cientes</TabsTrigger>
          <TabsTrigger value="todas">Todas</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : itens.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhuma aprovação de bypass encontrada
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {itens.map((item) => {
                const tipo = TIPO_LABEL[item.tipo];
                const pendente = item.status === 'ciente_pendente';
                return (
                  <Card key={item.id} className="overflow-hidden">
                    <CardContent className="p-5">
                      <div className="flex flex-col md:flex-row md:items-start gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            <Badge className={tipo.className} variant="outline">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {tipo.label}
                            </Badge>
                            {pendente ? (
                              <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>
                            ) : (
                              <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Ciente</Badge>
                            )}
                            {item.cotacao?.numero && (
                              <span className="text-sm font-mono text-muted-foreground">{item.cotacao.numero}</span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-muted-foreground">Associado</p>
                              <p className="font-medium">{item.cotacao?.nome_solicitante || '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Veículo</p>
                              <p className="font-medium flex items-center gap-1">
                                <Car className="h-3.5 w-3.5" />
                                {item.veiculo?.marca} {item.veiculo?.modelo} {item.veiculo?.ano}
                                {(item.veiculo?.placa || item.placa) && (
                                  <span className="text-muted-foreground ml-1">
                                    ({item.veiculo?.placa || item.placa})
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-muted/50">
                            <div>
                              <p className="text-xs text-muted-foreground">Autorizado por</p>
                              <p className="font-semibold">{item.nome_autorizador}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Operador (Cadastro)</p>
                              <p className="font-medium">{item.operador_nome || '—'}</p>
                            </div>
                          </div>

                          <div>
                            <p className="text-xs text-muted-foreground">Justificativa</p>
                            <p className="text-sm whitespace-pre-wrap">{item.justificativa}</p>
                          </div>

                          {!pendente && item.ciente_em && (
                            <div className="border-t pt-2 mt-2 space-y-1">
                              <p className="text-xs text-muted-foreground">
                                Ciência registrada em {format(new Date(item.ciente_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </p>
                              {item.observacao_supervisor && (
                                <p className="text-sm"><span className="text-muted-foreground">Observação:</span> {item.observacao_supervisor}</p>
                              )}
                            </div>
                          )}

                          {item.contrato_id && (
                            <Link
                              to={`/cadastro/proposta/${item.contrato_id}`}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              Abrir contrato <ArrowRight className="h-3 w-3" />
                            </Link>
                          )}
                        </div>

                        {pendente && (
                          <div className="flex flex-row md:flex-col gap-2 shrink-0">
                            <Button size="sm" onClick={() => openDialog(item)} className="gap-1">
                              <Eye className="h-4 w-4" />Marcar como Ciente
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Marcar como Ciente
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Tipo:</span> <strong>{TIPO_LABEL[selected.tipo].label}</strong></p>
                <p><span className="text-muted-foreground">Associado:</span> <strong>{selected.cotacao?.nome_solicitante || '—'}</strong></p>
                <p><span className="text-muted-foreground">Autorizado por:</span> <strong>{selected.nome_autorizador}</strong></p>
              </div>

              <Alert className="border-primary/30 bg-primary/5">
                <AlertDescription className="text-xs">
                  Esta é apenas uma ciência — a decisão do Cadastro já está aplicada. Marcar como ciente não altera o processo.
                </AlertDescription>
              </Alert>

              <div>
                <label className="text-sm font-medium">Observação (opcional)</label>
                <Textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Comentário interno sobre este bypass..."
                  rows={3}
                  className="mt-1.5"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={confirm} disabled={marcarCiente.isPending}>
              {marcarCiente.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Confirmar Ciência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

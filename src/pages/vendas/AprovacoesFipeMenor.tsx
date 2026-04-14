import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, XCircle, Clock, Car, TrendingDown, AlertTriangle, Loader2, ShieldOff, ShieldCheck, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent } from '@/components/ui/card';
import { PainelAprovacoesElegibilidade } from '@/components/aprovacoes/PainelAprovacoesElegibilidade';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  useAprovacoesFipeMenor,
  useAprovarFipeMenor,
  useRecusarFipeMenor,
  type AprovacaoFipeMenor,
} from '@/hooks/useAprovacoesFipeMenor';
import { useFipeMenorAtivo } from '@/hooks/useFipeMenorAtivo';
import { formatarMoeda } from '@/utils/format';

const STATUS_CONFIG = {
  pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  aprovado: { label: 'Aprovado', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  recusado: { label: 'Recusado', color: 'bg-red-100 text-red-800', icon: XCircle },
};

type SectionTab = 'fipe_menor' | 'elegibilidade';

export default function AprovacoesFipeMenor() {
  const [section, setSection] = useState<SectionTab>('fipe_menor');
  const [tab, setTab] = useState('pendente');
  
  // FIPE Menor hooks
  const { data: solicitacoes = [], isLoading } = useAprovacoesFipeMenor(tab === 'todas' ? undefined : tab);
  const aprovar = useAprovarFipeMenor();
  const recusar = useRecusarFipeMenor();
  const { fipeMenorAtivo } = useFipeMenorAtivo();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'aprovar' | 'recusar'>('aprovar');
  const [selectedItem, setSelectedItem] = useState<AprovacaoFipeMenor | null>(null);
  const [observacao, setObservacao] = useState('');

  const openDialog = (item: AprovacaoFipeMenor, mode: 'aprovar' | 'recusar') => {
    setSelectedItem(item);
    setDialogMode(mode);
    setObservacao('');
    setDialogOpen(true);
  };

  const handleConfirm = async () => {
    if (!selectedItem) return;
    if (dialogMode === 'aprovar') {
      await aprovar.mutateAsync({ id: selectedItem.id, observacao, cotacao_id: selectedItem.cotacao_id });
    } else {
      await recusar.mutateAsync({ id: selectedItem.id, observacao, cotacao_id: selectedItem.cotacao_id });
    }
    setDialogOpen(false);
    setSelectedItem(null);
  };

  const economia = (item: AprovacaoFipeMenor) =>
    item.valor_mensal_original - item.valor_mensal_reduzido;

  const isPending = aprovar.isPending || recusar.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Aprovações</h1>
        <p className="text-muted-foreground">
          Solicitações de FIPE menor e elegibilidade de veículos
        </p>
      </div>

      {/* Section tabs */}
      <Tabs value={section} onValueChange={(v) => { setSection(v as SectionTab); setTab('pendente'); }}>
        <TooltipProvider delayDuration={200}>
          <TabsList className="overflow-visible">
            <TabsTrigger value="fipe_menor" className="gap-1.5">
              <TrendingDown className="h-4 w-4" />
              FIPE Menor
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8} className="max-w-xs text-xs z-50">
                  Solicitações para enquadrar veículos em faixa FIPE inferior à original, reduzindo o valor mensal
                </TooltipContent>
              </Tooltip>
            </TabsTrigger>
            <TabsTrigger value="elegibilidade" className="gap-1.5">
              <ShieldCheck className="h-4 w-4" />
              Elegibilidade
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8} className="max-w-xs text-xs z-50">
                  Veículos fora da whitelist de aceitação do plano que necessitam aprovação manual para inclusão
                </TooltipContent>
              </Tooltip>
            </TabsTrigger>
          </TabsList>
        </TooltipProvider>

        {/* ===== FIPE MENOR ===== */}
        <TabsContent value="fipe_menor" className="space-y-4">
          {!fipeMenorAtivo && (
            <Alert className="border-amber-500/30 bg-amber-50 dark:bg-amber-950/20">
              <ShieldOff className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-sm text-amber-700 dark:text-amber-400">
                A regra de FIPE Menor está <strong>desativada</strong>. O histórico permanece acessível.
              </AlertDescription>
            </Alert>
          )}

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
              ) : solicitacoes.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    Nenhuma solicitação encontrada
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {solicitacoes.map((item) => {
                    const cfg = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pendente;
                    const StatusIcon = cfg.icon;
                    return (
                      <Card key={item.id} className="overflow-hidden">
                        <CardContent className="p-5">
                          <div className="flex flex-col md:flex-row md:items-start gap-4">
                            <div className="flex-1 space-y-3">
                              <div className="flex items-center gap-3 flex-wrap">
                                <Badge className={cfg.color}><StatusIcon className="h-3 w-3 mr-1" />{cfg.label}</Badge>
                                {item.cotacao && <span className="text-sm font-mono text-muted-foreground">{item.cotacao.numero}</span>}
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div><p className="text-xs text-muted-foreground">Associado</p><p className="font-medium">{item.cotacao?.nome_solicitante || '—'}</p></div>
                                <div><p className="text-xs text-muted-foreground">Veículo</p><p className="font-medium flex items-center gap-1"><Car className="h-3.5 w-3.5" />{item.cotacao?.veiculo_marca} {item.cotacao?.veiculo_modelo} {item.cotacao?.veiculo_ano}{item.cotacao?.veiculo_placa && <span className="text-muted-foreground ml-1">({item.cotacao.veiculo_placa})</span>}</p></div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-muted/50">
                                <div><p className="text-xs text-muted-foreground">FIPE Real</p><p className="font-bold text-primary">{formatarMoeda(item.fipe_real)}</p></div>
                                <div><p className="text-xs text-muted-foreground">Faixa Original</p><p className="text-sm">{formatarMoeda(item.fipe_faixa_original_min)} – {formatarMoeda(item.fipe_faixa_original_max)}</p></div>
                                <div><p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3" />Faixa Solicitada</p><p className="text-sm font-medium text-green-600">{formatarMoeda(item.fipe_faixa_solicitada_min)} – {formatarMoeda(item.fipe_faixa_solicitada_max)}</p></div>
                              </div>
                              <div className="flex items-center gap-6 text-sm">
                                <div><span className="text-muted-foreground">Mensal atual: </span><span className="font-medium">{formatarMoeda(item.valor_mensal_original)}</span></div>
                                <div><span className="text-muted-foreground">Mensal reduzida: </span><span className="font-bold text-green-600">{formatarMoeda(item.valor_mensal_reduzido)}</span></div>
                                <div><span className="text-muted-foreground">Economia: </span><span className="font-bold text-green-600">{formatarMoeda(economia(item))}</span></div>
                              </div>
                              <div><p className="text-xs text-muted-foreground">Justificativa</p><p className="text-sm bg-muted/30 p-2 rounded mt-1">{item.justificativa}</p></div>
                              {item.solicitante && <p className="text-xs text-muted-foreground">Solicitado por: <span className="font-medium text-foreground">{item.solicitante.nome}</span></p>}
                              {item.observacao_supervisor && <div className="border-t pt-2 mt-2"><p className="text-xs text-muted-foreground">Observação do supervisor</p><p className="text-sm">{item.observacao_supervisor}</p></div>}
                            </div>
                            {item.status === 'pendente' && (
                              <div className="flex flex-row md:flex-col gap-2 shrink-0">
                                <Button size="sm" onClick={() => openDialog(item, 'aprovar')} className="gap-1"><CheckCircle2 className="h-4 w-4" />Aprovar</Button>
                                <Button size="sm" variant="outline" onClick={() => openDialog(item, 'recusar')} className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"><XCircle className="h-4 w-4" />Recusar</Button>
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
        </TabsContent>

        {/* ===== ELEGIBILIDADE ===== */}
        <TabsContent value="elegibilidade" className="space-y-4">
          <PainelAprovacoesElegibilidade />
        </TabsContent>
      </Tabs>

      {/* Dialog de confirmação */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {dialogMode === 'aprovar' ? (
                <><CheckCircle2 className="h-5 w-5 text-green-600" />Aprovar FIPE Menor</>
              ) : (
                <><XCircle className="h-5 w-5 text-destructive" />Recusar FIPE Menor</>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4">
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Associado:</span> <strong>{selectedItem.cotacao?.nome_solicitante}</strong></p>
                <p><span className="text-muted-foreground">FIPE Real:</span> <strong>{formatarMoeda(selectedItem.fipe_real)}</strong></p>
                <p><span className="text-muted-foreground">Economia mensal:</span> <strong className="text-green-600">{formatarMoeda(economia(selectedItem))}</strong></p>
              </div>

              {dialogMode === 'recusar' && (
                <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  A cotação seguirá com a faixa FIPE original.
                </div>
              )}

              <div>
                <label className="text-sm font-medium">
                  Observação {dialogMode === 'recusar' ? '(recomendado)' : '(opcional)'}
                </label>
                <Textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder={dialogMode === 'aprovar' ? 'Observação sobre a aprovação...' : 'Motivo da recusa...'}
                  rows={3}
                  className="mt-1.5"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleConfirm}
              disabled={isPending}
              variant={dialogMode === 'recusar' ? 'destructive' : 'default'}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {dialogMode === 'aprovar' ? 'Confirmar Aprovação' : 'Confirmar Recusa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, Clock, XCircle, Car, Shield, Users, HelpCircle, Loader2, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PainelAprovacoesDiretoria } from '@/components/aprovacoes/PainelAprovacoesDiretoria';
import { useAprovacoesDiretoria } from '@/hooks/useAprovacoesDiretoria';
import {
  useAprovacoesFipeLimite,
  useAprovarFipeLimite,
  useRecusarFipeLimite,
  type AprovacaoFipeLimite,
} from '@/hooks/useAprovacoesFipeLimite';
import { formatarMoeda } from '@/utils/format';

const STATUS_CONFIG = {
  pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  aprovado: { label: 'Aprovado', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  recusado: { label: 'Recusado', color: 'bg-red-100 text-red-800', icon: XCircle },
};

type SectionTab = 'alto_valor' | 'diretoria';

export default function AprovacoesDiretoria() {
  const [section, setSection] = useState<SectionTab>('alto_valor');
  const [tab, setTab] = useState('pendente');

  // KPIs — diretoria
  const { data: todasDiretoria = [] } = useAprovacoesDiretoria();

  // Alto Valor hooks
  const { data: solicitacoesLimite = [], isLoading: isLoadingLimite } = useAprovacoesFipeLimite(tab === 'todas' ? undefined : tab);
  const aprovarLimite = useAprovarFipeLimite();
  const recusarLimite = useRecusarFipeLimite();

  // Alto Valor — all for KPIs
  const { data: todasLimite = [] } = useAprovacoesFipeLimite();

  // KPIs combinados
  const pendentes =
    todasDiretoria.filter((i) => i.status === 'pendente').length +
    todasLimite.filter((i) => i.status === 'pendente').length;
  const aprovados =
    todasDiretoria.filter((i) => i.status === 'aprovado').length +
    todasLimite.filter((i) => i.status === 'aprovado').length;
  const recusados =
    todasDiretoria.filter((i) => i.status === 'recusado').length +
    todasLimite.filter((i) => i.status === 'recusado').length;

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'aprovar' | 'recusar'>('aprovar');
  const [selectedLimiteItem, setSelectedLimiteItem] = useState<AprovacaoFipeLimite | null>(null);
  const [observacao, setObservacao] = useState('');

  const openLimiteDialog = (item: AprovacaoFipeLimite, mode: 'aprovar' | 'recusar') => {
    setSelectedLimiteItem(item);
    setDialogMode(mode);
    setObservacao('');
    setDialogOpen(true);
  };

  const handleConfirm = async () => {
    if (!selectedLimiteItem) return;
    if (dialogMode === 'aprovar') {
      await aprovarLimite.mutateAsync({ id: selectedLimiteItem.id, observacao, cotacao_id: selectedLimiteItem.cotacao_id });
    } else {
      await recusarLimite.mutateAsync({ id: selectedLimiteItem.id, observacao, cotacao_id: selectedLimiteItem.cotacao_id });
    }
    setDialogOpen(false);
    setSelectedLimiteItem(null);
  };

  const isPending = aprovarLimite.isPending || recusarLimite.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Aprovações da Diretoria</h1>
        <p className="text-muted-foreground text-sm">
          Aprovações de alto valor e dupla aprovação da diretoria para veículos acima do limite FIPE ou blindados.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
              <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendentes}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{aprovados}</p>
              <p className="text-xs text-muted-foreground">Aprovados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{recusados}</p>
              <p className="text-xs text-muted-foreground">Recusados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section tabs */}
      <Tabs value={section} onValueChange={(v) => { setSection(v as SectionTab); setTab('pendente'); }}>
        <TooltipProvider delayDuration={200}>
          <TabsList className="overflow-visible">
            <TabsTrigger value="alto_valor" className="gap-1.5">
              <Shield className="h-4 w-4" />
              Alto Valor
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8} className="max-w-xs text-xs z-50">
                  Veículos com FIPE acima do limite permitido pelo plano que precisam de autorização especial
                </TooltipContent>
              </Tooltip>
            </TabsTrigger>
            <TabsTrigger value="diretoria" className="gap-1.5">
              <Users className="h-4 w-4" />
              Dupla Aprovação
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8} className="max-w-xs text-xs z-50">
                  Veículos com FIPE acima do limite ou blindados que necessitam aprovação de múltiplos diretores
                </TooltipContent>
              </Tooltip>
            </TabsTrigger>
          </TabsList>
        </TooltipProvider>

        {/* ===== ALTO VALOR ===== */}
        <TabsContent value="alto_valor" className="space-y-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="pendente"><Clock className="h-4 w-4 mr-1" />Pendentes</TabsTrigger>
              <TabsTrigger value="aprovado"><CheckCircle2 className="h-4 w-4 mr-1" />Aprovados</TabsTrigger>
              <TabsTrigger value="recusado"><XCircle className="h-4 w-4 mr-1" />Recusados</TabsTrigger>
              <TabsTrigger value="todas">Todas</TabsTrigger>
            </TabsList>

            <TabsContent value={tab} className="mt-4">
              {isLoadingLimite ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : solicitacoesLimite.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    Nenhuma solicitação encontrada
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {solicitacoesLimite.map((item) => {
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
                                <div><p className="text-xs text-muted-foreground">Associado</p><p className="font-medium">{item.nome_solicitante || item.cotacao?.nome_solicitante || '—'}</p></div>
                                <div><p className="text-xs text-muted-foreground">Veículo</p><p className="font-medium flex items-center gap-1"><Car className="h-3.5 w-3.5" />{item.veiculo_marca || item.cotacao?.veiculo_marca} {item.veiculo_modelo || item.cotacao?.veiculo_modelo} {item.veiculo_ano || item.cotacao?.veiculo_ano}{(item.veiculo_placa || item.cotacao?.veiculo_placa) && <span className="text-muted-foreground ml-1">({item.veiculo_placa || item.cotacao?.veiculo_placa})</span>}</p></div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-muted/50">
                                <div><p className="text-xs text-muted-foreground">Valor FIPE</p><p className="font-bold text-primary">{formatarMoeda(item.valor_fipe)}</p></div>
                                <div><p className="text-xs text-muted-foreground">Limite Aplicado</p><p className="text-sm font-medium">{formatarMoeda(item.limite_aplicado)}</p></div>
                                <div><p className="text-xs text-muted-foreground">Tipo</p><p className="text-sm font-medium capitalize">{item.tipo_veiculo}</p></div>
                              </div>
                              <div className="p-2 rounded bg-destructive/5 border border-destructive/20">
                                <p className="text-sm text-destructive font-medium">
                                  Excede o limite em {formatarMoeda(item.valor_fipe - item.limite_aplicado)}
                                </p>
                              </div>
                              {item.justificativa && <div><p className="text-xs text-muted-foreground">Justificativa</p><p className="text-sm bg-muted/30 p-2 rounded mt-1">{item.justificativa}</p></div>}
                              {item.solicitante && <p className="text-xs text-muted-foreground">Solicitado por: <span className="font-medium text-foreground">{item.solicitante.nome}</span></p>}
                              {item.observacao_aprovador && <div className="border-t pt-2 mt-2"><p className="text-xs text-muted-foreground">Observação do aprovador</p><p className="text-sm">{item.observacao_aprovador}</p></div>}
                            </div>
                            {item.status === 'pendente' && (
                              <div className="flex flex-row md:flex-col gap-2 shrink-0">
                                <Button size="sm" onClick={() => openLimiteDialog(item, 'aprovar')} className="gap-1"><CheckCircle2 className="h-4 w-4" />Aprovar</Button>
                                <Button size="sm" variant="outline" onClick={() => openLimiteDialog(item, 'recusar')} className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"><XCircle className="h-4 w-4" />Recusar</Button>
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

        {/* ===== DIRETORIA (Dupla Aprovação) ===== */}
        <TabsContent value="diretoria" className="space-y-4">
          <PainelAprovacoesDiretoria />
        </TabsContent>
      </Tabs>

      {/* Dialog de confirmação Alto Valor */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {dialogMode === 'aprovar' ? (
                <><CheckCircle2 className="h-5 w-5 text-green-600" />Aprovar FIPE Alto Valor</>
              ) : (
                <><XCircle className="h-5 w-5 text-destructive" />Recusar FIPE Alto Valor</>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedLimiteItem && (
            <div className="space-y-4">
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Associado:</span> <strong>{selectedLimiteItem.nome_solicitante || selectedLimiteItem.cotacao?.nome_solicitante}</strong></p>
                <p><span className="text-muted-foreground">Valor FIPE:</span> <strong>{formatarMoeda(selectedLimiteItem.valor_fipe)}</strong></p>
                <p><span className="text-muted-foreground">Limite:</span> <strong>{formatarMoeda(selectedLimiteItem.limite_aplicado)}</strong></p>
                <p><span className="text-muted-foreground">Excedente:</span> <strong className="text-destructive">{formatarMoeda(selectedLimiteItem.valor_fipe - selectedLimiteItem.limite_aplicado)}</strong></p>
              </div>

              {dialogMode === 'recusar' && (
                <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  O veículo não poderá ser cadastrado.
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

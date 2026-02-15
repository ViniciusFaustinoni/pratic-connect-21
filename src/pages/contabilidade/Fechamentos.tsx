import { useState } from 'react';
import { Lock, Unlock, CheckCircle, Clock, AlertCircle, Check, X, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useFechamentos, useCriarFechamento, useReabrirFechamento, useFechamentoAnual } from '@/hooks/useContabilidade';
import { ChecklistFechamento, type ChecklistItem } from '@/components/contabilidade';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const CHECKLIST_TEMPLATE: Omit<ChecklistItem, 'verificado' | 'carregando'>[] = [
  { id: 'lanc_classif', label: 'Todos os lançamentos automáticos classificados' },
  { id: 'conciliacao', label: 'Conciliação bancária concluída' },
  { id: 'depreciacao', label: 'Depreciação mensal registrada' },
  { id: 'pdd', label: 'Provisão para devedores duvidosos atualizada' },
  { id: 'ferias_13', label: 'Provisão de férias e 13º atualizada' },
  { id: 'prov_sinistros', label: 'Provisão para sinistros atualizada' },
  { id: 'impostos', label: 'Impostos do período apurados e registrados' },
  { id: 'balancete', label: 'Balancete de verificação confere (diferença = 0)', autoVerificado: true },
  { id: 'revisao', label: 'Receitas e despesas do período revisadas' },
  { id: 'sem_pendentes', label: 'Nenhum lançamento pendente de aprovação', autoVerificado: true },
];

export default function Fechamentos() {
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; mes: number } | null>(null);
  const [reabrirDialog, setReabrirDialog] = useState<{ open: boolean; id: string; mes: number } | null>(null);
  const [motivoReabertura, setMotivoReabertura] = useState('');
  const [checklistState, setChecklistState] = useState<Record<string, boolean>>({});

  const [fechamentoAnualDialog, setFechamentoAnualDialog] = useState(false);
  const [resumoAnual, setResumoAnual] = useState<{ totalReceitas: number; totalDespesas: number; resultado: number } | null>(null);
  const [loadingResumo, setLoadingResumo] = useState(false);

  const { data: fechamentos, isLoading } = useFechamentos(ano);
  const criarFechamento = useCriarFechamento();
  const reabrirFechamento = useReabrirFechamento();
  const { calcularResumo, executarFechamento } = useFechamentoAnual();

  const handleAbrirFechamentoAnual = async () => {
    setFechamentoAnualDialog(true);
    setLoadingResumo(true);
    try {
      const resumo = await calcularResumo(ano);
      setResumoAnual(resumo);
    } catch { setResumoAnual(null); }
    setLoadingResumo(false);
  };

  const handleExecutarFechamentoAnual = async () => {
    await executarFechamento.mutateAsync(ano);
    setFechamentoAnualDialog(false);
    setResumoAnual(null);
  };

  // Verificação automática
  const { data: verificacao, isLoading: isLoadingVerif } = useQuery({
    queryKey: ['verificacao-fechamento', confirmDialog?.mes, ano],
    queryFn: async () => {
      if (!confirmDialog?.mes) return null;
      const m = confirmDialog.mes;
      const dataInicio = `${ano}-${String(m).padStart(2, '0')}-01`;
      const dataFim = m === 12 ? `${ano + 1}-01-01` : `${ano}-${String(m + 1).padStart(2, '0')}-01`;

      const { count } = await supabase
        .from('lancamentos_contabeis')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ativo')
        .gte('data_competencia', dataInicio)
        .lt('data_competencia', dataFim);

      const { data: partidas } = await supabase
        .from('lancamentos_partidas')
        .select('tipo, valor, lancamento:lancamentos_contabeis!inner(data_competencia, status)')
        .eq('lancamento.status', 'ativo')
        .gte('lancamento.data_competencia', dataInicio)
        .lt('lancamento.data_competencia', dataFim);

      const totalD = partidas?.filter((p: any) => p.tipo === 'debito').reduce((a: number, p: any) => a + Number(p.valor), 0) || 0;
      const totalC = partidas?.filter((p: any) => p.tipo === 'credito').reduce((a: number, p: any) => a + Number(p.valor), 0) || 0;

      const { count: pendentes } = await supabase
        .from('lancamentos_contabeis')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'rascunho')
        .gte('data_competencia', dataInicio)
        .lt('data_competencia', dataFim);

      return {
        qtdLancamentos: count || 0,
        totalDebito: totalD,
        totalCredito: totalC,
        balanceado: Math.abs(totalD - totalC) < 0.01,
        semPendentes: (pendentes || 0) === 0,
      };
    },
    enabled: !!confirmDialog?.mes && confirmDialog.open,
  });

  const checklistItems: ChecklistItem[] = CHECKLIST_TEMPLATE.map(t => ({
    ...t,
    verificado: t.autoVerificado
      ? (t.id === 'balancete' ? verificacao?.balanceado || false : verificacao?.semPendentes || false)
      : checklistState[t.id] || false,
    carregando: t.autoVerificado ? isLoadingVerif : false,
  }));

  const todosVerificados = checklistItems.every(i => i.verificado);

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const getFechamento = (mes: number) => fechamentos?.find(f => f.mes === mes);
  const getStatus = (mes: number) => getFechamento(mes)?.status || 'aberto';

  const handleFechar = async (mes: number) => {
    try {
      await criarFechamento.mutateAsync({ mes, ano });
      setConfirmDialog(null);
      setChecklistState({});
    } catch {}
  };

  const handleReabrir = async () => {
    if (!reabrirDialog) return;
    try {
      await reabrirFechamento.mutateAsync({ id: reabrirDialog.id, motivo: motivoReabertura });
      setReabrirDialog(null);
      setMotivoReabertura('');
    } catch {}
  };

  // Verificar se todos os meses estão fechados (para fechamento anual)
  const todosMesesFechados = Array.from({ length: 12 }, (_, i) => i + 1).every(m => getStatus(m) === 'fechado');

  const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
    aberto: { icon: Clock, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', label: 'Aberto' },
    em_fechamento: { icon: AlertCircle, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', label: 'Em Fechamento' },
    fechado: { icon: CheckCircle, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', label: 'Fechado' },
    reaberto: { icon: Unlock, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', label: 'Reaberto' },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fechamentos</h1>
          <p className="text-muted-foreground">Controle de fechamento contábil mensal e anual</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(ano)} onValueChange={(v) => setAno(parseInt(v))}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => (
                <SelectItem key={i} value={String(now.getFullYear() - 2 + i)}>{now.getFullYear() - 2 + i}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Fechamento Anual */}
      {todosMesesFechados && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-green-800 dark:text-green-200">
              Todos os 12 meses de {ano} estão fechados. O exercício pode ser encerrado.
            </span>
            <Button variant="outline" size="sm" className="border-green-500 text-green-700"
              onClick={handleAbrirFechamentoAnual}>
              <Lock className="h-4 w-4 mr-2" /> Fechar Exercício {ano}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Grid de Meses */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {MESES.map((nomeMes, index) => {
            const mes = index + 1;
            const status = getStatus(mes);
            const fechamento = getFechamento(mes);
            const config = statusConfig[status];
            const Icon = config.icon;
            const isFuturo = ano > now.getFullYear() || (ano === now.getFullYear() && mes > now.getMonth() + 1);

            return (
              <Card key={mes} className={cn('relative', status === 'fechado' && 'border-green-200 dark:border-green-900/50')}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{nomeMes}</CardTitle>
                    <Badge className={config.color}><Icon className="h-3 w-3 mr-1" />{config.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {fechamento ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Débitos:</span>
                        <span>{formatCurrency(Number(fechamento.total_debitos))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Créditos:</span>
                        <span>{formatCurrency(Number(fechamento.total_creditos))}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>Resultado:</span>
                        <span className={cn(Number(fechamento.resultado_periodo) >= 0 ? 'text-green-600' : 'text-red-600')}>
                          {formatCurrency(Number(fechamento.resultado_periodo))}
                        </span>
                      </div>
                      {fechamento.data_fechamento && (
                        <p className="text-xs text-muted-foreground pt-1">
                          Fechado em: {format(new Date(fechamento.data_fechamento), 'dd/MM/yyyy HH:mm')}
                        </p>
                      )}
                      {fechamento.motivo_reabertura && (
                        <p className="text-xs text-yellow-600 pt-1">Reaberto: {fechamento.motivo_reabertura}</p>
                      )}
                      {status === 'fechado' && (
                        <Button variant="ghost" size="sm" className="w-full mt-2 text-muted-foreground"
                          onClick={() => setReabrirDialog({ open: true, id: fechamento.id, mes })}>
                          <RotateCcw className="h-3 w-3 mr-1" /> Reabrir
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        {isFuturo ? 'Período futuro' : 'Período não fechado'}
                      </p>
                      {!isFuturo && (
                        <Button className="w-full" size="sm"
                          onClick={() => { setChecklistState({}); setConfirmDialog({ open: true, mes }); }}>
                          <Lock className="h-4 w-4 mr-2" /> Fechar Período
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Legenda */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            {Object.entries(statusConfig).map(([key, value]) => {
              const Icon = value.icon;
              return <Badge key={key} className={value.color}><Icon className="h-3 w-3 mr-1" />{value.label}</Badge>;
            })}
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Fechamento com Checklist */}
      <AlertDialog open={confirmDialog?.open} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <AlertDialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Fechamento de Período</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-left">
                <p>Período: <strong>{confirmDialog && MESES[confirmDialog.mes - 1]} de {ano}</strong></p>

                <ChecklistFechamento
                  items={checklistItems}
                  onChange={(id, checked) => setChecklistState(prev => ({ ...prev, [id]: checked }))}
                  todosVerificados={todosVerificados}
                />

                {verificacao && !verificacao.balanceado && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Período desbalanceado. Verifique os lançamentos.</AlertDescription>
                  </Alert>
                )}

                {todosVerificados && (
                  <p className="text-sm text-muted-foreground">
                    Após o fechamento, novos lançamentos não poderão ser feitos neste período.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDialog && handleFechar(confirmDialog.mes)}
              disabled={criarFechamento.isPending || !todosVerificados}
            >
              {criarFechamento.isPending ? 'Fechando...' : 'Confirmar Fechamento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Reabertura */}
      <Dialog open={reabrirDialog?.open} onOpenChange={(open) => !open && setReabrirDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reabrir Período</DialogTitle>
            <DialogDescription>
              Reabrir <strong>{reabrirDialog && MESES[reabrirDialog.mes - 1]} de {ano}</strong>. 
              Informe o motivo da reabertura.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Motivo da reabertura *</Label>
              <Textarea
                value={motivoReabertura}
                onChange={(e) => setMotivoReabertura(e.target.value)}
                placeholder="Descreva o motivo..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReabrirDialog(null)}>Cancelar</Button>
            <Button onClick={handleReabrir} disabled={!motivoReabertura.trim() || reabrirFechamento.isPending}>
              {reabrirFechamento.isPending ? 'Reabrindo...' : 'Confirmar Reabertura'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Fechamento Anual */}
      <Dialog open={fechamentoAnualDialog} onOpenChange={setFechamentoAnualDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Fechamento do Exercício {ano}</DialogTitle>
            <DialogDescription>
              Apuração do resultado e transferência para Patrimônio Social.
            </DialogDescription>
          </DialogHeader>
          {loadingResumo ? (
            <div className="text-center py-8 text-muted-foreground">Calculando resumo do exercício...</div>
          ) : resumoAnual ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Receitas</p>
                  <p className="text-lg font-bold text-green-700">{formatCurrency(resumoAnual.totalReceitas)}</p>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Despesas</p>
                  <p className="text-lg font-bold text-red-700">{formatCurrency(resumoAnual.totalDespesas)}</p>
                </div>
              </div>
              <div className={cn('p-4 rounded-lg text-center', resumoAnual.resultado >= 0 ? 'bg-green-100 dark:bg-green-950/30' : 'bg-red-100 dark:bg-red-950/30')}>
                <p className="text-sm text-muted-foreground">{resumoAnual.resultado >= 0 ? 'Superávit' : 'Déficit'} do Exercício</p>
                <p className={cn('text-2xl font-bold', resumoAnual.resultado >= 0 ? 'text-green-700' : 'text-red-700')}>
                  {formatCurrency(Math.abs(resumoAnual.resultado))}
                </p>
              </div>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  O sistema irá zerar todas as contas de receita e despesa e transferir o resultado para{' '}
                  <strong>{resumoAnual.resultado >= 0 ? 'Superávits Acumulados' : 'Déficits Acumulados'}</strong>.
                  Esta ação não pode ser desfeita.
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">Erro ao calcular resumo.</div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFechamentoAnualDialog(false)}>Cancelar</Button>
            <Button onClick={handleExecutarFechamentoAnual}
              disabled={!resumoAnual || executarFechamento.isPending}>
              {executarFechamento.isPending ? 'Processando...' : 'Confirmar Fechamento Anual'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

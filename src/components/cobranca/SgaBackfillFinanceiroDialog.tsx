import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, RefreshCw, Database, AlertCircle, CheckCircle2, Clock, MinusCircle, Timer, Zap, CalendarClock, Info, ShieldAlert, Link2 } from 'lucide-react';
import { toast } from 'sonner';

interface JobStatus {
  pendente: number;
  pendente_retry: number;
  executando: number;
  concluido: number;
  erro: number;
  sem_historico_hinova: number;
  cancelado: number;
}

interface TopErro {
  motivo: string;
  qtd: number;
}

interface StatusResp {
  jobs: JobStatus;
  veiculos_sem_codigo: number;
  veiculos_com_codigo: number;
  veiculos_sistema_novo: number;
  cobrancas_sga: number;
  top_erros: TopErro[];
}

export function SgaBackfillFinanceiroDialog() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [reagendando, setReagendando] = useState(false);
  const [forcando, setForcando] = useState(false);

  const fetchStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('sga-backfill-financeiro', {
        body: { acao: 'status' },
      });
      if (error) throw error;
      if (data?.success) setStatus(data as StatusResp);
    } catch (e: any) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!open) return;
    fetchStatus();
    const id = setInterval(fetchStatus, 5000);
    return () => clearInterval(id);
  }, [open]);

  const handleMapear = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sga-mapear-codigos-veiculos', {
        body: { batch_size: 50, delay_ms: 250 },
      });
      if (error) throw error;
      toast.success(`Mapeamento: ${data?.mapeados || 0} veículos vinculados, ${data?.restantes || 0} restantes`);
      fetchStatus();
    } catch (e: any) {
      toast.error(e?.message || 'Erro no mapeamento');
    } finally {
      setLoading(false);
    }
  };

  const handleEnfileirar = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sga-backfill-financeiro', {
        body: { acao: 'enfileirar', tipo: 'backfill_inicial' },
      });
      if (error) throw error;
      toast.success(`${data?.enfileirados || 0} veículos enfileirados para backfill`);
      fetchStatus();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao enfileirar');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessar = async () => {
    setRunning(true);
    try {
      let total = 0;
      let totalOk = 0;
      let totalRetry = 0;
      for (let i = 0; i < 10; i++) {
        const { data, error } = await supabase.functions.invoke('sga-backfill-financeiro', {
          body: { acao: 'processar', batch_size: 50, delay_ms: 150 },
        });
        if (error) throw error;
        if (!data?.processados) break;
        total += data.processados;
        totalOk += data.ok ?? 0;
        totalRetry += data.retry ?? 0;
        await fetchStatus();
      }
      toast.success(`Processados ${total} jobs (${totalOk} OK, ${totalRetry} adiados)`);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao processar');
    } finally {
      setRunning(false);
      fetchStatus();
    }
  };

  const handleReagendar = async () => {
    setReagendando(true);
    try {
      const { data, error } = await supabase.functions.invoke('sga-backfill-financeiro', {
        body: { acao: 'reagendar_erros_horario' },
      });
      if (error) throw error;
      toast.success(`${data?.reagendados || 0} jobs movidos para próximo retry`);
      fetchStatus();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao reagendar');
    } finally {
      setReagendando(false);
    }
  };

  const handleForcarSync = async () => {
    setForcando(true);
    try {
      // Pega top 100 jobs pendentes (mais antigos primeiro) e força processamento via cron
      const { data, error } = await supabase.functions.invoke('cron-sga-sync-financeiro-diario', {
        body: { apenas_processar: true },
      });
      if (error) throw error;
      toast.success(`Sync forçado: ${data?.ok || 0} OK, ${data?.retry || 0} adiados, ${data?.fail || 0} falhas`);
      fetchStatus();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao forçar sync');
    } finally {
      setForcando(false);
    }
  };

  const semHistorico = status?.jobs.sem_historico_hinova ?? 0;
  const cancelados = status?.jobs.cancelado ?? 0;
  const pendenteRetry = status?.jobs.pendente_retry ?? 0;
  const totalJobs = status
    ? status.jobs.pendente + pendenteRetry + status.jobs.executando + status.jobs.concluido + status.jobs.erro + semHistorico + cancelados
    : 0;
  const finalizados = status ? status.jobs.concluido + semHistorico + cancelados : 0;
  const concluidoPct = totalJobs > 0 ? Math.round((finalizados / totalJobs) * 100) : 0;

  const motivoPredominante = status?.top_erros?.[0]?.motivo || null;

  // Detecta bloqueio "Usuário com restrição" da Hinova — quando ativo, processar a fila
  // só multiplica jobs em pendente_retry sem produzir resultado. Bloqueia ações de execução.
  const restricaoHinovaAtiva = !!status?.top_erros?.some((e) =>
    /restri[cç][aã]o|usu[aá]rio com restri/i.test(e.motivo)
  );
  const qtdJobsRestricao = status?.top_erros
    ?.filter((e) => /restri[cç][aã]o|usu[aá]rio com restri/i.test(e.motivo))
    .reduce((sum, e) => sum + e.qtd, 0) ?? 0;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Database className="h-4 w-4" /> Sincronizar Financeiro
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" /> Sincronização Financeira SGA Hinova
            </DialogTitle>
            <DialogDescription>
              Sincroniza apenas veículos da <strong>base antiga</strong> (importados via API Hinova). Veículos novos contratados pelo
              sistema são enviados ao SGA automaticamente após a contratação e não entram nesta fila.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Pré-requisito de janela horária */}
            <Alert className="border-amber-300 bg-amber-50/60">
              <Info className="h-4 w-4 text-amber-700" />
              <AlertTitle className="text-amber-900">Pré-requisito operacional</AlertTitle>
              <AlertDescription className="text-amber-800">
                O usuário Hinova/SGA usado pela integração precisa ter a <strong>restrição de horário removida</strong> (ou janela liberada das 06h às 22h BRT).
                Sincronizações fora da janela são automaticamente adiadas para o próximo dia útil às 09:00 BRT.
              </AlertDescription>
            </Alert>

            {/* Bloqueio crítico: Usuário com restrição (Hinova rejeita autenticação) */}
            {restricaoHinovaAtiva && (
              <Alert className="border-red-400 bg-red-50">
                <ShieldAlert className="h-4 w-4 text-red-700" />
                <AlertTitle className="text-red-900">
                  Backfill bloqueado pela Hinova — "Usuário com restrição"
                </AlertTitle>
                <AlertDescription className="text-red-800 space-y-2">
                  <p>
                    A API Hinova está rejeitando a autenticação do usuário da integração com o erro
                    <strong> "Usuário com restrição"</strong>
                    {qtdJobsRestricao > 0 && (
                      <> (<strong>{qtdJobsRestricao}</strong> jobs afetados).</>
                    )}
                    {' '}Enquanto esse erro estiver ativo, <strong>a fila não vai concluir</strong>: cada nova tentativa
                    apenas reagenda os jobs para retry, sem importar boletos.
                  </p>
                  <p>
                    <strong>Como resolver:</strong> abra um chamado com a Hinova solicitando a
                    <strong> liberação 24h e/ou liberação por IP</strong> do usuário usado pela integração no painel SGA do parceiro.
                    Não há ação no sistema que destrave esse bloqueio — é configuração externa.
                  </p>
                  <p className="text-xs text-red-700">
                    Os botões de execução (Forçar sync, Reagendar, Processar) ficam desabilitados até
                    o erro deixar de aparecer no topo das causas de falha.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {/* Métricas principais */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-md border bg-card p-3">
                <p className="text-xs text-muted-foreground">Elegíveis com código</p>
                <p className="text-2xl font-bold">{status?.veiculos_com_codigo ?? '—'}</p>
              </div>
              <div className="rounded-md border bg-card p-3">
                <p className="text-xs text-muted-foreground">Elegíveis sem código</p>
                <p className="text-2xl font-bold text-orange-600">{status?.veiculos_sem_codigo ?? '—'}</p>
              </div>
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Sistema novo (skip)</p>
                <p className="text-2xl font-bold text-muted-foreground">{status?.veiculos_sistema_novo ?? '—'}</p>
              </div>
              <div className="rounded-md border bg-emerald-50 p-3">
                <p className="text-xs text-emerald-800">Cobranças SGA importadas</p>
                <p className="text-2xl font-bold text-emerald-700">{status?.cobrancas_sga ?? '—'}</p>
              </div>
            </div>

            {/* Progresso */}
            {status && totalJobs > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Progresso do backfill</span>
                  <span className="text-muted-foreground">{concluidoPct}%</span>
                </div>
                <Progress value={concluidoPct} />
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Pendentes: {status.jobs.pendente}</Badge>
                  {pendenteRetry > 0 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary" className="gap-1 bg-amber-50 text-amber-800 cursor-help">
                            <Timer className="h-3 w-3" /> Aguardando retry: {pendenteRetry}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-[280px] text-xs">
                            Jobs adiados por erro temporário (janela horária, 401, 5xx). Voltam automaticamente quando <code>proximo_retry_em</code> chegar.
                            {motivoPredominante && (
                              <> Motivo predominante: <strong>{motivoPredominante}</strong>.</>
                            )}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3" /> Executando: {status.jobs.executando}</Badge>
                  <Badge variant="secondary" className="gap-1 bg-green-50 text-green-700"><CheckCircle2 className="h-3 w-3" /> Concluídos: {status.jobs.concluido}</Badge>
                  <Badge variant="secondary" className="gap-1"><MinusCircle className="h-3 w-3" /> Sem histórico: {semHistorico}</Badge>
                  {cancelados > 0 && (
                    <Badge variant="secondary" className="gap-1"><MinusCircle className="h-3 w-3" /> Cancelados: {cancelados}</Badge>
                  )}
                  <Badge variant="secondary" className="gap-1 bg-red-50 text-red-700"><AlertCircle className="h-3 w-3" /> Erros: {status.jobs.erro}</Badge>
                </div>
              </div>
            )}

            {/* Top erros */}
            {status?.top_erros && status.top_erros.length > 0 && (
              <div className="rounded-md border p-3 space-y-2">
                <p className="text-sm font-medium">Top causas de falha (jobs em erro / retry)</p>
                <ul className="space-y-1 text-xs">
                  {status.top_erros.map((e) => (
                    <li key={e.motivo} className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground truncate" title={e.motivo}>{e.motivo}</span>
                      <Badge variant="outline" className="shrink-0">{e.qtd}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Ações de recuperação */}
            <div className="rounded-md border p-3 space-y-2">
              <p className="text-sm font-medium">Ações de recuperação</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReagendar}
                  disabled={reagendando || restricaoHinovaAtiva}
                  className="gap-1.5"
                  title={restricaoHinovaAtiva ? 'Bloqueado: usuário Hinova com restrição. Solicite liberação no painel SGA.' : undefined}
                >
                  {reagendando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />}
                  Reagendar erros (janela horária / 401)
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleForcarSync}
                  disabled={forcando || restricaoHinovaAtiva}
                  className="gap-1.5"
                  title={restricaoHinovaAtiva ? 'Bloqueado: usuário Hinova com restrição. Solicite liberação no painel SGA.' : undefined}
                >
                  {forcando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                  Forçar sync agora (drenar fila)
                </Button>
              </div>
              {restricaoHinovaAtiva && (
                <p className="text-xs text-red-700">
                  ⛔ Ações desabilitadas enquanto a Hinova retornar "Usuário com restrição".
                  Solicite à Hinova a liberação 24h ou liberação por IP do usuário da integração no painel SGA do parceiro.
                </p>
              )}
            </div>

            {/* Etapas */}
            <div className="space-y-2 rounded-md border p-3 text-sm">
              <p className="font-medium">Etapas (executar nesta ordem):</p>
              <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
                <li>
                  <span className="font-medium text-foreground">Mapear códigos Hinova</span> — busca por placa para preencher <code>codigo_hinova</code> dos veículos.
                  <Button size="sm" variant="outline" className="ml-2 h-7" onClick={handleMapear} disabled={loading}>
                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Mapear lote
                  </Button>
                </li>
                <li>
                  <span className="font-medium text-foreground">Enfileirar backfill</span> — cria jobs pendentes para todos os veículos elegíveis (com ou sem código).
                  <Button size="sm" variant="outline" className="ml-2 h-7" onClick={handleEnfileirar} disabled={loading}>
                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Enfileirar
                  </Button>
                </li>
                <li>
                  <span className="font-medium text-foreground">Processar fila</span> — executa lotes de 50 jobs e atualiza boletos.
                  <Button
                    size="sm"
                    variant="default"
                    className="ml-2 h-7"
                    onClick={handleProcessar}
                    disabled={running || restricaoHinovaAtiva}
                    title={restricaoHinovaAtiva ? 'Bloqueado: usuário Hinova com restrição. Solicite liberação no painel SGA.' : undefined}
                  >
                    {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Processar
                  </Button>
                </li>
              </ol>
              <p className="pt-2 text-xs text-muted-foreground">
                O cron diário roda às 09:00 BRT (12:00 UTC) — dentro da janela horária comercial. Ciclos extras a cada 2h até as 17h drenam a fila acumulada.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

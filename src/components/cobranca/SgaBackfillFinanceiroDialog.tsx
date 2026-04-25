import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, Database, AlertCircle, CheckCircle2, Clock, MinusCircle, Timer, Zap, CalendarClock, Activity, StopCircle, Hourglass } from 'lucide-react';
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
  // Throughput REAL: cobranças importadas nos últimos 5min consultando direto `cobrancas`.
  // Necessário porque `processados_total` da edge reseta a cada execução do cron e o histórico
  // do polling do front só existe quando o modal está aberto.
  const [throughputReal, setThroughputReal] = useState<{ ult5min: number; ult1h: number; ultima: string | null } | null>(null);
  const [reagendando, setReagendando] = useState(false);
  const [forcando, setForcando] = useState(false);

  // Telemetria da drenagem em background (lê sga_runtime_state)
  interface DrenagemStatus {
    ativo: boolean;
    vivo: boolean;
    cancelamento_solicitado: boolean;
    iniciado_em: string | null;
    ultimo_heartbeat: string | null;
    heartbeat_idade_ms: number | null;
    lote_atual: number;
    processados_total: number;
    ok_total: number;
    fail_total: number;
    retry_total: number;
  }
  const [drenagem, setDrenagem] = useState<DrenagemStatus | null>(null);
  // Histórico curto p/ calcular velocidade (jobs/min)
  const drenagemHist = useRef<Array<{ t: number; processados: number }>>([]);
  const [parandoDrenagem, setParandoDrenagem] = useState(false);

  const fetchStatus = async () => {
    try {
      const cincoMinAtras = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const [statusResp, drenResp, ult5Resp, ult1hResp, ultimaResp] = await Promise.all([
        supabase.functions.invoke('sga-backfill-financeiro', { body: { acao: 'status' } }),
        supabase.functions.invoke('sga-backfill-financeiro', { body: { acao: 'status_drenagem' } }),
        supabase.from('cobrancas').select('id', { count: 'exact', head: true })
          .eq('origem', 'sga_hinova').gte('created_at', cincoMinAtras),
        supabase.from('cobrancas').select('id', { count: 'exact', head: true })
          .eq('origem', 'sga_hinova').gte('created_at', umaHoraAtras),
        supabase.from('cobrancas').select('created_at')
          .eq('origem', 'sga_hinova').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (!statusResp.error && statusResp.data?.success) setStatus(statusResp.data as StatusResp);
      if (!drenResp.error && drenResp.data?.success) {
        const d = drenResp.data as DrenagemStatus;
        setDrenagem(d);
        drenagemHist.current.push({ t: Date.now(), processados: d.processados_total });
        if (drenagemHist.current.length > 36) drenagemHist.current.shift();
      }
      setThroughputReal({
        ult5min: ult5Resp.count ?? 0,
        ult1h: ult1hResp.count ?? 0,
        ultima: (ultimaResp.data as any)?.created_at ?? null,
      });
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
      // Dispara drenagem em BACKGROUND (resposta 202 Accepted imediata).
      // O loop continua processando mesmo se o usuário fechar o diálogo/sair da página.
      const { data, error } = await supabase.functions.invoke('cron-sga-sync-financeiro-diario', {
        body: { apenas_processar: true },
      });
      if (error) throw error;
      if (data?.started === false && data?.reason === 'already_running') {
        toast.info('Drenagem já em execução em background. Acompanhe o progresso aqui.');
      } else {
        toast.success('Drenagem iniciada em background. A fila será drenada continuamente até esgotar.');
      }
      // Pequeno delay e recarrega status
      setTimeout(fetchStatus, 1500);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao iniciar drenagem');
    } finally {
      setForcando(false);
    }
  };

  const handlePararDrenagem = async () => {
    setParandoDrenagem(true);
    try {
      const { data, error } = await supabase.functions.invoke('sga-backfill-financeiro', {
        body: { acao: 'parar_drenagem' },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success('Cancelamento solicitado — o background vai parar após o lote atual.');
        setTimeout(fetchStatus, 1500);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao parar drenagem');
    } finally {
      setParandoDrenagem(false);
    }
  };

  const semHistorico = status?.jobs.sem_historico_hinova ?? 0;
  const cancelados = status?.jobs.cancelado ?? 0;
  const pendenteRetry = status?.jobs.pendente_retry ?? 0;
  // IMPORTANTE: jobs `cancelado` NÃO entram no progresso — são lixo de dedupe anterior
  // que distorce o percentual (inflava para 95% mesmo com poucos concluídos reais).
  const ativosTotal = status
    ? status.jobs.pendente + pendenteRetry + status.jobs.executando + status.jobs.concluido + status.jobs.erro + semHistorico
    : 0;
  const totalJobs = ativosTotal + cancelados; // exibido em "todos os jobs"
  const finalizados = status ? status.jobs.concluido + semHistorico + status.jobs.erro : 0;
  const concluidoPct = ativosTotal > 0 ? Math.round((finalizados / ativosTotal) * 100) : 0;

  const motivoPredominante = status?.top_erros?.[0]?.motivo || null;

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
                <p className="text-2xl font-bold text-emerald-700">
                  {status?.cobrancas_sga != null ? status.cobrancas_sga.toLocaleString('pt-BR') : '—'}
                </p>
                {throughputReal && throughputReal.ult1h > 0 && (
                  <p className="text-[10px] text-emerald-700/80 mt-0.5">
                    +{throughputReal.ult1h.toLocaleString('pt-BR')} na última hora
                  </p>
                )}
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
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="gap-1 text-muted-foreground cursor-help">
                            <MinusCircle className="h-3 w-3" /> Não-elegíveis: {cancelados.toLocaleString('pt-BR')}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-[300px] text-xs">
                            Jobs cancelados pertencem a veículos da base nova (origem 'interno') ou a duplicatas
                            removidas em rodadas anteriores de deduplicação. <strong>Não contam como erro</strong> e
                            são excluídos do progresso e dos cálculos de ETA.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <Badge variant="secondary" className="gap-1 bg-red-50 text-red-700"><AlertCircle className="h-3 w-3" /> Erros: {status.jobs.erro}</Badge>
                </div>
              </div>
            )}

            {/* Drenagem em background — telemetria ao vivo */}
            {(() => {
              const drenAtivo = drenagem?.ativo && drenagem?.vivo;
              const heartbeatSec = drenagem?.heartbeat_idade_ms != null
                ? Math.round(drenagem.heartbeat_idade_ms / 1000)
                : null;

              // Velocidade jobs/min via histórico do polling (precisa modal aberto >5s)
              const hist = drenagemHist.current;
              let velocidadeJobsMin: number | null = null;
              if (hist.length >= 2) {
                const first = hist[0];
                const last = hist[hist.length - 1];
                const deltaJobs = last.processados - first.processados;
                const deltaMin = (last.t - first.t) / 60000;
                if (deltaMin > 0 && deltaJobs >= 0) {
                  velocidadeJobsMin = Math.round(deltaJobs / deltaMin);
                }
              }
              // Throughput REAL (cobranças/min últimos 5min) — fonte de verdade independente
              // do polling. Usado para fallback de velocidade e como métrica primária do ETA.
              const cobrancasPorMinReal = throughputReal
                ? Math.round((throughputReal.ult5min / 5) * 10) / 10
                : null;
              const velocidadeEfetiva = velocidadeJobsMin && velocidadeJobsMin > 0
                ? velocidadeJobsMin
                : (cobrancasPorMinReal && cobrancasPorMinReal > 0 ? cobrancasPorMinReal : null);
              const pendentesAtuais = (status?.jobs.pendente ?? 0) + (status?.jobs.pendente_retry ?? 0);
              const etaMin = velocidadeEfetiva && velocidadeEfetiva > 0
                ? Math.round(pendentesAtuais / velocidadeEfetiva)
                : null;
              const formatEta = (m: number) => {
                if (m < 60) return `~${m} min`;
                const h = Math.floor(m / 60);
                const r = m % 60;
                return r > 0 ? `~${h}h ${r}min` : `~${h}h`;
              };

              return (
                <div className={`rounded-md border p-3 space-y-3 ${drenAtivo ? 'border-emerald-400 bg-emerald-50/40' : 'bg-card'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Activity className={`h-4 w-4 ${drenAtivo ? 'text-emerald-700 animate-pulse' : 'text-muted-foreground'}`} />
                      <p className="text-sm font-medium">
                        Drenagem em background
                      </p>
                      {drenAtivo ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">Em execução</Badge>
                      ) : drenagem?.ativo && !drenagem?.vivo ? (
                        <Badge variant="destructive">Sem heartbeat</Badge>
                      ) : (
                        <Badge variant="secondary">Parada</Badge>
                      )}
                      {drenagem?.cancelamento_solicitado && (
                        <Badge variant="outline" className="border-amber-400 text-amber-700">Cancelamento solicitado</Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="rounded border bg-card p-2">
                      <p className="text-muted-foreground">Última hora</p>
                      <p className="text-base font-semibold text-emerald-700">
                        {throughputReal ? `+${throughputReal.ult1h.toLocaleString('pt-BR')}` : '—'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        cobranças importadas
                      </p>
                    </div>
                    <div className="rounded border bg-card p-2">
                      <p className="text-muted-foreground">Últimos 5min</p>
                      <p className="text-base font-semibold">
                        {throughputReal ? `+${throughputReal.ult5min.toLocaleString('pt-BR')}` : '—'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {cobrancasPorMinReal != null ? `${cobrancasPorMinReal}/min` : '—'}
                      </p>
                    </div>
                    <div className="rounded border bg-card p-2">
                      <p className="text-muted-foreground">Sessão atual (lote)</p>
                      <p className="text-base font-semibold">
                        <span className="text-emerald-700">{drenagem?.ok_total ?? 0}</span>
                        {' / '}
                        <span className="text-amber-700">{drenagem?.retry_total ?? 0}</span>
                        {' / '}
                        <span className="text-red-700">{drenagem?.fail_total ?? 0}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">OK / Retry / Falha</p>
                    </div>
                    <div className="rounded border bg-card p-2 flex flex-col">
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Hourglass className="h-3 w-3" /> ETA fila
                      </p>
                      <p className="text-base font-semibold">
                        {etaMin != null ? formatEta(etaMin) : '—'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {velocidadeEfetiva ? `~${velocidadeEfetiva}/min` : 'aguardando ritmo'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {drenagem?.iniciado_em
                        ? <>Iniciada em {new Date(drenagem.iniciado_em).toLocaleString('pt-BR')} · Lote atual: <strong>{drenagem.lote_atual}</strong></>
                        : 'Nenhuma execução recente'}
                    </span>
                    {heartbeatSec != null && (
                      <span>
                        Heartbeat: {heartbeatSec < 60 ? `há ${heartbeatSec}s` : `há ${Math.round(heartbeatSec / 60)}min`}
                      </span>
                    )}
                  </div>

                  {drenAtivo && (
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handlePararDrenagem}
                        disabled={parandoDrenagem || drenagem?.cancelamento_solicitado}
                        className="gap-1.5 text-red-700 border-red-300 hover:bg-red-50"
                      >
                        {parandoDrenagem ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <StopCircle className="h-3.5 w-3.5" />}
                        Parar drenagem
                      </Button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Ações de recuperação */}
            <div className="rounded-md border p-3 space-y-2">
              <p className="text-sm font-medium">Ações de recuperação</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReagendar}
                  disabled={reagendando}
                  className="gap-1.5"
                >
                  {reagendando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />}
                  Reagendar erros (janela horária / 401)
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleForcarSync}
                  disabled={forcando || (drenagem?.ativo && drenagem?.vivo)}
                  className="gap-1.5"
                  title={
                    drenagem?.ativo && drenagem?.vivo
                      ? 'Drenagem já em execução em background.'
                      : undefined
                  }
                >
                  {forcando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                  {drenagem?.ativo && drenagem?.vivo
                    ? 'Drenagem em execução…'
                    : 'Iniciar drenagem em background'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                A drenagem roda em segundo plano no servidor — você pode fechar este painel ou sair da página
                que o processamento continua. Um cron de 5 em 5 minutos retoma automaticamente até a fila zerar.
                O cron diário roda às 09:00 BRT (12:00 UTC).
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

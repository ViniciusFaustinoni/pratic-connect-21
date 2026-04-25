import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, RefreshCw, Database, AlertCircle, CheckCircle2, Clock, MinusCircle, Timer, Zap, CalendarClock, Info, ShieldAlert, Link2, Play, Pause, RotateCcw, ListChecks, Activity, StopCircle, Hourglass } from 'lucide-react';
import { toast } from 'sonner';

// ===== Mapeamento controlado: pausa, retomada e tracking por veículo =====
// Persistimos progresso em localStorage para que um refresh / fechamento do
// diálogo não perca o que já foi tentado. Assim, depois de um bloqueio
// "Usuário com restrição", quando a Hinova for liberada, podemos retomar do
// ponto onde parou sem re-tentar veículos já marcados como falhados.
const LS_KEY = 'sga-mapear-progresso-v1';
type RunState = 'idle' | 'running' | 'paused' | 'done';
interface MapearProgresso {
  fila: string[];           // IDs ainda a processar
  tentados: string[];       // IDs já enviados ao backend (sucesso, falha técnica ou não-encontrado)
  mapeados: string[];       // IDs efetivamente vinculados (codigo_hinova preenchido)
  falhados: string[];       // IDs que receberam erro técnico no lote (não confundir com não-encontrado)
  loteAtual: number;        // contador de lotes processados
  ultimoErro: string | null;
  carregadoEm: string | null; // timestamp da última carga da fila
}
const emptyProgresso: MapearProgresso = {
  fila: [], tentados: [], mapeados: [], falhados: [], loteAtual: 0, ultimoErro: null, carregadoEm: null,
};
const loadProgresso = (): MapearProgresso => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return emptyProgresso;
    const parsed = JSON.parse(raw);
    return { ...emptyProgresso, ...parsed };
  } catch { return emptyProgresso; }
};
const saveProgresso = (p: MapearProgresso) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch {}
};

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
  const [preparandoBase, setPreparandoBase] = useState(false);
  const [prepProgress, setPrepProgress] = useState<{ lotes: number; mapeados: number; restantes: number } | null>(null);

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

  // ===== Mapeamento controlado (pausa/retomada) =====
  const [mapState, setMapState] = useState<RunState>('idle');
  const [progresso, setProgresso] = useState<MapearProgresso>(() => loadProgresso());
  const [carregandoFila, setCarregandoFila] = useState(false);
  const [batchSizeCtrl] = useState(50);
  const pauseRef = useRef(false);
  const runningRef = useRef(false);

  // Persiste sempre que progresso mudar
  useEffect(() => { saveProgresso(progresso); }, [progresso]);

  // Carrega a fila completa de IDs elegíveis (sem codigo_hinova, origem
  // api_externa, com placa). Pagina em chunks de 1000 (limite default do
  // Supabase) e descarta IDs já tentados/mapeados/falhados desta sessão para
  // evitar reprocessar veículos após um bloqueio.
  const carregarFila = async () => {
    setCarregandoFila(true);
    try {
      const ignorar = new Set<string>([...progresso.tentados, ...progresso.falhados, ...progresso.mapeados]);
      const ids: string[] = [];
      const PAGE = 1000;
      let from = 0;
      while (from < 50000) {
        const { data, error } = await supabase
          .from('veiculos')
          .select('id, associados:associados!inner(origem_cadastro)')
          .is('codigo_hinova', null)
          .not('placa', 'is', null)
          .eq('associados.origem_cadastro', 'api_externa')
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const r of data) if (!ignorar.has(r.id)) ids.push(r.id);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      setProgresso((p) => ({ ...p, fila: ids, carregadoEm: new Date().toISOString(), ultimoErro: null }));
      toast.success(`Fila carregada: ${ids.length} veículo(s) elegíveis (excluindo ${ignorar.size} já tentados).`);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao carregar fila');
    } finally {
      setCarregandoFila(false);
    }
  };

  // Loop principal: processa a fila em lotes respeitando pause/resume.
  // Em caso de erro técnico do invoke (5xx, restrição Hinova) marca os IDs
  // do lote como "falhados" — não voltam ao retomar até reiniciar.
  const startMapearControlado = async () => {
    if (runningRef.current) return;
    if (progresso.fila.length === 0) {
      toast.error('Fila vazia. Carregue a fila primeiro.');
      return;
    }
    runningRef.current = true;
    pauseRef.current = false;
    setMapState('running');
    try {
      // Trabalhamos com cópia local da fila para evitar race entre setState
      let filaLocal = [...progresso.fila];
      while (!pauseRef.current && filaLocal.length > 0) {
        const lote = filaLocal.slice(0, batchSizeCtrl);
        try {
          const { data, error } = await supabase.functions.invoke('sga-mapear-codigos-veiculos', {
            body: { batch_size: lote.length, delay_ms: 200, veiculo_ids: lote },
          });
          if (error || data?.success === false) {
            const msg = error?.message || data?.error || 'Erro desconhecido no lote';
            filaLocal = filaLocal.filter((id) => !lote.includes(id));
            setProgresso((p) => ({
              ...p,
              fila: filaLocal,
              tentados: Array.from(new Set([...p.tentados, ...lote])),
              falhados: Array.from(new Set([...p.falhados, ...lote])),
              loteAtual: p.loteAtual + 1,
              ultimoErro: msg,
            }));
            pauseRef.current = true;
            setMapState('paused');
            toast.error(`Lote falhou — pausado. ${msg}`);
            break;
          }
          const mapeadosLote: number = data?.mapeados ?? 0;
          filaLocal = filaLocal.filter((id) => !lote.includes(id));
          setProgresso((p) => {
            // Aproximação: marcamos os primeiros N do lote como mapeados.
            // Fonte de verdade real é a contagem agregada em status.
            const aprox = lote.slice(0, mapeadosLote);
            return {
              ...p,
              fila: filaLocal,
              tentados: Array.from(new Set([...p.tentados, ...lote])),
              mapeados: Array.from(new Set([...p.mapeados, ...aprox])),
              loteAtual: p.loteAtual + 1,
              ultimoErro: null,
            };
          });
          await fetchStatus();
          await new Promise((r) => setTimeout(r, 250));
        } catch (e: any) {
          filaLocal = filaLocal.filter((id) => !lote.includes(id));
          setProgresso((p) => ({
            ...p,
            fila: filaLocal,
            tentados: Array.from(new Set([...p.tentados, ...lote])),
            falhados: Array.from(new Set([...p.falhados, ...lote])),
            loteAtual: p.loteAtual + 1,
            ultimoErro: e?.message || String(e),
          }));
          pauseRef.current = true;
          setMapState('paused');
          toast.error(`Erro inesperado — pausado. ${e?.message || e}`);
          break;
        }
      }
      if (!pauseRef.current && filaLocal.length === 0) {
        setMapState('done');
        toast.success('Mapeamento controlado concluído — fila esgotada.');
      }
    } finally {
      runningRef.current = false;
    }
  };

  const pausarMapearControlado = () => {
    pauseRef.current = true;
    setMapState('paused');
    toast.info('Pausa solicitada — finalizando lote em andamento.');
  };

  const retomarMapearControlado = () => {
    if (progresso.fila.length === 0) {
      toast.error('Nada a retomar — fila vazia. Carregue a fila novamente.');
      return;
    }
    startMapearControlado();
  };

  const reiniciarMapearControlado = () => {
    pauseRef.current = true;
    runningRef.current = false;
    setProgresso(emptyProgresso);
    setMapState('idle');
    toast.info('Progresso de mapeamento controlado zerado.');
  };

  const fetchStatus = async () => {
    try {
      const [statusResp, drenResp] = await Promise.all([
        supabase.functions.invoke('sga-backfill-financeiro', { body: { acao: 'status' } }),
        supabase.functions.invoke('sga-backfill-financeiro', { body: { acao: 'status_drenagem' } }),
      ]);
      if (!statusResp.error && statusResp.data?.success) setStatus(statusResp.data as StatusResp);
      if (!drenResp.error && drenResp.data?.success) {
        const d = drenResp.data as DrenagemStatus;
        setDrenagem(d);
        // Mantém histórico de até 6 amostras (~30s) p/ velocidade
        drenagemHist.current.push({ t: Date.now(), processados: d.processados_total });
        if (drenagemHist.current.length > 6) drenagemHist.current.shift();
      }
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

  // Modo preparar base: roda apenas Mapear lote em loop até esgotar (ou erro consecutivo).
  // NÃO dispara processamento financeiro — só popula codigo_hinova nos veículos.
  // Observação: a busca por placa também usa a API Hinova autenticada, então sofre o
  // mesmo bloqueio "Usuário com restrição". Quando bloqueada, o loop aborta no 1º erro.
  const handlePrepararBase = async () => {
    setPreparandoBase(true);
    setPrepProgress({ lotes: 0, mapeados: 0, restantes: 0 });
    let totalMapeados = 0;
    let lotes = 0;
    let errosConsecutivos = 0;
    const MAX_LOTES = 200; // teto defensivo (10.000 veículos a 50/lote)
    const MAX_ERROS_CONSECUTIVOS = 2;
    try {
      while (lotes < MAX_LOTES) {
        const { data, error } = await supabase.functions.invoke('sga-mapear-codigos-veiculos', {
          body: { batch_size: 50, delay_ms: 200 },
        });
        if (error) {
          errosConsecutivos++;
          if (errosConsecutivos >= MAX_ERROS_CONSECUTIVOS) {
            toast.error(`Mapeamento abortado após ${errosConsecutivos} erros consecutivos: ${error.message || 'erro desconhecido'}`);
            break;
          }
          continue;
        }
        errosConsecutivos = 0;
        lotes++;
        const mapeadosLote = data?.mapeados ?? 0;
        const restantes = data?.restantes ?? 0;
        const processados = data?.processados ?? 0;
        totalMapeados += mapeadosLote;
        setPrepProgress({ lotes, mapeados: totalMapeados, restantes });
        // Esgotou: não há mais veículos elegíveis sem código
        if (processados === 0 || restantes === 0) break;
        await fetchStatus();
        await new Promise((r) => setTimeout(r, 250));
      }
      toast.success(`Base preparada: ${totalMapeados} veículos vinculados em ${lotes} lote(s).`);
      fetchStatus();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao preparar base');
    } finally {
      setPreparandoBase(false);
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

            {/* Drenagem em background — telemetria ao vivo */}
            {(() => {
              const drenAtivo = drenagem?.ativo && drenagem?.vivo;
              const heartbeatSec = drenagem?.heartbeat_idade_ms != null
                ? Math.round(drenagem.heartbeat_idade_ms / 1000)
                : null;

              // Velocidade jobs/min com base no histórico
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
              const pendentesAtuais = (status?.jobs.pendente ?? 0) + (status?.jobs.pendente_retry ?? 0);
              const etaMin = velocidadeJobsMin && velocidadeJobsMin > 0
                ? Math.round(pendentesAtuais / velocidadeJobsMin)
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
                      <p className="text-muted-foreground">Processados (sessão)</p>
                      <p className="text-base font-semibold">{drenagem?.processados_total ?? 0}</p>
                    </div>
                    <div className="rounded border bg-card p-2">
                      <p className="text-muted-foreground">OK / Retry / Falhas</p>
                      <p className="text-base font-semibold">
                        <span className="text-emerald-700">{drenagem?.ok_total ?? 0}</span>
                        {' / '}
                        <span className="text-amber-700">{drenagem?.retry_total ?? 0}</span>
                        {' / '}
                        <span className="text-red-700">{drenagem?.fail_total ?? 0}</span>
                      </p>
                    </div>
                    <div className="rounded border bg-card p-2">
                      <p className="text-muted-foreground">Velocidade</p>
                      <p className="text-base font-semibold">
                        {velocidadeJobsMin != null ? `${velocidadeJobsMin} jobs/min` : '—'}
                      </p>
                    </div>
                    <div className="rounded border bg-card p-2 flex flex-col">
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Hourglass className="h-3 w-3" /> ETA fila
                      </p>
                      <p className="text-base font-semibold">
                        {etaMin != null ? formatEta(etaMin) : '—'}
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
                  disabled={forcando || restricaoHinovaAtiva || (drenagem?.ativo && drenagem?.vivo)}
                  className="gap-1.5"
                  title={
                    restricaoHinovaAtiva
                      ? 'Bloqueado: usuário Hinova com restrição. Solicite liberação no painel SGA.'
                      : drenagem?.ativo && drenagem?.vivo
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
              </p>
              {restricaoHinovaAtiva && (
                <p className="text-xs text-red-700">
                  ⛔ Ações desabilitadas enquanto a Hinova retornar "Usuário com restrição".
                  Solicite à Hinova a liberação 24h ou liberação por IP do usuário da integração no painel SGA do parceiro.
                </p>
              )}
            </div>

            {/* Modo preparar base — apenas mapeamento, sem processamento financeiro */}
            <div className="rounded-md border border-blue-300 bg-blue-50/50 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Link2 className="h-4 w-4 text-blue-700 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-blue-900">Modo preparar base (apenas mapeamento)</p>
                  <p className="text-xs text-blue-800">
                    Roda <strong>somente</strong> o passo 1 (Mapear códigos Hinova) em loop até esgotar os
                    veículos sem <code>codigo_hinova</code>. <strong>Não dispara</strong> o processamento financeiro,
                    então não enfileira nem executa jobs de boletos.
                  </p>
                  {restricaoHinovaAtiva && (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-300 rounded px-2 py-1">
                      ⚠️ Aviso: o mapeamento também usa a API Hinova autenticada. Com "Usuário com restrição" ativo
                      o loop pode abortar logo no 1º lote. Use este botão para <strong>testar manualmente</strong>
                      se a Hinova já liberou — se rodar, ótimo; se falhar, o status acima vai confirmar o bloqueio.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={handlePrepararBase}
                  disabled={preparandoBase}
                  className="gap-1.5"
                >
                  {preparandoBase ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                  {preparandoBase ? 'Preparando base…' : 'Preparar base (apenas mapeamento)'}
                </Button>
                {prepProgress && (
                  <span className="text-xs text-blue-900">
                    Lotes: <strong>{prepProgress.lotes}</strong> · Vinculados: <strong>{prepProgress.mapeados}</strong> · Restantes: <strong>{prepProgress.restantes}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Mapeamento controlado — pausa, retomada e tracking por veículo */}
            <div className="rounded-md border border-indigo-300 bg-indigo-50/50 p-3 space-y-3">
              <div className="flex items-start gap-2">
                <ListChecks className="h-4 w-4 text-indigo-700 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-indigo-900">Mapear lote — controlado (pausa / retomada)</p>
                  <p className="text-xs text-indigo-800">
                    Carrega a fila de veículos elegíveis e processa em lotes de {batchSizeCtrl}. Você pode <strong>pausar a qualquer momento</strong>
                    {' '}e <strong>retomar mais tarde</strong>. O progresso (tentados, vinculados, falhados) é salvo no navegador, então
                    veículos já processados <strong>não são reprocessados</strong> mesmo após um bloqueio Hinova ou refresh da página.
                  </p>
                </div>
              </div>

              {/* Métricas de progresso */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <div className="rounded border bg-card p-2">
                  <p className="text-muted-foreground">Na fila</p>
                  <p className="text-base font-semibold">{progresso.fila.length}</p>
                </div>
                <div className="rounded border bg-card p-2">
                  <p className="text-muted-foreground">Tentados</p>
                  <p className="text-base font-semibold">{progresso.tentados.length}</p>
                </div>
                <div className="rounded border bg-card p-2">
                  <p className="text-muted-foreground">Vinculados</p>
                  <p className="text-base font-semibold text-emerald-700">{progresso.mapeados.length}</p>
                </div>
                <div className="rounded border bg-card p-2">
                  <p className="text-muted-foreground">Falhados (lote)</p>
                  <p className="text-base font-semibold text-red-700">{progresso.falhados.length}</p>
                </div>
                <div className="rounded border bg-card p-2">
                  <p className="text-muted-foreground">Lotes</p>
                  <p className="text-base font-semibold">{progresso.loteAtual}</p>
                </div>
              </div>

              {/* Barra de progresso */}
              {(progresso.tentados.length > 0 || progresso.fila.length > 0) && (
                <Progress
                  value={(() => {
                    const total = progresso.tentados.length + progresso.fila.length;
                    return total > 0 ? Math.round((progresso.tentados.length / total) * 100) : 0;
                  })()}
                />
              )}

              {progresso.ultimoErro && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                  <strong>Último erro:</strong> {progresso.ultimoErro}
                </div>
              )}

              {progresso.carregadoEm && (
                <p className="text-[11px] text-muted-foreground">
                  Fila carregada em {new Date(progresso.carregadoEm).toLocaleString('pt-BR')}
                  {' · '}Estado: <strong>{mapState}</strong>
                </p>
              )}

              {/* Controles */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={carregarFila}
                  disabled={carregandoFila || mapState === 'running'}
                  className="gap-1.5"
                >
                  {carregandoFila ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Carregar fila
                </Button>

                {mapState !== 'running' && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={mapState === 'paused' ? retomarMapearControlado : startMapearControlado}
                    disabled={progresso.fila.length === 0}
                    className="gap-1.5"
                  >
                    <Play className="h-3.5 w-3.5" />
                    {mapState === 'paused' ? 'Retomar' : 'Iniciar'}
                  </Button>
                )}

                {mapState === 'running' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={pausarMapearControlado}
                    className="gap-1.5"
                  >
                    <Pause className="h-3.5 w-3.5" />
                    Pausar
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={reiniciarMapearControlado}
                  disabled={mapState === 'running'}
                  className="gap-1.5 text-muted-foreground"
                  title="Zera tentados/vinculados/falhados desta sessão. A próxima carga da fila trará todos os elegíveis novamente."
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reiniciar progresso
                </Button>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Dica: após um bloqueio Hinova, basta clicar em <strong>Retomar</strong> quando a liberação chegar — os veículos do lote
                que falhou ficam isolados em "Falhados" e não voltam até você reiniciar o progresso.
              </p>
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
                O cron diário roda às 09:00 BRT (12:00 UTC). Além disso, um cron de drenagem dispara a cada 5 minutos
                dentro da janela horária liberada (06h–22h BRT) para drenar a fila continuamente em segundo plano.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

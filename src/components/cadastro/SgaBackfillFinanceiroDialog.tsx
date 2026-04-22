import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Database, AlertCircle, CheckCircle2, Clock, MinusCircle } from 'lucide-react';
import { toast } from 'sonner';

interface JobStatus {
  pendente: number;
  executando: number;
  concluido: number;
  erro: number;
  sem_historico_hinova: number;
}

interface StatusResp {
  jobs: JobStatus;
  veiculos_sem_codigo: number;
  veiculos_com_codigo: number;
}

export function SgaBackfillFinanceiroDialog() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

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
      for (let i = 0; i < 10; i++) {
        const { data, error } = await supabase.functions.invoke('sga-backfill-financeiro', {
          body: { acao: 'processar', batch_size: 20, delay_ms: 200 },
        });
        if (error) throw error;
        if (!data?.processados) break;
        total += data.processados;
        await fetchStatus();
      }
      toast.success(`Processados ${total} jobs nesta rodada`);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao processar');
    } finally {
      setRunning(false);
      fetchStatus();
    }
  };

  const totalJobs = status ? status.jobs.pendente + status.jobs.executando + status.jobs.concluido + status.jobs.erro : 0;
  const concluidoPct = totalJobs > 0 ? Math.round((status!.jobs.concluido / totalJobs) * 100) : 0;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Database className="h-4 w-4" /> Sincronizar Financeiro
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" /> Sincronização Financeira SGA Hinova
            </DialogTitle>
            <DialogDescription>
              Importa boletos, situação financeira e histórico de pagamentos da API Hinova para todos os veículos da base antiga.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border bg-card p-3">
                <p className="text-xs text-muted-foreground">Veículos com código Hinova</p>
                <p className="text-2xl font-bold">{status?.veiculos_com_codigo ?? '—'}</p>
              </div>
              <div className="rounded-md border bg-card p-3">
                <p className="text-xs text-muted-foreground">Veículos sem código Hinova</p>
                <p className="text-2xl font-bold text-orange-600">{status?.veiculos_sem_codigo ?? '—'}</p>
              </div>
            </div>

            {status && totalJobs > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Progresso do backfill</span>
                  <span className="text-muted-foreground">{concluidoPct}%</span>
                </div>
                <Progress value={concluidoPct} />
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Pendentes: {status.jobs.pendente}</Badge>
                  <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3" /> Executando: {status.jobs.executando}</Badge>
                  <Badge variant="secondary" className="gap-1 bg-green-50 text-green-700"><CheckCircle2 className="h-3 w-3" /> Concluídos: {status.jobs.concluido}</Badge>
                  <Badge variant="secondary" className="gap-1 bg-red-50 text-red-700"><AlertCircle className="h-3 w-3" /> Erros: {status.jobs.erro}</Badge>
                </div>
              </div>
            )}

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
                  <span className="font-medium text-foreground">Enfileirar backfill</span> — cria jobs pendentes para todos os veículos elegíveis.
                  <Button size="sm" variant="outline" className="ml-2 h-7" onClick={handleEnfileirar} disabled={loading}>
                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Enfileirar
                  </Button>
                </li>
                <li>
                  <span className="font-medium text-foreground">Processar fila</span> — executa lotes de 20 jobs e atualiza boletos.
                  <Button size="sm" variant="default" className="ml-2 h-7" onClick={handleProcessar} disabled={running}>
                    {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Processar
                  </Button>
                </li>
              </ol>
              <p className="pt-2 text-xs text-muted-foreground">
                O cron diário roda automaticamente às 02:00 (BRT) sincronizando todos os veículos.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Truck, Clock, Send, CheckCircle, XCircle, AlertTriangle, Loader2, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatCurrency(v: number | null) {
  if (v === null || v === undefined) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

interface Props {
  chamadoId: string;
  chamadoStatus: string;
}

const conviteStatusConfig: Record<string, { label: string; className: string }> = {
  enviado: { label: '⏳ Enviado', className: 'bg-gray-100 text-gray-800' },
  visualizado: { label: '👀 Visualizado', className: 'bg-blue-100 text-blue-800' },
  aceito: { label: '✅ Aceito', className: 'bg-green-100 text-green-800' },
  recusado: { label: '❌ Recusado', className: 'bg-red-100 text-red-800' },
  expirado: { label: '⏰ Expirado', className: 'bg-gray-100 text-gray-600' },
  nao_atribuido: { label: '➖ Não atribuído', className: 'bg-yellow-100 text-yellow-800' },
};

export function CardDespachoReboque({ chamadoId, chamadoStatus }: Props) {
  const queryClient = useQueryClient();
  const [timeLeft, setTimeLeft] = useState(0);

  // Buscar despacho ativo
  const { data: despacho, isLoading } = useQuery({
    queryKey: ['despacho-reboque', chamadoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('despacho_reboque')
        .select(`
          *,
          prestador_atribuido:prestadores_assistencia!despacho_reboque_prestador_atribuido_id_fkey(
            id, razao_social, nome_fantasia, telefone, whatsapp
          )
        `)
        .eq('chamado_id', chamadoId)
        .order('ciclo', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Buscar convites do despacho
  const { data: convites } = useQuery({
    queryKey: ['despacho-convites', despacho?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('despacho_reboque_convites')
        .select(`
          *,
          prestador:prestadores_assistencia(id, razao_social, nome_fantasia)
        `)
        .eq('despacho_id', despacho!.id)
        .order('valor_calculado', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
    enabled: !!despacho?.id,
  });

  // Buscar status log
  const { data: statusLog } = useQuery({
    queryKey: ['despacho-status-log', chamadoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('despacho_reboque_status_log')
        .select('*')
        .eq('chamado_id', chamadoId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!despacho && despacho.status === 'atribuido',
  });

  // Realtime
  useEffect(() => {
    if (!despacho?.id) return;
    const channel = supabase
      .channel('despacho-' + despacho.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'despacho_reboque', filter: `id=eq.${despacho.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['despacho-reboque', chamadoId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'despacho_reboque_convites', filter: `despacho_id=eq.${despacho.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['despacho-convites', despacho.id] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'despacho_reboque_status_log', filter: `chamado_id=eq.${chamadoId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['despacho-status-log', chamadoId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [despacho?.id, chamadoId, queryClient]);

  // Timer
  useEffect(() => {
    if (!despacho?.hora_limite || despacho.status !== 'aguardando') return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(despacho.hora_limite).getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        // Trigger attribution
        handleAtribuir();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [despacho?.hora_limite, despacho?.status]);

  // Mutation: Disparar despacho
  const disparar = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada');
      const res = await supabase.functions.invoke('despacho-reboque-disparar', {
        body: { chamado_id: chamadoId },
      });
      if (res.error) throw new Error(res.error.message);
      if (!res.data.success) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Despacho enviado para ${data.total_enviados} reboquistas!`);
      queryClient.invalidateQueries({ queryKey: ['despacho-reboque', chamadoId] });
      queryClient.invalidateQueries({ queryKey: ['chamado', chamadoId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Atribuir agora
  const handleAtribuir = async () => {
    if (!despacho?.id) return;
    try {
      const res = await supabase.functions.invoke('despacho-reboque-atribuir', {
        body: { despacho_id: despacho.id },
      });
      if (res.data?.success) {
        toast.success(res.data.status === 'atribuido' ? `Atribuído a ${res.data.prestador_nome}!` : 'Despacho processado');
        queryClient.invalidateQueries({ queryKey: ['despacho-reboque', chamadoId] });
        queryClient.invalidateQueries({ queryKey: ['chamado', chamadoId] });
      }
    } catch (e: any) { toast.error(e.message); }
  };

  // Reenviar
  const reenviar = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada');
      // Cancelar despacho atual
      if (despacho?.id) {
        await supabase.from('despacho_reboque').update({ status: 'cancelado' }).eq('id', despacho.id);
      }
      // Novo disparo
      const res = await supabase.functions.invoke('despacho-reboque-disparar', {
        body: { chamado_id: chamadoId },
      });
      if (res.error) throw new Error(res.error.message);
      if (!res.data.success) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Reenviado para ${data.total_enviados} reboquistas! (Ciclo ${data.ciclo})`);
      queryClient.invalidateQueries({ queryKey: ['despacho-reboque', chamadoId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return null;

  const timerMin = Math.floor(timeLeft / 60);
  const timerSec = timeLeft % 60;

  // Antes de disparar
  if (!despacho) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Despacho de Reboque</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Envie automaticamente para todos os reboquistas ativos. O sistema atribui ao mais barato em até 10 minutos.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="w-full" disabled={disparar.isPending}>
                {disparar.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Despachar Reboque Automaticamente
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar Despacho Automático</AlertDialogTitle>
                <AlertDialogDescription>
                  Todos os reboquistas ativos receberão um link por WhatsApp. O sistema aguardará até 10 minutos e atribuirá ao mais barato.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => disparar.mutate()}>Confirmar Despacho</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    );
  }

  // Aguardando aceites
  if (despacho.status === 'aguardando') {
    const aceites = convites?.filter((c) => c.status === 'aceito').length || 0;
    const recusas = convites?.filter((c) => c.status === 'recusado').length || 0;
    const semResposta = (despacho.total_enviados || 0) - aceites - recusas;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Despacho de Reboque</CardTitle>
          <Badge className="bg-yellow-100 text-yellow-800 w-fit">Aguardando aceites — Ciclo {despacho.ciclo}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Timer */}
          <div className="flex items-center justify-between">
            <span className="text-sm flex items-center gap-1"><Clock className="h-4 w-4" /> Tempo restante:</span>
            <span className="font-mono font-bold text-lg">
              {String(timerMin).padStart(2, '0')}:{String(timerSec).padStart(2, '0')}
            </span>
          </div>
          <Progress value={Math.max(0, (timeLeft / 600) * 100)} className="h-2" />

          {/* Counters */}
          <div className="grid grid-cols-4 gap-2 text-center text-sm">
            <div><p className="font-bold text-lg">{despacho.total_enviados}</p><p className="text-muted-foreground">Enviados</p></div>
            <div><p className="font-bold text-lg text-green-600">{aceites}</p><p className="text-muted-foreground">Aceites</p></div>
            <div><p className="font-bold text-lg text-red-600">{recusas}</p><p className="text-muted-foreground">Recusas</p></div>
            <div><p className="font-bold text-lg text-gray-500">{semResposta}</p><p className="text-muted-foreground">Sem resp.</p></div>
          </div>

          {/* Table */}
          {convites && convites.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prestador</TableHead>
                  <TableHead>Distância</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {convites.map((c) => {
                  const cfg = conviteStatusConfig[c.status] || { label: c.status, className: '' };
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm">{(c.prestador as any)?.razao_social || (c.prestador as any)?.nome_fantasia}</TableCell>
                      <TableCell>{c.distancia_km ? `${c.distancia_km} km` : '-'}</TableCell>
                      <TableCell>{formatCurrency(c.valor_calculado)}</TableCell>
                      <TableCell><Badge className={cfg.className}>{cfg.label}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          <Button variant="outline" className="w-full" onClick={handleAtribuir} disabled={aceites === 0}>
            ⏹️ Encerrar e atribuir agora {aceites > 0 ? `(${aceites} aceites)` : ''}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Atribuído
  if (despacho.status === 'atribuido') {
    const prest = despacho.prestador_atribuido as any;
    const aceites = convites?.filter((c) => c.status === 'aceito' || c.status === 'nao_atribuido').length || 0;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Despacho de Reboque</CardTitle>
          <Badge className="bg-green-100 text-green-800 w-fit">✅ Atribuído</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg space-y-2">
            <p className="font-bold">{prest?.razao_social || prest?.nome_fantasia || 'Prestador'}</p>
            <p>Valor: <strong>{formatCurrency(despacho.valor_atribuido)}</strong></p>
            <p>Distância: <strong>{despacho.distancia_atribuida_km} km</strong></p>
          </div>

          {/* Status timeline */}
          {statusLog && statusLog.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Timeline do Reboquista:</p>
              {statusLog.map((log) => (
                <div key={log.id} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="text-xs">
                    {format(new Date(log.created_at), 'HH:mm', { locale: ptBR })}
                  </Badge>
                  <span>{log.status === 'a_caminho' ? '🚛 A caminho' : log.status === 'chegou_local' ? '📍 Chegou no local' : log.status === 'veiculo_carregado' ? '🚛 Veículo carregado' : log.status === 'chegou_destino' ? '📍 Chegou no destino' : log.status === 'concluido' ? '✅ Concluído' : log.status}</span>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {aceites} reboquistas aceitaram. Atribuído ao menor valor.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Expirado (ninguém aceitou)
  if (despacho.status === 'expirado') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Despacho de Reboque</CardTitle>
          <Badge className="bg-red-100 text-red-800 w-fit">⚠️ Sem aceites</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Nenhum reboquista aceitou o chamado em 10 minutos (ciclo {despacho.ciclo}). Intervenção manual necessária.
            </AlertDescription>
          </Alert>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => reenviar.mutate()} disabled={reenviar.isPending}>
              <RotateCw className="h-4 w-4 mr-2" />
              Reenviar para todos
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}

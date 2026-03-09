import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Truck, Send, CheckCircle, XCircle, AlertTriangle, Loader2, RotateCw, MapPin, Navigation, UserCheck, Clock, Camera, Upload, X, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useFotosReboquista, useAddFotoReboquista, useDeleteFotoReboquista } from '@/hooks/useFotosReboquista';

const vehicleIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41] });
const truckIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41] });

function FitBoundsCard({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length >= 2) map.fitBounds(positions as L.LatLngBoundsExpression, { padding: [30, 30] });
  }, [positions, map]);
  return null;
}

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

const etapaConfig: Record<string, { label: string; className: string }> = {
  aguardando_interesse: { label: '⏳ Aguardando interesse', className: 'bg-yellow-100 text-yellow-700' },
  aguardando_localizacao: { label: '📍 Aguardando localização', className: 'bg-blue-100 text-blue-700' },
  aguardando_confirmacao_valor: { label: '💰 Aguardando aceite do valor', className: 'bg-orange-100 text-orange-700' },
  aguardando_eta: { label: '⏱️ Aguardando tempo de chegada', className: 'bg-purple-100 text-purple-700' },
  aceito: { label: '✅ Aceito', className: 'bg-green-100 text-green-700' },
  recusado: { label: '❌ Recusou', className: 'bg-red-100 text-red-700' },
};

export function CardDespachoReboque({ chamadoId, chamadoStatus }: Props) {
  const queryClient = useQueryClient();

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
          prestador:prestadores_assistencia(id, razao_social, nome_fantasia, whatsapp, telefone)
        `)
        .eq('despacho_id', despacho!.id)
        .order('valor_calculado', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
    enabled: !!despacho?.id,
    refetchInterval: 10000, // Poll every 10s para ver aceites em tempo real
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

  // Buscar última posição do tracking
  const { data: ultimaPosicao } = useQuery({
    queryKey: ['despacho-tracking-last', chamadoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('despacho_reboque_tracking')
        .select('*')
        .eq('chamado_id', chamadoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!despacho && despacho.status === 'atribuido',
    refetchInterval: 15000,
  });

  // Buscar trilha do tracking
  const { data: trilhaTracking } = useQuery({
    queryKey: ['despacho-tracking-trail', chamadoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('despacho_reboque_tracking')
        .select('latitude, longitude, created_at')
        .eq('chamado_id', chamadoId)
        .order('created_at', { ascending: true })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!despacho && despacho.status === 'atribuido',
    refetchInterval: 30000,
  });

  // Dados do chamado para o mapa
  const { data: chamadoData } = useQuery({
    queryKey: ['chamado-coords', chamadoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chamados_assistencia')
        .select('origem_lat, origem_lng, rastreador_lat, rastreador_lng, destino_lat, destino_lng')
        .eq('id', chamadoId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!despacho && despacho.status === 'atribuido',
  });

  const veiculoLat = chamadoData?.rastreador_lat || chamadoData?.origem_lat;
  const veiculoLng = chamadoData?.rastreador_lng || chamadoData?.origem_lng;

  const trilhaPosicoes = useMemo(() => {
    if (!trilhaTracking?.length) return [];
    return trilhaTracking.map(t => [Number(t.latitude), Number(t.longitude)] as [number, number]);
  }, [trilhaTracking]);

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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'despacho_reboque_tracking', filter: `chamado_id=eq.${chamadoId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['despacho-tracking-last', chamadoId] });
        queryClient.invalidateQueries({ queryKey: ['despacho-tracking-trail', chamadoId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [despacho?.id, chamadoId, queryClient]);

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
      toast.success(`Despacho enviado para ${data.total_enviados} reboquistas via WhatsApp!`);
      queryClient.invalidateQueries({ queryKey: ['despacho-reboque', chamadoId] });
      queryClient.invalidateQueries({ queryKey: ['chamado', chamadoId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Mutation: Atribuir prestador manualmente
  const atribuirMutation = useMutation({
    mutationFn: async (conviteId: string) => {
      // Buscar dados do convite
      const convite = convites?.find(c => c.id === conviteId);
      if (!convite) throw new Error('Convite não encontrado');

      // Atualizar despacho com o prestador atribuído
      const { error: despErr } = await supabase
        .from('despacho_reboque')
        .update({
          status: 'atribuido',
          prestador_atribuido_id: convite.prestador_id,
          valor_atribuido: convite.valor_calculado,
          distancia_atribuida_km: convite.distancia_km,
        })
        .eq('id', despacho!.id);

      if (despErr) throw new Error('Erro ao atribuir: ' + despErr.message);

      // Marcar outros aceitos como não_atribuido
      await supabase
        .from('despacho_reboque_convites')
        .update({ status: 'nao_atribuido' })
        .eq('despacho_id', despacho!.id)
        .eq('status', 'aceito')
        .neq('id', conviteId);

      // Atualizar chamado
      await supabase
        .from('chamados_assistencia')
        .update({
          status: 'prestador_despachado',
          prestador_id: convite.prestador_id,
        })
        .eq('id', chamadoId);

      // Buscar dados do associado para enviar contato ao reboquista
      const { data: chamadoInfo } = await supabase
        .from('chamados_assistencia')
        .select('associado:associados(nome, telefone)')
        .eq('id', chamadoId)
        .single();

      const associado = (chamadoInfo as any)?.associado;
      const nomeAssociado = associado?.nome || 'Associado';
      const telAssociado = associado?.telefone || '';

      // Notificar prestador atribuído via WhatsApp (com contato do associado)
      const prest = convite.prestador as any;
      const telPrest = prest?.whatsapp || prest?.telefone;
      if (telPrest) {
        const contatoAssociado = telAssociado
          ? `\n\n👤 *Associado:* ${nomeAssociado}\n📱 *Telefone:* ${telAssociado}`
          : `\n\n👤 *Associado:* ${nomeAssociado}`;

        await supabase.functions.invoke('whatsapp-send-text', {
          body: {
            telefone: telPrest,
            mensagem: `🎉 *CHAMADO ATRIBUÍDO A VOCÊ!*\n\nVocê foi selecionado para este serviço de reboque.\nValor: ${formatCurrency(convite.valor_calculado)}${contatoAssociado}\n\nPor favor, dirija-se ao local o mais rápido possível. Boa viagem! 🚛`,
          },
        });
      }

      return { prestador_nome: prest?.razao_social || prest?.nome_fantasia };
    },
    onSuccess: (data) => {
      toast.success(`Atribuído a ${data.prestador_nome}!`);
      queryClient.invalidateQueries({ queryKey: ['despacho-reboque', chamadoId] });
      queryClient.invalidateQueries({ queryKey: ['despacho-convites', despacho?.id] });
      queryClient.invalidateQueries({ queryKey: ['chamado', chamadoId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Reenviar
  const reenviar = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada');
      if (despacho?.id) {
        await supabase.from('despacho_reboque').update({ status: 'cancelado' }).eq('id', despacho.id);
      }
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

  // Antes de disparar
  if (!despacho) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Despacho de Reboque</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Envie mensagem via WhatsApp para todos os reboquistas ativos. Os prestadores respondem diretamente no chat e o analista escolhe o melhor.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="w-full" disabled={disparar.isPending}>
                {disparar.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Despachar Reboque via WhatsApp
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar Despacho</AlertDialogTitle>
                <AlertDialogDescription>
                   Todos os reboquistas ativos receberão uma mensagem WhatsApp com os dados do chamado. A IA coletará localização, calculará o valor e tempo de chegada de cada um. Você escolherá entre os Top 3.
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
    const aceitos = convites?.filter((c) => c.status === 'aceito' || c.etapa_conversacao === 'aceito') || [];
    const recusas = convites?.filter((c) => c.status === 'recusado' || c.etapa_conversacao === 'recusado').length || 0;
    const semResposta = convites?.filter((c) => 
      c.etapa_conversacao === 'aguardando_interesse' || 
      c.etapa_conversacao === 'aguardando_localizacao' || 
      c.etapa_conversacao === 'aguardando_confirmacao_valor' || 
      c.etapa_conversacao === 'aguardando_eta'
    ).length || 0;

    // Top 3 aceitos, ordenados por menor valor e menor distância
    const top3 = aceitos
      .sort((a, b) => {
        const va = a.valor_calculado || Infinity;
        const vb = b.valor_calculado || Infinity;
        if (va !== vb) return va - vb;
        return (a.distancia_km || Infinity) - (b.distancia_km || Infinity);
      })
      .slice(0, 3);

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Despacho de Reboque</CardTitle>
          <Badge className="bg-yellow-100 text-yellow-800 w-fit">Aguardando respostas — Ciclo {despacho.ciclo}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Counters */}
          <div className="grid grid-cols-4 gap-2 text-center text-sm">
            <div><p className="font-bold text-lg">{despacho.total_enviados}</p><p className="text-muted-foreground">Enviados</p></div>
            <div><p className="font-bold text-lg text-green-600">{aceitos.length}</p><p className="text-muted-foreground">Aceitos</p></div>
            <div><p className="font-bold text-lg text-red-600">{recusas}</p><p className="text-muted-foreground">Recusados</p></div>
            <div><p className="font-bold text-lg text-muted-foreground">{semResposta}</p><p className="text-muted-foreground">Aguardando</p></div>
          </div>

          {/* Top 3 para atribuição manual */}
          {top3.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold flex items-center gap-1">
                <UserCheck className="h-4 w-4" /> Selecione o prestador (Top {Math.min(3, top3.length)} — menor valor e mais próximo):
              </p>
              <div className="space-y-2">
                {top3.map((c, idx) => {
                  const prest = c.prestador as any;
                  return (
                    <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg bg-green-50 dark:bg-green-950/20">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">#{idx + 1}</Badge>
                          <span className="font-medium text-sm">{prest?.razao_social || prest?.nome_fantasia}</span>
                        </div>
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {c.distancia_km ? `${c.distancia_km} km` : '-'}</span>
                          <span className="font-semibold text-foreground">{formatCurrency(c.valor_calculado)}</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {(c as any).tempo_chegada_minutos ? `~${(c as any).tempo_chegada_minutos} min` : '-'}</span>
                        </div>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" disabled={atribuirMutation.isPending}>
                            <CheckCircle className="h-4 w-4 mr-1" /> Atribuir
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar Atribuição</AlertDialogTitle>
                            <AlertDialogDescription>
                              Atribuir o chamado para <strong>{prest?.razao_social || prest?.nome_fantasia}</strong> por {formatCurrency(c.valor_calculado)} ({c.distancia_km} km)?
                              O prestador será notificado por WhatsApp.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => atribuirMutation.mutate(c.id)}>
                              Confirmar Atribuição
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tabela completa de convites */}
          {convites && convites.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Todos os prestadores:</p>
              <Table>
                <TableHeader>
                  <TableRow>
                     <TableHead>Prestador</TableHead>
                     <TableHead>Etapa</TableHead>
                     <TableHead>Distância</TableHead>
                     <TableHead>Valor</TableHead>
                     <TableHead>ETA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {convites.map((c) => {
                    const etapa = c.etapa_conversacao || 'aguardando_sim';
                    const cfg = etapaConfig[etapa] || { label: etapa, className: '' };
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="text-sm">{(c.prestador as any)?.razao_social || (c.prestador as any)?.nome_fantasia}</TableCell>
                        <TableCell><Badge className={cfg.className}>{cfg.label}</Badge></TableCell>
                        <TableCell>{c.distancia_km ? `${c.distancia_km} km` : '-'}</TableCell>
                        <TableCell>{formatCurrency(c.valor_calculado)}</TableCell>
                        <TableCell>{(c as any).tempo_chegada_minutos ? `~${(c as any).tempo_chegada_minutos} min` : '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {aceitos.length === 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Aguardando respostas dos reboquistas via WhatsApp. Os aceites aparecerão automaticamente aqui.
              </AlertDescription>
            </Alert>
          )}

          <Button variant="outline" className="w-full" onClick={() => reenviar.mutate()} disabled={reenviar.isPending}>
            <RotateCw className="h-4 w-4 mr-2" />
            Cancelar e reenviar para todos
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Atribuído
  if (despacho.status === 'atribuido') {
    const prest = despacho.prestador_atribuido as any;
    const aceites = convites?.filter((c) => c.status === 'aceito' || c.status === 'nao_atribuido').length || 0;

    const lastStatus = statusLog?.[statusLog.length - 1]?.status;
    const isConcluido = lastStatus === 'concluido';
    const truckLat = ultimaPosicao ? Number(ultimaPosicao.latitude) : null;
    const truckLng = ultimaPosicao ? Number(ultimaPosicao.longitude) : null;
    const temTracking = truckLat !== null && truckLng !== null;
    const temVeiculo = veiculoLat !== null && veiculoLng !== null;

    const mapPositions: [number, number][] = [];
    if (temTracking) mapPositions.push([truckLat!, truckLng!]);
    if (temVeiculo) mapPositions.push([veiculoLat!, veiculoLng!]);

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Despacho de Reboque</CardTitle>
          <Badge className="bg-green-100 text-green-800 w-fit">
            {isConcluido ? '✅ Concluído' : '🚛 Em andamento'}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg space-y-2">
            <p className="font-bold">{prest?.razao_social || prest?.nome_fantasia || 'Prestador'}</p>
            <div className="flex gap-4 text-sm">
              <span>Valor: <strong>{formatCurrency(despacho.valor_atribuido)}</strong></span>
              <span>Distância: <strong>{despacho.distancia_atribuida_km} km</strong></span>
            </div>
            {prest?.whatsapp && (
              <Button variant="outline" size="sm" asChild>
                <a href={`https://wa.me/55${prest.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                  📱 WhatsApp do reboquista
                </a>
              </Button>
            )}
          </div>

          {!isConcluido && (
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${temTracking ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'}`} />
              <span className="text-sm">
                {temTracking
                  ? `📡 Localização ativa — última atualização: ${ultimaPosicao?.created_at ? format(new Date(ultimaPosicao.created_at), 'HH:mm:ss', { locale: ptBR }) : ''}`
                  : '📡 Aguardando localização do reboquista...'}
              </span>
            </div>
          )}

          {mapPositions.length > 0 && !isConcluido && (
            <div className="h-64 rounded-lg overflow-hidden border">
              <MapContainer
                center={temTracking ? [truckLat!, truckLng!] : [veiculoLat!, veiculoLng!]}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
                zoomControl={true}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {temVeiculo && <Marker position={[veiculoLat!, veiculoLng!]} icon={vehicleIcon} />}
                {temTracking && <Marker position={[truckLat!, truckLng!]} icon={truckIcon} />}
                {trilhaPosicoes.length > 1 && (
                  <Polyline positions={trilhaPosicoes} color="#22c55e" weight={3} opacity={0.7} />
                )}
                {temTracking && temVeiculo && (
                  <Polyline positions={[[truckLat!, truckLng!], [veiculoLat!, veiculoLng!]]} color="#3b82f6" dashArray="8 8" weight={2} />
                )}
                {mapPositions.length >= 2 && <FitBoundsCard positions={mapPositions} />}
              </MapContainer>
            </div>
          )}
          {mapPositions.length > 0 && !isConcluido && (
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" /> Veículo</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500 inline-block" /> Reboquista</span>
              {trilhaPosicoes.length > 1 && <span className="flex items-center gap-1"><span className="h-3 w-3 border-t-2 border-green-500 inline-block" /> Percurso</span>}
            </div>
          )}

          {statusLog && statusLog.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium mb-2">Timeline do Reboquista:</p>
              <div className="relative pl-6 border-l-2 border-muted space-y-3">
                {statusLog.map((log, idx) => {
                  const isLast = idx === statusLog.length - 1;
                  const statusEmoji = log.status === 'a_caminho' ? '🚛' : log.status === 'chegou_local' ? '📍' : log.status === 'veiculo_carregado' ? '🔵' : log.status === 'chegou_destino' ? '🟢' : log.status === 'concluido' ? '✅' : '⚪';
                  const statusText = log.status === 'a_caminho' ? 'A caminho' : log.status === 'chegou_local' ? 'Chegou no local' : log.status === 'veiculo_carregado' ? 'Veículo carregado' : log.status === 'chegou_destino' ? 'Chegou no destino' : log.status === 'concluido' ? 'Serviço concluído' : log.status;
                  return (
                    <div key={log.id} className="relative">
                      <div className={`absolute -left-[25px] top-0.5 h-4 w-4 rounded-full flex items-center justify-center text-xs ${isLast ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        <span className="text-[10px]">{statusEmoji}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono">
                          {format(new Date(log.created_at), 'HH:mm', { locale: ptBR })}
                        </Badge>
                        <span className={`text-sm ${isLast ? 'font-semibold' : ''}`}>{statusText}</span>
                      </div>
                      {log.observacao && <p className="text-xs text-muted-foreground mt-0.5">{log.observacao}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {aceites} reboquistas aceitaram. Atribuído manualmente pelo analista.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Expirado / sem aceites
  if (despacho.status === 'expirado' || despacho.status === 'cancelado') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Despacho de Reboque</CardTitle>
          <Badge className="bg-red-100 text-red-800 w-fit">⚠️ {despacho.status === 'cancelado' ? 'Cancelado' : 'Sem aceites'}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {despacho.status === 'cancelado'
                ? `Despacho cancelado (ciclo ${despacho.ciclo}).`
                : `Nenhum reboquista aceitou o chamado (ciclo ${despacho.ciclo}). Intervenção manual necessária.`}
            </AlertDescription>
          </Alert>
          <Button variant="outline" className="w-full" onClick={() => reenviar.mutate()} disabled={reenviar.isPending}>
            <RotateCw className="h-4 w-4 mr-2" />
            Reenviar para todos
          </Button>
        </CardContent>
      </Card>
    );
  }

  return null;
}

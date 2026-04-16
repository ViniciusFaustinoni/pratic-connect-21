import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MapPin, Phone, Camera, CheckCircle, Clock, AlertTriangle, Loader2, Upload, ThumbsUp, ThumbsDown, Navigation as NavIcon, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export default function PrestadorInstalacao() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [fotos, setFotos] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showRecusarDialog, setShowRecusarDialog] = useState(false);
  const [recusaMotivo, setRecusaMotivo] = useState('');

  // Buscar link pelo token
  const { data: link, isLoading, error } = useQuery({
    queryKey: ['prestador-link', token],
    queryFn: async () => {
      if (!token) throw new Error('Token inválido');
      const { data, error } = await publicSupabase
        .from('instalacao_prestador_links' as any)
        .select('*')
        .eq('token', token)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Link não encontrado');
      if (new Date((data as any).expires_at) < new Date()) {
        throw new Error('Este link expirou');
      }
      return data as any;
    },
    enabled: !!token,
  });

  // Buscar dados da instalação
  const { data: instalacao } = useQuery({
    queryKey: ['prestador-instalacao', link?.instalacao_id],
    queryFn: async () => {
      const { data, error } = await publicSupabase
        .from('instalacoes' as any)
        .select(`
          id, data_agendada, periodo, logradouro, numero, complemento, bairro, cidade, uf, cep,
          associados:associado_id(nome, telefone)
        `)
        .eq('id', link.instalacao_id)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!link?.instalacao_id,
  });

  // ── Geolocalização contínua ──
  useEffect(() => {
    if (!token || !link) return;
    if (link.status === 'concluida' || link.status === 'cancelada') return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    let lastSent = 0;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSent < 25_000) return;
        lastSent = now;
        publicSupabase
          .from('instalacao_prestador_links' as any)
          .update({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            precisao_metros: pos.coords.accuracy,
            localizacao_atualizada_em: new Date().toISOString(),
          })
          .eq('token', token)
          .then(() => {});
      },
      (err) => console.warn('[PrestadorInstalacao] geolocation error', err),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [token, link?.status, link?.id]);

  const transicionarStatus = useCallback(async (
    novoStatus: 'aceito' | 'em_rota' | 'em_execucao',
  ) => {
    if (!token) return;
    const stamp = new Date().toISOString();
    const fieldStamp =
      novoStatus === 'aceito' ? 'aceito_em' :
      novoStatus === 'em_rota' ? 'em_rota_em' :
      'iniciada_em';
    const payload: any = {
      status: novoStatus,
      [fieldStamp]: stamp,
      updated_at: stamp,
    };
    if (novoStatus === 'em_execucao') payload.chegada_em = stamp;
    const { error } = await publicSupabase
      .from('instalacao_prestador_links' as any)
      .update(payload)
      .eq('token', token);
    if (error) { toast.error('Erro ao atualizar status'); return; }
    queryClient.invalidateQueries({ queryKey: ['prestador-link', token] });
  }, [token, queryClient]);

  const recusarTarefa = useCallback(async () => {
    if (!token) return;
    const stamp = new Date().toISOString();
    const { error } = await publicSupabase
      .from('instalacao_prestador_links' as any)
      .update({
        status: 'cancelada',
        recusado_em: stamp,
        recusa_motivo: recusaMotivo || null,
        updated_at: stamp,
      })
      .eq('token', token);
    if (error) { toast.error('Erro ao recusar'); return; }
    setShowRecusarDialog(false);
    queryClient.invalidateQueries({ queryKey: ['prestador-link', token] });
    toast.success('Tarefa recusada');
  }, [token, recusaMotivo, queryClient]);

  // Concluir com foto
  const concluir = useMutation({
    mutationFn: async () => {
      if (fotos.length === 0) throw new Error('Envie ao menos uma foto');
      setUploading(true);
      const urls: string[] = [];
      for (const foto of fotos) {
        const ext = foto.name.split('.').pop() || 'jpg';
        const path = `${link.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadErr } = await publicSupabase.storage
          .from('prestador-fotos')
          .upload(path, foto);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = publicSupabase.storage
          .from('prestador-fotos')
          .getPublicUrl(path);
        urls.push(urlData.publicUrl);
      }
      const { error } = await publicSupabase
        .from('instalacao_prestador_links' as any)
        .update({
          status: 'concluida',
          concluida_em: new Date().toISOString(),
          foto_comprovante_url: urls[0],
          updated_at: new Date().toISOString(),
        })
        .eq('token', token);
      if (error) throw error;
    },
    onSuccess: () => {
      setUploading(false);
      queryClient.invalidateQueries({ queryKey: ['prestador-link', token] });
      toast.success('Instalação marcada como concluída!');
    },
    onError: (e: any) => {
      setUploading(false);
      toast.error(e.message || 'Erro ao concluir');
    },
  });

  const handleFotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFotos(Array.from(e.target.files));
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !link) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Link inválido ou expirado</h2>
            <p className="text-muted-foreground text-sm">
              Este link não existe, já foi utilizado ou expirou. Entre em contato com a Praticcar.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const associado = instalacao?.associados as any;
  const endereco = [
    instalacao?.logradouro,
    instalacao?.numero ? `nº ${instalacao.numero}` : null,
    instalacao?.complemento,
    instalacao?.bairro,
    instalacao?.cidade,
    instalacao?.uf,
  ].filter(Boolean).join(', ');

  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    aguardando: { label: 'Aguardando aceite', color: 'bg-amber-500/15 text-amber-700 border-amber-500/30', icon: Clock },
    aceito: { label: 'Tarefa aceita', color: 'bg-blue-500/15 text-blue-700 border-blue-500/30', icon: ThumbsUp },
    em_rota: { label: 'Em rota', color: 'bg-purple-500/15 text-purple-700 border-purple-500/30', icon: NavIcon },
    em_execucao: { label: 'Em execução', color: 'bg-blue-500/15 text-blue-700 border-blue-500/30', icon: Camera },
    concluida: { label: 'Concluída', color: 'bg-green-500/15 text-green-700 border-green-500/30', icon: CheckCircle },
  };

  const currentStatus = statusConfig[link.status] || statusConfig.aguardando;
  const StatusIcon = currentStatus.icon;

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="max-w-md mx-auto space-y-4">
        <div className="text-center pt-2 pb-4">
          <h1 className="text-xl font-bold">Instalação Praticcar</h1>
          <Badge variant="outline" className={currentStatus.color}>
            <StatusIcon className="h-3.5 w-3.5 mr-1" />
            {currentStatus.label}
          </Badge>
        </div>

        {instalacao && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Dados da Instalação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Associado</p>
                <p className="font-medium">{associado?.nome || '—'}</p>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm">{endereco || 'Endereço não informado'}</p>
                  {instalacao.cep && <p className="text-xs text-muted-foreground">CEP: {instalacao.cep}</p>}
                </div>
              </div>
              {instalacao.data_agendada && (
                <div>
                  <p className="text-sm text-muted-foreground">Data agendada</p>
                  <p className="font-medium">
                    {format(new Date(instalacao.data_agendada), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    {instalacao.periodo && ` — ${instalacao.periodo === 'manha' ? 'Manhã' : instalacao.periodo === 'tarde' ? 'Tarde' : instalacao.periodo}`}
                  </p>
                </div>
              )}
              {associado?.telefone && (
                <a
                  href={`tel:${associado.telefone}`}
                  className="flex items-center gap-2 text-primary font-medium text-sm hover:underline"
                >
                  <Phone className="h-4 w-4" />
                  Ligar para o associado: {associado.telefone}
                </a>
              )}
            </CardContent>
          </Card>
        )}

        {/* Ações por status */}
        {link.status === 'aguardando' && (
          <Card className="border-amber-500/30 bg-amber-50/50">
            <CardContent className="pt-4 space-y-3">
              <p className="text-sm">Você recebeu uma nova tarefa de instalação. Aceita realizá-la?</p>
              <div className="grid grid-cols-2 gap-2">
                <Button className="h-12 bg-green-600 hover:bg-green-700" onClick={() => transicionarStatus('aceito')}>
                  <ThumbsUp className="h-4 w-4 mr-2" />Aceitar
                </Button>
                <Button variant="outline" className="h-12 border-red-300 text-red-700 hover:bg-red-50" onClick={() => setShowRecusarDialog(true)}>
                  <ThumbsDown className="h-4 w-4 mr-2" />Recusar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {link.status === 'aceito' && (
          <Button className="w-full h-14 text-base bg-blue-600 hover:bg-blue-700" onClick={() => transicionarStatus('em_rota')}>
            <NavIcon className="h-5 w-5 mr-2" />Iniciar Rota
          </Button>
        )}

        {link.status === 'em_rota' && (
          <Button className="w-full h-14 text-base bg-purple-600 hover:bg-purple-700" onClick={() => transicionarStatus('em_execucao')}>
            <PlayCircle className="h-5 w-5 mr-2" />Cheguei / Iniciar Instalação
          </Button>
        )}

        {link.status === 'em_execucao' && (
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Foto do comprovante (obrigatório)
                </label>
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 cursor-pointer hover:border-primary/50 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={handleFotoChange}
                    className="hidden"
                  />
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {fotos.length > 0 ? `${fotos.length} foto(s) selecionada(s)` : 'Tirar foto ou selecionar'}
                  </span>
                </label>
                {fotos.length > 0 && (
                  <div className="flex gap-2 mt-2 overflow-x-auto">
                    {fotos.map((f, i) => (
                      <img
                        key={i}
                        src={URL.createObjectURL(f)}
                        alt={`Foto ${i + 1}`}
                        className="h-16 w-16 object-cover rounded-md border"
                      />
                    ))}
                  </div>
                )}
              </div>
              <Button
                className="w-full h-14 text-base bg-green-600 hover:bg-green-700"
                onClick={() => concluir.mutate()}
                disabled={concluir.isPending || fotos.length === 0}
              >
                {concluir.isPending || uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="h-5 w-5 mr-2" />
                )}
                Marcar como Concluído
              </Button>
            </CardContent>
          </Card>
        )}

        {link.status === 'concluida' && (
          <Card className="border-green-500/30">
            <CardContent className="pt-6 text-center">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-green-700">Instalação concluída!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Obrigado pelo serviço. A equipe Praticcar foi notificada.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={showRecusarDialog} onOpenChange={setShowRecusarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recusar tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              Informe o motivo (opcional). O coordenador será avisado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Motivo da recusa..."
            value={recusaMotivo}
            onChange={(e) => setRecusaMotivo(e.target.value)}
            className="min-h-[80px]"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={recusarTarefa} className="bg-red-600 hover:bg-red-700">
              Confirmar Recusa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

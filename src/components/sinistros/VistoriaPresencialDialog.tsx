import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Video, Square, MapPin, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordemServico: { id: string; numero: string };
}

export function VistoriaPresencialDialog({ open, onOpenChange, ordemServico }: Props) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [gravando, setGravando] = useState(false);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [observacoes, setObservacoes] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [tempoGravacao, setTempoGravacao] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const capturarGPS = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
      },
      () => toast.error('Não foi possível obter localização'),
    );
  }, []);

  const iniciarGravacao = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: true,
      });
      streamRef.current = stream;
      chunksRef.current = [];

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }

      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setVideoBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = null;
          videoPreviewRef.current.src = URL.createObjectURL(blob);
        }
      };

      recorder.start(1000);
      setGravando(true);
      setTempoGravacao(0);
      capturarGPS();

      timerRef.current = setInterval(() => {
        setTempoGravacao((prev) => {
          if (prev >= 179) { // 3 min
            pararGravacao();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      toast.error('Não foi possível acessar a câmera');
    }
  };

  const pararGravacao = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setGravando(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleSalvar = async () => {
    if (!profile?.id) return;
    setSalvando(true);

    try {
      let videoUrl = null;
      if (videoBlob) {
        const path = `${ordemServico.id}/vistorias-presenciais/vistoria_${Date.now()}.webm`;
        const { error: uploadErr } = await supabase.storage
          .from('sinistro-eventos')
          .upload(path, videoBlob, { contentType: 'video/webm', upsert: true });
        if (!uploadErr) {
          const { data } = supabase.storage.from('sinistro-eventos').getPublicUrl(path);
          videoUrl = data?.publicUrl;
        }
      }

      const { error } = await supabase.from('os_vistorias_presenciais').insert({
        ordem_servico_id: ordemServico.id,
        regulador_id: profile.id,
        video_url: videoUrl,
        latitude,
        longitude,
        observacoes,
      } as any);

      if (error) throw error;

      toast.success('Vistoria presencial registrada!');
      queryClient.invalidateQueries({ queryKey: ['veiculos-oficina'] });
      onOpenChange(false);
      setVideoBlob(null);
      setObservacoes('');
      setTempoGravacao(0);
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    } finally {
      setSalvando(false);
    }
  };

  const formatTempo = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Vistoria Presencial — OS {ordemServico.numero}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Vídeo */}
          <div>
            <Label className="text-sm font-medium flex items-center gap-1">
              <Video className="h-4 w-4" /> Gravação de Vídeo (até 3 min)
            </Label>
            <div className="mt-2 bg-black rounded-lg overflow-hidden aspect-video relative">
              <video ref={videoPreviewRef} className="w-full h-full object-cover" controls={!!videoBlob} muted={gravando} playsInline />
              {gravando && (
                <div className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  {formatTempo(tempoGravacao)} / 3:00
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-2">
              {!gravando && !videoBlob && (
                <Button onClick={iniciarGravacao} className="flex-1" size="sm">
                  <Video className="h-4 w-4 mr-1" /> Iniciar Gravação
                </Button>
              )}
              {gravando && (
                <Button onClick={pararGravacao} variant="destructive" className="flex-1" size="sm">
                  <Square className="h-4 w-4 mr-1" /> Parar
                </Button>
              )}
              {videoBlob && !gravando && (
                <Button onClick={() => { setVideoBlob(null); setTempoGravacao(0); }} variant="outline" className="flex-1" size="sm">
                  Regravar
                </Button>
              )}
            </div>
          </div>

          {/* GPS */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {latitude && longitude ? (
              <span>GPS: {latitude.toFixed(6)}, {longitude.toFixed(6)}</span>
            ) : (
              <Button variant="ghost" size="sm" onClick={capturarGPS} className="text-xs">
                Capturar localização
              </Button>
            )}
          </div>

          {/* Observações */}
          <div>
            <Label className="text-sm">Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações sobre a vistoria..."
              rows={3}
              className="mt-1"
            />
          </div>

          <Button onClick={handleSalvar} disabled={salvando} className="w-full">
            {salvando ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Salvando...</> : 'Salvar Vistoria'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

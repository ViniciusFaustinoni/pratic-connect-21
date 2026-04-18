import { useState, useRef, useEffect } from 'react';
import { Video, Square, Play, Loader2, CheckCircle, RotateCcw, X, AlertTriangle, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { detectInAppBrowser, getInAppBrowserName, isIOS } from '@/lib/detectInAppBrowser';
import { toast } from 'sonner';

interface VideoCaptureProps {
  onCapture: (file: File) => void;
  onReset?: () => void;
  videoUrl?: string;
  uploading?: boolean;
  confirmed?: boolean; // Upload confirmado pelo pai
  maxDuration?: number; // em segundos
  label?: string;
  cameraOnly?: boolean; // Se true, remove opção de galeria
}

export function VideoCapture({
  onCapture,
  onReset,
  videoUrl,
  uploading = false,
  confirmed = false,
  maxDuration = 120, // 2 minutos padrão
  label = 'Vídeo 360°',
  cameraOnly = false,
}: VideoCaptureProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Quando getUserMedia falha em in-app browser, mostramos o aviso de "abrir no navegador"
  const [cameraBlocked, setCameraBlocked] = useState(false);
  // Stream ao vivo para preview — desacoplado do mount do <video> via useEffect.
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayUrl = videoUrl || previewUrl;
  const hasVideo = !!displayUrl;
  const isPendingReview = !!pendingFile && !uploading && !confirmed && !videoUrl;

  // Limpar recursos ao desmontar
  useEffect(() => {
    return () => {
      stopRecording();
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Após upload confirmado pelo pai, libera o blob local pesado para reduzir pressão de memória.
  // Mantém apenas o videoUrl remoto para exibição.
  useEffect(() => {
    if (confirmed && previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPendingFile(null);
    }
  }, [confirmed, previewUrl]);

  // Attach do MediaStream ao <video> assim que ambos existem.
  // Resolve o race condition: o ref pode ainda não estar montado quando getUserMedia resolve.
  useEffect(() => {
    const v = videoPreviewRef.current;
    if (!v) return;
    if (!liveStream) {
      // Garante limpeza explícita ao parar.
      try { v.srcObject = null; } catch {}
      return;
    }
    try {
      v.srcObject = liveStream;
      v.muted = true;
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
      v.play().catch(err => console.warn('[VideoCapture] play():', err));
    } catch (err) {
      console.warn('[VideoCapture] attach stream falhou:', err);
    }
  }, [liveStream]);

  const startRecording = async () => {
    setError(null);
    chunksRef.current = [];
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: true,
      });
      
      streamRef.current = stream;
      // O attach ao <video> acontece no useEffect acima, garantindo que o ref já está montado.
      setLiveStream(stream);


      // Prefer MP4 (Safari/iOS) → fallback WebM
      const candidates = [
        'video/mp4;codecs=h264,aac',
        'video/mp4',
        'video/webm;codecs=vp9',
        'video/webm',
      ];
      const mimeType = candidates.find((t) => MediaRecorder.isTypeSupported(t)) || 'video/webm';
      const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
      const baseType = mimeType.startsWith('video/mp4') ? 'video/mp4' : 'video/webm';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: baseType });
        const file = new File([blob], `video_360_${Date.now()}.${ext}`, { type: baseType });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setPendingFile(file);
        
        // Limpar stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };
      
      mediaRecorder.start(1000); // Salvar a cada segundo
      setIsRecording(true);
      setRecordingTime(0);
      
      // Timer para duração
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= maxDuration - 1) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
      
    } catch (err: any) {
      console.error('Erro ao acessar câmera:', err);
      const inApp = detectInAppBrowser();
      if (inApp) {
        // Em navegadores in-app (WhatsApp/Instagram/Facebook/TikTok) o getUserMedia
        // costuma falhar ou retornar stream sem preview. Mostramos o aviso completo.
        setCameraBlocked(true);
        setError(null);
      } else {
        setError('Não foi possível acessar a câmera. Verifique as permissões.');
      }
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
    
    setIsRecording(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Verificar se é vídeo
      if (!file.type.startsWith('video/')) {
        setError('Por favor, selecione um arquivo de vídeo.');
        return;
      }
      
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setPendingFile(file);
    }
    e.target.value = '';
  };

  const handleReset = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPendingFile(null);
    setRecordingTime(0);
    setError(null);
    onReset?.();
  };

  const handleConfirmUpload = () => {
    if (pendingFile) {
      onCapture(pendingFile);
      setPendingFile(null);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        capture="environment"
        onChange={handleFileUpload}
        className="hidden"
      />

      <div
        className={cn(
          'relative flex aspect-video flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all',
          hasVideo
            ? 'border-transparent'
            : 'border-slate-600 bg-slate-800'
        )}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
            <span className="text-sm text-slate-400">Enviando vídeo...</span>
          </div>
        ) : isRecording ? (
          <>
            <video
              ref={videoPreviewRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full rounded-lg object-cover"
            />
            {/* HUD topo: timer */}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-center bg-gradient-to-b from-black/70 to-transparent px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
                <span className="text-sm font-semibold text-white drop-shadow">
                  {formatTime(recordingTime)} / {formatTime(maxDuration)}
                </span>
              </div>
            </div>
            {/* HUD rodapé: botão parar */}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-gradient-to-t from-black/70 to-transparent px-3 py-3">
              <Button
                size="sm"
                variant="destructive"
                onClick={stopRecording}
                className="gap-2"
              >
                <Square className="h-4 w-4" />
                Parar Gravação
              </Button>
            </div>
          </>
        ) : hasVideo ? (
          <>
            <video
              src={displayUrl}
              controls
              playsInline
              className="h-full w-full rounded-lg object-contain"
            />
            <div className="absolute top-2 right-2 flex gap-1">
              {uploading ? (
                <div className="rounded-full bg-blue-500 p-1">
                  <Loader2 className="h-4 w-4 text-white animate-spin" />
                </div>
              ) : confirmed || videoUrl ? (
                <div className="rounded-full bg-green-500 p-1">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
              ) : (
                <div className="rounded-full bg-amber-500 p-1">
                  <Loader2 className="h-4 w-4 text-white animate-spin" />
                </div>
              )}
            </div>
            <div className="absolute bottom-2 left-2 right-2 flex gap-2 justify-center">
              {isPendingReview ? (
                <>
                  <Button
                    size="sm"
                    onClick={handleConfirmUpload}
                    className="gap-1 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Confirmar e Enviar
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleReset}
                    className="gap-1 bg-slate-800/90 hover:bg-slate-700"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Gravar Novamente
                  </Button>
                </>
              ) : (
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={handleReset}
                  disabled={uploading}
                  className="h-8 w-8 bg-slate-800/90 hover:bg-slate-700"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 p-4 w-full">
            <Video className="h-12 w-12 text-slate-500" />
            <span className="text-center text-sm text-slate-400">{label}</span>
            {(() => {
              const inApp = detectInAppBrowser();
              const navAlvo = isIOS() ? 'Safari' : 'Chrome';
              const copiarLink = async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  toast.success('Link copiado! Cole no ' + navAlvo + '.');
                } catch {
                  toast.error('Não foi possível copiar. Copie manualmente.');
                }
              };

              // Só mostra o aviso bloqueante depois que a câmera realmente falhou
              if (cameraBlocked && inApp) {
                return (
                  <div className="w-full max-w-sm space-y-3">
                    <div className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-amber-900 space-y-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5 text-amber-600" />
                        <div className="space-y-1">
                          <p className="text-sm font-semibold">Câmera bloqueada — abra no {navAlvo}</p>
                          <p className="text-xs leading-relaxed">
                            O navegador do {getInAppBrowserName(inApp)} não permitiu acesso à câmera ao vivo.
                            Toque no menu (⋯) acima e escolha <strong>Abrir no {navAlvo}</strong> para ver a gravação em tempo real.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={copiarLink}
                          className="gap-2 border-amber-400 bg-white hover:bg-amber-100 text-amber-900 w-full"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copiar link
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setCameraBlocked(false); startRecording(); }}
                          className="gap-2 border-amber-400 bg-white hover:bg-amber-100 text-amber-900 w-full"
                        >
                          <Play className="h-3.5 w-3.5" />
                          Tentar câmera novamente
                        </Button>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => inputRef.current?.click()}
                      className="w-full border-slate-600 text-slate-400"
                    >
                      Gravar mesmo assim (sem preview)
                    </Button>
                  </div>
                );
              }

              return (
                <div className="flex flex-col items-center gap-2 w-full max-w-sm">
                  {inApp && (
                    <div className="w-full rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-600" />
                      <span>
                        Você está no navegador do {getInAppBrowserName(inApp)}. Se a câmera ao vivo não aparecer,
                        toque em ⋯ e escolha <strong>Abrir no {navAlvo}</strong>.
                      </span>
                    </div>
                  )}
                  <Button
                    onClick={startRecording}
                    className="gap-2 bg-red-600 hover:bg-red-700"
                  >
                    <Play className="h-4 w-4" />
                    Gravar Vídeo
                  </Button>
                  {!cameraOnly && (
                    <>
                      <span className="text-xs text-slate-500">ou</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => inputRef.current?.click()}
                        className="border-slate-600 text-slate-400"
                      >
                        Selecionar da Galeria
                      </Button>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {error && (
        <p className="text-center text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
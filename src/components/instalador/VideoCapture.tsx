import { useState, useRef, useEffect } from 'react';
import { Video, Square, Play, Loader2, CheckCircle, RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface VideoCaptureProps {
  onCapture: (file: File) => void;
  videoUrl?: string;
  uploading?: boolean;
  maxDuration?: number; // em segundos
  label?: string;
}

export function VideoCapture({
  onCapture,
  videoUrl,
  uploading = false,
  maxDuration = 120, // 2 minutos padrão
  label = 'Vídeo 360°',
}: VideoCaptureProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayUrl = videoUrl || previewUrl;
  const hasVideo = !!displayUrl;

  // Limpar recursos ao desmontar
  useEffect(() => {
    return () => {
      stopRecording();
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const startRecording = async () => {
    setError(null);
    chunksRef.current = [];
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: true,
      });
      
      streamRef.current = stream;
      
      // Mostrar preview ao vivo
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }
      
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const file = new File([blob], `video_360_${Date.now()}.webm`, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        onCapture(file);
        
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
      
    } catch (err) {
      console.error('Erro ao acessar câmera:', err);
      setError('Não foi possível acessar a câmera. Verifique as permissões.');
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
      onCapture(file);
    }
    e.target.value = '';
  };

  const handleReset = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setRecordingTime(0);
    setError(null);
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
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
                  <span className="text-lg font-semibold text-white">
                    {formatTime(recordingTime)} / {formatTime(maxDuration)}
                  </span>
                </div>
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={stopRecording}
                  className="gap-2"
                >
                  <Square className="h-5 w-5" />
                  Parar Gravação
                </Button>
              </div>
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
              <div className="rounded-full bg-green-500 p-1">
                <CheckCircle className="h-4 w-4 text-white" />
              </div>
            </div>
            <div className="absolute bottom-2 right-2 flex gap-1">
              <Button
                size="icon"
                variant="secondary"
                onClick={handleReset}
                className="h-8 w-8 bg-slate-800/90 hover:bg-slate-700"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 p-4">
            <Video className="h-12 w-12 text-slate-500" />
            <span className="text-center text-sm text-slate-400">{label}</span>
            <div className="flex flex-col items-center gap-2">
              <Button
                onClick={startRecording}
                className="gap-2 bg-red-600 hover:bg-red-700"
              >
                <Play className="h-4 w-4" />
                Gravar Vídeo
              </Button>
              <span className="text-xs text-slate-500">ou</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
                className="border-slate-600 text-slate-400"
              >
                Selecionar da Galeria
              </Button>
            </div>
            <span className="text-xs text-slate-500">
              Máximo {formatTime(maxDuration)}
            </span>
          </div>
        )}
      </div>

      {error && (
        <p className="text-center text-sm text-red-400">{error}</p>
      )}

      <p className="text-center text-xs text-slate-500">
        Inicie pelo chassi e faça uma volta completa de 360° no veículo
      </p>
    </div>
  );
}
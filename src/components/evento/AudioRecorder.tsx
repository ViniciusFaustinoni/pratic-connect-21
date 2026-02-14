import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Play, RotateCcw } from 'lucide-react';

interface AudioRecorderProps {
  onAudioReady: (file: File | null) => void;
}

export default function AudioRecorder({ onAudioReady }: AudioRecorderProps) {
  const [status, setStatus] = useState<'idle' | 'recording' | 'recorded'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      chunks.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setStatus('recorded');
        const file = new File([blob], `relato-audio-${Date.now()}.webm`, { type: 'audio/webm' });
        onAudioReady(file);
      };

      mediaRecorder.current = recorder;
      recorder.start();
      setStatus('recording');
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      alert('Não foi possível acessar o microfone. Verifique as permissões.');
    }
  }, [onAudioReady]);

  const stopRecording = useCallback(() => {
    mediaRecorder.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const reRecord = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setStatus('idle');
    setSeconds(0);
    onAudioReady(null);
  }, [audioUrl, onAudioReady]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-3">
      {status === 'idle' && (
        <Button type="button" variant="outline" onClick={startRecording} className="w-full gap-2">
          <Mic className="h-4 w-4" />
          Gravar Áudio
        </Button>
      )}

      {status === 'recording' && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
          <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-mono font-medium text-red-700">{formatTime(seconds)}</span>
          <span className="text-sm text-red-600 flex-1">Gravando...</span>
          <Button type="button" size="sm" variant="destructive" onClick={stopRecording}>
            <Square className="h-4 w-4" />
          </Button>
        </div>
      )}

      {status === 'recorded' && audioUrl && (
        <div className="space-y-2">
          <audio controls src={audioUrl} className="w-full" />
          <Button type="button" variant="outline" size="sm" onClick={reRecord} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Regravar
          </Button>
        </div>
      )}
    </div>
  );
}

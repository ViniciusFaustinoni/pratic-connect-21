import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface ChatInputProps {
  onSend: (message: string) => void;
  onSendAudio?: (audioBlob: Blob) => void;
  isLoading?: boolean;
  isTranscribing?: boolean;
  placeholder?: string;
}

export function ChatInput({ 
  onSend, 
  onSendAudio,
  isLoading, 
  isTranscribing,
  placeholder = 'Digite sua mensagem...' 
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [value]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const handleSubmit = () => {
    if (!value.trim() || isLoading) return;
    onSend(value.trim());
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Iniciar gravação
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Verificar suporte ao formato
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : 'audio/mp4';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        if (onSendAudio && audioBlob.size > 0) {
          onSendAudio(audioBlob);
        }
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch (err) {
      console.error('Erro ao acessar microfone:', err);
      toast.error('Não foi possível acessar o microfone. Verifique as permissões.');
    }
  };

  // Parar gravação
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  // Cancelar gravação
  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      chunksRef.current = [];
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isDisabled = isLoading || isTranscribing;

  return (
    <div className="flex items-end gap-2 p-4 border-t bg-background">
      {isRecording ? (
        // UI de gravação
        <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-destructive/10 rounded-lg border border-destructive/20">
          <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
          <span className="text-sm font-medium text-destructive flex-1">
            Gravando... {formatTime(recordingTime)}
          </span>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={cancelRecording}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          Cancelar
        </Button>
        </div>
      ) : (
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isTranscribing ? 'Transcrevendo áudio...' : placeholder}
          disabled={isDisabled}
          className="min-h-[44px] max-h-[120px] resize-none"
          rows={1}
        />
      )}

      {/* Botão de Microfone - aparece quando não há texto e não está gravando */}
      {!value.trim() && !isRecording && onSendAudio && (
        <Button
          onClick={startRecording}
          disabled={isDisabled}
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0"
          title="Gravar mensagem de voz"
        >
          <Mic className="h-5 w-5" />
        </Button>
      )}

      {/* Botão de Parar Gravação */}
      {isRecording ? (
        <Button 
          onClick={stopRecording} 
          size="icon" 
          className="h-11 w-11 shrink-0 bg-destructive hover:bg-destructive/90"
          title="Parar e enviar"
        >
          <Square className="h-5 w-5" />
        </Button>
      ) : (
        /* Botão de Enviar - aparece quando há texto */
        <Button
          onClick={handleSubmit}
          disabled={!value.trim() || isLoading}
          size="icon"
          className="h-11 w-11 shrink-0"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      )}
    </div>
  );
}

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Mic, Square, RotateCcw, ArrowDown, Bot, User, Loader2, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserAvatar } from '@/components/UserAvatar';
import { useWhatsAppHistorico } from '@/hooks/useWhatsAppHistorico';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { WhatsAppMensagem } from '@/types/whatsapp';

interface ChatPanelProps {
  telefone: string | null;
  nomeContato: string | null;
  avatarUrl: string | null;
}

export function ChatPanel({ telefone, nomeContato, avatarUrl }: ChatPanelProps) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Audio recording
  const [audioStatus, setAudioStatus] = useState<'idle' | 'recording' | 'recorded'>('idle');
  const [audioSeconds, setAudioSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: mensagens, isLoading, refetch } = useWhatsAppHistorico(telefone, 200);

  // Realtime subscription
  useEffect(() => {
    if (!telefone) return;
    const telefoneLimpo = telefone.replace(/\D/g, '');
    const telefoneComDDI = telefoneLimpo.startsWith('55') ? telefoneLimpo : `55${telefoneLimpo}`;

    const channel = supabase
      .channel(`chat-ia-${telefoneComDDI}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'whatsapp_mensagens',
        filter: `telefone=eq.${telefoneComDDI}`,
      }, () => {
        refetch();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [telefone, refetch]);

  // Auto scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current && mensagens?.length) {
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 50);
    }
  }, [mensagens, autoScroll]);

  const handleEnviar = async () => {
    if (!telefone || (!texto.trim() && !audioFile)) return;

    setEnviando(true);
    try {
      if (audioFile) {
        // Send audio via whatsapp-send-media
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(audioFile);
        });

        const { data, error } = await supabase.functions.invoke('whatsapp-send-media', {
          body: {
            telefone,
            media_base64: base64,
            media_type: 'audio',
            mimetype: 'audio/webm',
            filename: audioFile.name,
          },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Erro ao enviar áudio');
        toast.success('Áudio enviado!');
        resetAudio();
      } else {
        const { data, error } = await supabase.functions.invoke('whatsapp-send-text', {
          body: { telefone, mensagem: texto.trim() },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Erro ao enviar');
        setTexto('');
      }
      setTimeout(() => refetch(), 1000);
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setEnviando(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEnviar();
    }
  };

  // Audio recording functions
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      audioChunks.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
        setAudioUrl(URL.createObjectURL(blob));
        setAudioStatus('recorded');
        setAudioFile(new File([blob], `audio-${Date.now()}.webm`, { type: 'audio/webm' }));
      };
      mediaRecorder.current = recorder;
      recorder.start();
      setAudioStatus('recording');
      setAudioSeconds(0);
      timerRef.current = setInterval(() => setAudioSeconds((s) => s + 1), 1000);
    } catch {
      toast.error('Não foi possível acessar o microfone.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorder.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const resetAudio = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioFile(null);
    setAudioStatus('idle');
    setAudioSeconds(0);
  }, [audioUrl]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const formatarTelefone = (tel: string) => {
    const limpo = tel.replace(/\D/g, '');
    if (limpo.length === 13) return `+${limpo.slice(0, 2)} (${limpo.slice(2, 4)}) ${limpo.slice(4, 9)}-${limpo.slice(9)}`;
    if (limpo.length === 12) return `+${limpo.slice(0, 2)} (${limpo.slice(2, 4)}) ${limpo.slice(4, 8)}-${limpo.slice(8)}`;
    return tel;
  };

  // Empty state
  if (!telefone) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted/20">
        <MessageSquare className="h-16 w-16 mb-4 opacity-30" />
        <p className="text-lg font-medium">Chat IA Maya</p>
        <p className="text-sm mt-1">Selecione uma conversa para visualizar</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <UserAvatar src={avatarUrl} name={nomeContato} size="md" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{nomeContato || 'Contato'}</p>
          <p className="text-xs text-muted-foreground">{formatarTelefone(telefone)}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden relative">
        <ScrollArea className="h-full" ref={scrollRef}>
          <div className="space-y-2 p-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !mensagens?.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">Nenhuma mensagem</p>
              </div>
            ) : (
              mensagens.map((msg, index) => {
                const isEntrada = msg.direcao === 'entrada';
                const showDate = index === 0 ||
                  new Date(mensagens[index - 1].created_at).toDateString() !==
                  new Date(msg.created_at).toDateString();

                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div className="flex justify-center my-3">
                        <Badge variant="secondary" className="text-xs font-normal">
                          {format(new Date(msg.created_at), "dd 'de' MMMM", { locale: ptBR })}
                        </Badge>
                      </div>
                    )}
                    <div className={cn('flex', isEntrada ? 'justify-start' : 'justify-end')}>
                      <div
                        className={cn(
                          'max-w-[75%] p-3 rounded-lg shadow-sm',
                          isEntrada
                            ? 'bg-muted rounded-tl-none'
                            : 'bg-green-100 dark:bg-green-900/30 rounded-tr-none'
                        )}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          {isEntrada ? (
                            <>
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="text-[11px] font-medium text-muted-foreground">
                                {msg.nome_contato || 'Cliente'}
                              </span>
                            </>
                          ) : (
                            <>
                              <Bot className="h-3 w-3 text-green-600" />
                              <span className="text-[11px] font-medium text-green-600">Maya IA</span>
                            </>
                          )}
                        </div>

                        {/* Audio */}
                        {msg.tipo === 'audio' && msg.media_url ? (
                          <audio controls src={msg.media_url} className="w-full max-w-[250px]" />
                        ) : msg.tipo === 'image' && msg.media_url ? (
                          <img src={msg.media_url} alt="Imagem" className="max-w-[250px] rounded" />
                        ) : !isEntrada && msg.mensagem ? (
                          <div className="prose prose-sm max-w-none dark:prose-invert text-sm">
                            <ReactMarkdown>{msg.mensagem}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.mensagem}</p>
                        )}

                        <div className="flex items-center justify-end gap-1 mt-1">
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(msg.created_at), 'HH:mm')}
                          </span>
                          {!isEntrada && (
                            <span className={cn('text-[10px]', msg.status === 'lida' ? 'text-blue-500' : 'text-muted-foreground')}>
                              {msg.status === 'lida' || msg.status === 'entregue' ? '✓✓' : msg.status === 'enviada' ? '✓' : msg.status === 'erro' ? '✗' : '⏳'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {!autoScroll && (
          <Button
            size="icon"
            variant="secondary"
            className="absolute bottom-2 right-4 rounded-full shadow-lg h-8 w-8"
            onClick={() => {
              setAutoScroll(true);
              if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border p-3 bg-card">
        {audioStatus === 'recording' ? (
          <div className="flex items-center gap-3 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
            <span className="text-sm font-mono font-medium text-destructive">{formatTime(audioSeconds)}</span>
            <span className="text-sm text-destructive flex-1">Gravando...</span>
            <Button type="button" size="sm" variant="destructive" onClick={stopRecording}>
              <Square className="h-4 w-4" />
            </Button>
          </div>
        ) : audioStatus === 'recorded' && audioUrl ? (
          <div className="flex items-center gap-2">
            <audio controls src={audioUrl} className="flex-1 h-10" />
            <Button type="button" variant="ghost" size="sm" onClick={resetAudio}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={handleEnviar} disabled={enviando}>
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 h-9 w-9"
              onClick={startRecording}
            >
              <Mic className="h-4 w-4" />
            </Button>
            <Textarea
              ref={textareaRef}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite uma mensagem..."
              className="min-h-[36px] max-h-[120px] resize-none text-sm py-2"
              rows={1}
            />
            <Button
              size="icon"
              className="shrink-0 h-9 w-9"
              onClick={handleEnviar}
              disabled={enviando || !texto.trim()}
            >
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

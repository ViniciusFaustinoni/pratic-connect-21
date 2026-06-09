import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { Send, Mic, Square, RotateCcw, ArrowDown, ArrowLeft, Bot, User, Loader2, MessageSquare, Paperclip, BotOff, Smile } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
const EmojiPicker = lazy(() => import('emoji-picker-react'));
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
import { useIaPausa } from '@/hooks/useIaPausa';
import { useConcluirTransbordo } from '@/hooks/useTransbordosAtivos';
import { ContatoDetalheDrawer } from './ContatoDetalheDrawer';
import { ContatoDetalheEventosDrawer } from './ContatoDetalheEventosDrawer';
import { useMarkMessagesRead } from '@/hooks/useMarkMessagesRead';


interface ChatPanelProps {
  telefone: string | null;
  nomeContato: string | null;
  avatarUrl: string | null;
  drawerVariant?: 'relacionamento' | 'eventos' | 'monitoramento';
  onBack?: () => void;
}

export function ChatPanel({ telefone, nomeContato, avatarUrl, drawerVariant = 'relacionamento', onBack }: ChatPanelProps) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<WhatsAppMensagem[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio recording
  const [audioStatus, setAudioStatus] = useState<'idle' | 'recording' | 'recorded'>('idle');
  const [audioSeconds, setAudioSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: mensagens, isLoading, refetch } = useWhatsAppHistorico(telefone, 200);
  const { pausa, ativa: iaPausada, pausarPorIntervencao } = useIaPausa(telefone);
  const concluirTransbordo = useConcluirTransbordo();
  const { enqueue: marcarMsgLidaProvedor } = useMarkMessagesRead(telefone);

  // IntersectionObserver para markAsRead: quando bolha de entrada entra
  // na viewport (>=60%), enfileira o message_id para o edge `whatsapp-mark-read`.
  const observerRef = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const vp = getViewport();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          const id = el.dataset.whatsMsgId;
          if (!id) continue;
          marcarMsgLidaProvedor(id);
          observerRef.current?.unobserve(el);
        }
      },
      { root: vp ?? null, threshold: 0.6 },
    );
    return () => { observerRef.current?.disconnect(); observerRef.current = null; };
  }, [telefone, marcarMsgLidaProvedor]);

  const bubbleRef = useCallback((el: HTMLDivElement | null) => {
    if (!el || !observerRef.current) return;
    observerRef.current.observe(el);
  }, []);

  

  // Limpa pendentes que já apareceram no histórico (por message_id, ou heurística texto+janela)
  useEffect(() => {
    if (!pendingMessages.length || !mensagens?.length) return;
    setPendingMessages((prev) =>
      prev.filter((p) => {
        return !mensagens.some((m) =>
          m.direcao === 'saida' &&
          m.mensagem === p.mensagem &&
          Math.abs(new Date(m.created_at).getTime() - new Date(p.created_at).getTime()) < 60_000
        );
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensagens]);

  // Reseta pendentes + força auto-scroll ao trocar de contato
  useEffect(() => {
    setPendingMessages([]);
    setAutoScroll(true);
  }, [telefone]);

  // Resolve o viewport interno do Radix ScrollArea (quem realmente rola).
  const getViewport = (): HTMLElement | null => {
    const root = scrollRef.current;
    if (!root) return null;
    return root.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    const vp = getViewport();
    if (!vp) return;
    vp.scrollTo({ top: vp.scrollHeight, behavior });
  };

  // Realtime subscription (INSERT + UPDATE de status) com auto-recover
  // — se o socket cair (CHANNEL_ERROR/TIMED_OUT) refazemos a subscrição
  // em vez de ficar mudo até o usuário recarregar a página.
  useEffect(() => {
    if (!telefone) return;
    const telefoneLimpo = telefone.replace(/\D/g, '');
    const telefoneComDDI = telefoneLimpo.startsWith('55') ? telefoneLimpo : `55${telefoneLimpo}`;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      channel = supabase
        .channel(`chat-ia-${telefoneComDDI}-${Date.now()}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'whatsapp_mensagens',
          filter: `telefone=eq.${telefoneComDDI}`,
        }, () => {
          refetch();
        })
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            if (channel) { supabase.removeChannel(channel); channel = null; }
            if (!cancelled) {
              retryTimer = setTimeout(connect, 2000);
              // Garante que mesmo sem realtime as mensagens novas apareçam.
              refetch();
            }
          }
        });
    };
    connect();

    // Polling curto de segurança enquanto a conversa está aberta — cobre
    // qualquer janela em que o socket esteja reconectando.
    const pollTimer = setInterval(() => { refetch(); }, 5000);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      clearInterval(pollTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [telefone, refetch]);

  // Detecta se o usuário está "colado no fim" para respeitar a intenção dele.
  useEffect(() => {
    const vp = getViewport();
    if (!vp) return;
    const onScroll = () => {
      const distFromBottom = vp.scrollHeight - vp.scrollTop - vp.clientHeight;
      setAutoScroll(distFromBottom < 80);
    };
    vp.addEventListener('scroll', onScroll, { passive: true });
    return () => vp.removeEventListener('scroll', onScroll);
  }, [telefone, isLoading]);

  // Rolagem inicial no fim: dispara assim que a primeira leva chega (e em troca de contato).
  useEffect(() => {
    if (isLoading) return;
    if (!mensagens?.length) return;
    // múltiplos ticks para esperar markdown/imagens/áudios medirem altura
    requestAnimationFrame(() => {
      scrollToBottom('auto');
      setTimeout(() => scrollToBottom('auto'), 80);
      setTimeout(() => scrollToBottom('auto'), 250);
      setTimeout(() => scrollToBottom('auto'), 600);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telefone, isLoading, mensagens?.length]);


  // Auto scroll a cada nova mensagem (respeitando a intenção do usuário)
  useEffect(() => {
    if (!autoScroll) return;
    if (!mensagens?.length && !pendingMessages.length) return;
    requestAnimationFrame(() => scrollToBottom('smooth'));
  }, [mensagens, pendingMessages, autoScroll]);

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
        const conteudo = texto.trim();
        const telefoneLimpoOp = telefone.replace(/\D/g, '');
        const telefoneNorm = telefoneLimpoOp.startsWith('55') ? telefoneLimpoOp : `55${telefoneLimpoOp}`;
        const tempId = `pending-${Date.now()}`;
        const optimistic: WhatsAppMensagem = {
          id: tempId,
          telefone: telefoneNorm,
          direcao: 'saida',
          status: 'enviando',
          tipo: 'text',
          mensagem: conteudo,
          created_at: new Date().toISOString(),
        } as WhatsAppMensagem;
        setPendingMessages((prev) => [...prev, optimistic]);
        setTexto('');

        try {
          const { data, error } = await supabase.functions.invoke('whatsapp-send-text', {
            // allow_text=true: atendimento humano manual dentro da janela 24h vai como
            // texto livre — sem isso, Meta API cai no auto-fallback de template e a
            // mensagem real do atendente nunca chega ao associado.
            body: { telefone, mensagem: conteudo, allow_text: true },
          });
          if (error) throw error;
          if (!data?.success) throw new Error(data?.error || 'Erro ao enviar');

          // Edge expõe persisted=false quando o INSERT em whatsapp_mensagens falhou.
          // Nesse caso mantemos a bolha como 'enviada' (chegou ao associado), mas
          // logamos pra investigação — não some do chat.
          if (data?.persisted === false) {
            console.warn('[ChatPanel] mensagem enviada à Meta mas NÃO persistida no DB');
          }
          setPendingMessages((prev) =>
            prev.map((p) => (p.id === tempId ? { ...p, status: 'enviada' } : p))
          );
        } catch (sendErr: any) {
          setPendingMessages((prev) =>
            prev.map((p) =>
              p.id === tempId ? { ...p, status: 'erro', erro_mensagem: sendErr?.message } : p
            ) as WhatsAppMensagem[]
          );
          throw sendErr;
        }
      }
      // Pausa IA por 10 minutos após intervenção humana
      try { await pausarPorIntervencao(); } catch (e) { console.warn('falha ao pausar IA', e); }
      setTimeout(() => refetch(), 1000);
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setEnviando(false);
    }
  };

  const handleUploadFile = async (file: File) => {
    if (!telefone || !file) return;
    setEnviando(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });
      const mt = file.type || 'application/octet-stream';
      const media_type =
        mt.startsWith('image/') ? 'image' :
        mt.startsWith('video/') ? 'video' :
        mt.startsWith('audio/') ? 'audio' : 'document';

      const { data, error } = await supabase.functions.invoke('whatsapp-send-media', {
        body: {
          telefone,
          media_base64: base64,
          media_type,
          mimetype: mt,
          filename: file.name,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao enviar arquivo');
      toast.success('Arquivo enviado!');
      try { await pausarPorIntervencao(); } catch {}
      setTimeout(() => refetch(), 1000);
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setEnviando(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
        <p className="text-lg font-medium">Chat IA</p>
        <p className="text-sm mt-1">Selecione uma conversa para visualizar</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <button
          type="button"
          onClick={() => setDrawerAberto(true)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
          title="Ver detalhes do contato"
        >
          <UserAvatar src={avatarUrl} name={nomeContato} size="md" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{nomeContato || 'Contato'}</p>
            <p className="text-xs text-muted-foreground">{formatarTelefone(telefone)}</p>
          </div>
        </button>
        {iaPausada && pausa && (
          <Badge variant="outline" className="gap-1 text-amber-600 border-amber-500/50 bg-amber-50 dark:bg-amber-950/30">
            <BotOff className="h-3 w-3" />
            IA pausada até {format(new Date(pausa.pausada_ate), 'HH:mm')}
          </Badge>
        )}
        {iaPausada && pausa && (
          <Button
            size="sm"
            variant="default"
            disabled={concluirTransbordo.isPending}
            onClick={async () => {
              if (!telefone) return;
              try {
                await concluirTransbordo.mutateAsync(telefone);
                toast.success('Atendimento concluído. IA reativada.');
              } catch (e: any) {
                toast.error(e?.message ?? 'Falha ao concluir atendimento');
              }
            }}
          >
            {concluirTransbordo.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Concluir atendimento'}
          </Button>
        )}
      </div>


      {/* Messages */}
      <div className="flex-1 min-w-0 overflow-hidden relative">
        <ScrollArea className="h-full w-full" ref={scrollRef}>
          <div className="space-y-2 p-4 min-w-0 max-w-full">

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !mensagens?.length && !pendingMessages.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">Nenhuma mensagem</p>
              </div>
            ) : (
              ([...(mensagens ?? []), ...pendingMessages] as WhatsAppMensagem[]).map((msg, index, arr) => {
                const isEntrada = msg.direcao === 'entrada';
                const showDate = index === 0 ||
                  new Date(arr[index - 1].created_at).toDateString() !==
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
                    <div className={cn('flex min-w-0', isEntrada ? 'justify-start' : 'justify-end')}>
                      <div
                        ref={isEntrada && msg.message_id && !(msg as any).lida_pelo_operador_em ? bubbleRef : undefined}
                        data-whats-msg-id={isEntrada ? msg.message_id ?? undefined : undefined}
                        className={cn(
                          'max-w-[75%] min-w-0 p-3 rounded-lg shadow-sm break-words [overflow-wrap:anywhere]',
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
                              <span className="text-[11px] font-medium text-green-600">IA</span>
                            </>
                          )}
                        </div>

                        {/* Audio */}
                        {msg.tipo === 'audio' && msg.media_url ? (
                          <div
                            className={cn(
                              'flex items-center gap-2 rounded-lg px-2 py-2 min-w-[240px]',
                              isEntrada
                                ? 'bg-background/60 border border-border'
                                : 'bg-white/60 dark:bg-black/20 border border-green-200 dark:border-green-800'
                            )}
                          >
                            <div
                              className={cn(
                                'h-8 w-8 rounded-full flex items-center justify-center shrink-0',
                                isEntrada ? 'bg-primary/10 text-primary' : 'bg-green-600/15 text-green-700 dark:text-green-400'
                              )}
                            >
                              <Mic className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-[11px] font-medium text-muted-foreground">
                                  Mensagem de voz
                                </span>
                                <a
                                  href={msg.media_url}
                                  download
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-primary hover:underline"
                                  title="Baixar áudio"
                                >
                                  baixar
                                </a>
                              </div>
                              <audio controls src={msg.media_url} className="w-full h-8" preload="metadata" />
                            </div>
                          </div>
                        ) : msg.tipo === 'image' && msg.media_url ? (
                          <img src={msg.media_url} alt="Imagem" className="max-w-[250px] rounded" />
                        ) : !isEntrada && msg.mensagem ? (
                          <div className="prose prose-sm max-w-none dark:prose-invert text-sm break-words [overflow-wrap:anywhere] [&_p]:break-words [&_a]:break-all">
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
              scrollToBottom('smooth');
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
            <input
              ref={fileInputRef}
              type="file"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUploadFile(f);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 h-9 w-9"
              onClick={() => fileInputRef.current?.click()}
              disabled={enviando}
              title="Anexar arquivo"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 h-9 w-9"
              onClick={startRecording}
            >
              <Mic className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-9 w-9"
                  disabled={enviando}
                  title="Inserir emoji"
                >
                  <Smile className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="p-0 w-auto border-none bg-transparent shadow-none">
                <Suspense fallback={<div className="p-4 text-xs text-muted-foreground">Carregando…</div>}>
                  <EmojiPicker
                    theme={'dark' as any}
                    width={320}
                    height={400}
                    searchPlaceholder="Buscar emoji"
                    previewConfig={{ showPreview: false }}
                    onEmojiClick={(emojiData) => {
                      const ta = textareaRef.current;
                      const emoji = emojiData.emoji;
                      if (!ta) {
                        setTexto((t) => t + emoji);
                        return;
                      }
                      const start = ta.selectionStart ?? texto.length;
                      const end = ta.selectionEnd ?? texto.length;
                      const novo = texto.slice(0, start) + emoji + texto.slice(end);
                      setTexto(novo);
                      requestAnimationFrame(() => {
                        ta.focus();
                        const pos = start + emoji.length;
                        ta.setSelectionRange(pos, pos);
                      });
                    }}
                  />
                </Suspense>
              </PopoverContent>
            </Popover>
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

      {/* Drawer detalhes do contato */}
      {drawerVariant === 'eventos' ? (
        <ContatoDetalheEventosDrawer
          telefone={telefone}
          open={drawerAberto}
          onOpenChange={setDrawerAberto}
          nomeContato={nomeContato}
          avatarUrl={avatarUrl}
        />
      ) : (
        <ContatoDetalheDrawer
          telefone={telefone}
          open={drawerAberto}
          onOpenChange={setDrawerAberto}
          nomeContato={nomeContato}
          avatarUrl={avatarUrl}
        />
      )}
    </div>
  );
}

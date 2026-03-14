import { useState, useEffect, useRef } from 'react';
import { Send, FlaskConical, AlertTriangle, Phone, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ChatMessage {
  id: string;
  texto: string;
  direcao: 'saida' | 'entrada';
  timestamp: string;
  status?: string;
}

export function WhatsAppTestChat() {
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensagens, setMensagens] = useState<ChatMessage[]>([]);
  const [telefoneDestino, setTelefoneDestino] = useState('');
  const [telefoneEditavel, setTelefoneEditavel] = useState('');
  const [carregandoConfig, setCarregandoConfig] = useState(true);
  const [metaAtiva, setMetaAtiva] = useState(false);
  const [senderNumber, setSenderNumber] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Buscar config da Meta e número real do WhatsApp da IA
  useEffect(() => {
    async function carregarConfig() {
      try {
        const { data, error } = await supabase
          .from('whatsapp_meta_config')
          .select('phone_number_id, ativo')
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setMetaAtiva(!!data.ativo);
        }
        // Número real da IA no WhatsApp (fixo)
        setTelefoneDestino('5521969379982');
        setTelefoneEditavel('5521969379982');

        // Buscar número conectado na Evolution (sender/associado de teste)
        try {
          const { data: senderData } = await supabase.functions.invoke('whatsapp-get-sender', {
            body: {},
          });
          if (senderData?.sender) {
            setSenderNumber(senderData.sender);
            console.log('[TestChat] Sender Evolution:', senderData.sender);
          }
        } catch (senderErr) {
          console.warn('[TestChat] Não foi possível obter sender:', senderErr);
        }
      } catch (err) {
        console.error('[TestChat] Erro ao carregar config Meta:', err);
        setTelefoneDestino('5521969379982');
        setTelefoneEditavel('5521969379982');
      } finally {
        setCarregandoConfig(false);
      }
    }
    carregarConfig();
  }, []);

  // Polling de mensagens
  useEffect(() => {
    const telefone = telefoneDestino.replace(/\D/g, '');
    if (!telefone) return;

    const buscarMensagens = async () => {
      const telefoneLimpo = telefone;
      const telefoneComDDI = telefoneLimpo.startsWith('55') ? telefoneLimpo : `55${telefoneLimpo}`;

      // Buscar mensagens do número destino E do sender (Evolution)
      // A IA responde ao sender, não ao destino
      let orFilter = `telefone.eq.${telefoneComDDI},telefone.eq.${telefoneLimpo}`;
      if (senderNumber) {
        const senderComDDI = senderNumber.startsWith('55') ? senderNumber : `55${senderNumber}`;
        orFilter += `,telefone.eq.${senderNumber},telefone.eq.${senderComDDI}`;
      }

      const { data, error } = await supabase
        .from('whatsapp_mensagens')
        .select('id, mensagem, direcao, status, created_at, telefone')
        .or(orFilter)
        .order('created_at', { ascending: true })
        .limit(200);

      if (!error && data) {
        setMensagens(data.map(m => ({
          id: m.id,
          texto: m.mensagem || '',
          direcao: m.direcao as 'saida' | 'entrada',
          timestamp: m.created_at,
          status: m.status,
        })));
      }
    };

    buscarMensagens();
    pollingRef.current = setInterval(buscarMensagens, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [telefoneDestino, senderNumber]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens]);

  const enviarMensagem = async () => {
    const texto = mensagem.trim();
    if (!texto || !telefoneDestino) return;

    setEnviando(true);
    try {
      // Adicionar mensagem localmente de imediato
      const msgLocal: ChatMessage = {
        id: `local-${Date.now()}`,
        texto,
        direcao: 'saida',
        timestamp: new Date().toISOString(),
        status: 'enviando',
      };
      setMensagens(prev => [...prev, msgLocal]);
      setMensagem('');

      // Enviar mensagem REAL via Evolution API (forçando Evolution mesmo com Meta ativa)
      const { data, error } = await supabase.functions.invoke('whatsapp-send-text', {
        body: {
          telefone: telefoneDestino,
          mensagem: texto,
          force_provider: 'evolution',
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao enviar');

      // Atualizar status local
      setMensagens(prev => prev.map(m =>
        m.id === msgLocal.id ? { ...m, status: 'enviada' } : m
      ));

      // Usar o número do sender (Evolution) já carregado para simular entrada do associado
      // O webhook da Meta não dispara para mensagens da Evolution, então invocamos diretamente

      if (senderNumber) {
        console.log(`[TestChat] Simulando entrada da IA com sender: ${senderNumber}`);
        
        // Fire-and-forget: invocar webhook simulando mensagem de entrada do associado
        supabase.functions.invoke('whatsapp-webhook', {
          body: {
            event: 'messages.upsert',
            sender: `${senderNumber}@s.whatsapp.net`,
            _meta_delegate: true,
            data: {
              key: {
                remoteJid: `${senderNumber}@s.whatsapp.net`,
                fromMe: false,
                id: `test_${Date.now()}`,
              },
              message: { conversation: texto },
            },
          },
        }).then((res) => {
          console.log('[TestChat] Delegação IA resultado:', res.data);
        }).catch((err) => {
          console.error('[TestChat] Erro na delegação IA:', err);
        });

        toast.success('Mensagem enviada! IA processando...');
      } else {
        toast.success('Mensagem enviada via Evolution! Aguarde resposta da IA...');
      }
    } catch (err: any) {
      toast.error(`Erro ao enviar: ${err.message}`);
      setMensagens(prev => prev.map(m =>
        m.id.startsWith('local-') && m.status === 'enviando'
          ? { ...m, status: 'erro' }
          : m
      ));
    } finally {
      setEnviando(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensagem();
    }
  };

  const salvarNumero = () => {
    const limpo = telefoneEditavel.replace(/\D/g, '');
    if (limpo.length < 10) {
      toast.error('Número inválido');
      return;
    }
    setTelefoneDestino(telefoneEditavel);
    toast.success('Número de destino atualizado');
  };

  if (carregandoConfig) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Aviso */}
      <Alert className="border-green-500/30 bg-green-500/5">
        <FlaskConical className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-sm">
          <strong>Modo Teste Real</strong> — Envia mensagens reais via Evolution API para o número da Meta.
          O fluxo completo é executado: Mensagem WhatsApp → Webhook Meta → IA (Maya) → Resposta.
        </AlertDescription>
      </Alert>

      {/* Config do número destino */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Número da IA (destino real)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={telefoneEditavel}
              onChange={(e) => setTelefoneEditavel(e.target.value)}
              placeholder="5521969379982"
              className="font-mono"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={salvarNumero}
              disabled={telefoneEditavel === telefoneDestino}
            >
              Aplicar
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={metaAtiva ? 'default' : 'secondary'} className="text-xs">
              Meta {metaAtiva ? 'Ativa' : 'Inativa'}
            </Badge>
            {telefoneDestino && (
              <span className="text-xs text-muted-foreground font-mono">
                Evolution → {telefoneDestino}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Chat */}
      <Card className="flex flex-col" style={{ height: '500px' }}>
        <CardHeader className="pb-2 border-b shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Chat de Teste</CardTitle>
            <Badge variant="outline" className="text-xs">
              {mensagens.length} mensagens
            </Badge>
          </div>
        </CardHeader>

        {!telefoneDestino ? (
          <CardContent className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
              <p className="text-sm">Configure o número de destino acima para iniciar o teste.</p>
            </div>
          </CardContent>
        ) : (
          <>
            {/* Mensagens */}
            <ScrollArea className="flex-1 px-4">
              <div ref={scrollRef} className="py-4 space-y-3">
                {mensagens.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-8">
                    Nenhuma mensagem ainda. Envie uma mensagem para iniciar o teste.
                  </p>
                )}
                {mensagens.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex',
                      msg.direcao === 'saida' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[75%] rounded-2xl px-4 py-2 text-sm',
                        msg.direcao === 'saida'
                          ? 'bg-green-600 text-white rounded-br-sm'
                          : 'bg-muted text-foreground rounded-bl-sm'
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.texto}</p>
                      <div className={cn(
                        'flex items-center gap-1 mt-1 text-[10px]',
                        msg.direcao === 'saida' ? 'text-green-200 justify-end' : 'text-muted-foreground'
                      )}>
                        <span>
                          {format(new Date(msg.timestamp), 'HH:mm', { locale: ptBR })}
                        </span>
                        {msg.direcao === 'saida' && msg.status && (
                          <span className="opacity-75">
                            {msg.status === 'enviando' ? '⏳' : msg.status === 'erro' ? '❌' : '✓'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-3 border-t shrink-0">
              <div className="flex gap-2">
                <Input
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Digite uma mensagem de teste..."
                  disabled={enviando}
                  className="flex-1"
                />
                <Button
                  onClick={enviarMensagem}
                  disabled={enviando || !mensagem.trim()}
                  size="icon"
                  className="shrink-0 bg-green-600 hover:bg-green-700"
                >
                  {enviando ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

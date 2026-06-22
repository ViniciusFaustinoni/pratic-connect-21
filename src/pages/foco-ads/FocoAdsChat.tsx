import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Send, Sparkles, Loader2, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useChatCopiloto, type ChatMsg } from '@/hooks/useFocoAds';

const SUGESTOES = [
  'Como está o custo por lead nos últimos 7 dias?',
  'Quais anúncios estão acima do limite de custo?',
  'Me dá um resumo das campanhas de hoje (ao vivo).',
  'Qual anúncio você sugere pausar e por quê?',
];

export default function FocoAdsChat() {
  const navigate = useNavigate();
  const [mensagens, setMensagens] = useState<ChatMsg[]>([]);
  const [texto, setTexto] = useState('');
  const chat = useChatCopiloto();
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [mensagens, chat.isPending]);

  const enviar = async (pergunta: string) => {
    const q = pergunta.trim();
    if (!q || chat.isPending) return;
    const novo: ChatMsg[] = [...mensagens, { role: 'user', content: q }];
    setMensagens(novo);
    setTexto('');
    try {
      const resposta = await chat.mutateAsync(novo);
      setMensagens([...novo, { role: 'assistant', content: resposta }]);
    } catch (e: any) {
      setMensagens([...novo, { role: 'assistant', content: `⚠️ ${e?.message ?? 'Erro ao consultar o copiloto.'}` }]);
    }
  };

  return (
    <div className="flex h-[calc(100vh-2rem)] flex-col p-4 md:p-6">
      <div className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/foco-ads')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Sparkles className="h-5 w-5 text-primary" /> Copiloto Foco Ads
          </h1>
          <p className="text-sm text-muted-foreground">
            Pergunte sobre campanhas, peça análises e sugestões. Ancorado nos dados reais (Claude Opus).
          </p>
        </div>
        <Badge variant="outline" className="hidden gap-1 md:flex">
          <ShieldCheck className="h-3 w-3" /> Sugere — não executa
        </Badge>
      </div>

      <Card className="flex flex-1 flex-col overflow-hidden">
        <CardContent className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          {mensagens.length === 0 ? (
            <div className="m-auto max-w-md space-y-4 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Converse com o copiloto sobre seu tráfego pago. Ele lê suas métricas, achados e dados ao vivo da Meta — e pode <strong>propor</strong> ações (que você aprova depois).
              </p>
              <div className="grid gap-2">
                {SUGESTOES.map((s) => (
                  <Button key={s} variant="outline" size="sm" className="h-auto justify-start whitespace-normal py-2 text-left" onClick={() => enviar(s)}>
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            mensagens.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[85%] whitespace-pre-wrap rounded-lg px-4 py-2 text-sm',
                  m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted',
                )}>
                  {m.content}
                </div>
              </div>
            ))
          )}
          {chat.isPending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Analisando…
              </div>
            </div>
          )}
          <div ref={fimRef} />
        </CardContent>

        <div className="border-t p-3">
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => { e.preventDefault(); enviar(texto); }}
          >
            <Input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Pergunte sobre suas campanhas…"
              disabled={chat.isPending}
            />
            <Button type="submit" size="icon" disabled={chat.isPending || !texto.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}

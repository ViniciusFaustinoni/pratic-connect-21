import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Search, RefreshCw, User, Bot, ChevronRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { HistoricoConversaWhatsApp } from '@/components/whatsapp/HistoricoConversaWhatsApp';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface ConversaAgrupada {
  telefone: string;
  nome_contato: string | null;
  total_mensagens: number;
  ultima_mensagem: string;
  ultima_msg_texto: string | null;
  ultima_direcao: string;
}

export function WhatsAppConversasPainel() {
  const [busca, setBusca] = useState('');
  const [telefoneSelecionado, setTelefoneSelecionado] = useState<string | null>(null);
  const [nomeSelecionado, setNomeSelecionado] = useState<string>('');

  const { data: mensagens, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['whatsapp-conversas-painel'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_mensagens')
        .select('telefone, nome_contato, mensagem, created_at, direcao')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;
      return data;
    },
    staleTime: 60000,
  });

  const conversas = useMemo<ConversaAgrupada[]>(() => {
    if (!mensagens?.length) return [];

    const mapa = new Map<string, ConversaAgrupada>();

    for (const msg of mensagens) {
      const tel = msg.telefone;
      if (!mapa.has(tel)) {
        mapa.set(tel, {
          telefone: tel,
          nome_contato: msg.nome_contato,
          total_mensagens: 1,
          ultima_mensagem: msg.created_at,
          ultima_msg_texto: msg.mensagem,
          ultima_direcao: msg.direcao,
        });
      } else {
        const c = mapa.get(tel)!;
        c.total_mensagens++;
        if (!c.nome_contato && msg.nome_contato) {
          c.nome_contato = msg.nome_contato;
        }
      }
    }

    return Array.from(mapa.values()).sort(
      (a, b) => new Date(b.ultima_mensagem).getTime() - new Date(a.ultima_mensagem).getTime()
    );
  }, [mensagens]);

  const conversasFiltradas = useMemo(() => {
    if (!busca.trim()) return conversas;
    const termo = busca.toLowerCase();
    return conversas.filter(
      (c) =>
        c.telefone.includes(termo) ||
        c.nome_contato?.toLowerCase().includes(termo)
    );
  }, [conversas, busca]);

  const formatarData = (dataStr: string) => {
    const data = new Date(dataStr);
    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);

    if (data.toDateString() === hoje.toDateString()) {
      return format(data, 'HH:mm');
    }
    if (data.toDateString() === ontem.toDateString()) {
      return 'Ontem';
    }
    return format(data, 'dd/MM/yy', { locale: ptBR });
  };

  const formatarTelefone = (tel: string) => {
    const limpo = tel.replace(/\D/g, '');
    if (limpo.length === 13) {
      return `+${limpo.slice(0, 2)} (${limpo.slice(2, 4)}) ${limpo.slice(4, 9)}-${limpo.slice(9)}`;
    }
    if (limpo.length === 12) {
      return `+${limpo.slice(0, 2)} (${limpo.slice(2, 4)}) ${limpo.slice(4, 8)}-${limpo.slice(8)}`;
    }
    return tel;
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Conversas da IA
              {conversas.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {conversas.length}
                </Badge>
              )}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
            </Button>
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : conversasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">
                {busca ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa ainda'}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="divide-y divide-border">
                {conversasFiltradas.map((conversa) => (
                  <button
                    key={conversa.telefone}
                    onClick={() => {
                      setTelefoneSelecionado(conversa.telefone);
                      setNomeSelecionado(conversa.nome_contato || formatarTelefone(conversa.telefone));
                    }}
                    className="w-full flex items-center gap-3 px-2 py-3 text-left hover:bg-muted/50 transition-colors rounded-md group"
                  >
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">
                          {conversa.nome_contato || formatarTelefone(conversa.telefone)}
                        </span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatarData(conversa.ultima_mensagem)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          {conversa.ultima_direcao === 'entrada' ? (
                            <User className="h-3 w-3 flex-shrink-0" />
                          ) : (
                            <Bot className="h-3 w-3 flex-shrink-0" />
                          )}
                          {conversa.ultima_msg_texto
                            ? conversa.ultima_msg_texto.slice(0, 60) + (conversa.ultima_msg_texto.length > 60 ? '...' : '')
                            : 'Mídia'}
                        </p>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {conversa.total_mensagens}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                      {conversa.nome_contato && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatarTelefone(conversa.telefone)}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Dialog com histórico completo */}
      <Dialog
        open={!!telefoneSelecionado}
        onOpenChange={(open) => {
          if (!open) setTelefoneSelecionado(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {nomeSelecionado}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <HistoricoConversaWhatsApp
              telefone={telefoneSelecionado}
              mostrarHeader={false}
              altura="h-[55vh]"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

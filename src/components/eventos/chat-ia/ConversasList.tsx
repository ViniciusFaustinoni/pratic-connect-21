import { useState, useMemo } from 'react';
import { Search, User, Bot, Loader2, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserAvatar } from '@/components/UserAvatar';
import { cn } from '@/lib/utils';

export interface ConversaAgrupada {
  telefone: string;
  nome_contato: string | null;
  avatar_url: string | null;
  total_mensagens: number;
  ultima_mensagem: string;
  ultima_msg_texto: string | null;
  ultima_direcao: string;
}

interface ConversasListProps {
  conversas: ConversaAgrupada[];
  isLoading: boolean;
  telefoneSelecionado: string | null;
  onSelectConversa: (conversa: ConversaAgrupada) => void;
}

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

export function ConversasList({ conversas, isLoading, telefoneSelecionado, onSelectConversa }: ConversasListProps) {
  const [busca, setBusca] = useState('');

  const conversasFiltradas = useMemo(() => {
    if (!busca.trim()) return conversas;
    const termo = busca.toLowerCase();
    return conversas.filter(
      (c) =>
        c.telefone.includes(termo) ||
        c.nome_contato?.toLowerCase().includes(termo)
    );
  }, [conversas, busca]);

  return (
    <div className="flex flex-col h-full border-r border-border">
      {/* Header */}
      <div className="p-3 border-b border-border space-y-2">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          Conversas IA
          {conversas.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">{conversas.length}</Badge>
          )}
        </h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar nome ou telefone..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : conversasFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MessageSquare className="h-6 w-6 mb-2 opacity-50" />
            <p className="text-xs">{busca ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa'}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {conversasFiltradas.map((conversa) => (
              <button
                key={conversa.telefone}
                onClick={() => onSelectConversa(conversa)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-muted/50 transition-colors',
                  telefoneSelecionado === conversa.telefone && 'bg-muted'
                )}
              >
                <UserAvatar
                  src={conversa.avatar_url}
                  name={conversa.nome_contato}
                  size="md"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">
                      {conversa.nome_contato || formatarTelefone(conversa.telefone)}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {formatarData(conversa.ultima_mensagem)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {conversa.ultima_direcao === 'entrada' ? (
                      <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <Bot className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    )}
                    <p className="text-xs text-muted-foreground truncate">
                      {conversa.ultima_msg_texto
                        ? conversa.ultima_msg_texto.slice(0, 50) + (conversa.ultima_msg_texto.length > 50 ? '...' : '')
                        : '📎 Mídia'}
                    </p>
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
        )}
      </ScrollArea>
    </div>
  );
}

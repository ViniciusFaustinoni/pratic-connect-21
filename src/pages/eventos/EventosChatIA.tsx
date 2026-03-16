import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ConversasList, type ConversaAgrupada } from '@/components/eventos/chat-ia/ConversasList';
import { ChatPanel } from '@/components/eventos/chat-ia/ChatPanel';

export default function EventosChatIA() {
  const [telefoneSelecionado, setTelefoneSelecionado] = useState<string | null>(null);
  const [nomeContato, setNomeContato] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Fetch all messages grouped by phone
  const { data: mensagens, isLoading } = useQuery({
    queryKey: ['chat-ia-conversas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_mensagens')
        .select('telefone, nome_contato, mensagem, created_at, direcao')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data;
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  // Fetch associados for avatar matching
  const { data: associados } = useQuery({
    queryKey: ['chat-ia-associados-avatar'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('associados')
        .select('nome, telefone, whatsapp, avatar_url')
        .not('telefone', 'is', null);
      if (error) throw error;
      return data;
    },
    staleTime: 300000,
  });

  const conversas = useMemo<ConversaAgrupada[]>(() => {
    if (!mensagens?.length) return [];

    // Build associado lookup by phone
    const avatarMap = new Map<string, { nome: string; avatar_url: string | null }>();
    if (associados) {
      for (const a of associados) {
        const phones = [a.telefone, a.whatsapp].filter(Boolean).map((p) => p!.replace(/\D/g, ''));
        for (const p of phones) {
          const comDDI = p.startsWith('55') ? p : `55${p}`;
          avatarMap.set(comDDI, { nome: a.nome, avatar_url: a.avatar_url });
          avatarMap.set(p, { nome: a.nome, avatar_url: a.avatar_url });
        }
      }
    }

    const mapa = new Map<string, ConversaAgrupada>();

    for (const msg of mensagens) {
      const tel = msg.telefone;
      if (!mapa.has(tel)) {
        const assoc = avatarMap.get(tel.replace(/\D/g, ''));
        mapa.set(tel, {
          telefone: tel,
          nome_contato: msg.nome_contato || assoc?.nome || null,
          avatar_url: assoc?.avatar_url || null,
          total_mensagens: 1,
          ultima_mensagem: msg.created_at,
          ultima_msg_texto: msg.mensagem,
          ultima_direcao: msg.direcao,
        });
      } else {
        const c = mapa.get(tel)!;
        c.total_mensagens++;
        if (!c.nome_contato && msg.nome_contato) c.nome_contato = msg.nome_contato;
      }
    }

    return Array.from(mapa.values()).sort(
      (a, b) => new Date(b.ultima_mensagem).getTime() - new Date(a.ultima_mensagem).getTime()
    );
  }, [mensagens, associados]);

  const handleSelectConversa = (conversa: ConversaAgrupada) => {
    setTelefoneSelecionado(conversa.telefone);
    setNomeContato(conversa.nome_contato);
    setAvatarUrl(conversa.avatar_url);
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex rounded-lg border border-border bg-card overflow-hidden">
      {/* Sidebar - Conversations List */}
      <div className="w-80 shrink-0">
        <ConversasList
          conversas={conversas}
          isLoading={isLoading}
          telefoneSelecionado={telefoneSelecionado}
          onSelectConversa={handleSelectConversa}
        />
      </div>

      {/* Chat Panel */}
      <div className="flex-1 min-w-0">
        <ChatPanel
          telefone={telefoneSelecionado}
          nomeContato={nomeContato}
          avatarUrl={avatarUrl}
        />
      </div>
    </div>
  );
}

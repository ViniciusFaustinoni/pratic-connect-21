import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ConversasList, type ConversaAgrupada } from '@/components/eventos/chat-ia/ConversasList';
import { ChatPanel } from '@/components/eventos/chat-ia/ChatPanel';

interface EventosChatIAProps {
  drawerVariant?: 'relacionamento' | 'eventos' | 'monitoramento';
  escopo?: 'todos' | 'monitoramento';
}

export default function EventosChatIA({ drawerVariant = 'relacionamento', escopo = 'todos' }: EventosChatIAProps = {}) {
  const [telefoneSelecionado, setTelefoneSelecionado] = useState<string | null>(null);
  const [nomeContato, setNomeContato] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Fetch all messages grouped by phone — apenas do provedor/instância ativa(s)
  const { data: instanciasAtivas } = useQuery({
    queryKey: ['whatsapp-instancias-ativas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_instancias')
        .select('id')
        .eq('ativa', true)
        .in('provedor', ['evolution', 'meta']); // somente provedores WhatsApp
      if (error) throw error;
      return (data ?? []).map((d) => d.id);
    },
    staleTime: 60_000,
  });

  const queryClient = useQueryClient();

  const { data: mensagens, isLoading } = useQuery({
    queryKey: ['chat-ia-conversas', instanciasAtivas],
    enabled: !!instanciasAtivas,
    queryFn: async () => {
      let q = supabase
        .from('whatsapp_mensagens')
        .select('telefone, nome_contato, mensagem, created_at, direcao, instancia_id, referencia_tipo')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (instanciasAtivas && instanciasAtivas.length > 0) {
        q = q.in('instancia_id', instanciasAtivas);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    staleTime: 5_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  // Realtime: atualiza a lista de conversas assim que uma nova mensagem é gravada
  useEffect(() => {
    if (!instanciasAtivas?.length) return;
    const channel = supabase
      .channel('chat-ia-mensagens-rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_mensagens' },
        (payload) => {
          const inst = (payload.new as any)?.instancia_id;
          if (inst && instanciasAtivas.includes(inst)) {
            queryClient.invalidateQueries({ queryKey: ['chat-ia-conversas', instanciasAtivas] });
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [instanciasAtivas, queryClient]);

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

  // Telefones elegíveis para escopo Monitoramento (associados com veículo/serviço/rastreador operacional)
  const { data: telefonesMonitoramento } = useQuery({
    queryKey: ['monitoramento-telefones-elegiveis'],
    enabled: escopo === 'monitoramento',
    staleTime: 60_000,
    queryFn: async () => {
      const STATUS_VEIC = ['ativo', 'instalacao_pendente', 'suspenso'] as const;
      const SERV_STATUS_ABERTOS = ['pendente', 'agendada', 'em_andamento', 'em_rota', 'em_analise', 'reagendada', 'imprevisto_pendente'] as const;

      const [{ data: veics }, { data: servs }, { data: rastr }] = await Promise.all([
        supabase.from('veiculos').select('associado_id').in('status', STATUS_VEIC as unknown as any).not('associado_id', 'is', null),
        supabase.from('servicos').select('veiculos!inner(associado_id)').in('status', SERV_STATUS_ABERTOS as unknown as any),
        supabase.from('rastreadores').select('veiculos!inner(associado_id)').not('veiculo_id', 'is', null),
      ]);

      const associadoIds = new Set<string>();
      (veics ?? []).forEach((v: any) => v.associado_id && associadoIds.add(v.associado_id));
      (servs ?? []).forEach((s: any) => s.veiculos?.associado_id && associadoIds.add(s.veiculos.associado_id));
      (rastr ?? []).forEach((r: any) => r.veiculos?.associado_id && associadoIds.add(r.veiculos.associado_id));

      if (associadoIds.size === 0) return new Set<string>();

      const ids = Array.from(associadoIds);
      const tels = new Set<string>();
      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500);
        const { data: ass } = await supabase.from('associados').select('telefone, whatsapp').in('id', chunk);
        (ass ?? []).forEach((a: any) => {
          [a.telefone, a.whatsapp].forEach((p: string | null) => {
            if (!p) return;
            const d = p.replace(/\D/g, '');
            if (!d) return;
            tels.add(d);
            tels.add(d.startsWith('55') ? d.slice(2) : `55${d}`);
          });
        });
      }
      return tels;
    },
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

    const COBRANCA_TIPOS = new Set(['cobranca', 'cobranca_csv']);

    for (const msg of mensagens) {
      const tel = msg.telefone;
      const isCobranca = msg.referencia_tipo && COBRANCA_TIPOS.has(msg.referencia_tipo);
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
          ultima_cobranca: isCobranca ? msg.created_at : null,
        });
      } else {
        const c = mapa.get(tel)!;
        c.total_mensagens++;
        if (!c.nome_contato && msg.nome_contato) c.nome_contato = msg.nome_contato;
        if (isCobranca && (!c.ultima_cobranca || new Date(msg.created_at) > new Date(c.ultima_cobranca))) {
          c.ultima_cobranca = msg.created_at;
        }
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
    <div className="h-[calc(100dvh-8rem)] flex rounded-lg border border-border bg-card overflow-hidden">
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
          drawerVariant={drawerVariant}
        />
      </div>
    </div>
  );
}

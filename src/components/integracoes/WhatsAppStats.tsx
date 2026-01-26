import { useState, useEffect } from 'react';
import { BarChart3, MessageSquare, Send, FileText, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

interface Stats {
  recebidas: number;
  enviadas: number;
  solicitacoes: number;
}

export function WhatsAppStats() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ recebidas: 0, enviadas: 0, solicitacoes: 0 });

  useEffect(() => {
    async function loadStats() {
      try {
        const agora = new Date();
        const ontem = new Date(agora.getTime() - 24 * 60 * 60 * 1000).toISOString();

        // Mensagens recebidas (entrada)
        const { count: recebidas } = await supabase
          .from('whatsapp_mensagens')
          .select('*', { count: 'exact', head: true })
          .eq('direcao', 'entrada')
          .gte('created_at', ontem);

        // Mensagens enviadas (saída)
        const { count: enviadas } = await supabase
          .from('whatsapp_mensagens')
          .select('*', { count: 'exact', head: true })
          .eq('direcao', 'saida')
          .gte('created_at', ontem);

        // Solicitações criadas via chat
        const { count: solicitacoes } = await supabase
          .from('chat_solicitacoes_ia')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', ontem);

        setStats({
          recebidas: recebidas || 0,
          enviadas: enviadas || 0,
          solicitacoes: solicitacoes || 0,
        });
      } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Estatísticas (24h)</CardTitle>
        </div>
        <CardDescription>
          Atividade do WhatsApp nas últimas 24 horas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {/* Recebidas */}
          <div className="text-center p-3 bg-blue-500/10 rounded-lg">
            <div className="flex items-center justify-center mb-2">
              <MessageSquare className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.recebidas}</p>
            <p className="text-xs text-muted-foreground">Recebidas</p>
          </div>

          {/* Enviadas */}
          <div className="text-center p-3 bg-green-500/10 rounded-lg">
            <div className="flex items-center justify-center mb-2">
              <Send className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.enviadas}</p>
            <p className="text-xs text-muted-foreground">Enviadas</p>
          </div>

          {/* Solicitações */}
          <div className="text-center p-3 bg-purple-500/10 rounded-lg">
            <div className="flex items-center justify-center mb-2">
              <FileText className="h-5 w-5 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.solicitacoes}</p>
            <p className="text-xs text-muted-foreground">Solicitações</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Solicitações incluem sinistros e assistências criadas via chat
        </p>
      </CardContent>
    </Card>
  );
}

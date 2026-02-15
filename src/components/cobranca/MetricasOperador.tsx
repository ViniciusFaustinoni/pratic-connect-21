import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PhoneCall, Target, TrendingUp, Timer } from 'lucide-react';

export function MetricasOperador() {
  const { user } = useAuth();

  const { data: metricas, isLoading } = useQuery({
    queryKey: ['metricas-operador', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const hoje = new Date().toISOString().split('T')[0];
      const trintaDiasAtras = new Date(Date.now() - 30 * 86400000).toISOString();

      const [contatosHoje, contatosEfetivos, tarefasHoje] = await Promise.all([
        supabase
          .from('cobranca_contatos')
          .select('id, resultado', { count: 'exact' })
          .eq('atendente_id', user.id)
          .gte('created_at', hoje),
        supabase
          .from('cobranca_contatos')
          .select('id, resultado', { count: 'exact' })
          .eq('atendente_id', user.id)
          .gte('created_at', trintaDiasAtras)
          .in('resultado', ['acordo', 'pagamento', 'promessa_pagamento']),
        supabase
          .from('cobranca_fila')
          .select('id, created_at, concluido_em')
          .eq('atribuido_para', user.id)
          .eq('status', 'concluido')
          .gte('concluido_em', hoje),
      ]);

      const totalHoje = contatosHoje.count || 0;
      const totalContatosData = contatosHoje.data || [];
      const efetivosHoje = totalContatosData.filter(c => c.resultado !== 'nao_atendeu').length;
      const taxaEfetivo = totalHoje > 0 ? Math.round((efetivosHoje / totalHoje) * 100) : 0;

      // Taxa de conversão (30 dias)
      const { count: totalContatos30d } = await supabase
        .from('cobranca_contatos')
        .select('id', { count: 'exact', head: true })
        .eq('atendente_id', user.id)
        .gte('created_at', trintaDiasAtras);

      const conversoes30d = contatosEfetivos.count || 0;
      const taxaConversao = (totalContatos30d || 0) > 0
        ? Math.round((conversoes30d / (totalContatos30d || 1)) * 100)
        : 0;

      // Tempo médio por tarefa
      const tarefasConcluidasHoje = tarefasHoje.data || [];
      let tempoMedio = 0;
      if (tarefasConcluidasHoje.length > 0) {
        const tempos = tarefasConcluidasHoje
          .filter(t => t.concluido_em && t.created_at)
          .map(t => (new Date(t.concluido_em!).getTime() - new Date(t.created_at).getTime()) / 60000);
        tempoMedio = tempos.length > 0 ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : 0;
      }

      return { totalHoje, taxaEfetivo, taxaConversao, tempoMedio };
    },
    enabled: !!user?.id
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }

  if (!metricas) return null;

  const items = [
    { icon: PhoneCall, label: 'Contatos Hoje', value: metricas.totalHoje, color: 'text-blue-600', bg: 'bg-blue-100' },
    { icon: Target, label: 'Taxa Efetivo', value: `${metricas.taxaEfetivo}%`, color: 'text-green-600', bg: 'bg-green-100' },
    { icon: TrendingUp, label: 'Conversão 30d', value: `${metricas.taxaConversao}%`, color: 'text-purple-600', bg: 'bg-purple-100' },
    { icon: Timer, label: 'Tempo Médio', value: `${metricas.tempoMedio}min`, color: 'text-orange-600', bg: 'bg-orange-100' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${item.bg}`}>
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <div>
                <p className="text-lg font-bold">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

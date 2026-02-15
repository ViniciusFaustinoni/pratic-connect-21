import { useMemo } from 'react';
import { Phone, MessageSquare, Mail, Settings, Handshake, AlertTriangle, Smartphone, DollarSign, Calendar, Bot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TimelineUnificadaProps {
  associadoId: string;
}

interface EventoUnificado {
  id: string;
  tipo: string;
  subtipo?: string;
  descricao: string;
  data: string;
  automatico: boolean;
  atendente?: string;
  dados?: Record<string, any>;
  origem: 'evento' | 'contato';
}

const tipoConfig: Record<string, { icon: any; cor: string; label: string }> = {
  sistema: { icon: Settings, cor: 'bg-gray-500', label: 'Sistema' },
  whatsapp: { icon: MessageSquare, cor: 'bg-green-500', label: 'WhatsApp' },
  email: { icon: Mail, cor: 'bg-purple-500', label: 'E-mail' },
  sms: { icon: Smartphone, cor: 'bg-blue-500', label: 'SMS' },
  ligacao: { icon: Phone, cor: 'bg-yellow-500', label: 'Ligação' },
  acordo: { icon: Handshake, cor: 'bg-blue-600', label: 'Acordo' },
  negativacao: { icon: AlertTriangle, cor: 'bg-red-600', label: 'Negativação' },
  status: { icon: Settings, cor: 'bg-indigo-500', label: 'Status' },
  pagamento: { icon: DollarSign, cor: 'bg-emerald-500', label: 'Pagamento' },
};

const resultadoLabels: Record<string, string> = {
  atendeu: 'Atendeu',
  nao_atendeu: 'Não Atendeu',
  promessa_pagamento: 'Promessa de Pagamento',
  pediu_acordo: 'Pediu Acordo',
  negou_divida: 'Negou Dívida',
  enviado: 'Enviado',
  lido: 'Lido',
  caixa_postal: 'Caixa Postal',
  numero_invalido: 'Número Inválido',
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export function TimelineUnificada({ associadoId }: TimelineUnificadaProps) {
  // Buscar eventos da tabela cobranca_eventos
  const { data: eventos, isLoading: loadingEventos } = useQuery({
    queryKey: ['cobranca-eventos', associadoId],
    queryFn: async () => {
      const { data } = await supabase
        .from('cobranca_eventos')
        .select('*')
        .eq('associado_id', associadoId)
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!associadoId,
  });

  // Buscar contatos da tabela cobranca_contatos
  const { data: contatos, isLoading: loadingContatos } = useQuery({
    queryKey: ['cobranca-contatos-timeline', associadoId],
    queryFn: async () => {
      const { data } = await supabase
        .from('cobranca_contatos')
        .select(`
          *,
          atendente:profiles!cobranca_contatos_atendente_id_fkey(nome)
        `)
        .eq('associado_id', associadoId)
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!associadoId,
  });

  // Unificar e ordenar cronologicamente
  const timeline = useMemo(() => {
    const items: EventoUnificado[] = [];

    // Eventos da tabela cobranca_eventos
    eventos?.forEach((e: any) => {
      items.push({
        id: e.id,
        tipo: e.tipo,
        subtipo: e.subtipo,
        descricao: e.descricao,
        data: e.created_at,
        automatico: e.automatico || false,
        atendente: undefined,
        dados: e.dados as Record<string, any> || {},
        origem: 'evento',
      });
    });

    // Contatos manuais
    contatos?.forEach((c: any) => {
      const resultado = resultadoLabels[c.resultado] || c.resultado;
      items.push({
        id: c.id,
        tipo: c.tipo,
        subtipo: c.resultado,
        descricao: `${c.tipo === 'ligacao' ? 'Ligação' : c.tipo === 'whatsapp' ? 'WhatsApp' : c.tipo === 'email' ? 'E-mail' : c.tipo} — ${resultado}${c.observacao ? `: ${c.observacao}` : ''}`,
        data: c.created_at,
        automatico: false,
        atendente: c.atendente?.nome,
        dados: {
          promessa_data: c.promessa_data,
          promessa_valor: c.promessa_valor,
        },
        origem: 'contato',
      });
    });

    // Ordenar por data DESC
    items.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    return items;
  }, [eventos, contatos]);

  const isLoading = loadingEventos || loadingContatos;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum evento registrado
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

      <div className="space-y-4">
        {timeline.map((item) => {
          const config = tipoConfig[item.tipo] || tipoConfig.sistema;
          const Icon = config.icon;

          return (
            <div key={`${item.origem}-${item.id}`} className="relative pl-10">
              <div className={`absolute left-0 w-8 h-8 rounded-full ${config.cor} flex items-center justify-center`}>
                <Icon className="h-4 w-4 text-white" />
              </div>

              <div className="bg-card border rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{config.label}</span>
                    {item.automatico && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Bot className="h-3 w-3" />
                        Automático
                      </Badge>
                    )}
                    {item.atendente && (
                      <span className="text-xs text-muted-foreground">por {item.atendente}</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(item.data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>

                <p className="text-sm text-muted-foreground">{item.descricao}</p>

                {(item.dados?.promessa_data || item.dados?.promessa_valor) && (
                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md p-2">
                    <div className="flex items-center gap-4 text-sm">
                      {item.dados.promessa_data && (
                        <div className="flex items-center gap-1 text-blue-700 dark:text-blue-300">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{format(new Date(item.dados.promessa_data), 'dd/MM/yyyy')}</span>
                        </div>
                      )}
                      {item.dados.promessa_valor && (
                        <div className="flex items-center gap-1 text-blue-700 dark:text-blue-300">
                          <DollarSign className="h-3.5 w-3.5" />
                          <span className="font-medium">{formatCurrency(item.dados.promessa_valor)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

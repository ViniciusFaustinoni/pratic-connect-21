import { useQuery } from '@tanstack/react-query';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { useConfiguracaoBase } from '@/hooks/useAgendamentoBase';
import { Calendar, Clock, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

interface AgendamentoBaseResumoProps {
  cotacaoId: string;
}

export function AgendamentoBaseResumo({ cotacaoId }: AgendamentoBaseResumoProps) {
  // Buscar dados do agendamento
  const { data: agendamento, isLoading: isLoadingAgendamento } = useQuery({
    queryKey: ['agendamento-base-resumo', cotacaoId],
    queryFn: async () => {
      const { data, error } = await publicSupabase
        .from('agendamentos_base')
        .select('data_agendada, horario, status')
        .eq('cotacao_id', cotacaoId)
        .in('status', ['agendado', 'confirmado', 'realizado'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('[AgendamentoBaseResumo] Erro ao buscar agendamento:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!cotacaoId,
    staleTime: 30000,
  });

  // Buscar configurações da base
  const { data: configBase, isLoading: isLoadingConfig } = useConfiguracaoBase();

  const isLoading = isLoadingAgendamento || isLoadingConfig;

  if (isLoading) {
    return (
      <div className="bg-muted/30 rounded-lg p-4 max-w-md mx-auto space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!agendamento) {
    return null;
  }

  const enderecoCompleto = configBase ? [
    configBase.base_logradouro,
    configBase.base_numero ? `, ${configBase.base_numero}` : '',
    configBase.base_complemento ? ` - ${configBase.base_complemento}` : '',
  ].join('') : '';

  const bairroCidade = configBase ? [
    configBase.base_bairro,
    configBase.base_cidade ? ` - ${configBase.base_cidade}` : '',
    configBase.base_uf ? `/${configBase.base_uf}` : '',
  ].join('') : '';

  return (
    <div className="bg-muted/30 rounded-lg p-4 max-w-md mx-auto text-left space-y-3">
      {agendamento.data_agendada && (
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-primary flex-shrink-0" />
          <div>
            <p className="text-sm text-muted-foreground">Data</p>
            <p className="font-medium">
              {format(new Date(agendamento.data_agendada + 'T12:00:00'), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>
      )}
      
      {agendamento.horario && (
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-primary flex-shrink-0" />
          <div>
            <p className="text-sm text-muted-foreground">Horário</p>
            <p className="font-medium">{agendamento.horario}</p>
          </div>
        </div>
      )}
      
      {configBase && enderecoCompleto && (
        <div className="flex items-start gap-3">
          <MapPin className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-muted-foreground">Local (Base PRATIC)</p>
            <p className="font-medium">{enderecoCompleto}</p>
            {bairroCidade && (
              <p className="text-sm text-muted-foreground">{bairroCidade}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

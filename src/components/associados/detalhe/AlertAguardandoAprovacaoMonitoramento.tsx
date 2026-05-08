import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  associadoId: string;
  associadoStatus?: string | null;
}

/**
 * Aviso para o módulo Cadastro: a instalação já foi concluída em campo
 * (técnico interno ou prestador externo) e o associado está parado em
 * `aguardando_instalacao` apenas porque o Coordenador de Monitoramento
 * ainda não aprovou a Proteção 360 na fila correspondente.
 *
 * Mostra a data da conclusão e leva direto à fila para destravar.
 */
export function AlertAguardandoAprovacaoMonitoramento({ associadoId, associadoStatus }: Props) {
  const navigate = useNavigate();

  const enabled = !!associadoId && associadoStatus === 'aguardando_instalacao';

  const { data, isLoading } = useQuery({
    queryKey: ['alerta-aprovacao-monitoramento', associadoId],
    enabled,
    queryFn: async () => {
      // Procura serviço de instalação concluído (mas não aprovado/reprovado)
      // — esse é exatamente o estado que joga o card na fila do monitoramento.
      const { data: servico } = await (supabase as any)
        .from('servicos')
        .select('id, concluida_em, profissional:profissional_id(nome), veiculo:veiculo_id(placa)')
        .eq('associado_id', associadoId)
        .eq('tipo', 'instalacao')
        .eq('status', 'concluida')
        .order('concluida_em', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!servico) return null;

      // Tenta enriquecer com nome do prestador, se a instalação veio por link público.
      const { data: link } = await supabase
        .from('instalacao_prestador_links')
        .select('prestador:prestador_id(nome), concluida_em')
        .eq('status', 'concluida')
        .order('concluida_em', { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        concluidaEm: servico.concluida_em as string | null,
        placa: (servico.veiculo as any)?.placa as string | undefined,
        executor:
          (link?.prestador as any)?.nome ||
          (servico.profissional as any)?.nome ||
          null,
      };
    },
    refetchInterval: 60_000,
  });

  if (!enabled) return null;
  if (isLoading) return <Skeleton className="h-20 w-full rounded-lg" />;
  if (!data) return null;

  const dataFmt = data.concluidaEm
    ? new Date(data.concluidaEm).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
      <CheckCircle2 className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-900 dark:text-amber-200">
        Instalação concluída em campo — aguardando aprovação do Monitoramento
      </AlertTitle>
      <AlertDescription className="text-amber-800 dark:text-amber-300">
        <div className="space-y-2">
          <p className="text-sm">
            {data.executor ? <strong>{data.executor}</strong> : 'A instalação'} concluiu o serviço
            {data.placa ? ` do veículo ${data.placa}` : ''}
            {dataFmt ? ` em ${dataFmt}` : ''}. O associado segue como{' '}
            <strong>Aguardando Instalação</strong> até que o Coordenador de Monitoramento
            aprove a Proteção 360 (revisão das fotos/checklist). Esse passo é obrigatório
            antes de ativar o associado e vincular o rastreador.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-400 bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 dark:text-amber-100"
            onClick={() => navigate('/monitoramento/aprovacao-associados')}
          >
            Abrir fila de aprovação
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

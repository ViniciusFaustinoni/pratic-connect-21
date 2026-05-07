import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClipboardCheck, ExternalLink, Loader2 } from 'lucide-react';

interface Props {
  servicoId: string;
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  aguardando_atribuicao: 'outline',
  agendada: 'secondary',
  em_andamento: 'secondary',
  concluida: 'default',
  aprovada: 'default',
  aprovada_ressalvas: 'default',
  reprovada: 'destructive',
  cancelada: 'destructive',
};

export function MiniCardVistoriaTroca({ servicoId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['mini-card-vistoria-troca', servicoId],
    queryFn: async () => {
      const { data: servico } = await (supabase as any)
        .from('servicos')
        .select('id, status, tipo_servico, agendamento_data, concluido_em, instalador_id')
        .eq('id', servicoId)
        .maybeSingle();
      if (!servico) return null;
      let instaladorNome: string | null = null;
      if (servico.instalador_id) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('nome')
          .eq('id', servico.instalador_id)
          .maybeSingle();
        instaladorNome = prof?.nome || null;
      }
      return { ...servico, instaladorNome };
    },
    refetchInterval: 30000,
  });

  return (
    <div className="rounded border p-3 space-y-2">
      <h4 className="font-semibold flex items-center gap-2">
        <ClipboardCheck className="h-4 w-4" /> Vistoria do veículo
      </h4>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">Vistoria não encontrada</p>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={STATUS_VARIANT[data.status] || 'secondary'}>
              {data.status?.replace(/_/g, ' ')}
            </Badge>
            <span className="text-xs text-muted-foreground">{data.tipo_servico}</span>
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5">
            {data.agendamento_data && (
              <p>Agendamento: {new Date(data.agendamento_data).toLocaleString('pt-BR')}</p>
            )}
            {data.concluido_em && (
              <p>Concluído em {new Date(data.concluido_em).toLocaleString('pt-BR')}</p>
            )}
            {data.instaladorNome && <p>Técnico: {data.instaladorNome}</p>}
          </div>
          <Button size="sm" variant="outline" asChild>
            <a
              href={`/monitoramento/vistorias-instalacoes-mon?servico=${servicoId}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="h-3 w-3 mr-1" /> Abrir vistoria
            </a>
          </Button>
        </>
      )}
    </div>
  );
}

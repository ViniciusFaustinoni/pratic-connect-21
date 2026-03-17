import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { UserPlus, ExternalLink } from 'lucide-react';

interface Props {
  associadoId: string;
}

function useOrigemCadastro(associadoId: string) {
  return useQuery({
    queryKey: ['origem-cadastro', associadoId],
    queryFn: async () => {
      // Check if this associate was referred
      const { data: indicacao } = await supabase
        .from('indicacoes')
        .select('id, indicador_id, data_conversao, associados!indicacoes_indicador_id_fkey(nome)')
        .eq('associado_id', associadoId)
        .eq('status', 'convertido')
        .maybeSingle();

      // Get contract info
      const { data: contrato } = await supabase
        .from('contratos')
        .select('id, created_at, vendedor_id, profiles:vendedor_id(nome)')
        .eq('associado_id', associadoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Determine entry type
      let tipoEntrada = 'Nova adesão';
      if (indicacao) {
        tipoEntrada = 'Indicação';
      }

      return {
        tipoEntrada,
        indicacao: indicacao ? {
          indicadorId: indicacao.indicador_id,
          indicadorNome: (indicacao.associados as any)?.nome || 'Associado',
          dataConversao: indicacao.data_conversao,
        } : null,
        consultor: (contrato?.profiles as any)?.nome || null,
        dataConversao: indicacao?.data_conversao || contrato?.created_at || null,
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-BR') : '—';

export function OrigemCadastroCard({ associadoId }: Props) {
  const { data, isLoading } = useOrigemCadastro(associadoId);

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (!data) return null;

  return (
    <Card className="border-border/60">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <UserPlus className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Origem do Cadastro</span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <span className="text-xs text-muted-foreground">Tipo de entrada</span>
            <div>
              <Badge variant="outline" className="mt-0.5 text-xs">
                {data.tipoEntrada}
              </Badge>
            </div>
          </div>

          {data.indicacao && (
            <div>
              <span className="text-xs text-muted-foreground">Indicado por</span>
              <div>
                <Link
                  to={`/cadastro/associados/${data.indicacao.indicadorId}`}
                  className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1 mt-0.5"
                >
                  {data.indicacao.indicadorNome}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
          )}

          {data.consultor && (
            <div>
              <span className="text-xs text-muted-foreground">Consultor responsável</span>
              <p className="text-xs font-medium mt-0.5">{data.consultor}</p>
            </div>
          )}

          {data.dataConversao && (
            <div>
              <span className="text-xs text-muted-foreground">Data da conversão</span>
              <p className="text-xs font-medium mt-0.5">{formatDate(data.dataConversao)}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

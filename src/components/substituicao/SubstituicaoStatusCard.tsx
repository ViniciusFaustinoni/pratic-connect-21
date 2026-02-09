import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { STATUS_SUBSTITUICAO_LABELS, STATUS_SUBSTITUICAO_CORES, type StatusSubstituicao } from '@/types/substituicao';

const STEPS_ORDER: StatusSubstituicao[] = [
  'iniciada',
  'aguardando_retirada',
  'aguardando_vistoria',
  'aguardando_financeiro',
  'aguardando_aprovacao',
  'efetivada',
];

const STEP_LABELS = [
  'Iniciada',
  'Retirada',
  'Vistoria',
  'Financeiro',
  'Aprovação',
  'Efetivada',
];

function getProgressPercent(status: StatusSubstituicao): number {
  const idx = STEPS_ORDER.indexOf(status);
  if (idx < 0) return 0;
  return Math.round(((idx + 1) / STEPS_ORDER.length) * 100);
}

interface Props {
  associadoId: string;
}

export function SubstituicaoStatusCard({ associadoId }: Props) {
  const navigate = useNavigate();

  const { data: substituicao } = useQuery({
    queryKey: ['substituicao-ativa', associadoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('substituicoes_veiculo')
        .select('id, status, veiculo_antigo_placa, veiculo_antigo_modelo, veiculo_novo_placa, veiculo_novo_modelo, created_at')
        .eq('associado_id', associadoId)
        .not('status', 'in', '("efetivada","rejeitada","cancelada_pelo_associado")')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!associadoId,
  });

  if (!substituicao) return null;

  const status = substituicao.status as StatusSubstituicao;
  const progress = getProgressPercent(status);
  const currentStepIdx = STEPS_ORDER.indexOf(status);

  return (
    <Card className="border-yellow-300 dark:border-yellow-700 bg-yellow-50/50 dark:bg-yellow-950/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-yellow-600" />
            <span className="font-semibold text-sm">Substituição em Andamento</span>
          </div>
          <Badge className={STATUS_SUBSTITUICAO_CORES[status]}>
            {STATUS_SUBSTITUICAO_LABELS[status]}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Veículo antigo: </span>
            <span className="font-medium">{substituicao.veiculo_antigo_modelo} ({substituicao.veiculo_antigo_placa})</span>
          </div>
          <div>
            <span className="text-muted-foreground">Veículo novo: </span>
            <span className="font-medium">
              {substituicao.veiculo_novo_modelo
                ? `${substituicao.veiculo_novo_modelo} (${substituicao.veiculo_novo_placa})`
                : 'Aguardando dados'}
            </span>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            {STEP_LABELS.map((label, i) => (
              <span
                key={label}
                className={i <= currentStepIdx ? 'text-primary font-medium' : ''}
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => navigate(`/cadastro/substituicoes/${substituicao.id}`)}
        >
          Ver detalhes <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}

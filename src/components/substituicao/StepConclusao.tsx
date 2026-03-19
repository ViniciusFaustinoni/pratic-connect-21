import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Clock, ArrowRight, AlertTriangle, Plus } from 'lucide-react';
import { format, isFuture, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatarMoeda } from '@/utils/format';

interface StepConclusaoProps {
  substituicaoId: string;
  associadoId: string;
  associadoNome: string;
  veiculoAntigoPlaca: string;
  onRetry: () => void;
}

const STATUS_MAP: Record<string, { label: string; icon: 'loading' | 'success' | 'error'; color: string }> = {
  aguardando_aprovacao: { label: 'Aguardando processamento', icon: 'loading', color: 'text-amber-500' },
  aprovada: { label: 'Em processamento', icon: 'loading', color: 'text-blue-500' },
  efetivada: { label: 'Concluída com sucesso', icon: 'success', color: 'text-emerald-500' },
  rejeitada: { label: 'Falha no processamento', icon: 'error', color: 'text-destructive' },
};

const TERMINAL_STATUSES = ['efetivada', 'rejeitada', 'cancelada_pelo_associado'];

export function StepConclusao({
  substituicaoId,
  associadoId,
  associadoNome,
  veiculoAntigoPlaca,
  onRetry,
}: StepConclusaoProps) {
  const navigate = useNavigate();

  const { data: substituicao, isLoading } = useQuery({
    queryKey: ['substituicao-status', substituicaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('substituicoes_veiculo')
        .select('status, motivo_rejeicao, veiculo_novo_placa, veiculo_novo_modelo, taxa_substituicao, veiculo_antigo_placa, data_fim_carencia')
        .eq('id', substituicaoId)
        .single();
      if (error) throw error;
      return data;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && TERMINAL_STATUSES.includes(status)) return false;
      return 10_000;
    },
  });

  const status = substituicao?.status ?? 'aguardando_aprovacao';
  const statusInfo = STATUS_MAP[status] ?? STATUS_MAP.aguardando_aprovacao;

  const emCarencia = substituicao?.data_fim_carencia
    ? isFuture(parseISO(substituicao.data_fim_carencia))
    : false;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status indicator */}
      <Card>
        <CardContent className="py-8 flex flex-col items-center gap-4 text-center">
          {statusInfo.icon === 'loading' && (
            <Loader2 className={`h-12 w-12 animate-spin ${statusInfo.color}`} />
          )}
          {statusInfo.icon === 'success' && (
            <CheckCircle2 className={`h-12 w-12 ${statusInfo.color}`} />
          )}
          {statusInfo.icon === 'error' && (
            <XCircle className={`h-12 w-12 ${statusInfo.color}`} />
          )}

          <div>
            <h2 className="text-lg font-semibold">{statusInfo.label}</h2>
            {statusInfo.icon === 'loading' && (
              <p className="text-sm text-muted-foreground mt-1">
                Verificando automaticamente a cada 10 segundos…
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Operation summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Resumo da operação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Associado</span>
            <span className="font-medium">{associadoNome}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Veículo</span>
            <span className="font-medium flex items-center gap-1.5">
              {substituicao?.veiculo_antigo_placa || veiculoAntigoPlaca}
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              {substituicao?.veiculo_novo_placa ?? '—'}
            </span>
          </div>
          {substituicao?.veiculo_novo_modelo && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Novo modelo</span>
              <span className="font-medium">{substituicao.veiculo_novo_modelo}</span>
            </div>
          )}
          {substituicao?.taxa_substituicao != null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Taxa paga</span>
              <span className="font-medium">{formatarMoeda(substituicao.taxa_substituicao)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coverage alert */}
      {emCarencia && substituicao?.data_fim_carencia && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-600">Veículo em período de carência</AlertTitle>
          <AlertDescription className="text-amber-600/80">
            O novo veículo estará sem cobertura até{' '}
            <strong>
              {format(parseISO(substituicao.data_fim_carencia), "dd/MM/yyyy", { locale: ptBR })}
            </strong>
            . Oriente o associado sobre as condições durante esse período.
          </AlertDescription>
        </Alert>
      )}

      {/* Error reason */}
      {status === 'rejeitada' && substituicao?.motivo_rejeicao && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Motivo da falha</AlertTitle>
          <AlertDescription>{substituicao.motivo_rejeicao}</AlertDescription>
        </Alert>
      )}

      {/* Action buttons */}
      {status === 'efetivada' && (
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button className="flex-1" onClick={() => navigate(`/cadastro/associados/${associadoId}`)}>
            Ver ficha do associado
          </Button>
          <Button variant="outline" className="flex-1 gap-1.5" onClick={() => navigate('/cadastro/associados')}>
            <Plus className="h-4 w-4" />
            Nova operação
          </Button>
        </div>
      )}

      {status === 'rejeitada' && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={onRetry}>
            Tentar novamente
          </Button>
        </div>
      )}
    </div>
  );
}

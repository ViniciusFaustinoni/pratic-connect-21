import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, Clock, Radio, ExternalLink, SkipForward } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface StepRastreadorProps {
  associadoId: string;
  veiculoAntigoId: string;
  substituicaoId: string | null;
  onNext: () => void;
  onBack: () => void;
  onIniciarSubstituicao: () => Promise<string>;
}

export function StepRastreador({
  associadoId,
  veiculoAntigoId,
  substituicaoId,
  onNext,
  onBack,
  onIniciarSubstituicao,
}: StepRastreadorProps) {
  const [criandoOrdem, setCriandoOrdem] = useState(false);
  const [ordemCriada, setOrdemCriada] = useState(false);

  // Verificar se o veículo antigo tem rastreador instalado
  const { data: rastreador, isLoading: loadingRastreador } = useQuery({
    queryKey: ['rastreador-veiculo', veiculoAntigoId],
    queryFn: async () => {
      const { data } = await supabase
        .from('rastreadores')
        .select('id, codigo, status')
        .eq('veiculo_id', veiculoAntigoId)
        .in('status', ['instalado'])
        .maybeSingle();
      return data;
    },
    enabled: !!veiculoAntigoId,
  });

  // Verificar se já existe serviço de retirada pendente
  const { data: servicoRetirada, isLoading: loadingServico, refetch: refetchServico } = useQuery({
    queryKey: ['servico-retirada-substituicao', veiculoAntigoId],
    queryFn: async () => {
      const { data } = await supabase
        .from('servicos')
        .select('id, status, tipo')
        .eq('veiculo_id', veiculoAntigoId)
        .eq('tipo', 'vistoria_retirada')
        .in('status', ['pendente', 'agendada', 'em_andamento', 'concluida'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!veiculoAntigoId,
    refetchInterval: (query) => {
      // Poll every 10s if there's a pending service
      const data = query.state.data;
      if (data && data.status !== 'concluido') return 10_000;
      return false;
    },
  });

  const semRastreador = !loadingRastreador && !rastreador;
  const rastreadorRetirado = servicoRetirada?.status === 'concluido';
  const canProceed = semRastreador || rastreadorRetirado;

  // Auto-skip if no tracker
  useEffect(() => {
    if (semRastreador && !loadingRastreador) {
      // Small delay to show the skip message
      const timer = setTimeout(() => onNext(), 800);
      return () => clearTimeout(timer);
    }
  }, [semRastreador, loadingRastreador, onNext]);

  const handleCriarOrdemRetirada = async () => {
    setCriandoOrdem(true);
    try {
      let substId = substituicaoId;
      if (!substId) {
        substId = await onIniciarSubstituicao();
      }

      // Criar serviço de retirada
      const { data: servico, error } = await supabase
        .from('servicos')
        .insert({
          tipo: 'retirada',
          veiculo_id: veiculoAntigoId,
          associado_id: associadoId,
          status: 'pendente',
          observacoes: `Retirada de rastreador para substituição de veículo (Substituição #${substId.slice(0, 8)})`,
        } as any)
        .select('id')
        .single();

      if (error) throw error;

      // Vincular serviço à substituição
      await supabase
        .from('substituicoes_veiculo')
        .update({
          servico_retirada_id: servico.id,
          status: 'aguardando_retirada' as string,
          updated_at: new Date().toISOString(),
        })
        .eq('id', substId);

      setOrdemCriada(true);
      toast.success('Ordem de retirada criada com sucesso!');
      refetchServico();
    } catch (err) {
      toast.error('Erro ao criar ordem de retirada: ' + (err as Error).message);
    } finally {
      setCriandoOrdem(false);
    }
  };

  if (loadingRastreador || loadingServico) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
          <span className="text-muted-foreground">Verificando rastreador do veículo...</span>
        </CardContent>
      </Card>
    );
  }

  if (semRastreador) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 gap-3">
          <SkipForward className="h-5 w-5 text-green-600" />
          <span className="text-muted-foreground">Veículo sem rastreador instalado — pulando etapa...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Radio className="h-5 w-5" />
            Rastreador do Veículo Atual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Info do rastreador */}
          <div className={cn(
            'flex items-start gap-3 p-4 rounded-lg border',
            rastreadorRetirado
              ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30'
              : 'border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/30'
          )}>
            {rastreadorRetirado ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            ) : (
              <Clock className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className="font-medium text-sm">
                {rastreadorRetirado
                  ? 'Rastreador retirado com sucesso'
                  : 'Rastreador instalado no veículo atual precisa ser retirado'}
              </p>
              {rastreador && (
                <p className="text-xs text-muted-foreground mt-1">
                  Código: {rastreador.codigo} • Status: {rastreador.status}
                </p>
              )}
              {servicoRetirada && !rastreadorRetirado && (
                <p className="text-xs text-muted-foreground mt-1">
                  Ordem de retirada: <Badge variant="secondary" className="text-xs capitalize">{servicoRetirada.status}</Badge>
                </p>
              )}
            </div>
            <Badge
              variant={rastreadorRetirado ? 'default' : 'secondary'}
              className={cn(rastreadorRetirado && 'bg-green-600')}
            >
              {rastreadorRetirado ? 'Concluído' : 'Pendente'}
            </Badge>
          </div>

          {/* Ações */}
          {!servicoRetirada && !ordemCriada && (
            <Button onClick={handleCriarOrdemRetirada} disabled={criandoOrdem} className="w-full">
              {criandoOrdem ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Radio className="h-4 w-4 mr-2" />}
              Criar ordem de retirada
            </Button>
          )}

          {servicoRetirada && !rastreadorRetirado && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Aguardando a retirada do rastreador. Acompanhe no módulo de Monitoramento.
                <Button variant="link" size="sm" className="p-0 ml-1 h-auto" asChild>
                  <a href="/monitoramento/retiradas">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Ver retiradas
                  </a>
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Voltar</Button>
        <Button onClick={onNext} disabled={!canProceed}>
          Próximo
        </Button>
      </div>
    </div>
  );
}

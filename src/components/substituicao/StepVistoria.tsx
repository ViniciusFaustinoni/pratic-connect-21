import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Camera, CheckCircle2, Clock, FileText, Loader2, AlertTriangle,
  ExternalLink, ArrowLeft, ArrowRight, ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface StepVistoriaProps {
  associadoId: string;
  veiculoNovoId: string | null;
  substituicaoId: string | null;
  dadosNovoVeiculo: { placa?: string; modelo?: string; ano_modelo?: number };
  onNext: () => void;
  onBack: () => void;
  onIniciarSubstituicao: () => Promise<string>;
}

type VistoriaStatus = 'pendente' | 'agendada' | 'em_analise' | 'aprovada' | 'reprovada';

export function StepVistoria({
  associadoId,
  veiculoNovoId,
  substituicaoId,
  dadosNovoVeiculo,
  onNext,
  onBack,
  onIniciarSubstituicao,
}: StepVistoriaProps) {
  const queryClient = useQueryClient();
  const [dispensaConfirmada, setDispensaConfirmada] = useState(false);
  const [dispensaSolicitada, setDispensaSolicitada] = useState(false);

  // Fetch dispensa config from configuracoes table
  const { data: dispensaConfig } = useQuery({
    queryKey: ['config-dispensa-vistoria-substituicao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', [
          'substituicao_dispensa_vistoria_0km_ativa',
          'substituicao_dispensa_vistoria_0km_prazo_nf_dias',
        ]);
      if (error) throw error;

      const map: Record<string, string> = {};
      data?.forEach((c) => { map[c.chave] = c.valor; });
      return {
        dispensaAtiva: map['substituicao_dispensa_vistoria_0km_ativa'] === 'true',
        prazoNfDias: parseInt(map['substituicao_dispensa_vistoria_0km_prazo_nf_dias'] || '30', 10),
      };
    },
  });

  // Check if a vistoria already exists for this vehicle in this substituição context
  const { data: vistoriaExistente, isLoading: loadingVistoria } = useQuery({
    queryKey: ['vistoria-substituicao', veiculoNovoId],
    queryFn: async () => {
      if (!veiculoNovoId) return null;
      const { data, error } = await supabase
        .from('vistorias')
        .select('id, status, created_at')
        .eq('veiculo_id', veiculoNovoId)
        .eq('tipo', 'entrada')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!veiculoNovoId,
    refetchInterval: (query) => {
      const status = query.state.data?.status as VistoriaStatus | undefined;
      if (!status || status === 'aprovada' || status === 'reprovada') return false;
      return 10_000;
    },
  });

  // Create vistoria for the new vehicle
  const criarVistoria = useMutation({
    mutationFn: async () => {
      const subId = substituicaoId || await onIniciarSubstituicao();
      if (!veiculoNovoId) throw new Error('Veículo novo não encontrado');

      const { data, error } = await supabase
        .from('vistorias')
        .insert({
          veiculo_id: veiculoNovoId,
          associado_id: associadoId,
          tipo: 'entrada',
          status: 'pendente' as const,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vistoria-substituicao', veiculoNovoId] });
      toast.success('Vistoria criada! Aguardando realização.');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar vistoria: ${err.message}`);
    },
  });

  // Handle dispensa (skip vistoria for 0km vehicles)
  const handleDispensa = async () => {
    setDispensaSolicitada(true);
    toast.success('Vistoria dispensada — veículo 0km com nota fiscal válida.');
  };

  const vistoriaStatus = vistoriaExistente?.status as VistoriaStatus | undefined;
  const vistoriaAprovada = vistoriaStatus === 'aprovada';
  const vistoriaReprovada = vistoriaStatus === 'reprovada';
  const vistoriaEmAndamento = vistoriaStatus === 'pendente' || vistoriaStatus === 'agendada' || vistoriaStatus === 'em_analise';

  const podeAvancar = vistoriaAprovada || dispensaSolicitada;

  const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
    pendente: { label: 'Pendente', color: 'bg-amber-500/15 text-amber-500 border-amber-500/30', icon: Clock },
    agendada: { label: 'Agendada', color: 'bg-blue-500/15 text-blue-500 border-blue-500/30', icon: Clock },
    em_analise: { label: 'Em análise', color: 'bg-purple-500/15 text-purple-500 border-purple-500/30', icon: Camera },
    aprovada: { label: 'Aprovada', color: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30', icon: CheckCircle2 },
    reprovada: { label: 'Reprovada', color: 'bg-destructive/15 text-destructive border-destructive/30', icon: AlertTriangle },
  };

  if (loadingVistoria) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Vistoria do Novo Veículo
          </CardTitle>
          <CardDescription>
            A vistoria de entrada é obrigatória para todos os veículos. O consultor pode realizá-la
            presencialmente ou gerar um link para o associado fazer pelo app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current vistoria status */}
          {vistoriaExistente && vistoriaStatus && (
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
              {(() => {
                const cfg = statusConfig[vistoriaStatus];
                const Icon = cfg?.icon || Clock;
                return (
                  <>
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Vistoria criada</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(vistoriaExistente.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <Badge variant="outline" className={cfg?.color}>
                      {cfg?.label}
                    </Badge>
                  </>
                );
              })()}
            </div>
          )}

          {/* Polling indicator */}
          {vistoriaEmAndamento && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Aguardando conclusão</AlertTitle>
              <AlertDescription>
                O status da vistoria é verificado automaticamente a cada 10 segundos.
                Você pode permanecer nesta tela ou voltar depois.
              </AlertDescription>
            </Alert>
          )}

          {/* Reprovada */}
          {vistoriaReprovada && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Vistoria reprovada</AlertTitle>
              <AlertDescription>
                A vistoria do veículo foi reprovada. Solicite uma nova vistoria após
                corrigir os itens apontados.
              </AlertDescription>
            </Alert>
          )}

          {/* Aprovada */}
          {vistoriaAprovada && (
            <Alert className="border-emerald-500/50 bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <AlertTitle className="text-emerald-600">Vistoria aprovada</AlertTitle>
              <AlertDescription className="text-emerald-600/80">
                A vistoria de entrada foi aprovada. Você pode avançar para a próxima etapa.
              </AlertDescription>
            </Alert>
          )}

          {/* Dispensada */}
          {dispensaSolicitada && (
            <Alert className="border-emerald-500/50 bg-emerald-500/10">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <AlertTitle className="text-emerald-600">Vistoria dispensada</AlertTitle>
              <AlertDescription className="text-emerald-600/80">
                Veículo 0km com nota fiscal válida — vistoria dispensada conforme regra operacional.
              </AlertDescription>
            </Alert>
          )}

          {/* No vistoria yet and not dispensed - show actions */}
          {!vistoriaExistente && !dispensaSolicitada && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center gap-2"
                  onClick={() => criarVistoria.mutate()}
                  disabled={criarVistoria.isPending || !veiculoNovoId}
                >
                  {criarVistoria.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Camera className="h-5 w-5" />
                  )}
                  <span className="text-sm font-medium">Iniciar vistoria presencial</span>
                  <span className="text-xs text-muted-foreground">O consultor realiza agora</span>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center gap-2"
                  onClick={() => criarVistoria.mutate()}
                  disabled={criarVistoria.isPending || !veiculoNovoId}
                >
                  {criarVistoria.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ExternalLink className="h-5 w-5" />
                  )}
                  <span className="text-sm font-medium">Enviar link ao associado</span>
                  <span className="text-xs text-muted-foreground">Autovistoria pelo app</span>
                </Button>
              </div>
            </div>
          )}

          {/* Reprovada - allow retry */}
          {vistoriaReprovada && (
            <Button
              variant="outline"
              onClick={() => criarVistoria.mutate()}
              disabled={criarVistoria.isPending || !veiculoNovoId}
            >
              {criarVistoria.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Camera className="h-4 w-4 mr-2" />
              )}
              Solicitar nova vistoria
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Dispensa section - only for 0km with config enabled */}
      {dispensaConfig?.dispensaAtiva && !vistoriaAprovada && !dispensaSolicitada && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Dispensa de vistoria — Veículo 0km
            </CardTitle>
            <CardDescription>
              Veículos zero quilômetro com nota fiscal de até {dispensaConfig.prazoNfDias} dias
              e certificado da concessionária podem ter a vistoria dispensada.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg border">
              <Checkbox
                id="confirmar-dispensa"
                checked={dispensaConfirmada}
                onCheckedChange={(checked) => setDispensaConfirmada(checked === true)}
              />
              <Label htmlFor="confirmar-dispensa" className="text-sm cursor-pointer leading-relaxed">
                Confirmo que o veículo é 0km, possuo a nota fiscal emitida há no máximo{' '}
                <strong>{dispensaConfig.prazoNfDias} dias</strong> e o certificado da concessionária.
              </Label>
            </div>

            <Button
              variant="secondary"
              onClick={handleDispensa}
              disabled={!dispensaConfirmada}
              className="gap-1.5"
            >
              <ShieldCheck className="h-4 w-4" />
              Dispensar vistoria
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Button
          onClick={onNext}
          disabled={!podeAvancar}
          className="gap-1.5"
        >
          Próximo
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle, AlertTriangle, Info, Loader2, CreditCard,
  Camera, Radio, FileCheck, ArrowRight, Shield,
} from 'lucide-react';
import { useInadimplenciaPrazos, useCarenciaDiasPadrao, useCarenciaVidrosDias } from '@/hooks/useConteudosSistema';
import { useAssociadoActions } from '@/hooks/useAssociados';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { SituacaoAssociado } from '@/hooks/useAssociadoSituacao';

interface ReativacaoWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  associadoId: string;
  contratoId: string | undefined;
  situacao: SituacaoAssociado;
}

type Caminho = 1 | 2 | 3;

const CAMINHO_LABELS: Record<Caminho, string> = {
  1: 'Pagamento Simples',
  2: 'Pagamento + Revistoria',
  3: 'Nova Adesão Completa',
};

const CAMINHO_COLORS: Record<Caminho, string> = {
  1: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  2: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  3: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export function ReativacaoWizard({
  open, onOpenChange, associadoId, contratoId, situacao,
}: ReativacaoWizardProps) {
  const { data: prazos } = useInadimplenciaPrazos();
  const { reativarAssociado, isReativando } = useAssociadoActions();

  // Steps tracking
  const [currentStep, setCurrentStep] = useState(0);
  const [stepsCompleted, setStepsCompleted] = useState<Record<number, boolean>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  const prazoSemRevistoria = prazos?.prazoSemRevistoria ?? 30;
  const prazoNovaAdesao = prazos?.prazoNovaAdesao ?? 180;
  const dias = situacao.diasAtraso;

  // Determine path
  const caminho: Caminho = dias <= prazoSemRevistoria ? 1 : dias <= prazoNovaAdesao ? 2 : 3;

  const stepsForPath: Record<Caminho, { title: string; icon: typeof CreditCard }[]> = {
    1: [
      { title: 'Confirmar Pagamento', icon: CreditCard },
    ],
    2: [
      { title: 'Confirmar Pagamento', icon: CreditCard },
      { title: 'Confirmar Revistoria', icon: Camera },
    ],
    3: [
      { title: 'Quitar Débitos', icon: CreditCard },
      { title: 'Nova Taxa de Adesão', icon: FileCheck },
      { title: 'Nova Vistoria', icon: Camera },
      { title: 'Instalação Rastreador', icon: Radio },
    ],
  };

  const steps = stepsForPath[caminho];
  const totalSteps = steps.length;
  const allDone = Object.keys(stepsCompleted).length === totalSteps;

  const markStepComplete = (step: number) => {
    setStepsCompleted(prev => ({ ...prev, [step]: true }));
    if (step < totalSteps - 1) {
      setCurrentStep(step + 1);
    }
  };

  const handleFinalizar = async () => {
    setIsProcessing(true);
    try {
      if (caminho === 3) {
        // Register as nova adesão + pontuação
        await supabase.from('associados_historico').insert({
          associado_id: associadoId,
          tipo: 'status_alterado',
          descricao: `Reativação via nova adesão completa (${dias} dias de inadimplência)`,
          dados_anteriores: { caminho: 3, diasAtraso: dias },
          dados_novos: { status: 'ativo', tipo: 'nova_adesao' },
        });

        // Assign points to consultant if available
        if (situacao.consultorNome && contratoId) {
          const { data: contrato } = await supabase
            .from('contratos')
            .select('vendedor_id')
            .eq('id', contratoId)
            .maybeSingle();

          if (contrato?.vendedor_id) {
            // Get configured points for reativação
            const { data: paramPontos } = await supabase
              .from('comissoes_parametros')
              .select('valor')
              .eq('chave', 'pontos_reativacao')
              .eq('ativo', true)
              .maybeSingle();

            const pontos = paramPontos ? parseFloat(paramPontos.valor) : 5;

            await supabase.from('pontuacao_eventos').insert({
              vendedor_id: contrato.vendedor_id,
              tipo_operacao: 'reativacao_nova_adesao',
              pontos,
              contrato_id: contratoId,
              referencia_tipo: 'reativacao',
              referencia_id: associadoId,
            });
          }
        }
      } else {
        // Paths 1 & 2: register history with path info
        await supabase.from('associados_historico').insert({
          associado_id: associadoId,
          tipo: 'status_alterado',
          descricao: `Reativação via ${CAMINHO_LABELS[caminho]} (${dias} dias de inadimplência)`,
          dados_anteriores: { caminho, diasAtraso: dias },
          dados_novos: { status: 'ativo' },
        });
      }

      // Reactivate
      reativarAssociado(associadoId);
      toast.success('Reativação concluída com sucesso!');
      onOpenChange(false);
      resetState();
    } catch (err: any) {
      toast.error(`Erro na reativação: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetState = () => {
    setCurrentStep(0);
    setStepsCompleted({});
  };

  const handleClose = (val: boolean) => {
    if (!val) resetState();
    onOpenChange(val);
  };

  const renderStepContent = (stepIndex: number) => {
    const done = stepsCompleted[stepIndex];

    // Caminho 1, step 0 / Caminho 2, step 0 / Caminho 3, step 0
    if (stepIndex === 0) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {caminho === 3
              ? 'Confirme que todos os débitos em aberto foram quitados antes de prosseguir.'
              : 'Confirme que o boleto em aberto foi pago ou regularizado.'}
          </p>
          <Button
            onClick={() => markStepComplete(0)}
            disabled={done}
            className="w-full"
            variant={done ? 'outline' : 'default'}
          >
            {done ? <><CheckCircle className="h-4 w-4 mr-2" /> Pagamento Confirmado</> : 'Confirmar Pagamento'}
          </Button>
        </div>
      );
    }

    // Caminho 2, step 1
    if (caminho === 2 && stepIndex === 1) {
      return (
        <div className="space-y-3">
          <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-800 dark:text-blue-300">
              A revistoria pode ser feita pelo app do associado sem custo adicional.
            </AlertDescription>
          </Alert>
          <p className="text-sm text-muted-foreground">
            Confirme que a revistoria foi realizada ou agendada.
          </p>
          <Button
            onClick={() => markStepComplete(1)}
            disabled={done}
            className="w-full"
            variant={done ? 'outline' : 'default'}
          >
            {done ? <><CheckCircle className="h-4 w-4 mr-2" /> Revistoria Confirmada</> : 'Confirmar Revistoria'}
          </Button>
        </div>
      );
    }

    // Caminho 3, step 1 - Nova taxa de adesão
    if (caminho === 3 && stepIndex === 1) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Confirme que a nova taxa de adesão foi paga.
          </p>
          <Button
            onClick={() => markStepComplete(1)}
            disabled={done}
            className="w-full"
            variant={done ? 'outline' : 'default'}
          >
            {done ? <><CheckCircle className="h-4 w-4 mr-2" /> Adesão Confirmada</> : 'Confirmar Adesão'}
          </Button>
        </div>
      );
    }

    // Caminho 3, step 2 - Nova vistoria
    if (caminho === 3 && stepIndex === 2) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Confirme que a nova vistoria do veículo foi realizada.
          </p>
          <Button
            onClick={() => markStepComplete(2)}
            disabled={done}
            className="w-full"
            variant={done ? 'outline' : 'default'}
          >
            {done ? <><CheckCircle className="h-4 w-4 mr-2" /> Vistoria Confirmada</> : 'Confirmar Vistoria'}
          </Button>
        </div>
      );
    }

    // Caminho 3, step 3 - Rastreador
    if (caminho === 3 && stepIndex === 3) {
      return (
        <div className="space-y-3">
          {!situacao.pendenciaRastreador ? (
            <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-sm text-emerald-800 dark:text-emerald-300">
                Sem pendência de rastreador identificada. Esta etapa pode ser confirmada diretamente.
              </AlertDescription>
            </Alert>
          ) : (
            <p className="text-sm text-muted-foreground">
              Confirme que o novo rastreador foi instalado no veículo.
            </p>
          )}
          <Button
            onClick={() => markStepComplete(3)}
            disabled={done}
            className="w-full"
            variant={done ? 'outline' : 'default'}
          >
            {done ? <><CheckCircle className="h-4 w-4 mr-2" /> Instalação Confirmada</> : 'Confirmar Instalação'}
          </Button>
        </div>
      );
    }

    return null;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" /> Reativar Associado
          </DialogTitle>
          <DialogDescription>
            Wizard de reativação baseado nos prazos configurados.
          </DialogDescription>
        </DialogHeader>

        {/* Situation banner */}
        <Alert className={caminho === 1
          ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
          : caminho === 2
            ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
            : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
        }>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm space-y-1">
            <p><strong>Inadimplente há {dias} dias</strong></p>
            <p className="text-xs text-muted-foreground">
              Prazo sem revistoria: {prazoSemRevistoria} dias · Prazo nova adesão: {prazoNovaAdesao} dias
            </p>
            <Badge className={CAMINHO_COLORS[caminho]}>
              Caminho: {CAMINHO_LABELS[caminho]}
            </Badge>
          </AlertDescription>
        </Alert>

        {/* Steps progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Etapa {Math.min(currentStep + 1, totalSteps)} de {totalSteps}</span>
            <span>{Object.keys(stepsCompleted).length}/{totalSteps} concluídas</span>
          </div>
          <Progress value={(Object.keys(stepsCompleted).length / totalSteps) * 100} className="h-2" />
        </div>

        {/* Steps list */}
        <div className="space-y-3">
          {steps.map((step, idx) => {
            const done = stepsCompleted[idx];
            const isCurrent = idx === currentStep;
            const StepIcon = step.icon;

            return (
              <Card key={idx} className={
                done
                  ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20'
                  : isCurrent
                    ? 'border-primary/50 bg-primary/5'
                    : 'opacity-50'
              }>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      done
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400'
                        : isCurrent
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                    }`}>
                      {done ? <CheckCircle className="h-4 w-4" /> : idx + 1}
                    </div>
                    <div className="flex items-center gap-2">
                      <StepIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{step.title}</span>
                    </div>
                  </div>
                  {isCurrent && !done && renderStepContent(idx)}
                  {done && idx < totalSteps - 1 && !stepsCompleted[idx + 1] && idx === currentStep - 1 && null}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Separator />

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleFinalizar}
            disabled={!allDone || isProcessing || isReativando}
          >
            {(isProcessing || isReativando) ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4 mr-2" />
            )}
            Finalizar Reativação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

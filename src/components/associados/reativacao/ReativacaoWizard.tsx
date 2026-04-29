import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  CheckCircle, AlertTriangle, Info, Loader2, CreditCard,
  Camera, Radio, FileCheck, ArrowRight, Shield, CalendarClock,
} from 'lucide-react';
import { useInadimplenciaPrazos, useCarenciaDiasPadrao, useCarenciaVidrosDias } from '@/hooks/useConteudosSistema';
import { useAssociadoActions } from '@/hooks/useAssociados';
import { useLiberarAutoVistoria } from '@/hooks/useLiberacoesAutoVistoria';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { TablesUpdate } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import type { SituacaoAssociado } from '@/hooks/useAssociadoSituacao';

interface ReativacaoWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  associadoId: string;
  contratoId: string | undefined;
  situacao: SituacaoAssociado;
}

type Caminho = 1 | 2 | 3 | 4;

const CAMINHO_LABELS: Record<Caminho, string> = {
  1: 'Pagamento Simples',
  2: 'Pagamento + Revistoria',
  3: 'Nova Adesão Completa',
  4: 'Liberar Reagendamento de Instalação',
};

const CAMINHO_COLORS: Record<Caminho, string> = {
  1: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  2: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  3: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  4: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

export function ReativacaoWizard({
  open, onOpenChange, associadoId, contratoId, situacao,
}: ReativacaoWizardProps) {
  const { data: prazos } = useInadimplenciaPrazos();
  const { data: carenciaDiasPadrao } = useCarenciaDiasPadrao();
  const { data: carenciaVidrosDias } = useCarenciaVidrosDias();
  const { reativarAssociado, isReativando } = useAssociadoActions();
  const liberarAutoVistoria = useLiberarAutoVistoria();
  const { user } = useAuth();

  // Steps tracking
  const [currentStep, setCurrentStep] = useState(0);
  const [stepsCompleted, setStepsCompleted] = useState<Record<number, boolean>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [motivoLiberacao, setMotivoLiberacao] = useState('');

  const prazoSemRevistoria = prazos?.prazoSemRevistoria ?? 30;
  const prazoNovaAdesao = prazos?.prazoNovaAdesao ?? 180;
  const dias = situacao.diasAtraso;

  // Detectar suspensão por instalação fora do prazo.
  // Regra: se o veículo do contrato está com cobertura suspensa e NÃO existe instalação
  // concluída/dispensada, tratamos como caminho 4 — independente do texto exato do motivo
  // (cobre suspensão automática do cron, suspensão manual do analista e motivos legados).
  const { data: suspensaoInstalacao } = useQuery({
    queryKey: ['suspensao-instalacao-veiculo', contratoId],
    queryFn: async () => {
      if (!contratoId) return null;
      const { data: contrato } = await supabase
        .from('contratos')
        .select('veiculo_id, liberado_reagendamento_em')
        .eq('id', contratoId)
        .maybeSingle();
      if (!contrato?.veiculo_id) return null;
      // Se já foi liberado, não está mais nesse caminho
      if (contrato.liberado_reagendamento_em) return null;

      const { data: v } = await supabase
        .from('veiculos')
        .select('cobertura_suspensa, cobertura_suspensa_motivo, cobertura_suspensa_em')
        .eq('id', contrato.veiculo_id)
        .maybeSingle();

      if (!v?.cobertura_suspensa) return null;

      // Verificar se já existe instalação concluída/dispensada para este contrato
      const { data: instalacaoConcluida } = await supabase
        .from('instalacoes')
        .select('id')
        .eq('contrato_id', contratoId)
        .or('status.eq.concluida,concluida_em.not.is.null,dispensa_rastreador.eq.true')
        .limit(1);
      if ((instalacaoConcluida?.length ?? 0) > 0) return null;

      // Heurística adicional: se o motivo casa com prefixo conhecido OU se simplesmente não
      // há instalação concluída + cobertura suspensa, tratamos como caminho 4.
      const motivo = (v.cobertura_suspensa_motivo || '').toLowerCase();
      const motivoCasaPadrao =
        motivo.startsWith('instalação não realizada') ||
        motivo.startsWith('instalacao nao realizada') ||
        motivo.includes('auto-vistoria sem instalação') ||
        motivo.includes('autovistoria sem instalação') ||
        /instala[cç][aã]o.*(prazo|n[aã]o realizada|fora do prazo)/i.test(v.cobertura_suspensa_motivo || '');

      // Se motivo não bate o padrão, ainda assim aceitamos como caminho 4 (sem instalação concluída
      // + cobertura suspensa = bloqueio operacional resolvido só pela instalação).
      const susEm = v.cobertura_suspensa_em ? new Date(v.cobertura_suspensa_em) : new Date();
      const diasSuspenso = Math.max(0, Math.floor((Date.now() - susEm.getTime()) / (1000 * 60 * 60 * 24)));

      return {
        motivo: v.cobertura_suspensa_motivo || 'Cobertura suspensa (instalação pendente)',
        diasSuspenso,
        suspensaEm: v.cobertura_suspensa_em,
        motivoCasaPadrao,
      };
    },
    enabled: !!contratoId && open,
  });

  // Determinar caminho:
  // - Caminho 4 (suspensão por instalação) tem PRIORIDADE: pagar boleto não devolve cobertura
  //   suspensa por não-instalação — só a instalação devolve.
  // - Sem suspensão de instalação → caminhos 1/2/3 conforme dias de atraso.
  const caminho: Caminho = (() => {
    if (suspensaoInstalacao) return 4;
    if (dias <= prazoSemRevistoria) return 1;
    if (dias <= prazoNovaAdesao) return 2;
    return 3;
  })();

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
    4: [
      { title: 'Liberar Reagendamento', icon: CalendarClock },
    ],
  };

  const steps = stepsForPath[caminho];
  const totalSteps = steps.length;
  const allDone = Object.keys(stepsCompleted).length === totalSteps;

  // Reset steps quando o caminho muda (ex.: query de suspensão chega depois)
  useEffect(() => {
    setCurrentStep(0);
    setStepsCompleted({});
  }, [caminho]);

  const markStepComplete = (step: number) => {
    setStepsCompleted(prev => ({ ...prev, [step]: true }));
    if (step < totalSteps - 1) {
      setCurrentStep(step + 1);
    }
  };

  const handleLiberarReagendamento = async () => {
    if (!contratoId) {
      toast.error('Contrato não identificado.');
      return;
    }
    try {
      await liberarAutoVistoria.mutateAsync({
        contrato_ids: [contratoId],
        motivo: motivoLiberacao.trim() || undefined,
      });
      markStepComplete(0);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao liberar reagendamento');
    }
  };

  const handleFinalizar = async () => {
    setIsProcessing(true);
    try {
      // Caminho 4: a edge function já reativou cobertura, contrato e disparou WhatsApp.
      // Aqui só registramos o histórico e fechamos. Não chamar reativarAssociado porque
      // o associado pode continuar 'aguardando_instalacao' até concluir a nova instalação.
      if (caminho === 4) {
        await supabase.from('associados_historico').insert({
          associado_id: associadoId,
          tipo: 'status_alterado',
          descricao: `Reagendamento liberado após suspensão por instalação fora do prazo${motivoLiberacao ? ` — ${motivoLiberacao}` : ''}`,
          dados_anteriores: { caminho: 4, motivo_suspensao: suspensaoInstalacao?.motivo, dias_suspenso: suspensaoInstalacao?.diasSuspenso },
          dados_novos: { liberado_reagendamento: true },
        });
        toast.success('Reagendamento liberado. Associado notificado por WhatsApp.');
        onOpenChange(false);
        resetState();
        return;
      }

      if (caminho === 3) {
        // Register as nova adesão + pontuação
        await supabase.from('associados_historico').insert({
          associado_id: associadoId,
          tipo: 'status_alterado',
          descricao: `Reativação via nova adesão completa (${dias} dias de inadimplência)`,
          dados_anteriores: { caminho: 3, diasAtraso: dias },
          dados_novos: { status: 'ativo', tipo: 'nova_adesao' },
        });

        // --- Update contract: tipo_entrada, carência geral e vidros ---
        const hoje = new Date().toISOString().split('T')[0];
        const carenciaGeralDias = carenciaDiasPadrao ?? 120;
        const carenciaVidDias = carenciaVidrosDias ?? 120;
        const fimGeral = new Date();
        fimGeral.setDate(fimGeral.getDate() + carenciaGeralDias);
        const fimVidros = new Date();
        fimVidros.setDate(fimVidros.getDate() + carenciaVidDias);

        const contratoUpdate: TablesUpdate<'contratos'> = {
          tipo_entrada: 'reativacao',
          data_carencia_inicio: hoje,
          data_carencia_fim: fimGeral.toISOString().split('T')[0],
          carencia_isenta: false,
          carencia_motivo_isencao: null,
          data_carencia_vidros_inicio: hoje,
          data_carencia_vidros_fim: fimVidros.toISOString().split('T')[0],
          carencia_vidros_isenta: false,
          carencia_vidros_motivo_isencao: null,
        };

        if (user?.id) {
          contratoUpdate.vendedor_id = user.id;
        }

        if (contratoId) {
          await supabase
            .from('contratos')
            .update(contratoUpdate)
            .eq('id', contratoId);
        } else {
          // Rare case: no contract exists — create one
          await supabase.from('contratos').insert({
            ...contratoUpdate,
            associado_id: associadoId,
            status: 'ativo',
          } as any);
        }

        // Assign points to consultant if available
        if (situacao.consultorNome && contratoId) {
          const { data: contrato } = await supabase
            .from('contratos')
            .select('vendedor_id')
            .eq('id', contratoId)
            .maybeSingle();

          if (contrato?.vendedor_id) {
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
    setMotivoLiberacao('');
  };

  const handleClose = (val: boolean) => {
    if (!val) resetState();
    onOpenChange(val);
  };

  const renderStepContent = (stepIndex: number) => {
    const done = stepsCompleted[stepIndex];

    // Caminho 4 — Liberar Reagendamento
    if (caminho === 4 && stepIndex === 0) {
      return (
        <div className="space-y-3">
          <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-800 dark:text-blue-300">
              A liberação reativa a cobertura do veículo (roubo/furto) e envia ao associado um link no WhatsApp para reagendar a vistoria/instalação. A cobertura total volta ao concluir a instalação.
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <Label htmlFor="motivo-liberacao" className="text-sm">Motivo da liberação (opcional)</Label>
            <Textarea
              id="motivo-liberacao"
              value={motivoLiberacao}
              onChange={(e) => setMotivoLiberacao(e.target.value)}
              placeholder="Ex.: cliente solicitou reagendamento por viagem, atraso justificado..."
              rows={2}
              disabled={done}
            />
          </div>
          <Button
            onClick={handleLiberarReagendamento}
            disabled={done || liberarAutoVistoria.isPending}
            className="w-full"
            variant={done ? 'outline' : 'default'}
          >
            {done ? (
              <><CheckCircle className="h-4 w-4 mr-2" /> Reagendamento Liberado</>
            ) : liberarAutoVistoria.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Liberando...</>
            ) : (
              <><CalendarClock className="h-4 w-4 mr-2" /> Liberar Reagendamento</>
            )}
          </Button>
        </div>
      );
    }

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

  // Banner: caminho 4 tem texto próprio
  const bannerClass = caminho === 4
    ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30'
    : caminho === 1
      ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
      : caminho === 2
        ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
        : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" /> Reativar Associado
          </DialogTitle>
          <DialogDescription>
            {caminho === 4
              ? 'Liberação de reagendamento para suspensão por instalação fora do prazo.'
              : 'Wizard de reativação baseado nos prazos configurados.'}
          </DialogDescription>
        </DialogHeader>

        {/* Situation banner */}
        <Alert className={bannerClass}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm space-y-1">
            {caminho === 4 ? (
              <>
                <p><strong>Cobertura suspensa há {suspensaoInstalacao?.diasSuspenso ?? 0} dias</strong></p>
                <p className="text-xs text-muted-foreground">
                  Motivo: {suspensaoInstalacao?.motivo ?? 'instalação não realizada no prazo'}. Não há débito em aberto.
                </p>
              </>
            ) : (
              <>
                <p><strong>Inadimplente há {dias} dias</strong></p>
                <p className="text-xs text-muted-foreground">
                  Prazo sem revistoria: {prazoSemRevistoria} dias · Prazo nova adesão: {prazoNovaAdesao} dias
                </p>
              </>
            )}
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
            {caminho === 4 ? 'Concluir' : 'Finalizar Reativação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

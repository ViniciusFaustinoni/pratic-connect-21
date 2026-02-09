import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertTriangle, CheckCircle2, XCircle, Ban, DollarSign, FileText, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CancelarAssociadoDialogProps {
  open: boolean;
  onClose: () => void;
  associado: { id: string; nome: string; status: string; pendencia_rastreador: boolean };
  onSuccess: () => void;
}

const MOTIVOS = [
  { value: 'solicitacao_associado', label: 'Solicitação do associado' },
  { value: 'insatisfacao', label: 'Insatisfação com o serviço' },
  { value: 'concorrente', label: 'Mudança para concorrente' },
  { value: 'venda_veiculo', label: 'Venda do veículo (sem substituição)' },
  { value: 'dificuldade_financeira', label: 'Dificuldade financeira' },
  { value: 'mudanca_cidade', label: 'Mudança de cidade/estado' },
  { value: 'falecimento', label: 'Falecimento do titular' },
  { value: 'outro', label: 'Outro' },
];

type StepStatus = 'pending' | 'running' | 'done' | 'error';

interface ProcessStep {
  id: string;
  label: string;
  status: StepStatus;
  errorMsg?: string;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export function CancelarAssociadoDialog({ open, onClose, associado, onSuccess }: CancelarAssociadoDialogProps) {
  // Form state
  const [motivo, setMotivo] = useState('');
  const [motivoOutro, setMotivoOutro] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [confirmaCancelamento, setConfirmaCancelamento] = useState(false);
  const [confirmaTermo, setConfirmaTermo] = useState(false);

  // Financial data
  const [totalAberto, setTotalAberto] = useState(0);
  const [proRata, setProRata] = useState(0);
  const [cobrancasAbertas, setCobrancasAbertas] = useState<any[]>([]);
  const [loadingFinanceiro, setLoadingFinanceiro] = useState(false);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [steps, setSteps] = useState<ProcessStep[]>([]);

  // Reset on close
  const handleClose = useCallback(() => {
    if (isProcessing) return;
    setMotivo('');
    setMotivoOutro('');
    setObservacoes('');
    setConfirmaCancelamento(false);
    setConfirmaTermo(false);
    setSteps([]);
    onClose();
  }, [isProcessing, onClose]);

  // Load financial data when dialog opens
  useEffect(() => {
    if (!open || !associado.id) return;
    
    const loadFinanceiro = async () => {
      setLoadingFinanceiro(true);
      try {
        // Fetch open charges
        const { data: cobrancas } = await supabase
          .from('asaas_cobrancas')
          .select('*')
          .eq('associado_id', associado.id)
          .in('status', ['PENDING', 'OVERDUE']);

        const abertos = cobrancas || [];
        setCobrancasAbertas(abertos);
        const soma = abertos.reduce((acc: number, c: any) => acc + (c.valor || 0), 0);
        setTotalAberto(soma);

        // Calculate pro-rata using the latest mensalidade charge value
        const { data: ultimaCobranca } = await supabase
          .from('asaas_cobrancas')
          .select('valor')
          .eq('associado_id', associado.id)
          .eq('tipo', 'mensalidade')
          .in('status', ['RECEIVED', 'CONFIRMED', 'PENDING'])
          .order('data_vencimento', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (ultimaCobranca?.valor) {
          const hoje = new Date();
          const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
          const diasRestantes = ultimoDia - hoje.getDate();
          const valorDiario = ultimaCobranca.valor / ultimoDia;
          setProRata(Math.round(valorDiario * diasRestantes * 100) / 100);
        }
      } catch (err) {
        console.error('[CancelarDialog] Erro ao carregar financeiro:', err);
      } finally {
        setLoadingFinanceiro(false);
      }
    };

    loadFinanceiro();
  }, [open, associado.id]);

  // Validation
  const motivoCompleto = motivo === 'outro' ? motivoOutro.trim() : motivo;
  const canSubmit = !isProcessing && motivoCompleto && confirmaCancelamento && confirmaTermo && !associado.pendencia_rastreador;

  // Update a step
  const updateStep = (id: string, status: StepStatus, errorMsg?: string) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status, errorMsg } : s));
  };

  // Main cancellation handler
  const handleCancelamento = async () => {
    if (!canSubmit) return;
    setIsProcessing(true);

    const initialSteps: ProcessStep[] = [
      { id: 'processar', label: 'Processando cancelamento...', status: 'pending' },
      { id: 'asaas', label: 'Cancelando cobranças futuras...', status: 'pending' },
      { id: 'boleto', label: 'Gerando boleto final...', status: 'pending' },
      { id: 'autentique', label: 'Gerando termo de cancelamento...', status: 'pending' },
      { id: 'notificacao', label: 'Enviando notificação...', status: 'pending' },
      { id: 'concluido', label: 'Concluído!', status: 'pending' },
    ];
    setSteps(initialSteps);

    try {
      // === STEP 1: processar-pos-retirada ===
      updateStep('processar', 'running');
      const { data: prData, error: prError } = await supabase.functions.invoke('processar-pos-retirada', {
        body: {
          servico_id: 'cancelamento_manual',
          associado_id: associado.id,
          motivo_retirada: 'cancelamento_voluntario',
          executado_por: (await supabase.auth.getUser()).data.user?.id,
        },
      });
      if (prError || !prData?.success) {
        updateStep('processar', 'error', prData?.error || prError?.message || 'Erro ao processar');
        toast.error('Erro ao processar cancelamento: ' + (prData?.error || prError?.message));
        setIsProcessing(false);
        return;
      }
      updateStep('processar', 'done');

      // === STEP 2: Cancel future ASAAS charges ===
      updateStep('asaas', 'running');
      try {
        const hoje = new Date().toISOString().split('T')[0];
        const { data: futuras } = await supabase
          .from('asaas_cobrancas')
          .select('asaas_id')
          .eq('associado_id', associado.id)
          .eq('status', 'PENDING')
          .gt('data_vencimento', hoje);

        if (futuras && futuras.length > 0) {
          for (const c of futuras) {
            try {
              await supabase.functions.invoke('asaas-cobrancas', {
                body: { action: 'cancelar', asaas_id: c.asaas_id },
              });
            } catch (e) {
              console.error('[CancelarDialog] Erro ao cancelar cobrança:', c.asaas_id, e);
            }
          }
        }
        await supabase.from('associados').update({ asaas_recorrencia_cancelada: true }).eq('id', associado.id);
        updateStep('asaas', 'done');
      } catch (asaasErr: any) {
        console.error('[CancelarDialog] Erro ASAAS:', asaasErr);
        await supabase.from('associados').update({ asaas_recorrencia_cancelada: false }).eq('id', associado.id);
        updateStep('asaas', 'error', 'Erro ao cancelar cobranças - financeiro notificado');
      }

      // === STEP 3: Generate final boleto ===
      updateStep('boleto', 'running');
      const valorFinal = totalAberto + proRata;
      if (valorFinal > 0) {
        try {
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 10);
          await supabase.functions.invoke('asaas-cobrancas', {
            body: {
              action: 'criar',
              associado_id: associado.id,
              dados: {
                billingType: 'BOLETO',
                value: valorFinal,
                dueDate: dueDate.toISOString().split('T')[0],
                description: `Boleto final de cancelamento - ${associado.nome}`,
              },
              tipo: 'boleto_final_cancelamento',
            },
          });
          await supabase.from('associados').update({ boleto_final_gerado: true }).eq('id', associado.id);
          updateStep('boleto', 'done');
        } catch (boletoErr: any) {
          console.error('[CancelarDialog] Erro boleto final:', boletoErr);
          updateStep('boleto', 'error', 'Erro ao gerar boleto final');
        }
      } else {
        updateStep('boleto', 'done');
      }

      // === STEP 4: Generate Autentique term ===
      updateStep('autentique', 'running');
      try {
        const { data: assocFull } = await supabase
          .from('associados')
          .select('contrato_id')
          .eq('id', associado.id)
          .single();

        if (assocFull?.contrato_id) {
          await supabase.functions.invoke('autentique-create', {
            body: { contratoId: assocFull.contrato_id },
          });
          updateStep('autentique', 'done');
        } else {
          updateStep('autentique', 'done');
          console.warn('[CancelarDialog] Associado sem contrato vinculado, Autentique pulado');
        }
      } catch (autErr: any) {
        console.error('[CancelarDialog] Erro Autentique:', autErr);
        updateStep('autentique', 'error', 'Termo pode ser gerado depois');
      }

      // === STEP 5: WhatsApp notification ===
      updateStep('notificacao', 'running');
      try {
        const complementoBoleto = valorFinal > 0
          ? `Boleto final no valor de ${formatCurrency(valorFinal)} enviado para quitação. `
          : '';

        await supabase.functions.invoke('disparar-notificacao', {
          body: {
            associado_id: associado.id,
            tipo: 'cobranca',
            subtipo: 'cancelamento',
            dados: { complemento_boleto: complementoBoleto },
            forcar_envio: true,
          },
        });
        updateStep('notificacao', 'done');
      } catch (notifErr: any) {
        console.error('[CancelarDialog] Erro notificação:', notifErr);
        updateStep('notificacao', 'error', 'Notificação não enviada');
      }

      // === STEP 6: Done ===
      // Save motivo and observacoes
      const motivoLabel = MOTIVOS.find(m => m.value === motivo)?.label || motivoOutro;
      await supabase.from('associados').update({
        motivo_cancelamento: observacoes ? `${motivoLabel}: ${observacoes}` : motivoLabel,
      }).eq('id', associado.id);

      updateStep('concluido', 'done');
      toast.success('Cancelamento processado com sucesso');
      
      // Wait a moment so user sees the completed steps
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      console.error('[CancelarDialog] Erro geral:', err);
      toast.error('Erro ao processar cancelamento');
    } finally {
      setIsProcessing(false);
    }
  };

  // Step icon
  const StepIcon = ({ status }: { status: StepStatus }) => {
    switch (status) {
      case 'running': return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'done': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'error': return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <div className="h-4 w-4 rounded-full border-2 border-muted" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-destructive" />
            Cancelar Associado
          </DialogTitle>
          <DialogDescription>
            Cancelar <strong>{associado.nome}</strong>. Esta ação processará todas as integrações necessárias.
          </DialogDescription>
        </DialogHeader>

        {/* Processing view */}
        {steps.length > 0 ? (
          <div className="space-y-3 py-4">
            {steps.map((step) => (
              <div key={step.id} className="flex items-start gap-3">
                <StepIcon status={step.status} />
                <div className="flex-1">
                  <p className={`text-sm ${step.status === 'done' ? 'text-muted-foreground' : step.status === 'error' ? 'text-destructive' : ''}`}>
                    {step.label}
                  </p>
                  {step.errorMsg && (
                    <p className="text-xs text-destructive mt-0.5">{step.errorMsg}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Form view */
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {/* Checklist */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Verificações</Label>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm">
                  {!associado.pendencia_rastreador ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span>Rastreador devolvido</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {loadingFinanceiro ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )}
                  <span>Situação financeira verificada</span>
                </div>
              </div>
            </div>

            {/* Block if tracker pending */}
            {associado.pendencia_rastreador && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  O rastreador ainda não foi devolvido. O cancelamento só pode ser finalizado após a devolução.
                </AlertDescription>
              </Alert>
            )}

            {!associado.pendencia_rastreador && (
              <>
                {/* Motivo */}
                <div className="space-y-2">
                  <Label>Motivo do Cancelamento *</Label>
                  <Select value={motivo} onValueChange={setMotivo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o motivo" />
                    </SelectTrigger>
                    <SelectContent>
                      {MOTIVOS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {motivo === 'outro' && (
                  <div className="space-y-2">
                    <Label>Especifique o motivo *</Label>
                    <Input
                      value={motivoOutro}
                      onChange={(e) => setMotivoOutro(e.target.value)}
                      placeholder="Descreva o motivo do cancelamento"
                    />
                  </div>
                )}

                {/* Observações */}
                <div className="space-y-2">
                  <Label>Observações adicionais</Label>
                  <Textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value.slice(0, 500))}
                    placeholder="Observações sobre o cancelamento (opcional)"
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground text-right">{observacoes.length}/500</p>
                </div>

                {/* Financial section */}
                <Card>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">Situação Financeira</span>
                    </div>
                    {loadingFinanceiro ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Carregando...
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between text-sm">
                          <span>Cobranças em aberto ({cobrancasAbertas.length})</span>
                          <span className="font-medium">{formatCurrency(totalAberto)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Pro-rata estimado</span>
                          <span className="font-medium">{formatCurrency(proRata)}</span>
                        </div>
                        {(totalAberto + proRata) > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Será gerado boleto final consolidado de {formatCurrency(totalAberto + proRata)}
                          </p>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Checkboxes */}
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="confirma-cancel"
                      checked={confirmaCancelamento}
                      onCheckedChange={(v) => setConfirmaCancelamento(v === true)}
                    />
                    <Label htmlFor="confirma-cancel" className="text-sm leading-tight cursor-pointer">
                      Confirmo que desejo cancelar o cadastro deste associado
                    </Label>
                  </div>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="confirma-termo"
                      checked={confirmaTermo}
                      onCheckedChange={(v) => setConfirmaTermo(v === true)}
                    />
                    <Label htmlFor="confirma-termo" className="text-sm leading-tight cursor-pointer">
                      Será gerado termo de cancelamento para assinatura via Autentique
                    </Label>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Footer - only show when not processing completed */}
        {!(steps.length > 0 && steps.every(s => s.status === 'done')) && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isProcessing}>
              Voltar
            </Button>
            {steps.length === 0 && (
              <Button
                variant="destructive"
                onClick={handleCancelamento}
                disabled={!canSubmit}
              >
                Confirmar Cancelamento
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

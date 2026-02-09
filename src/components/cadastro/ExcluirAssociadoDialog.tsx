import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertTriangle, CheckCircle2, XCircle, DollarSign, Shield, Gavel, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================
export type TipoExclusao = 'inadimplencia' | 'exclusao_diretoria' | 'busca_apreensao';

interface ExcluirAssociadoDialogProps {
  open: boolean;
  onClose: () => void;
  associado: { id: string; nome: string; status: string; pendencia_rastreador: boolean };
  tipoExclusao: TipoExclusao;
  onSuccess: () => void;
}

type StepStatus = 'pending' | 'running' | 'done' | 'error';

interface ProcessStep {
  id: string;
  label: string;
  status: StepStatus;
  errorMsg?: string;
}

// ============================================
// CONSTANTS
// ============================================
const TITULOS: Record<TipoExclusao, string> = {
  inadimplencia: 'Excluir por Inadimplência',
  exclusao_diretoria: 'Excluir por Decisão da Diretoria',
  busca_apreensao: 'Registrar Busca e Apreensão',
};

const ICONES: Record<TipoExclusao, typeof DollarSign> = {
  inadimplencia: DollarSign,
  exclusao_diretoria: Gavel,
  busca_apreensao: Shield,
};

const ACOES_COBRANCA = [
  { value: 'regua_cobranca', label: 'Encaminhar para régua de cobrança' },
  { value: 'cobranca_judicial', label: 'Encaminhar para cobrança judicial' },
  { value: 'negativacao', label: 'Encaminhar para negativação (SPC/Serasa)' },
  { value: 'apenas_registrar', label: 'Apenas registrar exclusão' },
];

const FUNDAMENTOS = [
  { value: '3.5.1', label: '3.5.1 - Não colaboração com rastreamento' },
  { value: '3.5.2', label: '3.5.2 - Inadimplência reiterada (2+ fechamentos)' },
  { value: '3.5.3', label: '3.5.3 - Recusa de documentação' },
  { value: '3.5.4', label: '3.5.4 - Atos atentatórios/ofensas' },
  { value: '3.5.5', label: '3.5.5 - Risco à coletividade/má-fé' },
  { value: '3.5.6', label: '3.5.6 - Uso indevido de benefícios' },
  { value: '3.5.7', label: '3.5.7 - Não regularização cadastral' },
  { value: '3.5.8', label: '3.5.8 - Dificuldade de peças' },
  { value: '3.5.9', label: '3.5.9 - Tentativa de fraude' },
  { value: '3.5.10', label: '3.5.10 - Infração obrigações item 6/9' },
  { value: '3.5.11', label: '3.5.11 - Hipóteses item 4.7/7' },
  { value: '3.6.5', label: '3.6.5 - Conduta contrária aos interesses' },
  { value: '3.6.6', label: '3.6.6 - 2+ eventos em 12 meses' },
];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

// ============================================
// COMPONENT
// ============================================
export function ExcluirAssociadoDialog({ open, onClose, associado, tipoExclusao, onSuccess }: ExcluirAssociadoDialogProps) {
  // Shared state
  const [isProcessing, setIsProcessing] = useState(false);
  const [steps, setSteps] = useState<ProcessStep[]>([]);

  // Inadimplência
  const [totalAberto, setTotalAberto] = useState(0);
  const [diasInadimplencia, setDiasInadimplencia] = useState(0);
  const [loadingFinanceiro, setLoadingFinanceiro] = useState(false);
  const [acaoCobranca, setAcaoCobranca] = useState('');
  const [confirmaInadimplencia, setConfirmaInadimplencia] = useState(false);

  // Exclusão diretoria
  const [numeroAta, setNumeroAta] = useState('');
  const [dataDecisao, setDataDecisao] = useState<Date | undefined>();
  const [motivoDiretoria, setMotivoDiretoria] = useState('');
  const [fundamento, setFundamento] = useState('');
  const [confirmaProcesso, setConfirmaProcesso] = useState(false);
  const [confirmaNotificacao, setConfirmaNotificacao] = useState(false);

  // Busca e apreensão
  const [numeroProcesso, setNumeroProcesso] = useState('');
  const [varaTribunal, setVaraTribunal] = useState('');
  const [motivoBusca, setMotivoBusca] = useState('');
  const [encaminharJuridico, setEncaminharJuridico] = useState(false);

  // Reset
  const handleClose = useCallback(() => {
    if (isProcessing) return;
    setAcaoCobranca('');
    setConfirmaInadimplencia(false);
    setNumeroAta('');
    setDataDecisao(undefined);
    setMotivoDiretoria('');
    setFundamento('');
    setConfirmaProcesso(false);
    setConfirmaNotificacao(false);
    setNumeroProcesso('');
    setVaraTribunal('');
    setMotivoBusca('');
    setEncaminharJuridico(false);
    setSteps([]);
    onClose();
  }, [isProcessing, onClose]);

  // Load financial data for inadimplência
  useEffect(() => {
    if (!open || !associado.id || tipoExclusao !== 'inadimplencia') return;

    const load = async () => {
      setLoadingFinanceiro(true);
      try {
        const { data: cobrancas } = await supabase
          .from('asaas_cobrancas')
          .select('valor, data_vencimento, status')
          .eq('associado_id', associado.id)
          .in('status', ['PENDING', 'OVERDUE']);

        const abertos = cobrancas || [];
        setTotalAberto(abertos.reduce((acc, c) => acc + (c.valor || 0), 0));

        // Calculate days from oldest OVERDUE
        const overdues = abertos
          .filter(c => c.status === 'OVERDUE')
          .map(c => new Date(c.data_vencimento).getTime())
          .sort((a, b) => a - b);

        if (overdues.length > 0) {
          const dias = Math.floor((Date.now() - overdues[0]) / (1000 * 60 * 60 * 24));
          setDiasInadimplencia(dias);
        }
      } catch (err) {
        console.error('[ExcluirDialog] Erro financeiro:', err);
      } finally {
        setLoadingFinanceiro(false);
      }
    };
    load();
  }, [open, associado.id, tipoExclusao]);

  // Validation per type
  const canSubmit = (() => {
    if (isProcessing || associado.pendencia_rastreador) return false;
    switch (tipoExclusao) {
      case 'inadimplencia':
        return !!acaoCobranca && confirmaInadimplencia;
      case 'exclusao_diretoria':
        return !!numeroAta && !!dataDecisao && motivoDiretoria.trim().length >= 20 && !!fundamento && confirmaProcesso && confirmaNotificacao;
      case 'busca_apreensao':
        return motivoBusca.trim().length > 0;
      default:
        return false;
    }
  })();

  const updateStep = (id: string, status: StepStatus, errorMsg?: string) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status, errorMsg } : s));
  };

  // Main handler
  const handleExclusao = async () => {
    if (!canSubmit) return;
    setIsProcessing(true);

    const initialSteps: ProcessStep[] = [
      { id: 'processar', label: 'Processando exclusão...', status: 'pending' },
      { id: 'metadata', label: 'Salvando dados adicionais...', status: 'pending' },
      { id: 'notificacao', label: 'Enviando notificação...', status: 'pending' },
      { id: 'concluido', label: 'Concluído!', status: 'pending' },
    ];
    setSteps(initialSteps);

    try {
      // === STEP 1: processar-pos-retirada ===
      updateStep('processar', 'running');
      const { data: prData, error: prError } = await supabase.functions.invoke('processar-pos-retirada', {
        body: {
          servico_id: 'exclusao_manual',
          associado_id: associado.id,
          motivo_retirada: tipoExclusao,
          executado_por: (await supabase.auth.getUser()).data.user?.id,
        },
      });
      if (prError || !prData?.success) {
        updateStep('processar', 'error', prData?.error || prError?.message || 'Erro ao processar');
        toast.error('Erro ao processar: ' + (prData?.error || prError?.message));
        setIsProcessing(false);
        return;
      }
      updateStep('processar', 'done');

      // === STEP 2: Save metadata ===
      updateStep('metadata', 'running');
      try {
        // Get the latest historico record to update metadata
        const { data: ultimoHistorico } = await supabase
          .from('associados_historico')
          .select('id')
          .eq('associado_id', associado.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (ultimoHistorico) {
          let metadata: Record<string, any> = {};

          if (tipoExclusao === 'inadimplencia') {
            metadata = {
              acao_cobranca: acaoCobranca,
              total_aberto: totalAberto,
              dias_inadimplencia: diasInadimplencia,
            };
          } else if (tipoExclusao === 'exclusao_diretoria') {
            metadata = {
              numero_ata: numeroAta,
              data_decisao: dataDecisao ? format(dataDecisao, 'yyyy-MM-dd') : null,
              motivo: motivoDiretoria,
              fundamento,
            };
          } else if (tipoExclusao === 'busca_apreensao') {
            metadata = {
              numero_processo: numeroProcesso || null,
              vara_tribunal: varaTribunal || null,
              motivo: motivoBusca,
              encaminhar_juridico: encaminharJuridico,
            };
          }

          await supabase
            .from('associados_historico')
            .update({ metadata })
            .eq('id', ultimoHistorico.id);
        }
        updateStep('metadata', 'done');
      } catch (metaErr: any) {
        console.error('[ExcluirDialog] Erro metadata:', metaErr);
        updateStep('metadata', 'error', 'Erro ao salvar dados adicionais');
      }

      // === STEP 3: Notification ===
      updateStep('notificacao', 'running');
      try {
        await supabase.functions.invoke('disparar-notificacao', {
          body: {
            associado_id: associado.id,
            tipo: 'cobranca',
            subtipo: tipoExclusao,
            dados: {},
            forcar_envio: true,
          },
        });
        updateStep('notificacao', 'done');
      } catch (notifErr: any) {
        console.error('[ExcluirDialog] Erro notificação:', notifErr);
        updateStep('notificacao', 'error', 'Notificação não enviada');
      }

      // === STEP 4: Done ===
      updateStep('concluido', 'done');
      toast.success(`${TITULOS[tipoExclusao]} processado com sucesso`);

      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      console.error('[ExcluirDialog] Erro geral:', err);
      toast.error('Erro ao processar exclusão');
    } finally {
      setIsProcessing(false);
    }
  };

  const StepIcon = ({ status }: { status: StepStatus }) => {
    switch (status) {
      case 'running': return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'done': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'error': return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <div className="h-4 w-4 rounded-full border-2 border-muted" />;
    }
  };

  const IconeTipo = ICONES[tipoExclusao];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconeTipo className={cn("h-5 w-5", 
              tipoExclusao === 'inadimplencia' && 'text-orange-600',
              tipoExclusao === 'exclusao_diretoria' && 'text-destructive',
              tipoExclusao === 'busca_apreensao' && 'text-red-900',
            )} />
            {TITULOS[tipoExclusao]}
          </DialogTitle>
          <DialogDescription>
            Associado: <strong>{associado.nome}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Processing view */}
        {steps.length > 0 ? (
          <div className="space-y-3 py-4">
            {steps.map((step) => (
              <div key={step.id} className="flex items-start gap-3">
                <StepIcon status={step.status} />
                <div className="flex-1">
                  <p className={cn("text-sm",
                    step.status === 'done' && 'text-muted-foreground',
                    step.status === 'error' && 'text-destructive',
                  )}>
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
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {/* Rastreador check */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Verificações</Label>
              <div className="flex items-center gap-2 text-sm">
                {!associado.pendencia_rastreador ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <span>Rastreador devolvido</span>
              </div>
            </div>

            {associado.pendencia_rastreador && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  O rastreador ainda não foi devolvido. A exclusão só pode ser finalizada após a devolução.
                </AlertDescription>
              </Alert>
            )}

            {!associado.pendencia_rastreador && (
              <>
                {/* === INADIMPLÊNCIA === */}
                {tipoExclusao === 'inadimplencia' && (
                  <>
                    <Card>
                      <CardContent className="pt-4 space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="h-4 w-4 text-orange-600" />
                          <span className="text-sm font-semibold">Situação de Inadimplência</span>
                        </div>
                        {loadingFinanceiro ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" /> Carregando...
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between text-sm">
                              <span>Dias de inadimplência</span>
                              <span className="font-medium text-orange-600">{diasInadimplencia} dias</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Total em aberto</span>
                              <span className="font-medium text-destructive">{formatCurrency(totalAberto)}</span>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>

                    <div className="space-y-2">
                      <Label>Ação de cobrança *</Label>
                      <Select value={acaoCobranca} onValueChange={setAcaoCobranca}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a ação" />
                        </SelectTrigger>
                        <SelectContent>
                          {ACOES_COBRANCA.map((a) => (
                            <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="confirma-inadimplencia"
                        checked={confirmaInadimplencia}
                        onCheckedChange={(c) => setConfirmaInadimplencia(!!c)}
                      />
                      <Label htmlFor="confirma-inadimplencia" className="text-sm leading-tight cursor-pointer">
                        Confirmo a exclusão por inadimplência
                      </Label>
                    </div>
                  </>
                )}

                {/* === EXCLUSÃO DIRETORIA === */}
                {tipoExclusao === 'exclusao_diretoria' && (
                  <>
                    <div className="space-y-2">
                      <Label>Número da Ata *</Label>
                      <Input
                        value={numeroAta}
                        onChange={(e) => setNumeroAta(e.target.value)}
                        placeholder="Ex: ATA-2026/001"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Data da decisão *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn("w-full justify-start text-left font-normal", !dataDecisao && "text-muted-foreground")}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dataDecisao ? format(dataDecisao, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                          <Calendar
                            mode="single"
                            selected={dataDecisao}
                            onSelect={setDataDecisao}
                            locale={ptBR}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label>Motivo da exclusão * <span className="text-xs text-muted-foreground">(mín. 20 caracteres)</span></Label>
                      <Textarea
                        value={motivoDiretoria}
                        onChange={(e) => setMotivoDiretoria(e.target.value)}
                        placeholder="Descreva o motivo da exclusão conforme deliberação da diretoria"
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground text-right">{motivoDiretoria.length} caracteres</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Fundamento regulamentar *</Label>
                      <Select value={fundamento} onValueChange={setFundamento}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o fundamento" />
                        </SelectTrigger>
                        <SelectContent>
                          {FUNDAMENTOS.map((f) => (
                            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <Checkbox
                          id="confirma-processo"
                          checked={confirmaProcesso}
                          onCheckedChange={(c) => setConfirmaProcesso(!!c)}
                        />
                        <Label htmlFor="confirma-processo" className="text-sm leading-tight cursor-pointer">
                          Confirmo que o devido processo administrativo foi realizado (Reg. 3.5)
                        </Label>
                      </div>
                      <div className="flex items-start gap-2">
                        <Checkbox
                          id="confirma-notificacao"
                          checked={confirmaNotificacao}
                          onCheckedChange={(c) => setConfirmaNotificacao(!!c)}
                        />
                        <Label htmlFor="confirma-notificacao" className="text-sm leading-tight cursor-pointer">
                          Confirmo que o associado foi notificado com direito a defesa (Reg. 3.6.1)
                        </Label>
                      </div>
                    </div>
                  </>
                )}

                {/* === BUSCA E APREENSÃO === */}
                {tipoExclusao === 'busca_apreensao' && (
                  <>
                    <div className="space-y-2">
                      <Label>Número do processo</Label>
                      <Input
                        value={numeroProcesso}
                        onChange={(e) => setNumeroProcesso(e.target.value)}
                        placeholder="Ex: 0001234-56.2026.8.13.0001 (opcional)"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Vara/Tribunal</Label>
                      <Input
                        value={varaTribunal}
                        onChange={(e) => setVaraTribunal(e.target.value)}
                        placeholder="Ex: 1ª Vara Cível - Comarca de João Pessoa (opcional)"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Motivo *</Label>
                      <Textarea
                        value={motivoBusca}
                        onChange={(e) => setMotivoBusca(e.target.value)}
                        placeholder="Descreva o motivo da busca e apreensão"
                        rows={3}
                      />
                    </div>

                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="encaminhar-juridico"
                        checked={encaminharJuridico}
                        onCheckedChange={(c) => setEncaminharJuridico(!!c)}
                      />
                      <Label htmlFor="encaminhar-juridico" className="text-sm leading-tight cursor-pointer">
                        Encaminhar para módulo Jurídico
                      </Label>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Footer */}
        {steps.length === 0 && (
          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handleExclusao}
              disabled={!canSubmit}
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar {tipoExclusao === 'busca_apreensao' ? 'Registro' : 'Exclusão'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

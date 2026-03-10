import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, CheckCircle, XCircle, Car, AlertTriangle, Wrench, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { useConfiguracaoNumero } from '@/hooks/useConteudosSistema';

interface Sinistro {
  id: string;
  protocolo: string;
  status: string;
  tipo: string;
  valor_fipe: number | null;
  veiculo_id?: string | null;
  analise_interna?: boolean | null;
  analise_interna_motivos?: string[] | null;
  veiculo?: {
    placa: string;
    marca: string;
    modelo: string;
  } | null;
}

interface EmitirParecerModalProps {
  open: boolean;
  onClose: () => void;
  sinistro: Sinistro | null;
}

const tipoConfig: Record<string, string> = {
  colisao: 'Colisão',
  roubo: 'Roubo',
  furto: 'Furto',
  incendio: 'Incêndio',
  fenomeno_natural: 'Fenômeno Natural',
  vidros: 'Vidros',
  outro: 'Outro',
};

export function EmitirParecerModal({ open, onClose, sinistro }: EmitirParecerModalProps) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const [resultado, setResultado] = useState<'aprovado' | 'negado' | ''>('');
  const [valorAprovado, setValorAprovado] = useState('');
  const [parecer, setParecer] = useState('');
  // Manual override when FIPE is not available
  const [tipoDanoManual, setTipoDanoManual] = useState<'parcial' | 'perda_total' | null>(null);
  const [confirmaBaixaVeiculo, setConfirmaBaixaVeiculo] = useState(false);

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null) return 'N/A';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatCurrencyInput = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    const cents = parseInt(numbers || '0', 10);
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrencyInput(e.target.value);
    setValorAprovado(formatted);
  };

  const { data: limiteDanoParcial = 0.75 } = useConfiguracaoNumero('limite_dano_parcial_fipe', 0.75);

  const getValorNumerico = () => {
    return parseFloat(valorAprovado.replace(/\D/g, '')) / 100 || 0;
  };

  // Classificação automática (quando há FIPE)
  const getClassificacaoAutomatica = (): 'parcial' | 'perda_total' | null => {
    if (resultado !== 'aprovado' || !sinistro?.valor_fipe) return null;
    const valorNumerico = getValorNumerico();
    if (!valorNumerico || valorNumerico <= 0) return null;
    const limite75 = sinistro.valor_fipe * 0.75;
    return valorNumerico >= limite75 ? 'perda_total' : 'parcial';
  };

  // Tipo de dano efetivo: automático se há FIPE, manual caso contrário
  const tipoDanoEfetivo: 'parcial' | 'perda_total' | null = (() => {
    if (resultado !== 'aprovado') return null;
    if (sinistro?.valor_fipe) {
      // Com FIPE: automático baseado no valor digitado
      return getClassificacaoAutomatica();
    }
    // Sem FIPE: manual
    return tipoDanoManual;
  })();

  // Quando resultado muda para aprovado e há valor FIPE, pré-popular valor para perda total
  useEffect(() => {
    if (resultado === 'aprovado' && sinistro?.valor_fipe && !valorAprovado) {
      // não pré-popular: analista deve digitar o valor
    }
    // Reset checkbox quando tipo muda
    if (tipoDanoEfetivo !== 'perda_total') {
      setConfirmaBaixaVeiculo(false);
    }
  }, [tipoDanoEfetivo, resultado]);

  // Pré-popular valor de indenização com FIPE quando classificado como perda total (sem FIPE manual)
  const handleTipoDanoManualChange = (tipo: 'parcial' | 'perda_total') => {
    setTipoDanoManual(tipo);
    setConfirmaBaixaVeiculo(false);
    if (tipo === 'perda_total' && sinistro?.valor_fipe) {
      setValorAprovado(formatCurrencyInput(String(Math.round(sinistro.valor_fipe * 100))));
    } else {
      setValorAprovado('');
    }
  };

  const limite75Fipe = sinistro?.valor_fipe ? sinistro.valor_fipe * 0.75 : null;

  const isFormValid = () => {
    if (!resultado) return false;
    if (parecer.length < 100) return false;

    if (resultado === 'aprovado') {
      const valorNumerico = getValorNumerico();
      if (!valorNumerico || valorNumerico <= 0) return false;

      if (tipoDanoEfetivo === 'perda_total') {
        // Perda total: exige confirmação de baixa
        if (!confirmaBaixaVeiculo) return false;
        // Não pode exceder FIPE se houver
        if (sinistro?.valor_fipe && valorNumerico > sinistro.valor_fipe) return false;
      } else if (tipoDanoEfetivo === 'parcial') {
        // Parcial: valor deve ser < 75% FIPE se houver FIPE
        if (sinistro?.valor_fipe && valorNumerico >= sinistro.valor_fipe * 0.75) return false;
      } else {
        // Sem classificação ainda (sem FIPE e sem seleção manual)
        if (!sinistro?.valor_fipe && !tipoDanoManual) return false;
      }
    }

    return true;
  };

  const handleClose = () => {
    setResultado('');
    setValorAprovado('');
    setParecer('');
    setTipoDanoManual(null);
    setConfirmaBaixaVeiculo(false);
    onClose();
  };

  const parecerMutation = useMutation({
    mutationFn: async () => {
      if (!sinistro) throw new Error('Sinistro não encontrado');

      let novoStatus: string = resultado === 'aprovado' ? 'aprovado' : 'negado';
      const valorIndenizacao = resultado === 'aprovado' ? getValorNumerico() : null;
      
      // Calcular tipo_dano: automático se há FIPE, manual caso contrário
      let tipoDano: 'parcial' | 'perda_total' | null = null;
      if (resultado === 'aprovado' && valorIndenizacao) {
        if (sinistro.valor_fipe) {
          const limite75 = sinistro.valor_fipe * 0.75;
          tipoDano = valorIndenizacao >= limite75 ? 'perda_total' : 'parcial';
        } else {
          tipoDano = tipoDanoManual;
        }
      }

      // Para QUALQUER tipo com perda total aprovada, encaminhar para indenização integral
      if (tipoDano === 'perda_total' && resultado === 'aprovado') {
        novoStatus = 'aguardando_pagamento';
        console.log(`[EmitirParecer] ${sinistro.tipo} perda total → encaminhando para indenização integral`);
      }

      // 1. Atualizar sinistro com parecer
      const { error } = await supabase
        .from('sinistros')
        .update({
          status: novoStatus as any,
          parecer: parecer,
          data_parecer: new Date().toISOString(),
          analista_id: profile?.id,
          valor_indenizacao: valorIndenizacao,
          tipo_dano: tipoDano,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sinistro.id);

      if (error) throw error;

      // 2. Registrar histórico
      await supabase.from('sinistro_historico').insert({
        sinistro_id: sinistro.id,
        status_anterior: sinistro.status,
        status_novo: novoStatus,
        usuario_id: user?.id,
        observacao: `Parecer emitido: ${novoStatus.toUpperCase()}${tipoDano ? ` (${tipoDano === 'perda_total' ? 'Perda Total' : 'Dano Parcial'})` : ''}`,
      });

      // 3. Se perda total, inativar veículo na plataforma e localmente
      if (tipoDano === 'perda_total' && sinistro.veiculo_id) {
        console.log('[EmitirParecer] Perda total detectada, inativando veículo:', sinistro.veiculo_id);
        
        try {
          await supabase.functions.invoke('rede-veiculos-inativar-veiculo', {
            body: {
              veiculoId: sinistro.veiculo_id,
              motivo: 'perda_total',
              observacoes: `Sinistro ${sinistro.protocolo} aprovado como perda total`,
              atualizarBancoLocal: true,
            },
          });
          console.log('[EmitirParecer] Veículo inativado com sucesso');
        } catch (inativarError) {
          console.error('[EmitirParecer] Erro ao inativar veículo:', inativarError);
          await supabase
            .from('veiculos')
            .update({
              ativo: false,
              observacoes: `Baixado por perda total - Sinistro ${sinistro.protocolo}`,
              updated_at: new Date().toISOString(),
            })
            .eq('id', sinistro.veiculo_id);
        }
      }

      // 4. Notificar associado via WhatsApp
      try {
        await supabase.functions.invoke('notificar-sinistro', {
          body: {
            sinistro_id: sinistro.id,
            status: novoStatus,
            dados_extras: {
              valor_indenizacao: valorIndenizacao,
              tipo_dano: tipoDano,
              parecer: parecer.substring(0, 200),
            }
          }
        });
        console.log('[EmitirParecer] Notificação enviada ao associado');
      } catch (notifErr) {
        console.error('[EmitirParecer] Erro ao notificar:', notifErr);
      }

      // 5. Se aprovado, enviar Termo de Entrada de Evento para assinatura via Autentique
      if (resultado === 'aprovado') {
        try {
          console.log('[EmitirParecer] Enviando Termo de Entrada de Evento para assinatura...');
          const { data: termoData, error: termoError } = await supabase.functions.invoke('autentique-evento-create', {
            body: { sinistro_id: sinistro.id },
          });
          if (termoError) {
            console.error('[EmitirParecer] Erro ao criar termo:', termoError);
            toast.warning('Parecer aprovado, mas houve erro ao enviar o termo para assinatura. Tente novamente pela tela do sinistro.');
          } else {
            console.log('[EmitirParecer] ✓ Termo enviado:', termoData);
            toast.success('Termo de Entrada de Evento enviado para assinatura!');
          }
        } catch (termoErr) {
          console.error('[EmitirParecer] Erro ao enviar termo:', termoErr);
          toast.warning('Parecer aprovado, mas não foi possível enviar o termo para assinatura.');
        }
      }
    },
    onSuccess: () => {
      toast.success('Parecer registrado com sucesso!', {
        description: 'O associado foi notificado via WhatsApp.'
      });
      queryClient.invalidateQueries({ queryKey: ['sinistro', sinistro?.id] });
      queryClient.invalidateQueries({ queryKey: ['sinistro-historico', sinistro?.id] });
      queryClient.invalidateQueries({ queryKey: ['sinistros'] });
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      handleClose();
    },
    onError: (error) => {
      console.error('Erro ao registrar parecer:', error);
      toast.error('Erro ao registrar parecer');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) return;
    parecerMutation.mutate();
  };

  if (!sinistro) return null;

  const hasFipe = !!sinistro.valor_fipe;
  const valorNumerico = getValorNumerico();
  const classificacaoAuto = getClassificacaoAutomatica();

  // Label e hint do campo de valor dependem do tipo de dano
  const getValorLabel = () => {
    if (tipoDanoEfetivo === 'perda_total') return 'Valor da Indenização *';
    if (tipoDanoEfetivo === 'parcial') return 'Valor do Reparo (Orçamento) *';
    return 'Valor Aprovado *';
  };

  const getSubmitLabel = () => {
    if (resultado === 'negado') return 'Registrar Recusa';
    if (resultado === 'aprovado') {
      if (tipoDanoEfetivo === 'perda_total') return 'Aprovar – Perda Total';
      if (tipoDanoEfetivo === 'parcial') return 'Aprovar – Dano Parcial';
      return 'Aprovar Sinistro';
    }
    return 'Emitir Parecer';
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Emitir Parecer Técnico</DialogTitle>
          <DialogDescription>Sinistro {sinistro.protocolo}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações do Sinistro */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Protocolo</span>
              <Badge variant="outline">{sinistro.protocolo}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tipo</span>
              <span className="text-sm font-medium">
                {tipoConfig[sinistro.tipo] || sinistro.tipo}
              </span>
            </div>
            {sinistro.veiculo && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Veículo</span>
                <span className="text-sm font-medium flex items-center gap-1">
                  <Car className="h-3.5 w-3.5" />
                  {sinistro.veiculo.placa} - {sinistro.veiculo.marca}/{sinistro.veiculo.modelo}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Valor FIPE</span>
              <span className={cn(
                'text-sm font-semibold',
                hasFipe ? 'text-primary' : 'text-muted-foreground italic'
              )}>
                {hasFipe ? formatCurrency(sinistro.valor_fipe) : 'Não cadastrado'}
              </span>
            </div>
          </div>

          {/* Alerta análise interna (incêndio / fenômeno natural) */}
          {['incendio', 'fenomeno_natural'].includes(sinistro.tipo) && sinistro.analise_interna && (
            <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800 dark:text-amber-300">
                {sinistro.tipo === 'fenomeno_natural' ? 'Sinistro em Análise Jurídica' : 'Sinistro em Análise Interna'}
              </AlertTitle>
              <AlertDescription className="text-amber-700 dark:text-amber-400">
                Motivos: {(sinistro.analise_interna_motivos as string[] || []).map(m => {
                  const labels: Record<string, string> = {
                    gnv_irregular: 'GNV irregular',
                    sobrecarga_eletrica: 'Sobrecarga elétrica',
                    agua_salgada: 'Água salgada (maré/ressaca)',
                    local_inadequado: 'Local inadequado (área notoriamente alagável)',
                  };
                  return labels[m] || m;
                }).join(', ')}
              </AlertDescription>
            </Alert>
          )}

          <Separator />

          {/* Resultado */}
          <div className="space-y-3">
            <Label>Resultado do Parecer *</Label>
            <RadioGroup
              value={resultado}
              onValueChange={(value) => {
                setResultado(value as 'aprovado' | 'negado');
                setValorAprovado('');
                setTipoDanoManual(null);
                setConfirmaBaixaVeiculo(false);
              }}
              className="flex gap-4"
            >
              <div
                className={cn(
                  'flex-1 flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors',
                  resultado === 'aprovado'
                    ? 'border-green-500 bg-green-500/10'
                    : 'hover:bg-muted/50'
                )}
                onClick={() => {
                  setResultado('aprovado');
                  setValorAprovado('');
                  setTipoDanoManual(null);
                  setConfirmaBaixaVeiculo(false);
                }}
              >
                <RadioGroupItem value="aprovado" id="aprovado" />
                <Label htmlFor="aprovado" className="flex items-center gap-2 cursor-pointer">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Aprovado
                </Label>
              </div>
              <div
                className={cn(
                  'flex-1 flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors',
                  resultado === 'negado'
                    ? 'border-destructive bg-destructive/10'
                    : 'hover:bg-muted/50'
                )}
                onClick={() => {
                  setResultado('negado');
                  setValorAprovado('');
                  setTipoDanoManual(null);
                  setConfirmaBaixaVeiculo(false);
                }}
              >
                <RadioGroupItem value="negado" id="negado" />
                <Label htmlFor="negado" className="flex items-center gap-2 cursor-pointer">
                  <XCircle className="h-4 w-4 text-destructive" />
                  Negado
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Seção condicional: APROVADO */}
          {resultado === 'aprovado' && (
            <div className="space-y-4">

              {/* ── COM FIPE: valor + classificação automática ── */}
              {hasFipe && (
                <>
                  {/* Badge de classificação automática (aparece após digitar valor) */}
                  {classificacaoAuto && (
                    <div className={cn(
                      'flex items-center gap-2 rounded-lg border p-3',
                      classificacaoAuto === 'perda_total'
                        ? 'border-destructive/50 bg-destructive/5'
                        : 'border-blue-500/50 bg-blue-500/5'
                    )}>
                      {classificacaoAuto === 'perda_total' ? (
                        <ShieldAlert className="h-4 w-4 text-destructive shrink-0" />
                      ) : (
                        <Wrench className="h-4 w-4 text-blue-600 shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className={cn(
                          'text-xs font-semibold',
                          classificacaoAuto === 'perda_total' ? 'text-destructive' : 'text-blue-700 dark:text-blue-400'
                        )}>
                          Classificação automática: {classificacaoAuto === 'perda_total' ? 'Perda Total' : 'Dano Parcial'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {classificacaoAuto === 'perda_total'
                            ? `Valor ≥ 75% do FIPE (R$ ${limite75Fipe?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`
                            : `Valor < 75% do FIPE (teto: R$ ${limite75Fipe?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`
                          }
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Campo de valor contextualizado */}
                  <div className="space-y-2">
                    <Label htmlFor="valor-aprovado">{getValorLabel()}</Label>
                    <Input
                      id="valor-aprovado"
                      value={valorAprovado}
                      onChange={handleValorChange}
                      placeholder="R$ 0,00"
                    />
                    <p className={cn(
                      'text-xs',
                      tipoDanoEfetivo === 'parcial' && valorNumerico > 0 && valorNumerico >= (limite75Fipe ?? Infinity)
                        ? 'text-destructive'
                        : tipoDanoEfetivo === 'perda_total' && valorNumerico > (sinistro.valor_fipe ?? Infinity)
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                    )}>
                      {tipoDanoEfetivo === 'parcial'
                        ? `Valor do reparo deve ser inferior a ${formatCurrency(limite75Fipe)} (75% do FIPE)`
                        : tipoDanoEfetivo === 'perda_total'
                        ? `Valor da indenização (máx. ${formatCurrency(sinistro.valor_fipe)}). FIPE = referência de base.`
                        : `Valor máximo: ${formatCurrency(sinistro.valor_fipe)}`
                      }
                    </p>
                  </div>

                  {/* Perda Total COM FIPE: banner + checkbox */}
                  {tipoDanoEfetivo === 'perda_total' && (
                    <div className="space-y-3">
                      <Alert className="border-destructive/60 bg-destructive/5">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <AlertTitle className="text-destructive font-semibold">
                          ⚠️ Perda Total Detectada
                        </AlertTitle>
                        <AlertDescription className="text-destructive/80">
                          O veículo será <strong>baixado da plataforma</strong> após a aprovação deste parecer.
                          A indenização integral será processada para pagamento.
                        </AlertDescription>
                      </Alert>

                      {/* Valor FIPE de referência */}
                      <div className="rounded-md border bg-muted/30 p-3 flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Valor FIPE de referência</span>
                        <span className="text-sm font-bold text-primary">{formatCurrency(sinistro.valor_fipe)}</span>
                      </div>

                      <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                        <Checkbox
                          id="confirma-baixa"
                          checked={confirmaBaixaVeiculo}
                          onCheckedChange={(checked) => setConfirmaBaixaVeiculo(!!checked)}
                          className="mt-0.5"
                        />
                        <label htmlFor="confirma-baixa" className="text-sm cursor-pointer leading-snug">
                          <span className="font-semibold text-destructive">Confirmo</span> que o veículo será baixado da plataforma e a indenização integral será processada.
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Dano Parcial COM FIPE: texto informativo */}
                  {tipoDanoEfetivo === 'parcial' && (
                    <div className="flex items-center gap-2 rounded-md border border-blue-500/40 bg-blue-500/5 p-3">
                      <Wrench className="h-4 w-4 text-blue-600 shrink-0" />
                      <p className="text-xs text-blue-700 dark:text-blue-400">
                        O veículo será encaminhado para reparo em oficina parceira.
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* ── SEM FIPE: seleção manual de tipo de dano ── */}
              {!hasFipe && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tipo de Dano *</Label>
                    <p className="text-xs text-muted-foreground">
                      Valor FIPE não cadastrado. Selecione o tipo de dano manualmente.
                    </p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => handleTipoDanoManualChange('parcial')}
                        className={cn(
                          'flex-1 flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors cursor-pointer',
                          tipoDanoManual === 'parcial'
                            ? 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-400'
                            : 'border-border hover:bg-muted/50 text-foreground'
                        )}
                      >
                        <Wrench className="h-4 w-4" />
                        🔧 Dano Parcial
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTipoDanoManualChange('perda_total')}
                        className={cn(
                          'flex-1 flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors cursor-pointer',
                          tipoDanoManual === 'perda_total'
                            ? 'border-destructive bg-destructive/10 text-destructive'
                            : 'border-border hover:bg-muted/50 text-foreground'
                        )}
                      >
                        <ShieldAlert className="h-4 w-4" />
                        ⚠️ Perda Total
                      </button>
                    </div>
                  </div>

                  {/* Campo de valor (aparece após selecionar tipo) */}
                  {tipoDanoManual && (
                    <div className="space-y-2">
                      <Label htmlFor="valor-aprovado">{getValorLabel()}</Label>
                      <Input
                        id="valor-aprovado"
                        value={valorAprovado}
                        onChange={handleValorChange}
                        placeholder="R$ 0,00"
                      />
                    </div>
                  )}

                  {/* Perda Total SEM FIPE: banner + checkbox */}
                  {tipoDanoManual === 'perda_total' && (
                    <div className="space-y-3">
                      <Alert className="border-destructive/60 bg-destructive/5">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <AlertTitle className="text-destructive font-semibold">
                          ⚠️ Perda Total
                        </AlertTitle>
                        <AlertDescription className="text-destructive/80">
                          O veículo será <strong>baixado da plataforma</strong> após a aprovação deste parecer.
                          A indenização integral será processada para pagamento.
                        </AlertDescription>
                      </Alert>

                      <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                        <Checkbox
                          id="confirma-baixa-manual"
                          checked={confirmaBaixaVeiculo}
                          onCheckedChange={(checked) => setConfirmaBaixaVeiculo(!!checked)}
                          className="mt-0.5"
                        />
                        <label htmlFor="confirma-baixa-manual" className="text-sm cursor-pointer leading-snug">
                          <span className="font-semibold text-destructive">Confirmo</span> que o veículo será baixado da plataforma e a indenização integral será processada.
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Dano Parcial SEM FIPE: texto informativo */}
                  {tipoDanoManual === 'parcial' && (
                    <div className="flex items-center gap-2 rounded-md border border-blue-500/40 bg-blue-500/5 p-3">
                      <Wrench className="h-4 w-4 text-blue-600 shrink-0" />
                      <p className="text-xs text-blue-700 dark:text-blue-400">
                        O veículo será encaminhado para reparo em oficina parceira.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Parecer Técnico */}
          <div className="space-y-2">
            <Label htmlFor="parecer">Parecer Técnico *</Label>
            <Textarea
              id="parecer"
              value={parecer}
              onChange={(e) => setParecer(e.target.value)}
              placeholder="Descreva o parecer técnico detalhadamente..."
              rows={5}
            />
            <p className={cn(
              'text-xs',
              parecer.length < 100 ? 'text-muted-foreground' : 'text-green-600'
            )}>
              {parecer.length}/100 caracteres mínimos
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={parecerMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!isFormValid() || parecerMutation.isPending}
              className={cn(
                resultado === 'aprovado' && tipoDanoEfetivo !== 'perda_total' && 'bg-green-600 hover:bg-green-700',
                resultado === 'aprovado' && tipoDanoEfetivo === 'perda_total' && 'bg-destructive hover:bg-destructive/90',
                resultado === 'negado' && 'bg-destructive hover:bg-destructive/90'
              )}
            >
              {parecerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {getSubmitLabel()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

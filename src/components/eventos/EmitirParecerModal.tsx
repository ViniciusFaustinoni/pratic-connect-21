import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, CheckCircle, XCircle, Car, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
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

  const getValorNumerico = () => {
    return parseFloat(valorAprovado.replace(/\D/g, '')) / 100 || 0;
  };

  const isFormValid = () => {
    if (!resultado) return false;
    if (parecer.length < 100) return false;

    if (resultado === 'aprovado') {
      const valorNumerico = getValorNumerico();
      if (!valorNumerico || valorNumerico <= 0) return false;
      if (sinistro?.valor_fipe && valorNumerico > sinistro.valor_fipe) return false;
    }

    return true;
  };

  const handleClose = () => {
    setResultado('');
    setValorAprovado('');
    setParecer('');
    onClose();
  };

  const parecerMutation = useMutation({
    mutationFn: async () => {
      if (!sinistro) throw new Error('Sinistro não encontrado');

      let novoStatus: string = resultado === 'aprovado' ? 'aprovado' : 'negado';
      const valorIndenizacao = resultado === 'aprovado' ? getValorNumerico() : null;
      
      // Calcular tipo_dano automaticamente baseado na regra 75% FIPE
      let tipoDano: 'parcial' | 'perda_total' | null = null;
      if (resultado === 'aprovado' && valorIndenizacao && sinistro.valor_fipe) {
        const limite75 = sinistro.valor_fipe * 0.75;
        tipoDano = valorIndenizacao >= limite75 ? 'perda_total' : 'parcial';
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
          // Chamar edge function para inativar na Rede Veículos
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
          // Mesmo se falhar na API, atualizar localmente
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
        // Não falhar a operação por erro de notificação
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

  const valorExcedeFipe = resultado === 'aprovado' && sinistro.valor_fipe && getValorNumerico() > sinistro.valor_fipe;
  
  // Preview da classificação automática de tipo de dano
  const getClassificacaoDano = () => {
    if (resultado !== 'aprovado' || !sinistro.valor_fipe) return null;
    const valorNumerico = getValorNumerico();
    if (!valorNumerico || valorNumerico <= 0) return null;
    const limite75 = sinistro.valor_fipe * 0.75;
    return valorNumerico >= limite75 ? 'perda_total' : 'parcial';
  };
  const classificacaoDano = getClassificacaoDano();

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
              <span className="text-sm font-semibold text-primary">
                {formatCurrency(sinistro.valor_fipe)}
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
              onValueChange={(value) => setResultado(value as 'aprovado' | 'negado')}
              className="flex gap-4"
            >
              <div
                className={cn(
                  'flex-1 flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors',
                  resultado === 'aprovado'
                    ? 'border-green-500 bg-green-500/10'
                    : 'hover:bg-muted/50'
                )}
                onClick={() => setResultado('aprovado')}
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
                onClick={() => setResultado('negado')}
              >
                <RadioGroupItem value="negado" id="negado" />
                <Label htmlFor="negado" className="flex items-center gap-2 cursor-pointer">
                  <XCircle className="h-4 w-4 text-destructive" />
                  Negado
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Valor Aprovado (condicional) */}
          {resultado === 'aprovado' && (
            <div className="space-y-2">
              <Label htmlFor="valor-aprovado">Valor Aprovado *</Label>
              <Input
                id="valor-aprovado"
                value={valorAprovado}
                onChange={handleValorChange}
                placeholder="R$ 0,00"
              />
              {sinistro.valor_fipe && (
                <div className="space-y-1">
                  <p className={cn(
                    'text-xs',
                    valorExcedeFipe ? 'text-destructive' : 'text-muted-foreground'
                  )}>
                    {valorExcedeFipe
                      ? `Valor excede o limite FIPE de ${formatCurrency(sinistro.valor_fipe)}`
                      : `Valor máximo: ${formatCurrency(sinistro.valor_fipe)}`}
                  </p>
                  {classificacaoDano && (
                    <div className={cn(
                      'text-xs font-medium flex items-center gap-1 p-2 rounded-md',
                      classificacaoDano === 'perda_total' 
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' 
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                    )}>
                      <span>Classificação automática:</span>
                      <Badge variant="outline" className={cn(
                        classificacaoDano === 'perda_total' 
                          ? 'border-red-500 text-red-700' 
                          : 'border-blue-500 text-blue-700'
                      )}>
                        {classificacaoDano === 'perda_total' ? '⚠️ Perda Total' : '🔧 Dano Parcial'}
                      </Badge>
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
                resultado === 'aprovado' && 'bg-green-600 hover:bg-green-700',
                resultado === 'negado' && 'bg-destructive hover:bg-destructive/90'
              )}
            >
              {parecerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {resultado === 'aprovado' ? 'Aprovar Sinistro' : resultado === 'negado' ? 'Negar Sinistro' : 'Emitir Parecer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

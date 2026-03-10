import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertTriangle,
  User,
  Car,
  Radio,
  Calendar,
  MapPin,
  RefreshCw,
  DollarSign,
  Loader2,
  Scale,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MOTIVO_RETIRADA_LABELS, type MotivoRetirada } from '@/types/retirada';
import { useMultaRastreador } from '@/hooks/useConteudosSistema';
import { AplicarMultaModal } from './AplicarMultaModal';
import { type Servico } from '@/hooks/useServicos';

interface RetiradaData extends Servico {
  motivo_retirada?: MotivoRetirada;
  solicitado_por_modulo?: string;
  cancelamento_bloqueado_ate_devolucao?: boolean;
  rastreador?: {
    id: string;
    codigo: string;
    imei?: string;
    plataforma?: string;
  };
}

interface TratarAusenciaRetiradaModalProps {
  open: boolean;
  onClose: () => void;
  retirada: RetiradaData | null;
}

type AcaoAusencia = 'reagendar' | 'aplicar_multa' | 'escalar';

export function TratarAusenciaRetiradaModal({
  open,
  onClose,
  retirada,
}: TratarAusenciaRetiradaModalProps) {
  const [acao, setAcao] = useState<AcaoAusencia>('reagendar');
  const [observacao, setObservacao] = useState('');
  const [showConfirmacao, setShowConfirmacao] = useState(false);
  const [showMultaModal, setShowMultaModal] = useState(false);

  const queryClient = useQueryClient();

  // Mutation para reagendar
  const reagendarMutation = useMutation({
    mutationFn: async (servicoId: string) => {
      const { error } = await supabase
        .from('servicos')
        .update({
          status: 'pendente',
          data_agendada: null,
          profissional_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', servicoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      toast.success('Retirada enviada para reagendamento');
      handleClose();
    },
    onError: (error) => {
      console.error('Erro ao reagendar:', error);
      toast.error('Erro ao reagendar retirada');
    },
  });

  // Mutation para escalar para diretoria
  const escalarMutation = useMutation({
    mutationFn: async ({ servicoId, observacao }: { servicoId: string; observacao: string }) => {
      const { error } = await supabase
        .from('servicos')
        .update({
          observacoes: observacao ? `[ESCALADO PARA DIRETORIA] ${observacao}` : '[ESCALADO PARA DIRETORIA] Associado não compareceu à retirada agendada',
          updated_at: new Date().toISOString(),
        })
        .eq('id', servicoId);

      if (error) throw error;

      // Aqui poderia criar uma notificação para a diretoria
      // Por enquanto apenas atualizamos o serviço
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      toast.success('Caso escalado para a diretoria');
      handleClose();
    },
    onError: (error) => {
      console.error('Erro ao escalar:', error);
      toast.error('Erro ao escalar para diretoria');
    },
  });

  const isPending = reagendarMutation.isPending || escalarMutation.isPending;

  const handleConfirmar = async () => {
    if (!retirada) return;

    if (acao === 'reagendar') {
      await reagendarMutation.mutateAsync(retirada.id);
    } else if (acao === 'aplicar_multa') {
      // Abrir modal de multa
      setShowMultaModal(true);
    } else if (acao === 'escalar') {
      setShowConfirmacao(true);
    }
  };

  const handleConfirmarEscalacao = async () => {
    if (!retirada) return;
    await escalarMutation.mutateAsync({
      servicoId: retirada.id,
      observacao,
    });
    setShowConfirmacao(false);
  };

  const handleClose = () => {
    setAcao('reagendar');
    setObservacao('');
    setShowConfirmacao(false);
    setShowMultaModal(false);
    onClose();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) handleClose();
  };

  if (!retirada) return null;

  return (
    <>
      <Dialog open={open && !showMultaModal} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              Associado Não Compareceu
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Alerta */}
            <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-700 dark:text-orange-300">
                O associado não compareceu à retirada de rastreador agendada.
                Prazo de 48h para comparecimento foi excedido.
              </AlertDescription>
            </Alert>

            {/* Info do serviço */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{retirada.associado?.nome || '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Car className="h-4 w-4 text-muted-foreground" />
                <span>
                  {retirada.veiculo?.marca} {retirada.veiculo?.modelo} • {retirada.veiculo?.placa}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono">{retirada.rastreador?.codigo || '-'}</span>
              </div>
              {retirada.data_agendada && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {format(new Date(retirada.data_agendada), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
              )}
              {retirada.motivo_retirada && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{MOTIVO_RETIRADA_LABELS[retirada.motivo_retirada]}</span>
                </div>
              )}
            </div>

            {/* Seleção de ação */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">O que deseja fazer?</Label>
              <RadioGroup
                value={acao}
                onValueChange={(v) => setAcao(v as AcaoAusencia)}
                className="space-y-3"
              >
                {/* Reagendar */}
                <div
                  className={`flex items-start space-x-3 p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                    acao === 'reagendar' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' : 'border-border'
                  }`}
                  onClick={() => setAcao('reagendar')}
                >
                  <RadioGroupItem value="reagendar" id="reagendar" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="reagendar" className="font-medium cursor-pointer flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-blue-600" />
                      Reagendar Retirada
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Retorna para fila de pendentes para novo agendamento
                    </p>
                  </div>
                </div>

                {/* Aplicar Multa */}
                <div
                  className={`flex items-start space-x-3 p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                    acao === 'aplicar_multa' ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : 'border-border'
                  }`}
                  onClick={() => setAcao('aplicar_multa')}
                >
                  <RadioGroupItem value="aplicar_multa" id="aplicar_multa" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="aplicar_multa" className="font-medium cursor-pointer flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-red-600" />
                      Aplicar Multa R$ {multaValor.toFixed(2)}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Multa por não comparecimento conforme regulamento
                    </p>
                  </div>
                </div>

                {/* Escalar */}
                <div
                  className={`flex items-start space-x-3 p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                    acao === 'escalar' ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20' : 'border-border'
                  }`}
                  onClick={() => setAcao('escalar')}
                >
                  <RadioGroupItem value="escalar" id="escalar" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="escalar" className="font-medium cursor-pointer flex items-center gap-2">
                      <Scale className="h-4 w-4 text-amber-600" />
                      Escalar para Diretoria
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Encaminhar caso para análise da diretoria/jurídico
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Observação */}
            <div className="space-y-2">
              <Label className="text-sm">Observação</Label>
              <Textarea
                placeholder="Observação opcional..."
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isPending}
              className="flex-1"
            >
              Voltar
            </Button>
            <Button
              onClick={handleConfirmar}
              disabled={isPending}
              variant={acao === 'aplicar_multa' ? 'destructive' : 'default'}
              className="flex-1"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Confirmar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmação para escalação */}
      <AlertDialog open={showConfirmacao} onOpenChange={setShowConfirmacao}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <Scale className="h-5 w-5" />
              Confirmar Escalação?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O caso será encaminhado para análise da diretoria/departamento jurídico.
              <br /><br />
              A diretoria poderá decidir sobre ações adicionais como bloqueio judicial,
              acionamento de seguro ou outras medidas cabíveis.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={escalarMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarEscalacao}
              disabled={escalarMutation.isPending}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {escalarMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Sim, escalar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de multa */}
      {retirada && (
        <AplicarMultaModal
          open={showMultaModal}
          onOpenChange={(open) => {
            setShowMultaModal(open);
            if (!open) handleClose();
          }}
          retirada={{
            id: retirada.id,
            associado: retirada.associado ? {
              nome: retirada.associado.nome,
              cpf: retirada.associado.cpf || '',
            } : null,
            rastreador: retirada.rastreador ? {
              codigo: retirada.rastreador.codigo,
            } : null,
            integridade: null,
          }}
          motivoPreSelecionado="nao_compareceu"
        />
      )}
    </>
  );
}

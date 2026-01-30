import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, FileSignature, Send } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PRAZOS_SINISTRO, VALORES_SINISTRO } from '@/types/sinistros';

interface GerarTermoAnuenciaDialogProps {
  open: boolean;
  onClose: () => void;
  sinistroId: string;
  protocolo: string;
  valorOrcamento?: number;
  valorCota?: number;
  onSuccess?: () => void;
}

export function GerarTermoAnuenciaDialog({
  open,
  onClose,
  sinistroId,
  protocolo,
  valorOrcamento = 0,
  valorCota = VALORES_SINISTRO.cota_participacao_padrao,
  onSuccess,
}: GerarTermoAnuenciaDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [enviarWhatsApp, setEnviarWhatsApp] = useState(true);
  const [prazoAssinatura, setPrazoAssinatura] = useState(
    format(addDays(new Date(), PRAZOS_SINISTRO.termo_pendente), 'yyyy-MM-dd')
  );

  const gerarMutation = useMutation({
    mutationFn: async () => {
      // 1. Atualizar sinistro para aguardando_termo
      const { error: updateError } = await supabase
        .from('sinistros')
        .update({
          status: 'aguardando_termo' as any,
          valor_cota_participacao: valorCota,
          data_prazo_termo: prazoAssinatura,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sinistroId);

      if (updateError) throw updateError;

      // 2. Registrar histórico
      const { error: histError } = await supabase
        .from('sinistro_historico')
        .insert({
          sinistro_id: sinistroId,
          status_novo: 'aguardando_termo',
          usuario_id: user?.id,
          observacao: `Termo de anuência gerado. Valor orçamento: R$ ${valorOrcamento.toFixed(2)}. Cota: R$ ${valorCota.toFixed(2)}. Prazo: ${format(new Date(prazoAssinatura), 'dd/MM/yyyy')}`,
        });

      if (histError) throw histError;

      // 3. Notificar via WhatsApp
      if (enviarWhatsApp) {
        try {
          await supabase.functions.invoke('notificar-sinistro', {
            body: {
              sinistro_id: sinistroId,
              status: 'aguardando_termo',
              dados_extras: {
                valor_orcamento: valorOrcamento,
                valor_cota: valorCota,
                prazo: format(new Date(prazoAssinatura), 'dd/MM/yyyy'),
              },
            },
          });
        } catch (err) {
          console.error('Erro ao notificar:', err);
        }
      }
    },
    onSuccess: () => {
      toast.success('Termo de anuência gerado!', {
        description: enviarWhatsApp ? 'Associado foi notificado via WhatsApp' : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['sinistro', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistro-analise', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistros'] });
      handleClose();
      onSuccess?.();
    },
    onError: (error) => {
      console.error('Erro ao gerar termo:', error);
      toast.error('Erro ao gerar termo de anuência');
    },
  });

  const handleClose = () => {
    setEnviarWhatsApp(true);
    setPrazoAssinatura(format(addDays(new Date(), PRAZOS_SINISTRO.termo_pendente), 'yyyy-MM-dd'));
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-sky-600" />
            Gerar Termo de Anuência
          </DialogTitle>
          <DialogDescription>
            Sinistro {protocolo}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Resumo de Valores */}
          <div className="p-4 rounded-lg bg-muted space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor do Orçamento:</span>
              <span className="font-medium">R$ {valorOrcamento.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cota de Participação:</span>
              <span className="font-medium text-amber-600">R$ {valorCota.toFixed(2)}</span>
            </div>
          </div>

          {/* Prazo */}
          <div className="space-y-2">
            <Label htmlFor="prazo">Prazo para Assinatura</Label>
            <Input
              id="prazo"
              type="date"
              value={prazoAssinatura}
              onChange={(e) => setPrazoAssinatura(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
            />
            <p className="text-xs text-muted-foreground">
              Após {PRAZOS_SINISTRO.termo_pendente} dias sem assinatura, o sinistro será cancelado automaticamente.
            </p>
          </div>

          {/* Enviar WhatsApp */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="enviar-whatsapp"
              checked={enviarWhatsApp}
              onCheckedChange={(checked) => setEnviarWhatsApp(checked as boolean)}
            />
            <Label htmlFor="enviar-whatsapp" className="font-normal flex items-center gap-1">
              <Send className="h-4 w-4" />
              Enviar notificação via WhatsApp
            </Label>
          </div>

          {/* Informativo */}
          <div className="p-3 rounded-md bg-sky-50 border border-sky-200">
            <p className="text-sm text-sky-800">
              📝 O termo de anuência será gerado e o associado receberá instruções para assinar.
              Após assinatura, será cobrada a cota de participação.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={gerarMutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => gerarMutation.mutate()}
            disabled={gerarMutation.isPending}
            className="bg-sky-600 hover:bg-sky-700"
          >
            {gerarMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Gerar e Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

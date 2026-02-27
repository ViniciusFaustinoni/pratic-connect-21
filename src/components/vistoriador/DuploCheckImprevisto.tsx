import { useState } from 'react';
import { CheckCircle2, Loader2, MessageCircle, Phone, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface DuploCheckImprevistoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tarefaId: string;
  clienteNome: string;
  clienteTelefone: string;
  clienteWhatsapp?: string | null;
}

export function DuploCheckImprevisto({
  open,
  onOpenChange,
  tarefaId,
  clienteNome,
  clienteTelefone,
  clienteWhatsapp,
}: DuploCheckImprevistoProps) {
  const [contatoFeito, setContatoFeito] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const queryClient = useQueryClient();

  const abrirWhatsApp = () => {
    const numero = clienteWhatsapp || clienteTelefone;
    if (numero) {
      const numeroLimpo = numero.replace(/\D/g, '');
      const mensagem = encodeURIComponent(
        `Olá ${clienteNome?.split(' ')[0] || ''}, infelizmente não foi possível prosseguir com o serviço agendado. ` +
        `Entraremos em contato para reagendar. Obrigado pela compreensão!`
      );
      window.open(`https://wa.me/55${numeroLimpo}?text=${mensagem}`, '_blank');
      setContatoFeito(true);
    }
  };

  const ligar = () => {
    if (clienteTelefone) {
      window.open(`tel:${clienteTelefone}`, '_self');
      setContatoFeito(true);
    }
  };

  const handleConfirmar = async () => {
    setConfirmando(true);
    try {
      // Atualizar duplo check e status
      const { error } = await supabase
        .from('servicos')
        .update({
          imprevisto_duplo_check: true,
          imprevisto_duplo_check_em: new Date().toISOString(),
          status: 'nao_compareceu',
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', tarefaId);

      if (error) throw error;

      // Disparar envio de link de reagendamento
      try {
        await supabase.functions.invoke('enviar-link-reagendamento', {
          body: { servico_id: tarefaId },
        });
      } catch (e) {
        console.warn('Erro ao enviar link de reagendamento (não crítico):', e);
      }

      toast.success('Duplo check confirmado. Link de reagendamento enviado ao associado.');
      onOpenChange(false);
      setContatoFeito(false);
      queryClient.invalidateQueries({ queryKey: ['tarefa-atual'] });
    } catch (error: any) {
      console.error('Erro ao confirmar duplo check:', error);
      toast.error('Erro ao confirmar duplo check');
    } finally {
      setConfirmando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Duplo Check com o Associado
          </DialogTitle>
          <DialogDescription>
            Confirme com o associado que não será possível prosseguir com o serviço. 
            Entre em contato via WhatsApp ou Ligação antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Botões de contato */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={abrirWhatsApp}
              className="gap-2 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Button>
            <Button
              variant="outline"
              onClick={ligar}
              className="gap-2"
            >
              <Phone className="h-4 w-4" />
              Ligar
            </Button>
          </div>

          {/* Status do contato */}
          {contatoFeito && (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-500/10 rounded-md py-2 px-3">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <span>Contato realizado com o associado</span>
            </div>
          )}

          {!contatoFeito && (
            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-md py-2 px-3">
              <MessageCircle className="h-4 w-4 flex-shrink-0" />
              <span>Entre em contato com o associado para habilitar a confirmação</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirmando}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={!contatoFeito || confirmando}
            className="gap-2"
          >
            {confirmando ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Confirmando...</>
            ) : (
              <><CheckCircle2 className="h-4 w-4" /> Confirmar Duplo Check</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

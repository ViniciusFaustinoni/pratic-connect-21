import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [etapa, setEtapa] = useState<'contato' | 'sucesso'>('contato');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setContatoFeito(false);
      setEtapa('contato');
    }
  }, [open]);

  // Transition timer: after success, wait then close and invalidate
  useEffect(() => {
    if (etapa !== 'sucesso') return;

    const buscarProximaTarefa = async () => {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
        );
        await supabase.functions.invoke('atribuir-proxima-tarefa', {
          body: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            acao: 'polling',
          },
        });
      } catch (e) {
        console.warn('Não foi possível buscar próxima tarefa imediatamente:', e);
      }
    };

    buscarProximaTarefa();

    const timer = setTimeout(() => {
      onOpenChange(false);
      // Invalidate all relevant queries to ensure task disappears from installer view
      queryClient.invalidateQueries({ queryKey: ['tarefa-atual'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      queryClient.invalidateQueries({ queryKey: ['servicos-historico'] });
      queryClient.invalidateQueries({ queryKey: ['servico-detalhes'] });
      navigate('/instalador');
    }, 4000);

    return () => clearTimeout(timer);
  }, [etapa, onOpenChange, queryClient, navigate]);

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
      const numeroLimpo = clienteTelefone.replace(/\D/g, '');
      window.location.href = `tel:${numeroLimpo}`;
      setContatoFeito(true);
    }
  };

  const handleConfirmar = async () => {
    setConfirmando(true);
    try {
      const { error } = await supabase
        .from('servicos')
        .update({
          imprevisto_duplo_check: true,
          imprevisto_duplo_check_em: new Date().toISOString(),
          status: 'nao_compareceu',
          profissional_id: null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', tarefaId);

      if (error) throw error;

      // PONTO B: Enviar link de reagendamento (idempotente - não reenvia se já foi)
      supabase.functions.invoke('enviar-link-reagendamento', {
        body: { servico_id: tarefaId },
      }).then(({ error: linkErr }) => {
        if (linkErr) console.warn('[DuploCheck] Erro ao enviar link (Ponto B, não crítico):', linkErr);
        else console.log('[DuploCheck] Link de reagendamento disparado (Ponto B)');
      }).catch(e => console.warn('[DuploCheck] Falha no Ponto B:', e));

      toast.success('Duplo check confirmado.');
      setEtapa('sucesso');
    } catch (error: any) {
      console.error('Erro ao confirmar duplo check:', error);
      toast.error('Erro ao confirmar duplo check');
    } finally {
      setConfirmando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={etapa === 'sucesso' ? undefined : onOpenChange}>
      <DialogContent className={etapa === 'sucesso' ? '[&>button]:hidden' : ''}>
        {etapa === 'contato' ? (
          <>
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
          </>
        ) : (
          /* Etapa de sucesso / transição */
          <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center">
            <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Imprevisto registrado com sucesso</h3>
              <p className="text-sm text-muted-foreground">
                O associado receberá o link de reagendamento.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Buscando próxima tarefa...</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

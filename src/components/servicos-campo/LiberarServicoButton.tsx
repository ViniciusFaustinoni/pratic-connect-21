import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Unlock, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '@/hooks/usePermissions';

interface LiberarServicoButtonProps {
  servicoId: string;
  servicoStatus: string;
  size?: 'sm' | 'default';
  variant?: 'outline' | 'ghost' | 'destructive';
  onLiberado?: () => void;
}

const LIBERAVEL = ['agendada', 'em_rota', 'em_andamento', 'imprevisto_pendente', 'pendente', 'reagendada', 'nao_compareceu', 'em_analise'];

export function LiberarServicoButton({
  servicoId,
  servicoStatus,
  size = 'sm',
  variant = 'outline',
  onLiberado,
}: LiberarServicoButtonProps) {
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);

  // Apenas perfis administrativos
  const podeLiberar =
    permissions.isDiretor ||
    permissions.isAdminMaster ||
    permissions.isDesenvolvedor ||
    permissions.isCoordenadorMonitoramento;

  if (!podeLiberar) return null;
  if (!LIBERAVEL.includes(servicoStatus)) return null;

  const handleConfirm = async () => {
    if (motivo.trim().length < 5) {
      toast.error('Informe um motivo (mínimo 5 caracteres).');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('liberar_servico_admin', {
        _servico_id: servicoId,
        _motivo: motivo.trim(),
      });
      if (error) throw error;
      const fechados = (data as any)?.agendamentos_fechados ?? 0;
      toast.success(
        fechados > 0
          ? `Serviço liberado. Agendamento vinculado também foi fechado.`
          : 'Serviço liberado. Técnico desbloqueado para novas atribuições.'
      );
      setOpen(false);
      setMotivo('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['servicos'] }),
        queryClient.invalidateQueries({ queryKey: ['servicos-campo-unificado'] }),
        queryClient.invalidateQueries({ queryKey: ['atribuicao-manual'] }),
        queryClient.invalidateQueries({ queryKey: ['tecnicos-disponiveis'] }),
        queryClient.invalidateQueries({ queryKey: ['agendamentos-base'] }),
        queryClient.invalidateQueries({ queryKey: ['agendamentos_base'] }),
        queryClient.invalidateQueries({ queryKey: ['monitoramento-mapa'] }),
        queryClient.invalidateQueries({ queryKey: ['mapa-atribuicao'] }),
      ]);
      onLiberado?.();
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      // Mensagens claras vindas do RPC
      toast.error(msg.includes('status terminal') || msg.includes('não permite')
        ? msg
        : `Erro ao liberar serviço: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Unlock className="h-3.5 w-3.5" /> Liberar serviço
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Liberar serviço travado?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação cancela administrativamente o serviço e libera a agenda do técnico
              para receber novas atribuições. Use quando o serviço já foi feito (ou
              abandonado) mas ficou preso na fila do técnico.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label htmlFor="motivo-liberar">Motivo (obrigatório)</Label>
            <Textarea
              id="motivo-liberar"
              placeholder="Ex.: Serviço realizado em campo na sexta-feira, técnico esqueceu de finalizar no app."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirmar liberação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '@/hooks/usePermissions';

interface Props {
  servicoId: string;
  servicoStatus: string;
  veiculoId?: string | null;
  associadoId?: string | null;
  size?: 'sm' | 'default';
  variant?: 'outline' | 'ghost' | 'default';
  onConcluido?: () => void;
}

const PERMITIDO = ['agendada', 'em_rota', 'em_andamento', 'imprevisto_pendente'];

/**
 * Permite que diretores/coordenadores marquem um serviço como concluído
 * quando ele foi realizado em um prestador externo (fora do app).
 * Registra local, data, executor e dispara sincronização SGA para liberar
 * coberturas (Hinova).
 */
export function ConcluirPrestadorExternoButton({
  servicoId,
  servicoStatus,
  veiculoId,
  associadoId,
  size = 'sm',
  variant = 'outline',
  onConcluido,
}: Props) {
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [local, setLocal] = useState('');
  const [data, setData] = useState<string>(new Date().toISOString().slice(0, 10));
  const [executadoPor, setExecutadoPor] = useState('');
  const [obs, setObs] = useState('');

  const podeUsar =
    permissions.isDiretor ||
    permissions.isAdminMaster ||
    permissions.isDesenvolvedor ||
    permissions.isCoordenadorMonitoramento;

  if (!podeUsar) return null;
  if (!PERMITIDO.includes(servicoStatus)) return null;

  const handleConfirm = async () => {
    if (local.trim().length < 3) {
      toast.error('Informe o local (mínimo 3 caracteres).');
      return;
    }
    if (!data) {
      toast.error('Informe a data de execução.');
      return;
    }
    if (executadoPor.trim().length < 3) {
      toast.error('Informe quem executou o serviço.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.rpc('concluir_servico_prestador_externo' as any, {
        _servico_id: servicoId,
        _local: local.trim(),
        _data_execucao: data,
        _executado_por: executadoPor.trim(),
        _observacoes: obs.trim() || null,
      });
      if (error) throw error;

      // Disparar SGA-Hinova-sync (não bloqueante para o usuário)
      if (veiculoId && associadoId) {
        supabase.functions
          .invoke('sga-hinova-sync', {
            body: {
              veiculo_id: veiculoId,
              associado_id: associadoId,
              status_sga_destino: 'pendente',
              force_resync_media: true,
              etapa_origem: 'concluir-servico-prestador-externo',
              motivo_decisao: `Serviço concluído manualmente (prestador externo: ${local}, ${data}).`,
            },
          })
          .catch((e) => console.warn('[ConcluirPrestadorExterno] SGA sync falhou:', e));
      }

      toast.success('Serviço marcado como concluído. Sincronização com SGA disparada.');
      setOpen(false);
      setLocal('');
      setExecutadoPor('');
      setObs('');
      await queryClient.invalidateQueries({ queryKey: ['servicos'] });
      await queryClient.invalidateQueries({ queryKey: ['servicos-campo-unificado'] });
      onConcluido?.();
    } catch (err: any) {
      toast.error(`Erro: ${err.message ?? err}`);
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
        <CheckCircle2 className="h-3.5 w-3.5" /> Marcar como feito (prestador externo)
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Concluir serviço feito em prestador externo</DialogTitle>
            <DialogDescription>
              Use quando o serviço já foi executado em um prestador parceiro fora do app.
              Os dados ficam registrados nas observações e o veículo é enviado para o SGA
              para liberar as coberturas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="local-prest">Onde foi feito *</Label>
              <Input
                id="local-prest"
                placeholder="Ex.: AutoCenter Beta — Niterói/RJ"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="data-prest">Data de execução *</Label>
              <Input
                id="data-prest"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="por-prest">Executado por *</Label>
              <Input
                id="por-prest"
                placeholder="Nome do técnico/prestador"
                value={executadoPor}
                onChange={(e) => setExecutadoPor(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="obs-prest">Observações</Label>
              <Textarea
                id="obs-prest"
                placeholder="Ex.: IMEI já vinculado na Softruck, fotos enviadas por WhatsApp."
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirmar conclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

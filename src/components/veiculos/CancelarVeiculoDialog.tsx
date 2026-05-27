import { useEffect, useMemo, useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCancelarVeiculo } from '@/hooks/useCancelarVeiculo';

interface CancelarVeiculoDialogProps {
  open: boolean;
  onClose: () => void;
  veiculo: { id: string; placa: string; marca?: string | null; modelo?: string | null; associado_id?: string | null } | null;
}

const MOTIVOS = [
  { value: 'desistencia', label: 'Desistência do associado' },
  { value: 'inadimplencia', label: 'Inadimplência' },
  { value: 'solicitacao_cliente', label: 'Solicitação do cliente' },
  { value: 'troca_para_outro_servico', label: 'Troca para outro serviço' },
  { value: 'outro', label: 'Outro motivo' },
];

export function CancelarVeiculoDialog({ open, onClose, veiculo }: CancelarVeiculoDialogProps) {
  const [motivoTipo, setMotivoTipo] = useState<string>('');
  const [observacoes, setObservacoes] = useState('');
  const cancelar = useCancelarVeiculo();

  useEffect(() => {
    if (open) {
      setMotivoTipo('');
      setObservacoes('');
    }
  }, [open]);

  // Verifica se este é o último veículo ativo do associado.
  const { data: outrosAtivos } = useQuery({
    queryKey: ['veiculos-outros-ativos', veiculo?.associado_id, veiculo?.id],
    enabled: !!veiculo?.associado_id && open,
    queryFn: async () => {
      const { data } = await supabase
        .from('veiculos')
        .select('id, status')
        .eq('associado_id', veiculo!.associado_id!)
        .neq('id', veiculo!.id)
        .not('status', 'in', '(cancelado,vendido,transferido)');
      return data?.length ?? 0;
    },
  });

  const ultimoAtivo = useMemo(() => outrosAtivos === 0, [outrosAtivos]);

  const handleConfirmar = async () => {
    if (!veiculo || !motivoTipo || observacoes.trim().length < 3) return;
    const motivoFinal = `${MOTIVOS.find((m) => m.value === motivoTipo)?.label || motivoTipo} — ${observacoes.trim()}`;
    await cancelar.mutateAsync({ veiculoId: veiculo.id, motivo: motivoFinal });
    onClose();
  };

  if (!veiculo) return null;

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && !cancelar.isPending && onClose()}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Cancelar veículo {veiculo.placa}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                <strong>{veiculo.marca} {veiculo.modelo}</strong> — placa <span className="font-mono">{veiculo.placa}</span>
              </p>
              <p className="text-sm">
                Esta ação cancela <strong>apenas este veículo</strong>. Os demais veículos do associado permanecem intactos.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs space-y-1">
            <p className="font-medium">Serão encerrados:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Contrato deste veículo</li>
              <li>Cotações, instalações, serviços e vistorias em aberto</li>
              <li>Rastreador volta ao estoque (desvínculo Softruck/Rede)</li>
              <li>Coberturas (Total e Roubo/Furto) desativadas</li>
              <li>Inativação no SGA Hinova</li>
            </ul>
          </AlertDescription>
        </Alert>

        {ultimoAtivo && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Este é o <strong>último veículo ativo</strong> do associado. Ele também será cancelado automaticamente após esta operação.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="motivo-tipo">Motivo *</Label>
            <Select value={motivoTipo} onValueChange={setMotivoTipo}>
              <SelectTrigger id="motivo-tipo">
                <SelectValue placeholder="Selecione um motivo" />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="motivo-obs">Detalhes *</Label>
            <Textarea
              id="motivo-obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Descreva o motivo (mínimo 3 caracteres)"
              rows={3}
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={cancelar.isPending}>Voltar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={!motivoTipo || observacoes.trim().length < 3 || cancelar.isPending}
            onClick={(e) => { e.preventDefault(); handleConfirmar(); }}
          >
            {cancelar.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Cancelando…</>
            ) : (
              'Confirmar cancelamento'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

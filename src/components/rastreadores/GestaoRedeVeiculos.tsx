import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Link2, Unlink, Power, PowerOff, CheckCircle2, XCircle, Activity, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
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

interface Props {
  veiculoId: string;
  associadoId: string | null;
  rastreadorId: string;
  imei: string;
}

type Acao =
  | 'vincular'
  | 'desvincular'
  | 'ativar-veiculo'
  | 'inativar-veiculo'
  | 'adimplente'
  | 'inadimplente'
  | 'sincronizar';

interface AcaoConfig {
  id: Acao;
  label: string;
  description: string;
  icon: React.ElementType;
  variant: 'default' | 'destructive' | 'outline' | 'secondary';
  destructive?: boolean;
  fn: string;
  payload: () => Record<string, any>;
  motivoRequired?: boolean;
}

export function GestaoRedeVeiculos({ veiculoId, associadoId, rastreadorId, imei }: Props) {
  const queryClient = useQueryClient();
  const [confirmAcao, setConfirmAcao] = useState<AcaoConfig | null>(null);
  const [motivo, setMotivo] = useState('');

  // Status do veículo na plataforma
  const statusVeiculo = useQuery({
    queryKey: ['rede-veiculos', 'status-veiculo', veiculoId],
    enabled: !!veiculoId,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('rede-veiculos-obter-status-veiculo', {
        body: { veiculoId },
      });
      if (error) throw error;
      return data;
    },
    retry: false,
  });

  // Status do cliente
  const statusCliente = useQuery({
    queryKey: ['rede-veiculos', 'status-cliente', associadoId],
    enabled: !!associadoId,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('rede-veiculos-obter-status-cliente', {
        body: { associadoId },
      });
      if (error) throw error;
      return data;
    },
    retry: false,
  });

  const acoes: AcaoConfig[] = [
    {
      id: 'vincular',
      label: 'Vincular cliente ao veículo',
      description: 'Cria vínculo cliente↔veículo na Rede Veículos.',
      icon: Link2,
      variant: 'default',
      fn: 'rede-veiculos-vincular-cliente',
      payload: () => ({ imei, veiculoId, associadoId }),
    },
    {
      id: 'desvincular',
      label: 'Desvincular cliente',
      description: 'Remove vínculo cliente↔veículo. Use após retirada física do rastreador.',
      icon: Unlink,
      variant: 'destructive',
      destructive: true,
      fn: 'rede-veiculos-desvincular-cliente',
      payload: () => ({ rastreadorId, motivo: motivo || 'desvinculacao_manual', atualizarBancoLocal: true }),
      motivoRequired: false,
    },
    {
      id: 'ativar-veiculo',
      label: 'Ativar veículo',
      description: 'Reativa o veículo na plataforma (libera rastreamento).',
      icon: Power,
      variant: 'outline',
      fn: 'rede-veiculos-ativar-veiculo',
      payload: () => ({ veiculoId, motivo: motivo || 'reativacao_manual' }),
    },
    {
      id: 'inativar-veiculo',
      label: 'Inativar veículo',
      description: 'Inativa o veículo (suspende rastreamento sem desvincular).',
      icon: PowerOff,
      variant: 'destructive',
      destructive: true,
      fn: 'rede-veiculos-inativar-veiculo',
      payload: () => ({ veiculoId, motivo: motivo || 'inativacao_manual', atualizarBancoLocal: true }),
      motivoRequired: true,
    },
    {
      id: 'adimplente',
      label: 'Marcar adimplente',
      description: 'Informa pagamento confirmado e libera o veículo.',
      icon: CheckCircle2,
      variant: 'outline',
      fn: 'rede-veiculos-informar-adimplente',
      payload: () => ({ associadoId, veiculoId, motivo: motivo || 'pagamento_confirmado' }),
    },
    {
      id: 'inadimplente',
      label: 'Marcar inadimplente',
      description: 'Informa inadimplência (suspende cobertura na plataforma).',
      icon: XCircle,
      variant: 'destructive',
      destructive: true,
      fn: 'rede-veiculos-informar-inadimplente',
      payload: () => ({ associadoId, veiculoId, motivo: motivo || 'inadimplencia_manual' }),
      motivoRequired: true,
    },
    {
      id: 'sincronizar',
      label: 'Sincronizar status',
      description: 'Reconcilia status local com a Rede Veículos.',
      icon: Activity,
      variant: 'secondary',
      fn: 'rede-veiculos-sincronizar-status',
      payload: () => ({ associadoId, forcarAtualizacao: true }),
    },
  ];

  const executar = useMutation({
    mutationFn: async (cfg: AcaoConfig) => {
      const { data, error } = await supabase.functions.invoke(cfg.fn, { body: cfg.payload() });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, cfg) => {
      toast.success(`${cfg.label} executado com sucesso`);
      queryClient.invalidateQueries({ queryKey: ['rede-veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores'] });
      setConfirmAcao(null);
      setMotivo('');
    },
    onError: (e: Error, cfg) => {
      toast.error(`Erro em "${cfg.label}": ${e.message}`);
    },
  });

  const handleClick = (cfg: AcaoConfig) => {
    if (!associadoId && ['vincular', 'adimplente', 'inadimplente', 'sincronizar'].includes(cfg.id)) {
      toast.error('Veículo sem associado vinculado.');
      return;
    }
    setConfirmAcao(cfg);
    setMotivo('');
  };

  return (
    <div className="space-y-4">
      {/* Status atual */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="border rounded-md p-3 bg-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Status do Veículo</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => statusVeiculo.refetch()}
              disabled={statusVeiculo.isFetching}
              className="h-6 px-2"
            >
              <RefreshCw className={`h-3 w-3 ${statusVeiculo.isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          {statusVeiculo.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : statusVeiculo.error ? (
            <p className="text-xs text-destructive">Erro: {(statusVeiculo.error as Error).message}</p>
          ) : (
            <pre className="text-xs whitespace-pre-wrap break-all max-h-32 overflow-auto">
              {JSON.stringify(statusVeiculo.data, null, 2)}
            </pre>
          )}
        </div>

        <div className="border rounded-md p-3 bg-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Status do Cliente</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => statusCliente.refetch()}
              disabled={statusCliente.isFetching || !associadoId}
              className="h-6 px-2"
            >
              <RefreshCw className={`h-3 w-3 ${statusCliente.isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          {!associadoId ? (
            <p className="text-xs text-muted-foreground">Sem associado vinculado.</p>
          ) : statusCliente.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : statusCliente.error ? (
            <p className="text-xs text-destructive">Erro: {(statusCliente.error as Error).message}</p>
          ) : (
            <pre className="text-xs whitespace-pre-wrap break-all max-h-32 overflow-auto">
              {JSON.stringify(statusCliente.data, null, 2)}
            </pre>
          )}
        </div>
      </div>

      {/* Ações */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Ações manuais</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {acoes.map((cfg) => {
            const Icon = cfg.icon;
            return (
              <Button
                key={cfg.id}
                variant={cfg.variant}
                size="sm"
                className="justify-start"
                onClick={() => handleClick(cfg)}
                disabled={executar.isPending}
              >
                <Icon className="h-4 w-4 mr-2" />
                {cfg.label}
              </Button>
            );
          })}
        </div>
      </div>

      <AlertDialog
        open={!!confirmAcao}
        onOpenChange={(o) => {
          if (!o) {
            setConfirmAcao(null);
            setMotivo('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {confirmAcao?.destructive && <AlertTriangle className="h-4 w-4 text-destructive" />}
              {confirmAcao?.label}?
            </AlertDialogTitle>
            <AlertDialogDescription>{confirmAcao?.description}</AlertDialogDescription>
          </AlertDialogHeader>

          {confirmAcao?.motivoRequired !== undefined && (
            <div className="space-y-1">
              <label className="text-xs font-medium">
                Motivo {confirmAcao.motivoRequired ? '(obrigatório)' : '(opcional)'}
              </label>
              <input
                className="w-full border rounded px-2 py-1 text-sm bg-background"
                placeholder="Descreva o motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmAcao) return;
                if (confirmAcao.motivoRequired && !motivo.trim()) {
                  toast.error('Informe o motivo.');
                  return;
                }
                executar.mutate(confirmAcao);
              }}
              disabled={executar.isPending}
            >
              {executar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

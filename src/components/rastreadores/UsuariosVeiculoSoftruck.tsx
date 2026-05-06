import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserMinus, RefreshCw, AlertTriangle } from 'lucide-react';
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
import { toast } from 'sonner';

interface Props {
  veiculoId: string | null;
  plataforma: string | null;
}

interface SoftruckUserAssoc {
  id: string;
  attributes?: Record<string, any>;
  user?: { id?: string; name?: string; username?: string };
}

export function UsuariosVeiculoSoftruck({ veiculoId, plataforma }: Props) {
  const queryClient = useQueryClient();
  const [confirmarId, setConfirmarId] = useState<string | null>(null);

  const { data: veiculoSoftruck } = useQuery({
    queryKey: ['veiculo-softruck-id', veiculoId],
    enabled: !!veiculoId && plataforma === 'softruck',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('veiculos')
        .select('softruck_vehicle_id, placa')
        .eq('id', veiculoId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const softruckVehicleId = (veiculoSoftruck as any)?.softruck_vehicle_id as string | undefined;

  const usuariosQuery = useQuery({
    queryKey: ['softruck', 'usuarios-veiculo', softruckVehicleId],
    enabled: !!softruckVehicleId,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('softruck-api', {
        body: { operation: 'listar-usuarios-veiculo', data: { vehicleId: softruckVehicleId } },
      });
      if (error) throw error;
      const items = ((data as any)?.data?.data || (data as any)?.data || []) as SoftruckUserAssoc[];
      return items;
    },
  });

  const desvincular = useMutation({
    mutationFn: async (associationId: string) => {
      const { error } = await supabase.functions.invoke('softruck-api', {
        body: { operation: 'desassociar-usuario-veiculo', data: { associationId } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Usuário desvinculado do veículo na Softtruck');
      queryClient.invalidateQueries({ queryKey: ['softruck', 'usuarios-veiculo', softruckVehicleId] });
      setConfirmarId(null);
    },
    onError: (e: Error) => {
      toast.error(`Erro ao desvincular: ${e.message}`);
    },
  });

  if (plataforma !== 'softruck') {
    return (
      <div className="text-sm text-muted-foreground p-4 border rounded-md">
        Gestão de usuários disponível apenas para rastreadores Softtruck.
      </div>
    );
  }

  if (!veiculoId) {
    return (
      <div className="text-sm text-muted-foreground p-4 border rounded-md">
        Rastreador não está vinculado a um veículo.
      </div>
    );
  }

  if (!softruckVehicleId) {
    return (
      <div className="flex items-start gap-2 p-4 border rounded-md bg-amber-50 dark:bg-amber-950/20">
        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
        <div className="text-sm">
          Veículo sem <code>softruck_vehicle_id</code>. Sincronize com a Softtruck antes de gerenciar usuários.
        </div>
      </div>
    );
  }

  const usuarios = usuariosQuery.data || [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Usuários vinculados a este veículo na Softtruck
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => usuariosQuery.refetch()}
          disabled={usuariosQuery.isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${usuariosQuery.isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {usuariosQuery.isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!usuariosQuery.isLoading && usuarios.length === 0 && (
        <div className="text-sm text-muted-foreground p-4 border rounded-md text-center">
          Nenhum usuário vinculado.
        </div>
      )}

      {usuarios.map((u) => {
        const nome = u.user?.name || u.attributes?.name || 'Usuário sem nome';
        const username = u.user?.username || u.attributes?.username;
        return (
          <div
            key={u.id}
            className="flex items-center justify-between p-3 border rounded-md bg-card"
          >
            <div className="min-w-0">
              <p className="font-medium truncate">{nome}</p>
              {username && (
                <p className="text-xs text-muted-foreground truncate">{username}</p>
              )}
              <Badge variant="outline" className="mt-1 text-xs">
                ID: {u.id}
              </Badge>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmarId(u.id)}
              disabled={desvincular.isPending}
            >
              <UserMinus className="h-4 w-4 mr-1" />
              Desvincular
            </Button>
          </div>
        );
      })}

      <AlertDialog open={!!confirmarId} onOpenChange={(o) => !o && setConfirmarId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              O usuário perderá acesso a este veículo na Softtruck. O usuário em si
              continuará existindo na plataforma. Esta ação pode ser revertida vinculando
              novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmarId && desvincular.mutate(confirmarId)}
              disabled={desvincular.isPending}
            >
              {desvincular.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Desvincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

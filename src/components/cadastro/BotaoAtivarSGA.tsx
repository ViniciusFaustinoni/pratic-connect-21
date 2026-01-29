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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Upload, Loader2, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type StatusSGA = 'pendente' | 'sincronizando' | 'ativado_sga' | 'erro_sincronizacao';

interface BotaoAtivarSGAProps {
  veiculoId: string;
  associadoId: string;
  statusAtual: StatusSGA;
  sincronizadoEm?: string | null;
  codigoHinova?: number | null;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

export function BotaoAtivarSGA({
  veiculoId,
  associadoId,
  statusAtual,
  sincronizadoEm,
  codigoHinova,
  onSuccess,
  onError,
  disabled = false,
}: BotaoAtivarSGAProps) {
  const [status, setStatus] = useState<StatusSGA>(statusAtual);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleAtivar = async () => {
    setStatus('sincronizando');
    setDialogOpen(false);

    try {
      const { data, error } = await supabase.functions.invoke('sga-hinova-sync', {
        body: { veiculo_id: veiculoId, associado_id: associadoId },
      });

      if (error) throw error;

      if (data.success) {
        setStatus('ativado_sga');
        toast.success('Associado ativado com sucesso no SGA Hinova!', {
          description: `Código Hinova: ${data.data.codigo_veiculo_hinova}`,
        });
        onSuccess?.();
      } else {
        throw new Error(data.error || 'Erro desconhecido na sincronização');
      }
    } catch (err) {
      setStatus('erro_sincronizacao');
      const message = err instanceof Error ? err.message : 'Erro ao sincronizar com SGA';
      toast.error('Erro na sincronização', { description: message });
      onError?.(message);
    }
  };

  const renderButton = () => {
    switch (status) {
      case 'sincronizando':
        return (
          <Button variant="secondary" disabled className="gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Sincronizando...
          </Button>
        );

      case 'ativado_sga':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  className="gap-2 bg-green-600 hover:bg-green-600 cursor-default"
                  disabled
                >
                  <CheckCircle className="w-4 h-4" />
                  Ativado no SGA ✓
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-sm">
                  {codigoHinova && <p>Código Hinova: {codigoHinova}</p>}
                  {sincronizadoEm && (
                    <p>
                      Sincronizado em:{' '}
                      {format(new Date(sincronizadoEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );

      case 'erro_sincronizacao':
        return (
          <Button
            variant="destructive"
            className="gap-2"
            onClick={() => setDialogOpen(true)}
            disabled={disabled}
          >
            <RefreshCw className="w-4 h-4" />
            Erro - Tentar Novamente
          </Button>
        );

      case 'pendente':
      default:
        return (
          <Button
            variant="default"
            className="gap-2 bg-blue-600 hover:bg-blue-700"
            onClick={() => setDialogOpen(true)}
            disabled={disabled}
          >
            <Upload className="w-4 h-4" />
            Ativar no SGA
          </Button>
        );
    }
  };

  return (
    <>
      {renderButton()}

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" />
              Ativar Associado no SGA Hinova?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-2">
              <p>
                Esta ação irá enviar todos os dados do associado, veículo e documentos para o
                sistema SGA Hinova.
              </p>
              <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                <li>Dados pessoais do associado</li>
                <li>Informações do veículo</li>
                <li>Documentos e fotos aprovados</li>
              </ul>
              <p className="text-sm font-medium mt-3">Deseja continuar?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAtivar}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Confirmar Ativação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle,
  User,
  FileText,
  Calendar,
  Info,
  Clock,
  ExternalLink,
  XCircle,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PlacaDuplicadaInfo } from '@/hooks/useVerificarPlaca';
import { IgnorarAvisoSGADialog } from '@/components/cotacao/IgnorarAvisoSGADialog';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface PlacaDuplicadaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placa: string;
  info: PlacaDuplicadaInfo | null;
  /** Quando definido, exibe botão "Ignorar e Prosseguir" (apenas Diretor recomendado). */
  onIgnorarEProsseguir?: () => void;
}

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  rascunho: { label: 'Rascunho', variant: 'secondary' },
  enviada: { label: 'Enviada', variant: 'default' },
  aceita: { label: 'Aceita', variant: 'default' },
};

export function PlacaDuplicadaModal({
  open,
  onOpenChange,
  placa,
  info,
  onIgnorarEProsseguir,
}: PlacaDuplicadaModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const permissions = usePermissions();
  const [showBypass, setShowBypass] = useState(false);
  const [confirmLiberar, setConfirmLiberar] = useState(false);
  const [liberando, setLiberando] = useState(false);

  if (!info) return null;

  // Gestor / Coordenador / Diretor (qualquer um com viewScope > 'own') pode
  // liberar manualmente uma placa presa em rascunho de outro consultor.
  const podeLiberar =
    permissions.cotacao.viewScope !== 'own' && info.status === 'rascunho';

  const formatarData = (dataStr: string) => {
    try {
      const data = new Date(dataStr);
      return format(data, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dataStr;
    }
  };

  const formatarPlaca = (placa: string) => {
    const limpa = placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (limpa.length === 7) {
      return `${limpa.slice(0, 3)}-${limpa.slice(3)}`;
    }
    return limpa;
  };

  const statusInfo = STATUS_LABELS[info.status] || { label: info.status, variant: 'outline' as const };

  const handleAbrirCotacao = () => {
    onOpenChange(false);
    navigate(`/vendas/cotacoes?cotacaoId=${info.cotacaoId}`);
  };

  const handleLiberar = async () => {
    if (!confirmLiberar) {
      setConfirmLiberar(true);
      return;
    }
    try {
      setLiberando(true);
      const { error } = await supabase
        .from('cotacoes')
        .update({
          status: 'recusada',
          motivo_cancelamento: 'Liberação manual de placa (gestão)',
          cancelada_em: new Date().toISOString(),
        })
        .eq('id', info.cotacaoId)
        .eq('status', 'rascunho');
      if (error) throw error;
      toast.success(`Placa ${formatarPlaca(placa)} liberada.`);
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível liberar a placa.');
    } finally {
      setLiberando(false);
      setConfirmLiberar(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-xl">
              Placa Já em Atendimento
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left space-y-4">
            <p className="text-base">
              A placa <span className="font-semibold text-foreground">{formatarPlaca(placa)}</span> já está reservada para outro consultor por <strong>48 horas</strong> e não pode ser utilizada para uma nova cotação neste momento.
            </p>
            
            <div className="bg-muted/50 rounded-lg p-4 space-y-3 border">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Consultor:</span>
                <span className="font-medium text-foreground">{info.vendedorNome}</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Cotação:</span>
                <span className="font-medium text-foreground">{info.numero}</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Cadastrada em:</span>
                <span className="font-medium text-foreground">{formatarData(info.createdAt)}</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Liberação em:</span>
                <span className="font-medium text-foreground">
                  {formatarData(addHours(new Date(info.createdAt), 48).toISOString())}
                </span>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground">
              A placa será liberada automaticamente após 48h. Para atender este cliente antes disso, entre em contato com o consultor responsável.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <div className="flex flex-wrap gap-2 justify-end w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAbrirCotacao}
              className="gap-1.5"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir cotação
            </Button>

            {podeLiberar && (
              <Button
                variant={confirmLiberar ? 'destructive' : 'outline'}
                size="sm"
                onClick={handleLiberar}
                disabled={liberando}
                className="gap-1.5"
              >
                <XCircle className="h-3.5 w-3.5" />
                {liberando
                  ? 'Liberando...'
                  : confirmLiberar
                    ? 'Confirmar liberação'
                    : 'Cancelar rascunho e liberar'}
              </Button>
            )}

            {onIgnorarEProsseguir && (
              <Button variant="destructive" size="sm" onClick={() => setShowBypass(true)}>
                Ignorar e Prosseguir
              </Button>
            )}

            <AlertDialogAction onClick={() => onOpenChange(false)}>
              Entendido
            </AlertDialogAction>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>

      {onIgnorarEProsseguir && (
        <IgnorarAvisoSGADialog
          open={showBypass}
          onOpenChange={setShowBypass}
          aviso={{
            tipo: 'placa_duplicada_outro_vendedor',
            titulo: 'Placa em atendimento por outro consultor',
            mensagem: `A placa ${placa.toUpperCase()} já está reservada na cotação ${info.numero} do consultor ${info.vendedorNome}.`,
            placa,
            detalhes: { numero: info.numero, vendedorNome: info.vendedorNome, status: info.status },
          }}
          onConfirm={() => {
            onOpenChange(false);
            onIgnorarEProsseguir();
          }}
        />
      )}
    </AlertDialog>
  );
}

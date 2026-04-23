import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertTriangle, Trash2, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export type AcaoOriginal = 'excluir' | 'manter';

export interface DuplicarCotacaoConfirmPayload {
  motivo: string;
  acaoOriginal: AcaoOriginal;
}

interface CotacaoMinima {
  id: string;
  numero: string;
  vendedor_id: string | null;
  status: string;
}

interface DuplicarCotacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cotacao: CotacaoMinima | null;
  vendedorOriginalNome?: string | null;
  /** ID do usuário logado (profile.id ou user.id usado em vendedor_id das cotações) */
  currentUserId: string | undefined;
  isSubmitting?: boolean;
  onConfirm: (payload: DuplicarCotacaoConfirmPayload) => void;
}

export function DuplicarCotacaoDialog({
  open,
  onOpenChange,
  cotacao,
  vendedorOriginalNome,
  currentUserId,
  isSubmitting,
  onConfirm,
}: DuplicarCotacaoDialogProps) {
  const isMesmoConsultor = !!cotacao && !!currentUserId && cotacao.vendedor_id === currentUserId;

  const [motivo, setMotivo] = useState('');
  const [acaoOriginal, setAcaoOriginal] = useState<AcaoOriginal>('excluir');

  // Reseta estado ao abrir/trocar cotação
  useEffect(() => {
    if (open) {
      setMotivo('');
      setAcaoOriginal(isMesmoConsultor ? 'excluir' : 'manter');
    }
  }, [open, isMesmoConsultor, cotacao?.id]);

  // Verifica se a original tem contrato/agendamento (bloqueia exclusão)
  const { data: bloqueio, isLoading: checandoBloqueio } = useQuery({
    queryKey: ['cotacao-bloqueio-exclusao', cotacao?.id],
    enabled: open && !!cotacao?.id,
    queryFn: async () => {
      const id = cotacao!.id;
      const [contratoRes, agendamentoRes] = await Promise.all([
        supabase.from('contratos').select('id').eq('cotacao_id', id).limit(1),
        supabase.from('agendamentos_base').select('id').eq('cotacao_id', id).limit(1),
      ]);
      const temContrato = (contratoRes.data?.length ?? 0) > 0;
      const temAgendamento = (agendamentoRes.data?.length ?? 0) > 0;
      const statusBloqueante = !!cotacao && !['rascunho', 'enviada'].includes(cotacao.status);
      return {
        temContrato,
        temAgendamento,
        statusBloqueante,
        podeExcluir: !temContrato && !temAgendamento && !statusBloqueante,
        motivoBloqueio: temContrato
          ? 'Esta cotação já gerou contrato — apenas substituição é permitida.'
          : temAgendamento
            ? 'Esta cotação já possui agendamento — apenas substituição é permitida.'
            : statusBloqueante
              ? 'Cotação com status diferente de Rascunho/Enviada não pode ser excluída — apenas substituída.'
              : null,
      };
    },
    staleTime: 0,
  });

  // Força modo "manter" se exclusão for bloqueada
  useEffect(() => {
    if (open && bloqueio && !bloqueio.podeExcluir && acaoOriginal === 'excluir') {
      setAcaoOriginal('manter');
    }
  }, [open, bloqueio, acaoOriginal]);

  const motivoValido = motivo.trim().length >= 3;
  const podeConfirmar = motivoValido && !isSubmitting && !checandoBloqueio;

  const handleConfirm = () => {
    if (!podeConfirmar) return;
    onConfirm({ motivo: motivo.trim(), acaoOriginal });
  };

  const exclusaoDesabilitada = !bloqueio?.podeExcluir;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Duplicar cotação{cotacao?.numero ? ` ${cotacao.numero}` : ''}</DialogTitle>
          <DialogDescription>
            {isMesmoConsultor
              ? 'Você criou esta cotação. Escolha o que fazer com a original e descreva o motivo da correção.'
              : 'Esta cotação será marcada como substituída. Descreva o motivo da correção para a trilha de auditoria.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isMesmoConsultor && vendedorOriginalNome && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Esta cotação pertence a <strong>{vendedorOriginalNome}</strong>. A correção será atribuída a você, e a original ficará marcada como <strong>substituída</strong>.
              </AlertDescription>
            </Alert>
          )}

          {isMesmoConsultor && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">O que deseja fazer com a cotação original?</Label>
              <RadioGroup
                value={acaoOriginal}
                onValueChange={(v) => setAcaoOriginal(v as AcaoOriginal)}
                className="gap-2"
              >
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <label
                        htmlFor="acao-excluir"
                        className={cn(
                          'flex items-start gap-3 rounded-lg border p-3 transition-colors',
                          exclusaoDesabilitada
                            ? 'cursor-not-allowed opacity-60'
                            : 'cursor-pointer hover:bg-accent',
                          acaoOriginal === 'excluir' && !exclusaoDesabilitada && 'border-primary bg-accent',
                        )}
                      >
                        <RadioGroupItem
                          id="acao-excluir"
                          value="excluir"
                          className="mt-0.5"
                          disabled={exclusaoDesabilitada}
                        />
                        <div className="flex-1 space-y-0.5">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Trash2 className="h-4 w-4 text-destructive" />
                            Excluir a cotação original
                            <span className="text-xs font-normal text-muted-foreground">(recomendado)</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            A cotação errada some da lista e a placa fica liberada imediatamente.
                          </p>
                        </div>
                      </label>
                    </TooltipTrigger>
                    {exclusaoDesabilitada && bloqueio?.motivoBloqueio && (
                      <TooltipContent side="top" className="max-w-xs">
                        {bloqueio.motivoBloqueio}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>

                <label
                  htmlFor="acao-manter"
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent',
                    acaoOriginal === 'manter' && 'border-primary bg-accent',
                  )}
                >
                  <RadioGroupItem id="acao-manter" value="manter" className="mt-0.5" />
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <FileText className="h-4 w-4" />
                      Manter como substituída
                    </div>
                    <p className="text-xs text-muted-foreground">
                      A original fica registrada com o badge "Substituída por…" para auditoria.
                    </p>
                  </div>
                </label>
              </RadioGroup>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="motivo-correcao" className="text-sm font-medium">
              Motivo da correção <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="motivo-correcao"
              placeholder="Ex.: FIPE incorreto, plano trocado, dados do cliente errados…"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              Mínimo 3 caracteres. Ficará registrado no histórico {acaoOriginal === 'excluir' ? 'do sistema' : 'da cotação substituída'}.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!podeConfirmar}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {acaoOriginal === 'excluir' ? 'Excluir e duplicar' : 'Duplicar e substituir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

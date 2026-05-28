import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Send, AlertCircle } from 'lucide-react';
import type { EmailSuspensaoEnvio } from '@/hooks/emails-suspensao/useEmailSuspensao';

interface Props {
  envio: EmailSuspensaoEnvio | null;
  onOpenChange: (open: boolean) => void;
}

export function EnvioDetalheDialog({ envio, onOpenChange }: Props) {
  if (!envio) return null;
  return (
    <Dialog open={!!envio} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalhe do envio</DialogTitle>
          <DialogDescription>
            {envio.cliente_nome || envio.destinatario} ·{' '}
            {format(new Date(envio.enviado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Destinatário</p>
              <p className="font-medium">{envio.destinatario}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Status</p>
              <Badge variant="secondary">{envio.status}</Badge>
            </div>
            <div className="col-span-2">
              <p className="text-xs uppercase text-muted-foreground">Fluxo de origem</p>
              <p className="font-medium">{envio.fluxo_origem || '—'}</p>
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 px-3 py-2">
            <p className="text-xs uppercase text-muted-foreground">Assunto enviado</p>
            <p className="font-medium">{envio.assunto_enviado || '—'}</p>
          </div>

          <div className="rounded-md border bg-background p-4 whitespace-pre-wrap text-sm leading-relaxed max-h-[320px] overflow-y-auto">
            {envio.corpo_renderizado || (
              <span className="text-muted-foreground italic">(sem corpo registrado)</span>
            )}
          </div>

          {envio.status === 'falhou' && envio.erro_mensagem && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Erro no envio</p>
                <p className="mt-1 text-xs font-mono">{envio.erro_mensagem}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button disabled>
                    <Send className="mr-2 h-4 w-4" />
                    Reenviar
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Disponível após a integração com o envio real
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

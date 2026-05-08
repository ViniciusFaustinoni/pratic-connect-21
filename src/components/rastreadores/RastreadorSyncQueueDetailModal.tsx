import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { RastSyncQueueItem } from '@/hooks/useRastreadoresSyncQueue';

export function RastreadorSyncQueueDetailModal({
  item,
  open,
  onOpenChange,
}: {
  item: RastSyncQueueItem | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  if (!item) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Item da Fila — {item.plataforma.toUpperCase()}
            <Badge variant="outline">{item.status}</Badge>
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-muted-foreground">IMEI:</span> <span className="font-mono">{item.imei || '—'}</span></div>
              <div><span className="text-muted-foreground">Placa:</span> <span className="font-mono">{item.veiculo_placa || '—'}</span></div>
              <div><span className="text-muted-foreground">Associado:</span> {item.associado_nome || '—'}</div>
              <div><span className="text-muted-foreground">Operação:</span> {item.operacao}</div>
              <div><span className="text-muted-foreground">Tentativas:</span> {item.tentativas ?? 0} / {item.max_tentativas ?? 5}</div>
              <div><span className="text-muted-foreground">Última tentativa:</span> {item.ultima_tentativa_em ? new Date(item.ultima_tentativa_em).toLocaleString('pt-BR') : '—'}</div>
            </div>
            {item.erro_ultimo && (
              <div>
                <p className="font-medium mb-1">Último erro</p>
                <pre className="bg-destructive/10 border border-destructive/30 rounded p-3 text-xs whitespace-pre-wrap">{item.erro_ultimo}</pre>
              </div>
            )}
            <div>
              <p className="font-medium mb-1">Payload</p>
              <pre className="bg-muted rounded p-3 text-xs whitespace-pre-wrap">{JSON.stringify(item.payload ?? {}, null, 2)}</pre>
            </div>
            <div>
              <p className="font-medium mb-1">Resposta da última tentativa</p>
              <pre className="bg-muted rounded p-3 text-xs whitespace-pre-wrap">{JSON.stringify(item.response_ultimo ?? {}, null, 2)}</pre>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

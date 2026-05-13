import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, MessageSquare, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface LinkPrestadorResultDialogProps {
  open: boolean;
  onClose: () => void;
  url: string;
  prestadorNome: string;
  prestadorTelefone?: string | null;
}

export function LinkPrestadorResultDialog({ open, onClose, url, prestadorNome, prestadorTelefone }: LinkPrestadorResultDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const handleWhatsApp = () => {
    if (!prestadorTelefone) return;
    const tel = prestadorTelefone.replace(/\D/g, '');
    const telFmt = tel.startsWith('55') ? tel : `55${tel}`;
    const msg = encodeURIComponent(`Olá ${prestadorNome}! Segue o link para a tarefa:\n${url}`);
    window.open(`https://wa.me/${telFmt}?text=${msg}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            ✅ Link Gerado
          </DialogTitle>
          <DialogDescription>
            Tarefa atribuída a <strong>{prestadorNome}</strong> (Prestador Externo)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
            Link gerado — dispensa envio de template
          </Badge>

          <div className="bg-muted rounded-md p-3">
            <p className="text-xs text-muted-foreground mb-1">URL do prestador:</p>
            <p className="text-sm font-mono break-all select-all">{url}</p>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:justify-end sm:space-x-0">
          <Button variant="outline" onClick={handleCopy} className="gap-2 w-full sm:w-auto">
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copiado!' : 'Copiar Link'}
          </Button>
          {prestadorTelefone && (
            <Button variant="outline" onClick={handleWhatsApp} className="gap-2 w-full sm:w-auto">
              <MessageSquare className="h-4 w-4" />
              Abrir no WhatsApp
            </Button>
          )}
          <Button onClick={onClose} className="w-full sm:w-auto">Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

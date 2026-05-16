import { Bell, Copy, ExternalLink, MessageCircle, FileText, Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { usePendenciasDocumentos, type PendenciaPropostaAgrupada } from '@/hooks/usePendenciasDocumentos';

function isFoto(tipo: string): boolean {
  return tipo.startsWith('foto_') || ['selfie_veiculo', 'frente', 'traseira', 'lateral_direita', 'lateral_esquerda', 'odometro', 'chassi', 'motor', 'banco_dianteiro', 'banco_traseiro'].includes(tipo) || tipo.startsWith('pneu_');
}

function sanitizePhone(tel: string | null | undefined): string | null {
  if (!tel) return null;
  const digits = tel.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits.startsWith('55') ? digits : `55${digits}`;
}

function buildWhatsappUrl(item: PendenciaPropostaAgrupada): string | null {
  const fone = sanitizePhone(item.associadoTelefone);
  if (!fone) return null;
  const lista = item.pendencias.map((p) => `• ${p.label}`).join('\n');
  const link = item.linkPublico ?? '';
  const msg = `Olá, ${item.associadoNome}! Sua proposta na Praticcar está com pendências:\n${lista}\n\nPara concluir, acesse:\n${link}\n\nQualquer dúvida, estou à disposição.`;
  return `https://wa.me/${fone}?text=${encodeURIComponent(msg)}`;
}

function CardPendencia({ item }: { item: PendenciaPropostaAgrupada }) {
  const wa = buildWhatsappUrl(item);

  const copyLink = async () => {
    if (!item.linkPublico) {
      toast.error('Link público indisponível para esta proposta');
      return;
    }
    try {
      await navigator.clipboard.writeText(item.linkPublico);
      toast.success('Link copiado');
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">{item.associadoNome}</div>
          <div className="text-xs text-muted-foreground truncate">
            {item.numeroContrato ? `Proposta ${item.numeroContrato}` : 'Proposta'}
            {item.placa ? ` · ${item.placa}` : ''}
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-500 shrink-0">
          {item.pendencias.length} pend.
        </Badge>
      </div>

      <div className="flex flex-wrap gap-1">
        {item.pendencias.map((p) => (
          <Badge
            key={p.id}
            variant="secondary"
            className="text-[10px] gap-1 font-normal"
          >
            {isFoto(p.tipo) ? <Camera className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
            {p.label}
          </Badge>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5 pt-1">
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          onClick={copyLink}
          disabled={!item.linkPublico}
        >
          <Copy className="h-3 w-3 mr-1" /> Copiar link
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          asChild
          disabled={!item.linkPublico}
        >
          <a
            href={item.linkPublico ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (!item.linkPublico) {
                e.preventDefault();
                toast.error('Link público indisponível');
              }
            }}
          >
            <ExternalLink className="h-3 w-3 mr-1" /> Abrir
          </a>
        </Button>
        <Button
          size="sm"
          className="h-7 px-2 text-xs bg-success hover:bg-success/90 text-white"
          asChild
          disabled={!wa}
        >
          <a
            href={wa ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (!wa) {
                e.preventDefault();
                toast.error('Telefone do associado indisponível');
              }
            }}
          >
            <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp
          </a>
        </Button>
      </div>
    </div>
  );
}

export function PendenciasDocumentosBell() {
  const { data, total, isLoading, podeVer } = usePendenciasDocumentos();

  if (!podeVer) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label="Documentos pendentes"
          title="Documentos pendentes"
        >
          <Bell className="h-5 w-5" />
          {total > 0 && (
            <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold leading-none">
              {total > 99 ? '99+' : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={8}
        className="w-[calc(100vw-1rem)] max-w-[420px] sm:w-[420px] p-0 z-[1100]"
      >
        <div className="px-4 pt-4 pb-2 border-b border-border">
          <div className="font-semibold text-sm">Documentos Pendentes</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cobre o associado para concluir o envio das pendências.
          </p>
        </div>

        <div className="max-h-[70vh] overflow-y-auto overscroll-contain">
          <div className="p-3 space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Carregando...
              </div>
            ) : !data || data.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-10">
                Nenhuma pendência no momento ✅
              </div>
            ) : (
              data.map((item) => (
                <CardPendencia key={`${item.contratoId}-${item.associadoId}`} item={item} />
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

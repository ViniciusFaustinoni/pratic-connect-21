import { Bell, Copy, ExternalLink, MessageCircle, FileText, Camera, Loader2, Clock } from 'lucide-react';
import { formatDistanceToNowStrict, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { usePendenciasDocumentos, type PendenciaPropostaAgrupada } from '@/hooks/usePendenciasDocumentos';

// Limiares de alerta (em horas). Ajuste centralizado.
const LIMITE_ATENCAO_H = 24;
const LIMITE_ALTO_H = 48;
const LIMITE_CRITICO_H = 96;

type NivelAlerta = 'ok' | 'atencao' | 'alto' | 'critico';

function getNivelAlerta(horas: number): NivelAlerta {
  if (horas >= LIMITE_CRITICO_H) return 'critico';
  if (horas >= LIMITE_ALTO_H) return 'alto';
  if (horas >= LIMITE_ATENCAO_H) return 'atencao';
  return 'ok';
}

const NIVEL_STYLES: Record<NivelAlerta, { border: string; badge: string; chip: string; label: string }> = {
  ok: {
    border: 'border-l-border',
    badge: 'border-border text-muted-foreground',
    chip: 'bg-muted text-muted-foreground',
    label: 'Recente',
  },
  atencao: {
    border: 'border-l-amber-500',
    badge: 'border-amber-500/50 text-amber-500',
    chip: 'bg-amber-500/15 text-amber-500',
    label: 'Atenção',
  },
  alto: {
    border: 'border-l-orange-500',
    badge: 'border-orange-500/60 text-orange-500',
    chip: 'bg-orange-500/15 text-orange-500',
    label: 'Alto',
  },
  critico: {
    border: 'border-l-destructive',
    badge: 'border-destructive/70 text-destructive',
    chip: 'bg-destructive/15 text-destructive',
    label: 'Crítico',
  },
};

function isFoto(tipo: string): boolean {
  return (
    tipo.startsWith('foto_') ||
    ['selfie_veiculo', 'frente', 'traseira', 'lateral_direita', 'lateral_esquerda', 'odometro', 'chassi', 'motor', 'banco_dianteiro', 'banco_traseiro'].includes(tipo) ||
    tipo.startsWith('pneu_')
  );
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
  const nivel = getNivelAlerta(item.horasParado);
  const styles = NIVEL_STYLES[nivel];

  const tempoRelativo = formatDistanceToNowStrict(new Date(item.aguardandoDesde), {
    locale: ptBR,
    addSuffix: false,
  });
  const desdeFormatado = format(new Date(item.aguardandoDesde), "dd/MM 'às' HH:mm", { locale: ptBR });

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
    <div className={cn('rounded-lg border border-border bg-card p-3 space-y-2 border-l-4', styles.border)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">{item.associadoNome}</div>
          <div className="text-xs text-muted-foreground truncate">
            {item.numeroContrato ? `Proposta ${item.numeroContrato}` : 'Proposta'}
            {item.placa ? ` · ${item.placa}` : ''}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] gap-1 font-medium',
              styles.badge,
              nivel === 'critico' && 'animate-pulse',
            )}
          >
            <Clock className="h-3 w-3" />
            há {tempoRelativo}
          </Badge>
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', styles.chip)}>
            {item.pendencias.length} pend.
          </span>
        </div>
      </div>

      <div className="text-[11px] text-muted-foreground">
        Aguardando desde {desdeFormatado}
      </div>

      <div className="flex flex-wrap gap-1">
        {item.pendencias.map((p) => (
          <Badge key={p.id} variant="secondary" className="text-[10px] gap-1 font-normal">
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

  const criticos = data?.filter((i) => getNivelAlerta(i.horasParado) === 'critico').length ?? 0;
  const altos = data?.filter((i) => getNivelAlerta(i.horasParado) === 'alto').length ?? 0;
  const atencao = data?.filter((i) => getNivelAlerta(i.horasParado) === 'atencao').length ?? 0;
  const temCritico = criticos > 0;

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
          <Bell className={cn('h-5 w-5', temCritico && 'text-destructive')} />
          {total > 0 && (
            <span
              className={cn(
                'absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold leading-none',
                temCritico && 'animate-pulse',
              )}
            >
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
        <div className="px-4 pt-4 pb-2 border-b border-border space-y-1">
          <div className="font-semibold text-sm">Documentos Pendentes</div>
          <p className="text-xs text-muted-foreground">
            Cobre o associado para concluir o envio das pendências.
          </p>
          {(criticos > 0 || altos > 0 || atencao > 0) && (
            <div className="flex flex-wrap gap-1 pt-1">
              {criticos > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive font-medium">
                  {criticos} crítico{criticos > 1 ? 's' : ''}
                </span>
              )}
              {altos > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-500 font-medium">
                  {altos} alto{altos > 1 ? 's' : ''}
                </span>
              )}
              {atencao > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 font-medium">
                  {atencao} em atenção
                </span>
              )}
            </div>
          )}
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

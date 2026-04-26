import { useState } from 'react';
import { ExternalLink, Copy, Loader2, Camera, Cpu, CheckCircle, Link2, ShieldCheck, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  useVistoriaLink,
  useGerarVistoriaLink,
  buildVistoriaLinkUrl,
} from '@/hooks/useVistoriaLinkPublica';

interface Props {
  cotacaoId?: string | null;
  instalacaoId?: string | null;
  /** Quando true, mostra botão "Gerar link" caso ainda não exista. */
  permitirGerar?: boolean;
}

/**
 * Bloco de Vistoria (link público unificado de duas etapas) para a tela de cotação.
 * Mostra o status das duas etapas + ações: abrir, copiar URL e (opcional) gerar.
 */
export function VistoriaLinkBlock({ cotacaoId, instalacaoId, permitirGerar = true }: Props) {
  const { data: link, isLoading, refetch } = useVistoriaLink({ cotacaoId, instalacaoId });
  const gerarMut = useGerarVistoriaLink();
  const [copiando, setCopiando] = useState(false);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando link de vistoria...
      </div>
    );
  }

  if (!link) {
    if (!permitirGerar) return null;
    return (
      <div className="rounded-lg border border-dashed border-border p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link2 className="h-4 w-4" />
          Nenhum link de vistoria gerado.
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={gerarMut.isPending || (!cotacaoId && !instalacaoId)}
          onClick={async () => {
            try {
              await gerarMut.mutateAsync({
                cotacaoId: cotacaoId || undefined,
                instalacaoId: instalacaoId || undefined,
              });
              toast.success('Link de vistoria gerado');
              refetch();
            } catch (e: any) {
              toast.error(e?.message || 'Erro ao gerar link');
            }
          }}
        >
          {gerarMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
          Gerar link
        </Button>
      </div>
    );
  }

  const url = buildVistoriaLinkUrl(link.token);
  const fotosOk = link.fotos_etapa_status === 'concluida';
  const fotosAprovadas = !!link.fotos_aprovadas_em;
  const fotosReprovadas = !!link.fotos_reprovadas_em && !fotosAprovadas;
  const aguardandoAprovacao = fotosOk && !fotosAprovadas && !fotosReprovadas;
  const instOk = link.instalacao_etapa_status === 'concluida';

  // Status visual da etapa de aprovação do monitoramento
  let aprovStatus: 'pendente' | 'aguardando' | 'aprovada' | 'reprovada' = 'pendente';
  let aprovLabel = 'Aguarda fotos';
  if (fotosAprovadas) {
    aprovStatus = 'aprovada';
    aprovLabel = 'Aprovada';
  } else if (fotosReprovadas) {
    aprovStatus = 'reprovada';
    aprovLabel = 'Reprovada';
  } else if (aguardandoAprovacao) {
    aprovStatus = 'aguardando';
    aprovLabel = 'Aguardando';
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Link2 className="h-4 w-4 text-primary" />
          Vistoria — link público
        </div>
        <Badge variant={link.status === 'concluido' ? 'default' : 'outline'}>
          {link.status === 'concluido' ? 'Concluída' : 'Em andamento'}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        {/* 1. Fotos */}
        <div className={`rounded border p-2 flex items-center gap-2 ${fotosOk ? 'border-success/40 bg-success/5' : 'border-border'}`}>
          {fotosOk ? <CheckCircle className="h-4 w-4 text-success flex-shrink-0" /> : <Camera className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
          <div className="flex flex-col min-w-0">
            <span className="font-medium">Fotos</span>
            <span className="text-muted-foreground truncate">
              {fotosOk ? link.fotos_executor_nome || 'Concluída' : 'Pendente'}
            </span>
          </div>
        </div>

        {/* 2. Aprovação do monitoramento */}
        <div
          className={`rounded border p-2 flex items-center gap-2 ${
            aprovStatus === 'aprovada'
              ? 'border-success/40 bg-success/5'
              : aprovStatus === 'reprovada'
              ? 'border-destructive/40 bg-destructive/5'
              : aprovStatus === 'aguardando'
              ? 'border-amber-500/40 bg-amber-500/5'
              : 'border-border'
          }`}
        >
          {aprovStatus === 'aprovada' && <ShieldCheck className="h-4 w-4 text-success flex-shrink-0" />}
          {aprovStatus === 'reprovada' && <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />}
          {aprovStatus === 'aguardando' && <Clock className="h-4 w-4 text-amber-600 flex-shrink-0" />}
          {aprovStatus === 'pendente' && <ShieldCheck className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
          <div className="flex flex-col min-w-0">
            <span className="font-medium">Monitoramento</span>
            <span className="text-muted-foreground truncate">{aprovLabel}</span>
          </div>
        </div>

        {/* 3. Instalação */}
        <div className={`rounded border p-2 flex items-center gap-2 ${instOk ? 'border-success/40 bg-success/5' : 'border-border'}`}>
          {instOk ? <CheckCircle className="h-4 w-4 text-success flex-shrink-0" /> : <Cpu className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
          <div className="flex flex-col min-w-0">
            <span className="font-medium">Instalação</span>
            <span className="text-muted-foreground truncate">
              {instOk
                ? link.instalacao_executor_nome || 'Concluída'
                : fotosAprovadas
                ? 'Liberada'
                : 'Bloqueada'}
            </span>
          </div>
        </div>
      </div>

      {/* Aviso de reprovação com motivo */}
      {fotosReprovadas && link.fotos_reprovacao_motivo && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-destructive">Fotos reprovadas pelo monitoramento</p>
            <p className="text-muted-foreground mt-0.5">{link.fotos_reprovacao_motivo}</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={() => window.open(url, '_blank')}>
          <ExternalLink className="h-4 w-4 mr-2" /> Abrir link
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={copiando}
          onClick={async () => {
            setCopiando(true);
            try {
              await navigator.clipboard.writeText(url);
              toast.success('URL copiada');
            } finally {
              setCopiando(false);
            }
          }}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

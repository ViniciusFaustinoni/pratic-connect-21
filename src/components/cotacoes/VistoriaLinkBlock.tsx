import { useState } from 'react';
import { ExternalLink, Copy, Loader2, Camera, Cpu, CheckCircle, Link2 } from 'lucide-react';
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
  const instOk = link.instalacao_etapa_status === 'concluida';

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

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className={`rounded border p-2 flex items-center gap-2 ${fotosOk ? 'border-success/40 bg-success/5' : 'border-border'}`}>
          {fotosOk ? <CheckCircle className="h-4 w-4 text-success" /> : <Camera className="h-4 w-4 text-muted-foreground" />}
          <div className="flex flex-col">
            <span className="font-medium">Fotos & Vídeo</span>
            <span className="text-muted-foreground">
              {fotosOk ? link.fotos_executor_nome || 'Concluída' : 'Pendente'}
            </span>
          </div>
        </div>
        <div className={`rounded border p-2 flex items-center gap-2 ${instOk ? 'border-success/40 bg-success/5' : 'border-border'}`}>
          {instOk ? <CheckCircle className="h-4 w-4 text-success" /> : <Cpu className="h-4 w-4 text-muted-foreground" />}
          <div className="flex flex-col">
            <span className="font-medium">Instalação</span>
            <span className="text-muted-foreground">
              {instOk ? link.instalacao_executor_nome || 'Concluída' : 'Pendente'}
            </span>
          </div>
        </div>
      </div>

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

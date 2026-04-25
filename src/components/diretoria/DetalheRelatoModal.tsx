import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ErrorReport, useErrorReportFiles, useUpdateErrorReportStatus } from '@/hooks/useErrorReports';
import { FileText, Image as ImageIcon, ExternalLink, Play, CheckCircle2, Copy, Download, X } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  report: ErrorReport | null;
  onClose: () => void;
}

const statusBadge: Record<string, { label: string; cls: string }> = {
  aberto: { label: 'Aberto', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
  em_tratamento: { label: 'Em tratamento', cls: 'bg-warning/15 text-warning border-warning/30' },
  concluido: { label: 'Concluído', cls: 'bg-primary/15 text-primary border-primary/30' },
  validado: { label: 'Validado', cls: 'bg-success/15 text-success border-success/30' },
};

export function DetalheRelatoModal({ report, onClose }: Props) {
  const { data: files = [] } = useErrorReportFiles(report?.id ?? null);
  const update = useUpdateErrorReportStatus();
  const [obs, setObs] = useState('');
  const [preview, setPreview] = useState<{ url: string; nome: string; mime: string } | null>(null);

  const copyImage = async (url: string, mime: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      // Tenta copiar como imagem nativa (PNG); caso falhe, copia a URL
      if (navigator.clipboard && (window as any).ClipboardItem && mime.startsWith('image/')) {
        try {
          const item = new (window as any).ClipboardItem({ [blob.type]: blob });
          await navigator.clipboard.write([item]);
          toast.success('Imagem copiada para a área de transferência');
          return;
        } catch {
          // fallback abaixo
        }
      }
      await navigator.clipboard.writeText(url);
      toast.success('Link da imagem copiado');
    } catch (e) {
      toast.error('Não foi possível copiar a imagem');
    }
  };

  const downloadFile = async (url: string, nome: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = nome || 'arquivo';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      toast.error('Falha ao baixar');
    }
  };

  if (!report) return null;
  const sb = statusBadge[report.status];
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleString('pt-BR') : '-');

  return (
    <Dialog open={!!report} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Relato — {report.area}
            <Badge variant="outline" className={sb.cls}>{sb.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Autor</Label>
              <p className="text-sm">{report.reporter_nome || '—'} <span className="text-muted-foreground">({report.reporter_email || '—'})</span></p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Descrição</Label>
              <p className="text-sm whitespace-pre-wrap bg-muted/40 rounded p-3 border border-border">
                {report.descricao}
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Arquivos ({files.length})</Label>
              {files.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem anexos.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {files.map((f) => {
                    const isImg = f.mime_type?.startsWith('image/');
                    const url = f.signedUrl ?? '';
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => url && setPreview({ url, nome: f.nome_original ?? 'arquivo', mime: f.mime_type ?? '' })}
                        className="group block rounded border border-border overflow-hidden bg-muted aspect-square relative text-left"
                        title={f.nome_original ?? ''}
                      >
                        {isImg && url ? (
                          <img src={url} alt={f.nome_original ?? ''} className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full p-2 text-center">
                            <FileText className="h-6 w-6 text-muted-foreground" />
                            <span className="text-[10px] mt-1 truncate w-full">{f.nome_original}</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                          <ExternalLink className="h-5 w-5 text-white" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="obs">Observação para o autor</Label>
              <Textarea
                id="obs"
                rows={3}
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder={report.observacao_diretor ?? 'Opcional...'}
              />
              {report.observacao_diretor && (
                <p className="text-xs text-muted-foreground mt-1">Atual: {report.observacao_diretor}</p>
              )}
            </div>
          </div>

          <aside className="space-y-3 text-sm bg-muted/30 rounded-lg p-3 border border-border">
            <div>
              <p className="text-xs text-muted-foreground">Aberto em</p>
              <p>{fmt(report.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Em tratamento</p>
              <p>{fmt(report.tratado_em)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Concluído em</p>
              <p>{fmt(report.concluido_em)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Validado em</p>
              <p>{fmt(report.validado_em)}</p>
            </div>
          </aside>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          {report.status === 'aberto' && (
            <Button
              onClick={() => update.mutate({ id: report.id, status: 'em_tratamento', observacao: obs || undefined }, { onSuccess: onClose })}
              disabled={update.isPending}
            >
              <Play className="h-4 w-4 mr-1" /> Iniciar tratamento
            </Button>
          )}
          {report.status === 'em_tratamento' && (
            <Button
              onClick={() => update.mutate({ id: report.id, status: 'concluido', observacao: obs || undefined }, { onSuccess: onClose })}
              disabled={update.isPending}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" /> Marcar como concluído
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

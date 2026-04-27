import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  ErrorReport,
  useErrorReportFiles,
  useErrorReportHistory,
  useUpdateErrorReportStatus,
  useMelhorarTextoRelato,
  ErrorReportStatus,
} from '@/hooks/useErrorReports';
import {
  FileText,
  ExternalLink,
  Play,
  CheckCircle2,
  Copy,
  Download,
  Wand2,
  Trash2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  report: ErrorReport | null;
  onClose: () => void;
}

const statusBadge: Record<ErrorReportStatus, { label: string; cls: string }> = {
  aberto: { label: 'Aberto', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
  em_tratamento: { label: 'Em tratamento', cls: 'bg-warning/15 text-warning border-warning/30' },
  concluido: { label: 'Concluído', cls: 'bg-primary/15 text-primary border-primary/30' },
  validado: { label: 'Validado', cls: 'bg-success/15 text-success border-success/30' },
  descartado: { label: 'Descartado', cls: 'bg-muted text-muted-foreground border-border' },
};

export function DetalheRelatoModal({ report, onClose }: Props) {
  const { data: files = [] } = useErrorReportFiles(report?.id ?? null);
  const { data: history = [] } = useErrorReportHistory(report?.id ?? null);
  const update = useUpdateErrorReportStatus();
  const melhorarTexto = useMelhorarTextoRelato();
  const [obs, setObs] = useState('');
  const [obsPrev, setObsPrev] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; nome: string; mime: string } | null>(null);

  const copyImage = async (url: string, mime: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      if (navigator.clipboard && (window as any).ClipboardItem && mime.startsWith('image/')) {
        try {
          const item = new (window as any).ClipboardItem({ [blob.type]: blob });
          await navigator.clipboard.write([item]);
          toast.success('Imagem copiada');
          return;
        } catch { /* fallback */ }
      }
      await navigator.clipboard.writeText(url);
      toast.success('Link da imagem copiado');
    } catch {
      toast.error('Não foi possível copiar');
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

  const onMelhorar = async () => {
    if (!report) return;
    const base = obs.trim() || report.descricao;
    const novo = await melhorarTexto.mutateAsync({ reportId: report.id, texto: base });
    if (novo) {
      setObsPrev(obs);
      setObs(novo);
      toast.success('Texto melhorado pela IA', {
        action: { label: 'Desfazer', onClick: () => setObs(obsPrev ?? '') },
      });
    }
  };

  const onDescartar = () => {
    if (!report) return;
    const motivo = window.prompt('Motivo do descarte (opcional):') ?? '';
    update.mutate(
      { id: report.id, status: 'descartado', motivo_descarte: motivo || undefined, observacao: obs || undefined },
      { onSuccess: onClose }
    );
  };

  if (!report) return null;
  const sb = statusBadge[report.status];
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleString('pt-BR') : '-');

  return (
    <Dialog open={!!report} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            Relato — {report.area}
            <Badge variant="outline" className={sb.cls}>{sb.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Usuário (autor)</Label>
              <p className="text-sm">
                <strong>{report.reporter_nome || '—'}</strong>{' '}
                <span className="text-muted-foreground">({report.reporter_email || '—'})</span>
              </p>
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
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="obs">Observação para o autor</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={onMelhorar}
                  disabled={melhorarTexto.isPending}
                >
                  {melhorarTexto.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Wand2 className="h-3 w-3 mr-1" />}
                  Melhorar com IA
                </Button>
              </div>
              <Textarea
                id="obs"
                rows={4}
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder={report.observacao_diretor ?? 'Opcional...'}
              />
              {report.observacao_diretor && (
                <p className="text-xs text-muted-foreground mt-1">Atual: {report.observacao_diretor}</p>
              )}
            </div>

            {/* Gerar prompt */}
            <div className="border border-border rounded-lg p-3 bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Prompt de correção (Lovable)</span>
                </div>
                <div className="flex gap-1">
                  {promptResult && (
                    <Button size="sm" variant="ghost" onClick={onGerarPrompt} disabled={gerarPrompt.isPending}>
                      <RotateCcw className="h-3 w-3 mr-1" /> Regerar
                    </Button>
                  )}
                  <Button size="sm" onClick={onGerarPrompt} disabled={gerarPrompt.isPending}>
                    {gerarPrompt.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                    {promptResult ? 'Gerar novamente' : 'Gerar prompt'}
                  </Button>
                </div>
              </div>
              {promptResult && (
                <div className="space-y-2">
                  <p className="text-xs font-medium">{promptResult.titulo}</p>
                  {promptResult.contexto_resumido && (
                    <p className="text-xs text-muted-foreground">{promptResult.contexto_resumido}</p>
                  )}
                  {promptResult.arquivos_provaveis && promptResult.arquivos_provaveis.length > 0 && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Arquivos prováveis: </span>
                      <span className="font-mono">{promptResult.arquivos_provaveis.join(', ')}</span>
                    </div>
                  )}
                  <ScrollArea className="max-h-64 rounded border border-border bg-background">
                    <pre className="text-xs whitespace-pre-wrap p-3 font-mono">
                      {promptResult.prompt_para_lovable}
                    </pre>
                  </ScrollArea>
                  <Button size="sm" variant="outline" onClick={onCopiarPrompt}>
                    <Copy className="h-3 w-3 mr-1" /> Copiar prompt
                  </Button>
                </div>
              )}
              {!promptResult && !gerarPrompt.isPending && (
                <p className="text-xs text-muted-foreground">
                  Gera um prompt pronto para colar no chat do Lovable, analisando texto + imagens anexadas.
                </p>
              )}
            </div>
          </div>

          {/* Timeline / aside */}
          <aside className="space-y-3 text-sm bg-muted/30 rounded-lg p-3 border border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Histórico</p>
            <ol className="space-y-2">
              {history.length === 0 && (
                <li className="text-xs text-muted-foreground">Sem movimentações registradas.</li>
              )}
              {history.map((h) => {
                const sbh = statusBadge[h.to_status];
                return (
                  <li key={h.id} className="text-xs border-l-2 border-primary/40 pl-2">
                    <div className="flex items-center gap-1 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] ${sbh.cls}`}>{sbh.label}</Badge>
                      <span className="text-muted-foreground">{fmt(h.created_at)}</span>
                    </div>
                    <p className="text-foreground/80 mt-0.5">{h.changed_by_nome || '—'}</p>
                    {h.observacao && <p className="text-muted-foreground italic">{h.observacao}</p>}
                  </li>
                );
              })}
            </ol>
            <div className="border-t border-border pt-2 space-y-1">
              <p className="text-xs text-muted-foreground">Aberto em: <strong className="text-foreground">{fmt(report.created_at)}</strong></p>
              {report.descartado_em && (
                <p className="text-xs text-muted-foreground">Descartado em: <strong className="text-foreground">{fmt(report.descartado_em)}</strong></p>
              )}
            </div>
          </aside>
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={onClose}>Fechar</Button>

          {report.status !== 'descartado' && report.status !== 'validado' && (
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={onDescartar}
              disabled={update.isPending}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Descartar
            </Button>
          )}

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
              <CheckCircle2 className="h-4 w-4 mr-1" /> Concluir e enviar para teste do usuário
            </Button>
          )}

          {report.status === 'concluido' && (
            <Button
              variant="outline"
              onClick={() => update.mutate({ id: report.id, status: 'em_tratamento', observacao: obs || undefined })}
              disabled={update.isPending}
            >
              <Play className="h-4 w-4 mr-1" /> Voltar para tratamento
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Preview ampliado */}
      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden bg-background">
          <DialogHeader className="px-4 py-3 border-b border-border flex flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-sm font-medium truncate pr-4">{preview?.nome}</DialogTitle>
            <div className="flex items-center gap-2">
              {preview?.mime.startsWith('image/') && (
                <Button size="sm" variant="outline" onClick={() => preview && copyImage(preview.url, preview.mime)}>
                  <Copy className="h-4 w-4 mr-1" /> Copiar
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => preview && downloadFile(preview.url, preview.nome)}>
                <Download className="h-4 w-4 mr-1" /> Baixar
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={preview?.url} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" /> Abrir
                </a>
              </Button>
            </div>
          </DialogHeader>
          <div className="bg-black/80 flex items-center justify-center max-h-[80vh] overflow-auto">
            {preview?.mime.startsWith('image/') ? (
              <img src={preview.url} alt={preview.nome} className="max-w-full max-h-[80vh] object-contain" />
            ) : preview?.mime === 'application/pdf' ? (
              <iframe src={preview.url} title={preview.nome} className="w-full h-[80vh] bg-white" />
            ) : (
              <div className="p-10 text-muted-foreground text-sm">Pré-visualização não disponível.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

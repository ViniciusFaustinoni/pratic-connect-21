import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMyConcluidosReports, useUpdateErrorReportStatus, useErrorReportFiles } from '@/hooks/useErrorReports';
import { CheckCircle2, FileText, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { useState } from 'react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function ReportFiles({ reportId }: { reportId: string }) {
  const { data } = useErrorReportFiles(reportId);
  if (!data || data.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {data.map((f) => (
        <a
          key={f.id}
          href={f.signedUrl ?? '#'}
          target="_blank"
          rel="noreferrer"
          className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-muted hover:bg-muted/70 transition"
        >
          {f.mime_type?.startsWith('image/') ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
          <span className="max-w-[140px] truncate">{f.nome_original ?? 'arquivo'}</span>
          <ExternalLink className="h-3 w-3 opacity-60" />
        </a>
      ))}
    </div>
  );
}

export function TestarCorrecoesSheet({ open, onOpenChange }: Props) {
  const { data: reports = [], isLoading } = useMyConcluidosReports();
  const update = useUpdateErrorReportStatus();
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Testar correções</SheetTitle>
          <SheetDescription>
            Erros que você relatou e foram concluídos. Teste e confirme se o problema foi resolvido.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!isLoading && reports.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nada a testar no momento.
            </p>
          )}
          {reports.map((r) => (
            <div key={r.id} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{r.area}</p>
                  <p className="text-xs text-muted-foreground">
                    Concluído em {r.concluido_em ? new Date(r.concluido_em).toLocaleString('pt-BR') : '-'}
                  </p>
                </div>
                <Badge variant="secondary">Aguardando teste</Badge>
              </div>
              <p className="text-sm text-foreground/80 line-clamp-3">{r.descricao}</p>
              {r.observacao_diretor && (
                <p className="text-xs bg-muted/50 rounded p-2 border-l-2 border-primary">
                  <strong>Resposta:</strong> {r.observacao_diretor}
                </p>
              )}
              {expanded === r.id && <ReportFiles reportId={r.id} />}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                >
                  {expanded === r.id ? 'Ocultar anexos' : 'Ver anexos'}
                </Button>
                <Button
                  size="sm"
                  onClick={() => update.mutate({ id: r.id, status: 'validado' })}
                  disabled={update.isPending}
                  className="ml-auto"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Validado!
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

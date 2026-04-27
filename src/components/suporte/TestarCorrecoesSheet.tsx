import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  useMyConcluidosReports,
  useUpdateErrorReportStatus,
  useErrorReportFiles,
  useReabrirRelatoComoRetratamento,
} from '@/hooks/useErrorReports';
import { CheckCircle2, FileText, Image as ImageIcon, ExternalLink, XCircle, AlertTriangle } from 'lucide-react';
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
  const reabrir = useReabrirRelatoComoRetratamento();
  const [expanded, setExpanded] = useState<string | null>(null);

  // Estado do dialog "Não foi resolvido"
  const [recusaReportId, setRecusaReportId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');

  // Fix tela preta: ao abrir o AlertDialog, fechamos o Sheet para evitar
  // sobreposição de overlays do Radix (Sheet z-1100 + AlertDialog z-1200)
  // que em alguns navegadores deixa o body com pointer-events: none travado.
  const abrirRecusa = (reportId: string) => {
    setMotivo('');
    setRecusaReportId(reportId);
    onOpenChange(false);
  };

  const fecharRecusa = () => {
    setRecusaReportId(null);
    setMotivo('');
    // Reabrir o Sheet para o usuário continuar avaliando outros relatos
    onOpenChange(true);
  };

  const confirmarRecusa = async () => {
    if (!recusaReportId) return;
    try {
      await reabrir.mutateAsync({ id: recusaReportId, motivo });
      // Sucesso: limpar tudo e manter Sheet fechado (relato sumiu da lista)
      setRecusaReportId(null);
      setMotivo('');
    } catch {
      // toast já é exibido no hook
    }
  };

  return (
    <>
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
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="secondary">Aguardando teste</Badge>
                    {r.eh_retratamento && r.vezes_retratado > 0 && (
                      <Badge variant="outline" className="border-orange-500/40 text-orange-600 dark:text-orange-400 gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Retratamento {r.vezes_retratado}ª vez
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="text-sm text-foreground/80 line-clamp-3">{r.descricao}</p>
                {r.observacao_diretor && (
                  <p className="text-xs bg-muted/50 rounded p-2 border-l-2 border-primary">
                    <strong>Resposta:</strong> {r.observacao_diretor}
                  </p>
                )}
                {expanded === r.id && <ReportFiles reportId={r.id} />}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                  >
                    {expanded === r.id ? 'Ocultar anexos' : 'Ver anexos'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => { setRecusaReportId(r.id); setMotivo(''); }}
                    disabled={reabrir.isPending}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Não foi resolvido
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

      <AlertDialog open={!!recusaReportId} onOpenChange={(v) => { if (!v) fecharRecusa(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>O erro não foi resolvido?</AlertDialogTitle>
            <AlertDialogDescription>
              O relato voltará para tratamento marcado como <strong>retratamento</strong>, para que a equipe saiba que esta é uma nova tentativa. Descreva o que continua acontecendo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="motivo-recusa">
              O que ainda está errado? <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="motivo-recusa"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Ex.: ao salvar continua dando o mesmo erro 500; o botão ainda não aparece em mobile..."
            />
            <p className="text-xs text-muted-foreground">{motivo.trim().length}/2000 — mínimo 10 caracteres</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reabrir.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={reabrir.isPending || motivo.trim().length < 10}
              onClick={(e) => { e.preventDefault(); confirmarRecusa(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {reabrir.isPending ? 'Reabrindo...' : 'Devolver para tratamento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

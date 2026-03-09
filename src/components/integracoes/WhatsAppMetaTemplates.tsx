import { useState } from 'react';
import { FileText, RefreshCw, Plus, Loader2, Trash2, Eye, Send, Edit } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useMetaTemplates, useSincronizarMetaTemplates, useExcluirMetaTemplate, useEnviarMetaTemplate } from '@/hooks/useWhatsAppMeta';
import { WhatsAppMetaTemplateDrawer } from './WhatsAppMetaTemplateDrawer';
import { format } from 'date-fns';

const STATUS_BADGE: Record<string, { className: string; label: string }> = {
  DRAFT: { className: 'bg-muted text-muted-foreground', label: 'Rascunho' },
  PENDING: { className: 'bg-yellow-500/20 text-yellow-700', label: 'Pendente' },
  APPROVED: { className: 'bg-green-500/20 text-green-700', label: 'Aprovado' },
  REJECTED: { className: 'bg-red-500/20 text-red-700', label: 'Rejeitado' },
  PAUSED: { className: 'bg-orange-500/20 text-orange-700', label: 'Pausado' },
  DISABLED: { className: 'bg-muted text-muted-foreground', label: 'Desativado' },
};

export function WhatsAppMetaTemplates() {
  const { data: templates = [], isLoading } = useMetaTemplates();
  const sincronizar = useSincronizarMetaTemplates();
  const excluir = useExcluirMetaTemplate();
  const enviar = useEnviarMetaTemplate();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<any>(null);
  const [viewTemplate, setViewTemplate] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null);

  const approved = templates.filter((t) => t.status === 'APPROVED').length;
  const pending = templates.filter((t) => t.status === 'PENDING').length;
  const rejected = templates.filter((t) => t.status === 'REJECTED').length;

  const canEdit = (status: string) => ['DRAFT', 'REJECTED'].includes(status);
  const canDelete = (status: string) => ['DRAFT', 'PENDING', 'REJECTED'].includes(status);
  const canSend = (status: string) => ['DRAFT', 'REJECTED'].includes(status);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Templates de Mensagem (API Oficial Meta)
          </h3>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => sincronizar.mutate()} disabled={sincronizar.isPending}>
            {sincronizar.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Sincronizar
          </Button>
          <Button size="sm" onClick={() => { setEditTemplate(null); setDrawerOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />
            Novo Template
          </Button>
        </div>
      </div>

      <Alert>
        <FileText className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Templates são obrigatórios para enviar mensagens via API Oficial da Meta.
          Toda mensagem enviada pelo sistema usa um template aprovado. Mensagens livres (sem template)
          só são permitidas dentro de uma janela de 24 horas após o associado ter enviado uma mensagem primeiro.
        </AlertDescription>
      </Alert>

      {/* Resumo */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', value: templates.length, className: 'bg-muted' },
          { label: 'Aprovados', value: approved, className: 'bg-green-500/10' },
          { label: 'Pendentes', value: pending, className: 'bg-yellow-500/10' },
          { label: 'Rejeitados', value: rejected, className: 'bg-red-500/10' },
        ].map((item) => (
          <Card key={item.label} className="border-0 shadow-none">
            <CardContent className={`p-3 rounded-lg ${item.className} text-center`}>
              <p className="text-xl font-bold">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Nenhum template cadastrado
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Nome</TableHead>
                <TableHead className="text-xs">Categoria</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs hidden md:table-cell">Prévia</TableHead>
                <TableHead className="text-xs hidden lg:table-cell">Atualizado</TableHead>
                <TableHead className="text-xs text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => {
                const badge = STATUS_BADGE[t.status] || STATUS_BADGE.DRAFT;
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.nome}</TableCell>
                    <TableCell className="text-xs">{t.categoria}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge className={`text-[10px] ${badge.className}`}>{badge.label}</Badge>
                        {t.status === 'REJECTED' && t.motivo_rejeicao && (
                          <p className="text-[10px] text-destructive leading-tight max-w-[200px]">
                            {t.motivo_rejeicao}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[200px] hidden md:table-cell">
                      {t.corpo?.substring(0, 80)}...
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">
                      {t.updated_at ? format(new Date(t.updated_at), 'dd/MM/yy HH:mm') : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewTemplate(t)}>
                          <Eye className="h-3 w-3" />
                        </Button>
                        {canEdit(t.status) && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditTemplate(t); setDrawerOpen(true); }}>
                            <Edit className="h-3 w-3" />
                          </Button>
                        )}
                        {canSend(t.status) && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => enviar.mutate(t.id)} disabled={enviar.isPending}>
                            <Send className="h-3 w-3" />
                          </Button>
                        )}
                        {canDelete(t.status) && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget({ id: t.id, nome: t.nome })}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Drawer criar/editar */}
      <WhatsAppMetaTemplateDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        template={editTemplate}
      />

      {/* Dialog visualizar */}
      {viewTemplate && (
        <AlertDialog open={!!viewTemplate} onOpenChange={() => setViewTemplate(null)}>
          <AlertDialogContent className="max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-mono text-sm">{viewTemplate.nome}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 text-left">
                  <div className="flex gap-2">
                    <Badge>{viewTemplate.categoria}</Badge>
                    <Badge className={STATUS_BADGE[viewTemplate.status]?.className}>{STATUS_BADGE[viewTemplate.status]?.label}</Badge>
                  </div>
                  {viewTemplate.header_texto && (
                    <div><strong className="text-xs">Cabeçalho:</strong> <span className="text-sm">{viewTemplate.header_texto}</span></div>
                  )}
                  <div>
                    <strong className="text-xs">Corpo:</strong>
                    <div className="mt-1 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg text-sm whitespace-pre-wrap">
                      {viewTemplate.corpo}
                    </div>
                  </div>
                  {viewTemplate.rodape && (
                    <div><strong className="text-xs">Rodapé:</strong> <span className="text-xs text-muted-foreground">{viewTemplate.rodape}</span></div>
                  )}
                  {viewTemplate.botoes && Array.isArray(viewTemplate.botoes) && viewTemplate.botoes.length > 0 && (
                    <div>
                      <strong className="text-xs">Botões:</strong>
                      <div className="mt-1 space-y-1">
                        {(viewTemplate.botoes as Array<{ tipo: string; texto: string; url?: string; telefone?: string }>).map((btn, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/50">
                            <Badge variant="outline" className="text-[10px]">
                              {btn.tipo === 'url' ? '🔗 URL' : btn.tipo === 'telefone' ? '📞 Tel' : '↩️ Resposta'}
                            </Badge>
                            <span className="font-medium">{btn.texto}</span>
                            {btn.url && <span className="text-muted-foreground truncate">{btn.url}</span>}
                            {btn.telefone && <span className="text-muted-foreground">{btn.telefone}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {viewTemplate.motivo_rejeicao && (
                    <div className="p-2 bg-red-50 dark:bg-red-950/20 rounded text-xs text-red-700">
                      <strong>Motivo da rejeição:</strong> {viewTemplate.motivo_rejeicao}
                    </div>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Fechar</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Dialog excluir */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>
              O template <strong className="font-mono">{deleteTarget?.nome}</strong> será excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => { if (deleteTarget) { excluir.mutate(deleteTarget); setDeleteTarget(null); } }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

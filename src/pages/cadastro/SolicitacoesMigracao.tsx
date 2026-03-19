import { useState, useMemo } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useSolicitacoesMigracaoList, useAprovarMigracao, useReprovarMigracao } from '@/hooks/useSolicitacoesMigracaoAdmin';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, CheckCircle, XCircle, AlertTriangle, FileText, Eye, ShieldAlert, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { differenceInHours, differenceInMinutes, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MigracaoDiretaDialog } from '@/components/cadastro/MigracaoDiretaDialog';

function calcPrazo(createdAt: string, prazoHoras: number) {
  const deadline = new Date(new Date(createdAt).getTime() + prazoHoras * 60 * 60 * 1000);
  const now = new Date();
  const diffMin = differenceInMinutes(deadline, now);
  const diffHrs = differenceInHours(deadline, now);

  if (diffMin <= 0) return { label: 'Vencido', variant: 'destructive' as const, minutes: diffMin };
  if (diffHrs < 4) return { label: `${diffHrs}h ${diffMin % 60}min`, variant: 'warning' as const, minutes: diffMin };
  return { label: `${diffHrs}h`, variant: 'secondary' as const, minutes: diffMin };
}

const statusConfig = {
  pendente: { label: 'Pendente', icon: Clock, className: 'bg-accent text-accent-foreground border-border' },
  aprovada: { label: 'Aprovada', icon: CheckCircle, className: 'bg-primary/10 text-primary border-primary/30' },
  reprovada: { label: 'Reprovada', icon: XCircle, className: 'bg-destructive/10 text-destructive border-destructive/30' },
};

export default function SolicitacoesMigracao() {
  const permissions = usePermissions();
  const canAccess = permissions.isGerencia || permissions.isDiretor || permissions.isAdminMaster || permissions.isDesenvolvedor;

  const [filtroStatus, setFiltroStatus] = useState('pendente');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [motivoReprovacao, setMotivoReprovacao] = useState('');
  const [showNovaDialog, setShowNovaDialog] = useState(false);

  const { data: solicitacoes, isLoading } = useSolicitacoesMigracaoList(filtroStatus);
  const aprovarMutation = useAprovarMigracao();
  const reprovarMutation = useReprovarMigracao();

  const sorted = useMemo(() => {
    if (!solicitacoes) return [];
    return [...solicitacoes].sort((a, b) => {
      const pa = calcPrazo(a.created_at!, a.prazo_resposta_horas).minutes;
      const pb = calcPrazo(b.created_at!, b.prazo_resposta_horas).minutes;
      return pa - pb; // mais urgente primeiro
    });
  }, [solicitacoes]);

  const selected = useMemo(() => sorted.find(s => s.id === selectedId), [sorted, selectedId]);

  if (!canAccess) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>Você não tem permissão para acessar esta página.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleAprovar = async () => {
    if (!selected) return;
    try {
      await aprovarMutation.mutateAsync({
        solicitacaoId: selected.id,
        consultorUserId: (selected as any).consultor?.user_id || '',
        cotacaoId: (selected as any).cotacao_id || undefined,
        consultorProfileId: (selected as any).consultor_id || undefined,
      });
      toast.success('Solicitação aprovada com sucesso');
      setShowApproveDialog(false);
      setSelectedId(null);
    } catch {
      toast.error('Erro ao aprovar solicitação');
    }
  };

  const handleReprovar = async () => {
    if (!selected || !motivoReprovacao.trim()) return;
    try {
      await reprovarMutation.mutateAsync({
        solicitacaoId: selected.id,
        motivo: motivoReprovacao.trim(),
        consultorUserId: (selected as any).consultor?.user_id || '',
      });
      toast.success('Solicitação reprovada');
      setShowRejectDialog(false);
      setMotivoReprovacao('');
      setSelectedId(null);
    } catch {
      toast.error('Erro ao reprovar solicitação');
    }
  };

  const comprovantes = selected?.documentos?.filter((d: any) => d.tipo === 'comprovante_pagamento') || [];
  const boletos = selected?.documentos?.filter((d: any) => d.tipo === 'boleto_referencia') || [];

    return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Solicitações de Migração</h1>
          <p className="text-muted-foreground text-sm">Fila de análise de solicitações de migração</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setShowNovaDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nova Solicitação
          </Button>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="aprovada">Aprovadas</SelectItem>
              <SelectItem value="reprovada">Reprovadas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>Nenhuma solicitação encontrada</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
             <TableRow>
                <TableHead>Nome / CPF</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Associação Origem</TableHead>
                <TableHead>Cancelamento</TableHead>
                <TableHead>Enviado em</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Consultor</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map(s => {
                const prazo = calcPrazo(s.created_at!, s.prazo_resposta_horas);
                const isOverdue = prazo.minutes <= 0 && s.status === 'pendente';
                const st = statusConfig[s.status as keyof typeof statusConfig] || statusConfig.pendente;

                return (
                  <TableRow
                    key={s.id}
                    className={`cursor-pointer transition-colors ${isOverdue ? 'bg-destructive/5 hover:bg-destructive/10' : 'hover:bg-muted/50'}`}
                    onClick={() => setSelectedId(s.id)}
                  >
                    <TableCell>
                      <div className="font-medium text-sm">{s.associado_nome || '—'}</div>
                      <div className="text-xs text-muted-foreground">{s.associado_cpf}</div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{s.veiculo_placa || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${(s as any).origem_entrada === 'direta' ? 'border-amber-400 text-amber-700 bg-amber-50' : ''}`}>
                        {(s as any).origem_entrada === 'direta' ? 'Direta' : 'Consultor'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{s.associacao_origem}</TableCell>
                    <TableCell>
                      {(s as any).declaracao_cancelamento_concorrente ? (
                        <Badge variant="outline" className="text-xs border-primary/30 text-primary bg-primary/5">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Declarado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs border-muted-foreground/30 text-muted-foreground">
                          Não declarado
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(s.created_at!), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {s.status === 'pendente' ? (
                        <Badge
                          variant={prazo.variant === 'warning' ? 'outline' : prazo.variant}
                          className={`text-xs ${prazo.variant === 'warning' ? 'border-orange-400 text-orange-700 bg-orange-50' : ''}`}
                        >
                          {isOverdue && <AlertTriangle className="h-3 w-3 mr-1" />}
                          {prazo.label}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${st.className}`}>
                        <st.icon className="h-3 w-3 mr-1" />
                        {st.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{(s as any).consultor?.nome || '—'}</TableCell>
                    <TableCell>
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhes da Solicitação</SheetTitle>
            <SheetDescription>Análise de migração</SheetDescription>
          </SheetHeader>

          {selected && (
            <div className="space-y-6 mt-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Nome:</span>
                  <p className="font-medium">{selected.associado_nome || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">CPF:</span>
                  <p className="font-medium">{selected.associado_cpf}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Placa:</span>
                  <p className="font-medium font-mono">{selected.veiculo_placa || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Associação Origem:</span>
                  <p className="font-medium">{selected.associacao_origem}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Enviado em:</span>
                  <p className="font-medium">{format(new Date(selected.created_at!), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Consultor:</span>
                  <p className="font-medium">{(selected as any).consultor?.nome || '—'}</p>
                </div>
              </div>

              {/* Status */}
              {selected.status !== 'pendente' && (
                <Alert variant={selected.status === 'aprovada' ? 'default' : 'destructive'}>
                  <AlertDescription>
                    <strong>{selected.status === 'aprovada' ? 'Aprovada' : 'Reprovada'}</strong>
                    {selected.aprovado_em && ` em ${format(new Date(selected.aprovado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}`}
                    {selected.motivo_reprovacao && <p className="mt-1">Motivo: {selected.motivo_reprovacao}</p>}
                  </AlertDescription>
                </Alert>
              )}

              {/* Documents tabs */}
              <Tabs defaultValue="comp-0">
                <TabsList className="flex-wrap h-auto gap-1">
                  {comprovantes.map((_: any, i: number) => (
                    <TabsTrigger key={`comp-${i}`} value={`comp-${i}`} className="text-xs">
                      Comprovante {i + 1}
                    </TabsTrigger>
                  ))}
                  {boletos.map((_: any, i: number) => (
                    <TabsTrigger key={`bol-${i}`} value={`bol-${i}`} className="text-xs">
                      Boleto
                    </TabsTrigger>
                  ))}
                </TabsList>

                {comprovantes.map((doc: any, i: number) => (
                  <TabsContent key={`comp-${i}`} value={`comp-${i}`}>
                    <DocumentPreview doc={doc} cpfEsperado={selected.associado_cpf} placaEsperada={selected.veiculo_placa} />
                  </TabsContent>
                ))}

                {boletos.map((doc: any, i: number) => (
                  <TabsContent key={`bol-${i}`} value={`bol-${i}`}>
                    <DocumentPreview doc={doc} cpfEsperado={selected.associado_cpf} placaEsperada={selected.veiculo_placa} />
                  </TabsContent>
                ))}
              </Tabs>

              {/* Action buttons */}
              {selected.status === 'pendente' && (
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    className="flex-1"
                    variant="default"
                    onClick={() => setShowApproveDialog(true)}
                    disabled={aprovarMutation.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Aprovar
                  </Button>
                  <Button
                    className="flex-1"
                    variant="destructive"
                    onClick={() => setShowRejectDialog(true)}
                    disabled={reprovarMutation.isPending}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reprovar
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Approve Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Aprovação</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja aprovar esta solicitação de migração? O consultor será notificado e o fluxo de adesão será desbloqueado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleAprovar} disabled={aprovarMutation.isPending}>
              Confirmar Aprovação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={(open) => { setShowRejectDialog(open); if (!open) setMotivoReprovacao(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reprovar Solicitação</AlertDialogTitle>
            <AlertDialogDescription>
              Informe o motivo da reprovação. O consultor será notificado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Motivo da reprovação (obrigatório)"
            value={motivoReprovacao}
            onChange={e => setMotivoReprovacao(e.target.value)}
            className="min-h-[100px]"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReprovar}
              disabled={!motivoReprovacao.trim() || reprovarMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar Reprovação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Nova Solicitação Direta */}
      <MigracaoDiretaDialog open={showNovaDialog} onOpenChange={setShowNovaDialog} />
    </div>
  );
}

// ============================================
// Document preview sub-component
// ============================================

function DocumentPreview({ doc, cpfEsperado, placaEsperada }: { doc: any; cpfEsperado: string; placaEsperada: string | null }) {
  const cpfOk = doc.cpf_detectado && doc.cpf_detectado.replace(/\D/g, '') === cpfEsperado.replace(/\D/g, '');
  const placaOk = !placaEsperada || (doc.placa_detectada && doc.placa_detectada.toUpperCase() === placaEsperada.toUpperCase());
  const isImage = doc.arquivo_url?.match(/\.(jpg|jpeg|png|webp|gif)$/i);

  return (
    <div className="space-y-3">
      {/* Preview */}
      <div className="border rounded-md overflow-hidden bg-muted/30">
        {isImage ? (
          <img src={doc.arquivo_url} alt={doc.nome_arquivo || 'Documento'} className="w-full max-h-[400px] object-contain" />
        ) : (
          <iframe src={doc.arquivo_url} title={doc.nome_arquivo || 'Documento'} className="w-full h-[400px]" />
        )}
      </div>

      {/* Validation results */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          {cpfOk ? (
            <CheckCircle className="h-4 w-4 text-primary" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          )}
          <span>CPF detectado: <strong>{doc.cpf_detectado || 'Não detectado'}</strong></span>
          {!cpfOk && <Badge variant="destructive" className="text-xs">Inconsistente</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {placaOk ? (
            <CheckCircle className="h-4 w-4 text-primary" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          )}
          <span>Placa detectada: <strong>{doc.placa_detectada || 'Não detectada'}</strong></span>
          {!placaOk && <Badge variant="destructive" className="text-xs">Inconsistente</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {doc.legivel ? (
            <CheckCircle className="h-4 w-4 text-primary" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          )}
          <span>{doc.legivel ? 'Documento legível' : 'Documento ilegível'}</span>
        </div>
        {doc.validacao_erro && (
          <p className="text-destructive text-xs mt-1">{doc.validacao_erro}</p>
        )}
      </div>
    </div>
  );
}

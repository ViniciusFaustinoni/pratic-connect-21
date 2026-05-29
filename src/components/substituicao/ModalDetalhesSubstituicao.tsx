import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, ExternalLink, FileText, Car, User, AlertTriangle, Clock, RefreshCw, XCircle } from 'lucide-react';
import { useSolicitacaoSubstituicao, useCancelarSolicitacaoSubstituicao } from '@/hooks/useSolicitacoesSubstituicao';
import { useSyncTermoCancelamento } from '@/hooks/useSyncTermoCancelamento';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  solicitacaoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function fmtCpf(cpf?: string) {
  const r = (cpf || '').replace(/\D/g, '');
  if (r.length !== 11) return cpf || '—';
  return r.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function fmtMoney(v?: number | null) {
  if (v == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

export function ModalDetalhesSubstituicao({ solicitacaoId, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { data: sol, isLoading } = useSolicitacaoSubstituicao(solicitacaoId);
  const cancelarMut = useCancelarSolicitacaoSubstituicao();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [motivoCancel, setMotivoCancel] = useState('');

  const syncTermo = useSyncTermoCancelamento({
    tipo: 'substituicao',
    solicitacaoId: sol?.id,
    enabled: open && !!sol && sol.status === 'termo_enviado' && !sol.termo_cancelamento_assinado_em,
  });

  const podeCancelar = !!sol && ['aguardando_termo', 'termo_enviado', 'termo_assinado', 'cotacao_criada'].includes(sol.status);

  const handleConfirmarCancelamento = async () => {
    if (!sol) return;
    try {
      const r = await cancelarMut.mutateAsync({ solicitacao_id: sol.id, motivo: motivoCancel.trim() || undefined });
      if (r?.ja_cancelada) {
        toast.info('Solicitação já estava cancelada');
      } else {
        toast.success(r?.cotacao_cancelada ? 'Substituição e cotação canceladas' : 'Substituição cancelada');
      }
      setCancelOpen(false);
      setMotivoCancel('');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao cancelar substituição');
    }
  };

  const handleCriarCotacao = () => {
    if (!sol) return;
    const snap = sol.associado_snapshot || {};
    const params = new URLSearchParams({
      tipo_entrada: 'substituicao_placa',
      associado_id: sol.associado_id || '',
      veiculo_antigo_id: sol.veiculo_antigo_id || '',
      veiculo_antigo_placa: sol.veiculo_antigo_placa,
      veiculo_antigo_modelo: `${sol.veiculo_antigo_snapshot?.marca || ''} ${sol.veiculo_antigo_snapshot?.modelo || ''}`.trim(),
      solicitacao_substituicao_id: sol.id,
      associado_nome: snap.nome || '',
      associado_telefone: snap.telefone || '',
      associado_email: snap.email || '',
    });
    onOpenChange(false);
    navigate(`/vendas/cotacoes?${params.toString()}`);
  };




  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Substituição de Placa {sol ? `· ${sol.veiculo_antigo_placa}` : ''}
          </DialogTitle>
        </DialogHeader>

        {isLoading || !sol ? (
          <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Status:</span>
              <Badge variant={sol.status === 'termo_assinado' || sol.status === 'cotacao_criada' ? 'default' : 'secondary'}>
                {sol.status.replace(/_/g, ' ')}
              </Badge>
            </div>

            {/* Associado */}
            <Card>
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold"><User className="h-4 w-4" /> Associado</div>
                <div className="text-sm">{sol.associado_snapshot?.nome || '—'}</div>
                <div className="text-xs text-muted-foreground">CPF: {fmtCpf(sol.associado_snapshot?.cpf)}</div>
                {sol.associado_snapshot?.email && <div className="text-xs text-muted-foreground">{sol.associado_snapshot.email}</div>}
                {sol.associado_snapshot?.telefone && <div className="text-xs text-muted-foreground">{sol.associado_snapshot.telefone}</div>}
                {sol.associado_snapshot?.tem_debito && (
                  <div className="mt-2 flex items-start gap-2 p-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      Associado com débitos no SGA: <strong>{fmtMoney(sol.associado_snapshot?.saldo_devedor_total)}</strong>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Veículo */}
            <Card>
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold"><Car className="h-4 w-4" /> Veículo a substituir</div>
                <div className="text-sm font-mono">{sol.veiculo_antigo_placa}</div>
                <div className="text-xs text-muted-foreground">
                  {sol.veiculo_antigo_snapshot?.marca} {sol.veiculo_antigo_snapshot?.modelo} {sol.veiculo_antigo_snapshot?.ano && `· ${sol.veiculo_antigo_snapshot.ano}`}
                </div>
                {sol.veiculo_antigo_snapshot?.saldo_devedor != null && (
                  <div className="text-xs text-muted-foreground">Saldo devedor SGA: {fmtMoney(sol.veiculo_antigo_snapshot.saldo_devedor)}</div>
                )}
              </CardContent>
            </Card>

            {/* Nova Cotação de Substituição (termo unificado é assinado no link público) */}
            {(sol.status === 'aguardando_termo' || sol.status === 'termo_assinado' || sol.status === 'cotacao_criada') && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="text-sm font-semibold">Nova Cotação de Substituição</div>
                  <p className="text-xs text-muted-foreground">
                    A substituição usa um único termo unificado, assinado pelo cliente dentro do link público desta cotação.
                  </p>
                  {sol.cotacao_id ? (
                    <Button variant="outline" className="w-full" onClick={() => { onOpenChange(false); navigate(`/vendas/cotacoes?cotacao=${sol.cotacao_id}`); }}>
                      Abrir cotação
                    </Button>
                  ) : (
                    <Button className="w-full" onClick={handleCriarCotacao}>
                      Criar Cotação de Substituição
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Visualização legada: solicitações antigas que enviaram termo de cancelamento separado */}
            {sol.status === 'termo_enviado' && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="text-sm font-semibold">Termo de Cancelamento (fluxo legado)</div>
                  <div className="flex items-center gap-2 p-2 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs">
                    <Clock className="h-4 w-4 text-blue-600 shrink-0" />
                    Aguardando assinatura. Enviado em {sol.termo_cancelamento_enviado_em && format(new Date(sol.termo_cancelamento_enviado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}.
                    {sol.termo_reenvios_count > 0 && ` · ${sol.termo_reenvios_count} reenvio(s)`}
                  </div>
                  {sol.termo_cancelamento_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={sol.termo_cancelamento_url} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3 w-3 mr-1" /> Abrir Autentique
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncTermo.verificarAgora()}
                    disabled={syncTermo.verificando}
                  >
                    {syncTermo.verificando ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                    Verificar assinatura agora
                  </Button>
                  {syncTermo.ultimaVerificacao && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Última verificação: {syncTermo.ultimaVerificacao.toLocaleTimeString('pt-BR')}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {(sol.status === 'termo_assinado' || sol.status === 'efetivada') && sol.termo_cancelamento_assinado_em && (
              <div className="flex items-center gap-2 p-2 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                Termo (legado) assinado em {format(new Date(sol.termo_cancelamento_assinado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}.
              </div>
            )}

            {/* Cancelar substituição — libera placa/associado para novos processos */}
            {podeCancelar && (
              <div className="pt-2 border-t flex justify-end">
                <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <XCircle className="h-4 w-4 mr-1" />
                      Cancelar substituição
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancelar Substituição de Placa?</AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div className="space-y-2 text-sm">
                          <p>
                            A solicitação ficará marcada como <strong>cancelada</strong> e o veículo <strong>{sol?.veiculo_antigo_placa}</strong> voltará a ficar disponível para nova substituição, troca ou cotação avulsa.
                          </p>
                          {sol?.cotacao_id && (
                            <p className="text-amber-700 dark:text-amber-400">
                              A cotação vinculada também será cancelada (se ainda estiver em fase pré-assinatura).
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            O registro permanece no banco para fins de auditoria — apenas o estado funcional é encerrado.
                          </p>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2">
                      <Label htmlFor="motivo-cancel-subst" className="text-xs">Motivo (opcional)</Label>
                      <Textarea
                        id="motivo-cancel-subst"
                        placeholder="Ex.: cliente desistiu, placa errada, etc."
                        value={motivoCancel}
                        onChange={(e) => setMotivoCancel(e.target.value.slice(0, 280))}
                        rows={3}
                      />
                      <p className="text-[10px] text-muted-foreground text-right">{motivoCancel.length}/280</p>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={cancelarMut.isPending}>Voltar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={(e) => { e.preventDefault(); handleConfirmarCancelamento(); }}
                        disabled={cancelarMut.isPending}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {cancelarMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                        Confirmar cancelamento
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

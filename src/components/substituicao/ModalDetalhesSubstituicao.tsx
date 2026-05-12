import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Send, CheckCircle2, ExternalLink, FileText, Car, User, AlertTriangle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useSolicitacaoSubstituicao, useEnviarTermoCancelamentoSubstituicao } from '@/hooks/useSolicitacoesSubstituicao';
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
  const enviar = useEnviarTermoCancelamentoSubstituicao();
  const [confirmando, setConfirmando] = useState(false);

  const handleEnviar = async (force: boolean) => {
    if (!sol) return;
    setConfirmando(true);
    try {
      await enviar.mutateAsync({ solicitacao_id: sol.id, force_resend: force });
      toast.success(force ? 'Termo reenviado' : 'Termo de cancelamento enviado');
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao enviar termo');
    } finally {
      setConfirmando(false);
    }
  };

  const handleCriarCotacao = () => {
    if (!sol) return;
    const params = new URLSearchParams({
      associado_id: sol.associado_id || '',
      tipo_entrada: 'substituicao',
      veiculo_antigo_id: sol.veiculo_antigo_id || '',
      veiculo_antigo_placa: sol.veiculo_antigo_placa,
      veiculo_antigo_modelo: `${sol.veiculo_antigo_snapshot?.marca || ''} ${sol.veiculo_antigo_snapshot?.modelo || ''}`.trim(),
      solicitacao_substituicao_id: sol.id,
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

            {/* Termo */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="text-sm font-semibold">Termo de Cancelamento do veículo {sol.veiculo_antigo_placa}</div>

                {sol.status === 'aguardando_termo' && (
                  <Button onClick={() => handleEnviar(false)} disabled={confirmando} className="w-full">
                    {confirmando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                    Enviar Termo de Cancelamento
                  </Button>
                )}

                {sol.status === 'termo_enviado' && (
                  <>
                    <div className="flex items-center gap-2 p-2 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs">
                      <Clock className="h-4 w-4 text-blue-600 shrink-0" />
                      Aguardando assinatura. Enviado em {sol.termo_cancelamento_enviado_em && format(new Date(sol.termo_cancelamento_enviado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}.
                      {sol.termo_reenvios_count > 0 && ` · ${sol.termo_reenvios_count} reenvio(s)`}
                    </div>
                    <div className="flex gap-2">
                      {sol.termo_cancelamento_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={sol.termo_cancelamento_url} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3 w-3 mr-1" /> Abrir Autentique
                          </a>
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => handleEnviar(true)} disabled={confirmando}>
                        {confirmando ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                        Reenviar
                      </Button>
                    </div>
                  </>
                )}

                {(sol.status === 'termo_assinado' || sol.status === 'cotacao_criada' || sol.status === 'efetivada') && (
                  <div className="flex items-center gap-2 p-2 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    Termo assinado{sol.termo_cancelamento_assinado_em ? ` em ${format(new Date(sol.termo_cancelamento_assinado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}` : ''}.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Nova Cotação */}
            {(sol.status === 'termo_assinado' || sol.status === 'cotacao_criada') && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="text-sm font-semibold">Nova Cotação para o veículo substituto</div>
                  {sol.cotacao_id ? (
                    <Button variant="outline" className="w-full" onClick={() => { onOpenChange(false); navigate(`/vendas/cotacoes?cotacao=${sol.cotacao_id}`); }}>
                      Abrir cotação
                    </Button>
                  ) : (
                    <Button className="w-full" onClick={handleCriarCotacao}>
                      Criar Nova Cotação (aproveitando dados do associado)
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

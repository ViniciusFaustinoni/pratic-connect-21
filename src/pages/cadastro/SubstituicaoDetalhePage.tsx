import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft, User, Car, Shield, Receipt, AlertTriangle, CheckCircle2,
  Clock, XCircle, FileText, Loader2, MessageCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useSubstituicao, useAprovarSubstituicao, useRejeitarSubstituicao } from '@/hooks/useSubstituicaoVeiculo';
import { STATUS_SUBSTITUICAO_LABELS, STATUS_SUBSTITUICAO_CORES } from '@/types/substituicao';
import type { StatusSubstituicao } from '@/types/substituicao';
import { supabase } from '@/integrations/supabase/client';
import { useConfigLimitesVeiculo } from '@/hooks/useConfigLimitesVeiculo';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function SubstituicaoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: sub, isLoading } = useSubstituicao(id);
  const aprovarMutation = useAprovarSubstituicao();
  const rejeitarMutation = useRejeitarSubstituicao();
  const { data: limites } = useConfigLimitesVeiculo();

  const [aprovarDialogOpen, setAprovarDialogOpen] = useState(false);
  const [rejeitarDialogOpen, setRejeitarDialogOpen] = useState(false);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [fipeAltaConfirmada, setFipeAltaConfirmada] = useState(false);
  const [blindadoConfirmado, setBlindadoConfirmado] = useState(false);
  const [efetivando, setEfetivando] = useState(false);

  const formatCurrency = (v: number | null | undefined) =>
    v != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : '—';

  const fipeAlta = (sub?.veiculo_novo_fipe ?? 0) > (limites?.fipeLimiteAutorizacao ?? 120000);
  const veiculoBlindado = !!(vNovo as any)?.blindado;
  const isPendente = sub?.status === 'aguardando_aprovacao';

  const handleAprovar = async () => {
    if (!id) return;
    setEfetivando(true);
    try {
      // 1. Approve
      await aprovarMutation.mutateAsync(id);

      // 2. Call edge function to effectuate
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke('efetivar-substituicao', {
        body: {
          substituicao_id: id,
          aprovado_por: userData.user?.id,
          observacoes,
        },
      });

      if (error) throw error;
      if (data?.success) {
        toast.success('Substituição aprovada e efetivada com sucesso!');
      } else {
        toast.warning('Substituição aprovada, mas houve erros na efetivação. Verifique os logs.');
      }
      navigate('/cadastro/substituicoes');
    } catch (err) {
      toast.error('Erro ao aprovar: ' + (err as Error).message);
    } finally {
      setEfetivando(false);
      setAprovarDialogOpen(false);
    }
  };

  const handleRejeitar = async () => {
    if (!id || !motivoRejeicao.trim()) return;
    try {
      await rejeitarMutation.mutateAsync({ id, motivo: motivoRejeicao });
      toast.success('Substituição rejeitada.');
      navigate('/cadastro/substituicoes');
    } catch (err) {
      toast.error('Erro ao rejeitar: ' + (err as Error).message);
    } finally {
      setRejeitarDialogOpen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Substituição não encontrada.
      </div>
    );
  }

  const assoc = sub.associado as Record<string, unknown> | null;
  const vAntigo = sub.veiculo_antigo as Record<string, unknown> | null;
  const vNovo = sub.veiculo_novo as Record<string, unknown> | null;
  const beneficios = (sub.beneficios_novos || {}) as Record<string, unknown>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/cadastro/substituicoes')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Análise de Substituição</h1>
          <p className="text-sm text-muted-foreground">
            {assoc?.nome as string || '—'} — Solicitada em{' '}
            {format(new Date(sub.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
        <Badge className={STATUS_SUBSTITUICAO_CORES[sub.status as StatusSubstituicao] || ''}>
          {STATUS_SUBSTITUICAO_LABELS[sub.status as StatusSubstituicao] || sub.status}
        </Badge>
      </div>

      {/* SEÇÃO 1: Dados do Associado */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-5 w-5" /> Dados do Associado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Nome</p>
              <p className="font-medium">{assoc?.nome as string || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">CPF</p>
              <p className="font-medium">{assoc?.cpf as string || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Telefone</p>
              <p className="font-medium">{assoc?.telefone as string || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium">{assoc?.email as string || '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 2: Comparativo de Veículos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Car className="h-5 w-5" /> Comparativo de Veículos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>Veículo Antigo</TableHead>
                <TableHead>Veículo Novo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium text-muted-foreground">Modelo</TableCell>
                <TableCell>{sub.veiculo_antigo_modelo || (vAntigo?.modelo as string) || '—'}</TableCell>
                <TableCell>{sub.veiculo_novo_modelo || (vNovo?.modelo as string) || '—'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium text-muted-foreground">Placa</TableCell>
                <TableCell>{sub.veiculo_antigo_placa || (vAntigo?.placa as string) || '—'}</TableCell>
                <TableCell>{sub.veiculo_novo_placa || (vNovo?.placa as string) || '—'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium text-muted-foreground">Valor FIPE</TableCell>
                <TableCell>{formatCurrency(sub.veiculo_antigo_fipe)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {formatCurrency(sub.veiculo_novo_fipe)}
                    {fipeAlta && (
                      <Badge variant="destructive" className="text-xs">FIPE ALTA</Badge>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* SEÇÃO 3: Vistoria (placeholder) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-5 w-5" /> Vistoria do Novo Veículo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Vistoria será verificada após aprovação do cadastro do veículo.
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 4: Financeiro */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-5 w-5" /> Resumo Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Taxa de Substituição</p>
              <div className="flex items-center gap-2">
                <span className="font-medium">{formatCurrency(sub.taxa_substituicao)}</span>
                <Badge variant={sub.cobranca_taxa_asaas_id ? 'default' : 'secondary'} className="text-xs">
                  {sub.cobranca_taxa_asaas_id ? 'Gerada' : 'Pendente'}
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-muted-foreground">Mensalidade Antiga</p>
              <p className="font-medium">{formatCurrency(sub.mensalidade_antiga)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Mensalidade Nova</p>
              <p className="font-semibold text-primary">{formatCurrency(sub.mensalidade_nova)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Diferença Mensal</p>
              <p className={cn('font-medium', (sub.diferenca_mensalidade ?? 0) > 0 ? 'text-red-600' : 'text-green-600')}>
                {(sub.diferenca_mensalidade ?? 0) > 0 ? '+' : ''}{formatCurrency(sub.diferenca_mensalidade)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Pro-Rata</p>
              <p className="font-medium">{formatCurrency(sub.valor_prorata)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Nova Cota de Participação</p>
              <p className="font-medium">{formatCurrency(sub.cota_participacao_nova)}</p>
            </div>
          </div>

          {/* Carência */}
          {sub.data_inicio_carencia && sub.data_fim_carencia && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-primary" />
                <span className="font-medium">Carência: {sub.carencia_dias} dias</span>
                <span className="text-muted-foreground">
                  ({format(new Date(sub.data_inicio_carencia), 'dd/MM/yyyy')} a{' '}
                  {format(new Date(sub.data_fim_carencia), 'dd/MM/yyyy')})
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SEÇÃO 5: Evento */}
      {sub.tipo_evento_bloqueante && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Evento Ativo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sub.resolucao_evento === 'cancelar_com_termo' && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Associado desistiu do evento #{sub.evento_bloqueante_id?.slice(0, 8)} — Termo assinado ✅
                </AlertDescription>
              </Alert>
            )}
            {sub.resolucao_evento === 'inclusao_temporaria' && (
              <Alert>
                <MessageCircle className="h-4 w-4" />
                <AlertDescription>
                  Inclusão temporária — veículo antigo será inativado após evento
                </AlertDescription>
              </Alert>
            )}
            {sub.tipo_evento_bloqueante === 'terceiros_paralelo' && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Evento de terceiros #{sub.evento_bloqueante_id?.slice(0, 8)} em andamento — não impede substituição
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* SEÇÃO 6: Ações da Diretoria */}
      {isPendente && (
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle className="text-base">Ações da Diretoria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {veiculoBlindado && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium">Veículo BLINDADO — Requer autorização especial da diretoria</p>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <Checkbox
                      checked={blindadoConfirmado}
                      onCheckedChange={(v) => setBlindadoConfirmado(!!v)}
                    />
                    <span className="text-sm">Confirmo autorização para veículo blindado</span>
                  </label>
                </AlertDescription>
              </Alert>
            )}

            {fipeAlta && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium">FIPE acima de R$ {(limites?.fipeLimiteAutorizacao ?? 120000).toLocaleString('pt-BR')} — Requer autorização especial por email</p>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <Checkbox
                      checked={fipeAltaConfirmada}
                      onCheckedChange={(v) => setFipeAltaConfirmada(!!v)}
                    />
                    <span className="text-sm">Confirmação de autorização especial recebida por email</span>
                  </label>
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>Observações da diretoria (opcional)</Label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Observações adicionais..."
                rows={3}
              />
            </div>

            <Separator />

            <div className="flex gap-3 justify-end">
              <Button
                variant="destructive"
                onClick={() => setRejeitarDialogOpen(true)}
                disabled={efetivando}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Rejeitar
              </Button>
              <Button
                onClick={() => setAprovarDialogOpen(true)}
                disabled={efetivando || (fipeAlta && !fipeAltaConfirmada) || (veiculoBlindado && !blindadoConfirmado)}
                className="bg-green-600 hover:bg-green-700"
              >
                {efetivando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Aprovar Substituição
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approval info for already processed */}
      {sub.status === 'aprovada' || sub.status === 'efetivada' ? (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription>
            Aprovada por {sub.aprovado_por?.slice(0, 8)} em{' '}
            {sub.aprovado_em ? format(new Date(sub.aprovado_em), 'dd/MM/yyyy HH:mm') : '—'}
          </AlertDescription>
        </Alert>
      ) : null}

      {sub.status === 'rejeitada' && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium">Rejeitada</p>
            <p className="text-sm mt-1">Motivo: {sub.motivo_rejeicao || '—'}</p>
          </AlertDescription>
        </Alert>
      )}

      {/* Dialog: Aprovar */}
      <AlertDialog open={aprovarDialogOpen} onOpenChange={setAprovarDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar Substituição</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? Isso efetivará a substituição automaticamente: o veículo antigo será
              inativado, o novo ativado, boletos atualizados e o associado notificado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={efetivando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAprovar}
              disabled={efetivando}
              className="bg-green-600 hover:bg-green-700"
            >
              {efetivando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmar Aprovação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Rejeitar */}
      <Dialog open={rejeitarDialogOpen} onOpenChange={setRejeitarDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Substituição</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Motivo da rejeição *</Label>
            <Textarea
              value={motivoRejeicao}
              onChange={(e) => setMotivoRejeicao(e.target.value)}
              placeholder="Descreva o motivo da rejeição..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejeitarDialogOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={handleRejeitar}
              disabled={!motivoRejeicao.trim() || rejeitarMutation.isPending}
            >
              {rejeitarMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

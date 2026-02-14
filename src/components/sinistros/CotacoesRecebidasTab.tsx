import { useState, useMemo } from 'react';
import { format, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CheckCircle, Clock, RefreshCw, Send, AlertTriangle, Trophy } from 'lucide-react';
import { useCotacoesEvento, CotacaoEvento } from '@/hooks/useCotacoesEvento';
import { useVistoriaEvento, ItemOrcamento } from '@/hooks/useVistoriaEvento';
import { RegistrarCotacaoDialog } from './RegistrarCotacaoDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  sinistroId: string;
}

const statusBadge: Record<string, { label: string; className: string }> = {
  enviado: { label: 'Aguardando resposta', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  respondido: { label: 'Respondido', className: 'bg-green-100 text-green-800 border-green-300' },
  expirado: { label: 'Expirado', className: 'bg-red-100 text-red-800 border-red-300' },
  nao_selecionada: { label: 'Não selecionada', className: 'bg-muted text-muted-foreground' },
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function CotacoesRecebidasTab({ sinistroId }: Props) {
  const { cotacoes, isLoading, registrarCotacao, aprovarCotacao } = useCotacoesEvento(sinistroId);
  const { data: vistoria } = useVistoriaEvento(sinistroId);
  const [showRegistrar, setShowRegistrar] = useState(false);
  const [cotacaoParaAprovar, setCotacaoParaAprovar] = useState<CotacaoEvento | null>(null);
  const [reenviando, setReenviando] = useState<string | null>(null);

  const itensOrcamento: ItemOrcamento[] = useMemo(
    () => vistoria?.dados_vistoria?.itens_orcamento || [],
    [vistoria]
  );

  // Determinar status real (expirado se >24h sem resposta)
  const cotacoesComStatus = useMemo(() => {
    return cotacoes.map((c) => {
      if (c.status === 'enviado' && c.created_at) {
        const horas = differenceInHours(new Date(), new Date(c.created_at));
        if (horas >= 24) return { ...c, status: 'expirado' };
      }
      return c;
    });
  }, [cotacoes]);

  const cotacaoAprovada = cotacoesComStatus.find((c) => c.aprovada);
  const cotacoesRespondidas = cotacoesComStatus.filter((c) => c.status === 'respondido' || c.aprovada);
  const temRegistraveis = cotacoesComStatus.some((c) => (c.status === 'enviado' || c.status === 'expirado') && !c.aprovada);

  const handleReenviar = async (cotacao: CotacaoEvento) => {
    setReenviando(cotacao.id);
    try {
      const { error } = await supabase.functions.invoke('enviar-cotacao-pecas', {
        body: {
          sinistro_id: sinistroId,
          auto_center_id: cotacao.auto_center_id,
          itens: cotacao.itens,
          cotacao_id: cotacao.id,
        },
      });
      if (error) throw error;

      // Reset status
      await supabase
        .from('evento_cotacoes_pecas')
        .update({ status: 'enviado', updated_at: new Date().toISOString() })
        .eq('id', cotacao.id);

      toast.success('Cotação reenviada');
    } catch {
      toast.error('Erro ao reenviar cotação');
    } finally {
      setReenviando(null);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando cotações...</div>;
  }

  if (cotacoes.length === 0) {
    return (
      <div className="text-center py-12">
        <Send className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold text-foreground">Nenhuma cotação enviada</h3>
        <p className="text-muted-foreground mt-1">
          Use o botão "Atribuir Fornecedores" para enviar pedidos de cotação
        </p>
      </div>
    );
  }

  // Dados para comparativo
  const pecasOrcamento = itensOrcamento.filter((i) => i.tipo === 'peca');
  const menorTotal = cotacoesRespondidas.length > 0
    ? Math.min(...cotacoesRespondidas.map((c) => c.valor_total || Infinity))
    : 0;

  return (
    <div className="space-y-6">
      {/* Cotação Aprovada em destaque */}
      {cotacaoAprovada && (
        <Card className="border-green-300 bg-green-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Trophy className="h-5 w-5" />
              Cotação Aprovada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-lg">
                  {cotacaoAprovada.auto_center?.nome_fantasia || cotacaoAprovada.auto_center?.nome}
                </p>
                <p className="text-sm text-green-700">
                  Aprovada em {cotacaoAprovada.aprovada_em
                    ? format(new Date(cotacaoAprovada.aprovada_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                    : '---'}
                </p>
                {cotacaoAprovada.prazo_geral && (
                  <p className="text-sm text-green-700 mt-1">Prazo: {cotacaoAprovada.prazo_geral}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-800">
                  {formatCurrency(cotacaoAprovada.valor_total || 0)}
                </p>
                <Badge className="bg-green-600 text-white mt-1">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Aprovada
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Seção 1 — Resumo dos Pedidos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Pedidos Enviados ({cotacoesComStatus.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {cotacoesComStatus.map((c) => {
            const badge = statusBadge[c.status] || statusBadge.enviado;
            return (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-medium">
                      {c.auto_center?.nome_fantasia || c.auto_center?.nome || 'Auto Center'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Enviado em {format(new Date(c.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={badge.className}>{badge.label}</Badge>
                  {c.status === 'expirado' && !cotacaoAprovada && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={reenviando === c.id}
                      onClick={() => handleReenviar(c)}
                    >
                      <RefreshCw className={cn("h-3 w-3 mr-1", reenviando === c.id && "animate-spin")} />
                      Reenviar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Seção 2 — Botão Registrar */}
      {temRegistraveis && !cotacaoAprovada && (
        <Button onClick={() => setShowRegistrar(true)} className="w-full">
          Registrar Cotação Recebida
        </Button>
      )}

      {/* Seção 3 — Comparativo */}
      {cotacoesRespondidas.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Comparativo de Cotações</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Peça</TableHead>
                  {cotacoesRespondidas.map((c) => (
                    <TableHead key={c.id} className="text-center min-w-[160px]">
                      {c.auto_center?.nome_fantasia || c.auto_center?.nome}
                      {c.aprovada && <Badge className="ml-1 bg-green-600 text-white text-[10px]">✓</Badge>}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pecasOrcamento.map((peca, pidx) => (
                  <TableRow key={pidx}>
                    <TableCell className="font-medium">
                      {peca.descricao}
                      <span className="text-xs text-muted-foreground ml-1">(x{peca.quantidade})</span>
                    </TableCell>
                    {cotacoesRespondidas.map((c) => {
                      const respItem = c.resposta?.itens?.[pidx];
                      if (!respItem) return <TableCell key={c.id} className="text-center text-muted-foreground">—</TableCell>;
                      const indisponivel = respItem.disponibilidade === 'indisponivel';
                      return (
                        <TableCell key={c.id} className={cn("text-center", indisponivel && "text-red-600 bg-red-50")}>
                          {indisponivel ? (
                            <span className="text-xs font-medium">Indisponível</span>
                          ) : (
                            <div>
                              <p className="font-medium">{formatCurrency(respItem.valor_unitario)}</p>
                              {respItem.prazo_entrega && (
                                <p className="text-xs text-muted-foreground">{respItem.prazo_entrega}</p>
                              )}
                            </div>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-bold">TOTAL</TableCell>
                  {cotacoesRespondidas.map((c) => {
                    const isMenor = c.valor_total === menorTotal && menorTotal > 0;
                    return (
                      <TableCell
                        key={c.id}
                        className={cn("text-center font-bold text-base", isMenor && "text-green-700 bg-green-50")}
                      >
                        {formatCurrency(c.valor_total || 0)}
                        {isMenor && <span className="block text-xs font-normal">Menor preço</span>}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Seção 4 — Cards com Aprovação */}
      {cotacoesRespondidas.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-lg">Cotações Recebidas</h3>
          {cotacoesRespondidas.map((c) => (
            <Card
              key={c.id}
              className={cn(
                c.aprovada && 'border-green-300',
                !c.aprovada && cotacaoAprovada && 'opacity-60'
              )}
            >
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">
                      {c.auto_center?.nome_fantasia || c.auto_center?.nome}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Valor total: <span className="font-medium text-foreground">{formatCurrency(c.valor_total || 0)}</span>
                    </p>
                    {c.prazo_geral && (
                      <p className="text-sm text-muted-foreground">Prazo: {c.prazo_geral}</p>
                    )}
                    {c.observacoes_auto_center && (
                      <p className="text-sm text-muted-foreground mt-1 italic">"{c.observacoes_auto_center}"</p>
                    )}
                  </div>
                  <div className="text-right">
                    {c.aprovada ? (
                      <Badge className="bg-green-600 text-white">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Aprovada
                      </Badge>
                    ) : cotacaoAprovada ? (
                      <Badge variant="outline" className="text-muted-foreground">Não selecionada</Badge>
                    ) : (
                      <Button size="sm" onClick={() => setCotacaoParaAprovar(c)}>
                        Aprovar esta Cotação
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Registrar */}
      <RegistrarCotacaoDialog
        open={showRegistrar}
        onOpenChange={setShowRegistrar}
        cotacoesEnviadas={cotacoesComStatus}
        itensOrcamento={itensOrcamento}
        onSalvar={(data) => {
          registrarCotacao.mutate(data, { onSuccess: () => setShowRegistrar(false) });
        }}
        isSaving={registrarCotacao.isPending}
      />

      {/* Dialog de confirmação de aprovação */}
      <AlertDialog open={!!cotacaoParaAprovar} onOpenChange={(open) => !open && setCotacaoParaAprovar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar Cotação</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja aprovar a cotação do{' '}
              <strong>
                {cotacaoParaAprovar?.auto_center?.nome_fantasia || cotacaoParaAprovar?.auto_center?.nome}
              </strong>
              ? Valor total:{' '}
              <strong>{formatCurrency(cotacaoParaAprovar?.valor_total || 0)}</strong>.
              <br />
              <br />
              <span className="text-destructive font-medium">Esta ação é irreversível.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (cotacaoParaAprovar) {
                  aprovarCotacao.mutate(cotacaoParaAprovar.id);
                  setCotacaoParaAprovar(null);
                }
              }}
            >
              Confirmar Aprovação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

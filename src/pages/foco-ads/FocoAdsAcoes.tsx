import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Check, X, ShieldAlert, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAcoesPropostas, useDecidirAcao, rotuloTipoAcao, type AcaoProposta } from '@/hooks/useFocoAds';

const STATUS_BADGE: Record<AcaoProposta['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  proposta: { label: 'Proposta', variant: 'secondary' },
  aprovada: { label: 'Aprovada', variant: 'default' },
  executando: { label: 'Executando…', variant: 'default' },
  executada: { label: 'Executada', variant: 'default' },
  rejeitada: { label: 'Rejeitada', variant: 'outline' },
  falha: { label: 'Falha', variant: 'destructive' },
  revertida: { label: 'Revertida', variant: 'outline' },
};

export default function FocoAdsAcoes() {
  const navigate = useNavigate();
  const { data: acoes, isLoading } = useAcoesPropostas();
  const decidir = useDecidirAcao();
  const [confirm, setConfirm] = useState<AcaoProposta | null>(null);

  const aprovar = (acao: AcaoProposta) => {
    setConfirm(null);
    toast.promise(decidir.mutateAsync({ acaoId: acao.id, decisao: 'aprovar' }), {
      loading: 'Executando na Meta…',
      success: 'Ação executada e registrada na auditoria.',
      error: (e) => `Falha: ${e?.message ?? e}`,
    });
  };

  const rejeitar = (acao: AcaoProposta) => {
    toast.promise(decidir.mutateAsync({ acaoId: acao.id, decisao: 'rejeitar' }), {
      loading: 'Rejeitando…',
      success: 'Ação rejeitada. Nada foi executado.',
      error: (e) => `Falha: ${e?.message ?? e}`,
    });
  };

  const pendentes = acoes?.filter((a) => a.status === 'proposta' || a.status === 'aprovada') ?? [];
  const historico = acoes?.filter((a) => !['proposta', 'aprovada'].includes(a.status)) ?? [];

  const renderCard = (acao: AcaoProposta, podeDecidir: boolean) => {
    const st = STATUS_BADGE[acao.status];
    const verba = acao.payload_proposto?.daily_budget ?? acao.payload_proposto?.verba_diaria;
    return (
      <Card key={acao.id}>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{rotuloTipoAcao(acao.tipo)}</Badge>
            <Badge variant="outline">{acao.entidade_tipo}</Badge>
            <Badge variant={st.variant}>{st.label}</Badge>
          </div>
          <CardTitle className="text-base">{acao.justificativa_ia ?? 'Ação proposta'}</CardTitle>
          <CardDescription>
            Alvo na Meta: <code className="text-xs">{acao.entidade_externa_id || '—'}</code>
            {acao.tipo === 'ajustar_verba' && verba != null && (
              <> · nova verba diária: <strong>R$ {String(verba)}</strong></>
            )}
          </CardDescription>
        </CardHeader>
        {podeDecidir && (
          <CardContent className="flex items-center gap-2">
            <Button size="sm" onClick={() => setConfirm(acao)} disabled={decidir.isPending}>
              {decidir.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Aprovar e executar
            </Button>
            <Button size="sm" variant="outline" onClick={() => rejeitar(acao)} disabled={decidir.isPending}>
              <X className="mr-2 h-4 w-4" /> Rejeitar
            </Button>
          </CardContent>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/foco-ads')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ações propostas</h1>
          <p className="text-muted-foreground">
            Aprovar executa a mudança na Meta (gasta/altera). Toda execução é auditada e reversível quando possível.
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Pendentes</h2>
        {isLoading ? (
          [...Array(2)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
        ) : !pendentes.length ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhuma ação pendente.</CardContent></Card>
        ) : (
          pendentes.map((a) => renderCard(a, true))
        )}
      </section>

      {historico.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Histórico</h2>
          {historico.map((a) => renderCard(a, false))}
        </section>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" /> Confirmar execução na Meta
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação <strong>{confirm ? rotuloTipoAcao(confirm.tipo) : ''}</strong> será aplicada na campanha real
              (pode gastar dinheiro ou alterar entrega). A execução fica registrada na auditoria. Confirma?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirm && aprovar(confirm)}>Aprovar e executar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

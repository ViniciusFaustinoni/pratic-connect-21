import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, RefreshCw, Search } from 'lucide-react';
import { useBoletosSgaPorAssociado } from '@/hooks/useBoletosSgaPorAssociado';

interface Props {
  associadoId: string;
  codigoHinova?: number | null;
  cpf?: string | null;
}

const fmtBRL = (v: number) =>
  `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function RelatorioFinanceiroAntigo({ codigoHinova, cpf }: Props) {
  const { data, isLoading, refetch, isFetching } = useBoletosSgaPorAssociado(
    codigoHinova ?? null,
    cpf ?? null,
    !!(codigoHinova || (cpf && cpf.replace(/\D/g, '').length === 11)),
  );

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  if (!data) {
    return (
      <Alert>
        <Search className="h-4 w-4" />
        <AlertTitle>Sem dados financeiros</AlertTitle>
        <AlertDescription>
          Informe CPF ou código Hinova do associado antigo para consultar o SGA.
        </AlertDescription>
      </Alert>
    );
  }

  if (data.erro_transitorio) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>SGA temporariamente indisponível</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>Não foi possível consultar a situação financeira agora.</p>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3 w-3 mr-1 ${isFetching ? 'animate-spin' : ''}`} /> Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!data.encontrado) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Associado não encontrado no SGA</AlertTitle>
        <AlertDescription>
          Sincronize o associado antigo com o SGA antes de aprovar a troca para conferir a situação financeira.
        </AlertDescription>
      </Alert>
    );
  }

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const todosBoletos = (data.veiculos || []).flatMap((v) => v.boletos_abertos || []);
  const vencidas = todosBoletos.filter((b) => b.data_vencimento && new Date(b.data_vencimento) < hoje);
  const aVencer = todosBoletos.filter((b) => !b.data_vencimento || new Date(b.data_vencimento) >= hoje);
  const totalVencido = vencidas.reduce((s, b) => s + Number(b.valor || 0), 0);
  const adimplente = !data.tem_debito && vencidas.length === 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            {adimplente ? (
              <><CheckCircle2 className="h-5 w-5 text-green-600" /> Associado ADIMPLENTE</>
            ) : (
              <><AlertTriangle className="h-5 w-5 text-destructive" /> Associado INADIMPLENTE</>
            )}
          </span>
          <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded border p-2">
            <p className="text-xs text-muted-foreground">Vencidas</p>
            <p className="text-lg font-bold text-destructive">{vencidas.length}</p>
          </div>
          <div className="rounded border p-2">
            <p className="text-xs text-muted-foreground">A vencer</p>
            <p className="text-lg font-bold">{aVencer.length}</p>
          </div>
          <div className="rounded border p-2">
            <p className="text-xs text-muted-foreground">Saldo devedor (SGA)</p>
            <p className={`text-lg font-bold ${data.saldo_devedor_total > 0 ? 'text-destructive' : 'text-green-600'}`}>
              {fmtBRL(data.saldo_devedor_total || 0)}
            </p>
          </div>
        </div>
        {totalVencido > 0 && (
          <div className="rounded bg-destructive/10 p-2 text-sm text-destructive">
            Total vencido em aberto: <strong>{fmtBRL(totalVencido)}</strong>
          </div>
        )}
        {vencidas.length > 0 && (
          <div className="space-y-1 max-h-40 overflow-auto">
            {vencidas.slice(0, 10).map((b, i) => (
              <div key={`${b.nosso_numero || i}`} className="flex items-center justify-between text-xs border-b py-1">
                <span>
                  {b.nosso_numero ? `Boleto ${b.nosso_numero}` : 'Boleto'} — venc.{' '}
                  {b.data_vencimento ? new Date(b.data_vencimento).toLocaleDateString('pt-BR') : '-'}
                </span>
                <Badge variant="destructive">{fmtBRL(b.valor)}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertTriangle, Car, CheckCircle2, Clock, ExternalLink, FileSignature, User,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSolicitacaoSubstituicao } from '@/hooks/useSolicitacoesSubstituicao';

interface Props {
  solicitacaoId: string;
}

function fmtCpf(cpf?: string | null) {
  const r = (cpf || '').replace(/\D/g, '');
  if (r.length !== 11) return cpf || '—';
  return r.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function fmtMoney(v?: number | null) {
  if (v == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function fmtDt(d?: string | null) {
  if (!d) return '—';
  try { return format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR }); } catch { return '—'; }
}

/**
 * Visão READ-ONLY do processo de Substituição de Placa que originou a cotação.
 * Renderizada como aba "Processo" do PropostaAnalise para o Cadastro avaliar
 * lado antigo + lado novo sem precisar sair para Outros Processos.
 */
export function SubstituicaoProcessoCard({ solicitacaoId }: Props) {
  const { data: sol, isLoading } = useSolicitacaoSubstituicao(solicitacaoId);

  if (isLoading) {
    return <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-32 w-full" /></div>;
  }
  if (!sol) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Processo de substituição não encontrado</AlertTitle>
        <AlertDescription>
          A cotação está marcada como Substituição de Veículo, mas a solicitação de origem
          (<code>solicitacoes_substituicao_placa</code>) não foi localizada. Abra Outros Processos
          para investigar.
        </AlertDescription>
      </Alert>
    );
  }

  const snapAssoc = (sol.associado_snapshot || {}) as any;
  const snapAntigo = (sol.veiculo_antigo_snapshot || {}) as any;
  const termoAssinado = !!sol.termo_cancelamento_assinado_em;
  const termoEnviado = !!sol.termo_cancelamento_enviado_em;

  return (
    <div className="space-y-3">
      {/* Header: tipo de processo + status do termo */}
      <Alert>
        <FileSignature className="h-4 w-4" />
        <AlertTitle className="flex items-center gap-2">
          Substituição de Veículo
          <Badge variant={sol.status === 'cotacao_criada' || sol.status === 'termo_assinado' ? 'default' : 'secondary'}>
            {sol.status.replace(/_/g, ' ')}
          </Badge>
        </AlertTitle>
        <AlertDescription className="text-xs">
          A cotação acima é o lado NOVO. Esta aba mostra o veículo que será substituído (lado antigo).
          A substituição usa termo unificado assinado no link público da nova cotação.
        </AlertDescription>
      </Alert>

      {/* Associado (mesmo dos dois lados) */}
      <Card className="border-t-4 border-t-primary">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4" /> Associado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="font-medium">{snapAssoc?.nome || '—'}</div>
          <div className="text-xs text-muted-foreground">
            CPF: {fmtCpf(snapAssoc?.cpf)}
            {snapAssoc?.email && <> • {snapAssoc.email}</>}
            {snapAssoc?.telefone && <> • {snapAssoc.telefone}</>}
          </div>
          {snapAssoc?.tem_debito && (
            <div className="mt-2 flex items-start gap-2 p-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                Débito SGA do associado: <strong>{fmtMoney(snapAssoc?.saldo_devedor_total)}</strong>
                {' '}— avalie no gate financeiro antes de aprovar.
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Veículo ANTIGO */}
      <Card className="border-t-4 border-t-amber-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Car className="h-4 w-4" /> Veículo a substituir (antigo)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="font-mono text-base font-semibold">{sol.veiculo_antigo_placa}</div>
          <div className="text-xs text-muted-foreground">
            {snapAntigo?.marca || ''} {snapAntigo?.modelo || ''}
            {snapAntigo?.ano && ` · ${snapAntigo.ano}`}
          </div>
          {snapAntigo?.saldo_devedor != null && (
            <div className="text-xs text-muted-foreground">
              Saldo devedor SGA do veículo: <strong>{fmtMoney(snapAntigo.saldo_devedor)}</strong>
            </div>
          )}
          {snapAntigo?.codigo_fipe && (
            <div className="text-[11px] text-muted-foreground">FIPE: {snapAntigo.codigo_fipe}</div>
          )}
        </CardContent>
      </Card>

      {/* Termo */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileSignature className="h-4 w-4" /> Termo de Cancelamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {termoAssinado ? (
            <div className="flex items-center gap-2 p-2 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              Termo assinado em {fmtDt(sol.termo_cancelamento_assinado_em)}.
            </div>
          ) : termoEnviado ? (
            <div className="flex items-center gap-2 p-2 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs">
              <Clock className="h-4 w-4 text-blue-600 shrink-0" />
              Aguardando assinatura. Enviado em {fmtDt(sol.termo_cancelamento_enviado_em)}.
              {sol.termo_reenvios_count > 0 && ` · ${sol.termo_reenvios_count} reenvio(s)`}
            </div>
          ) : (
            <div className="flex items-center gap-2 p-2 rounded bg-muted text-xs">
              <Clock className="h-4 w-4 shrink-0" />
              Substituição usa termo unificado assinado dentro do link público — sem termo de cancelamento separado.
            </div>
          )}
          {sol.termo_cancelamento_url && (
            <Button variant="outline" size="sm" asChild>
              <a href={sol.termo_cancelamento_url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" /> Abrir Autentique
              </a>
            </Button>
          )}
        </CardContent>
      </Card>

      <p className="text-[10px] text-muted-foreground text-right">
        Criada em {fmtDt(sol.created_at)}
      </p>
    </div>
  );
}

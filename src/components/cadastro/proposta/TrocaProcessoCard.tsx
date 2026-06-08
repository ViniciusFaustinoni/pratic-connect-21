import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertTriangle, Car, CheckCircle2, Clock, ExternalLink, FileSignature, User, ArrowRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSolicitacaoTroca } from '@/hooks/useSolicitacoesTroca';
import { formatCPF, formatPhone } from '@/types/termo-filiacao';

interface Props {
  solicitacaoId: string;
}

function fmtDt(d?: string | null) {
  if (!d) return '—';
  try { return format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR }); } catch { return '—'; }
}

/**
 * Visão READ-ONLY do processo de Troca de Titularidade que originou a cotação.
 * Renderizada como aba "Processo" do PropostaAnalise para o Cadastro avaliar
 * titular antigo + novo (mesmo veículo) sem precisar sair para Outros Processos.
 */
export function TrocaProcessoCard({ solicitacaoId }: Props) {
  const { data: sol, isLoading } = useSolicitacaoTroca(solicitacaoId);

  if (isLoading) {
    return <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-32 w-full" /></div>;
  }
  if (!sol) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Processo de troca não encontrado</AlertTitle>
        <AlertDescription>
          A cotação está marcada como Troca de Titularidade, mas a solicitação de origem
          (<code>solicitacoes_troca_titularidade</code>) não foi localizada. Abra Outros Processos
          para investigar.
        </AlertDescription>
      </Alert>
    );
  }

  const antigo = (sol as any).associado_antigo || {};
  const novo = (sol as any).novo_titular_dados || {};
  const veic = (sol as any).veiculo || {};
  const termoAssinado = !!sol.termo_cancelamento_assinado_em;
  const termoEnviado = !!sol.termo_cancelamento_enviado_em;

  return (
    <div className="space-y-3">
      <Alert>
        <FileSignature className="h-4 w-4" />
        <AlertTitle className="flex items-center gap-2">
          Troca de Titularidade
          <Badge variant="secondary">{sol.status.replace(/_/g, ' ')}</Badge>
        </AlertTitle>
        <AlertDescription className="text-xs">
          A aprovação canônica do Cadastro vê o novo titular nas abas Cliente / Veículo / Contrato.
          Esta aba mostra o titular ANTIGO e o status do termo de cancelamento.
        </AlertDescription>
      </Alert>

      {/* Comparativo titular antigo × novo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="border-t-4 border-t-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4" /> Titular Antigo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="font-medium">{antigo?.nome || '—'}</div>
            <div className="text-xs text-muted-foreground">CPF: {formatCPF(antigo?.cpf)}</div>
            {antigo?.email && <div className="text-xs text-muted-foreground">{antigo.email}</div>}
            {antigo?.telefone && <div className="text-xs text-muted-foreground">{formatPhone(antigo.telefone)}</div>}
            {antigo?.status && (
              <Badge variant="outline" className="text-[10px] mt-1">{antigo.status}</Badge>
            )}
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ArrowRight className="h-4 w-4" /> Novo Titular
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="font-medium">{novo?.nome || '—'}</div>
            <div className="text-xs text-muted-foreground">CPF: {formatCPF(novo?.cpf)}</div>
            {novo?.email && <div className="text-xs text-muted-foreground">{novo.email}</div>}
            {novo?.telefone && <div className="text-xs text-muted-foreground">{formatPhone(novo.telefone)}</div>}
          </CardContent>
        </Card>
      </div>

      {/* Veículo (mesmo dos dois lados) */}
      <Card className="border-t-4 border-t-purple-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Car className="h-4 w-4" /> Veículo (mantém)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="font-mono font-semibold">{veic?.placa || '—'}</div>
          <div className="text-xs text-muted-foreground">
            {veic?.marca || ''} {veic?.modelo || ''}
            {(veic?.ano_modelo || veic?.ano_fabricacao) && ` · ${veic.ano_modelo || veic.ano_fabricacao}`}
          </div>
        </CardContent>
      </Card>

      {/* Termo de Cancelamento */}
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
              Termo assinado pelo titular antigo em {fmtDt(sol.termo_cancelamento_assinado_em)}.
            </div>
          ) : termoEnviado ? (
            <div className="flex items-center gap-2 p-2 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs">
              <Clock className="h-4 w-4 text-blue-600 shrink-0" />
              Aguardando assinatura. Enviado em {fmtDt(sol.termo_cancelamento_enviado_em)}.
            </div>
          ) : (
            <div className="flex items-center gap-2 p-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              Termo ainda não enviado. A troca não pode ser efetivada sem assinatura.
            </div>
          )}
          {(sol as any).termo_cancelamento_url && (
            <Button variant="outline" size="sm" asChild>
              <a href={(sol as any).termo_cancelamento_url} target="_blank" rel="noreferrer">
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

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, RefreshCw, AlertTriangle, CheckCircle2, XCircle, User, Car, Wallet, Loader2 } from 'lucide-react';
import {
  useAnalisePreviaSGA,
  forcarAtualizarAnalisePrevia,
  type AnalisePreviaResultado,
} from '@/hooks/useAnalisePreviaSGA';
import { formatCPF, formatPhone } from '@/types/termo-filiacao';

interface Props {
  solicitacaoId: string;
  enabled: boolean;
}

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const formatDate = (iso?: string | null) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR');
};

export function AnalisePreviaNovoTitularCard({ solicitacaoId, enabled }: Props) {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { data, isLoading, error } = useAnalisePreviaSGA(solicitacaoId, enabled);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const fresh = await forcarAtualizarAnalisePrevia(solicitacaoId);
      qc.setQueryData(['analise-previa-sga', solicitacaoId], fresh);
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4" /> Análise prévia do novo titular
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Consultando base SGA Hinova…
          </p>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertTitle>Falha ao consultar</AlertTitle>
        <AlertDescription>
          {(error as Error).message || 'Erro ao executar análise prévia.'}
          <div className="mt-2">
            <Button size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
              Tentar novamente
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  const result = data as AnalisePreviaResultado | undefined;
  const sga = result?.sga;
  const baseLocal = result?.base_local;
  const transit = sga?.erro_transitorio;
  const encontrado = !!sga?.encontrado;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold flex items-center gap-2 text-sm">
          <Search className="h-4 w-4" /> Análise prévia do novo titular
        </h4>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {result?.do_cache ? 'Cache' : 'Atualizado'} · {result?.gerado_em ? new Date(result.gerado_em).toLocaleString('pt-BR') : '-'}
          </span>
          <Button size="sm" variant="ghost" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* SGA indisponível (transitório) */}
      {transit && !encontrado && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>SGA indisponível no momento</AlertTitle>
          <AlertDescription>
            {sga?.motivo || 'Erro transitório na consulta.'} Tente novamente em alguns minutos.
          </AlertDescription>
        </Alert>
      )}

      {/* Não encontrado no SGA */}
      {!transit && !encontrado && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>CPF não está na base SGA Hinova</AlertTitle>
          <AlertDescription>
            O novo titular ainda não é associado existente no SGA. O cadastro será criado do zero ao efetivar a troca.
          </AlertDescription>
        </Alert>
      )}

      {/* Encontrado no SGA */}
      {encontrado && sga && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" /> {sga.associado?.nome || '—'}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  CPF {formatCPF(sga.associado?.cpf || '')} · Cód. SGA {sga.codigo_associado ?? '-'}
                </p>
              </div>
              {sga.tem_debito ? (
                <Badge variant="destructive">Com pendências</Badge>
              ) : (
                <Badge className="bg-green-600 hover:bg-green-600">Em dia</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Dados pessoais */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">E-mail</p>
                <p>{sga.associado?.email || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Telefone</p>
                <p>{sga.associado?.telefone ? formatPhone(sga.associado.telefone) : '-'}</p>
              </div>
            </div>

            {/* Situação financeira */}
            <div className="rounded border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h5 className="font-semibold text-sm flex items-center gap-2">
                  <Wallet className="h-4 w-4" /> Situação financeira
                </h5>
                <span className={`text-sm font-bold ${sga.tem_debito ? 'text-destructive' : 'text-green-600'}`}>
                  {formatBRL(sga.saldo_devedor_total || 0)}
                </span>
              </div>

              {sga.tem_debito && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Associado possui pendências financeiras no SGA — avalie antes de aprovar a troca.
                  </AlertDescription>
                </Alert>
              )}

              {(sga.veiculos || []).map((v) => (
                <div key={v.codigo_veiculo} className="border-t pt-2 first:border-t-0 first:pt-0">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium flex items-center gap-1">
                      <Car className="h-3 w-3" /> {v.placa} {v.modelo ? `· ${v.modelo}` : ''}
                    </span>
                    <span className={v.saldo_devedor > 0 ? 'text-destructive font-semibold' : 'text-green-600'}>
                      {formatBRL(v.saldo_devedor)}
                    </span>
                  </div>
                  {v.boletos_abertos.length > 0 ? (
                    <ul className="mt-1 space-y-1">
                      {v.boletos_abertos.map((b, i) => (
                        <li key={i} className="text-xs flex items-center justify-between bg-muted/30 rounded px-2 py-1">
                          <span>
                            Venc. {formatDate(b.data_vencimento)} · {b.situacao_label}
                          </span>
                          <span className="font-medium">{formatBRL(b.valor)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-600" /> Sem boletos em aberto
                    </p>
                  )}
                </div>
              ))}

              {(!sga.veiculos || sga.veiculos.length === 0) && (
                <p className="text-xs text-muted-foreground">Nenhum veículo vinculado no SGA.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Base local */}
      {baseLocal && (
        <div className="rounded border p-3">
          <h5 className="font-semibold text-sm mb-2">Base local (Lovable)</h5>
          {baseLocal.erro ? (
            <p className="text-xs text-destructive">{baseLocal.erro}</p>
          ) : baseLocal.encontrado && baseLocal.associado ? (
            <div className="text-xs space-y-1">
              <p>{baseLocal.associado.nome} · {formatCPF(baseLocal.associado.cpf)}</p>
              <p className="text-muted-foreground">
                Status: <Badge variant="outline" className="text-[10px]">{baseLocal.associado.status || '-'}</Badge>
                {' '}· Cadastrado em {formatDate(baseLocal.associado.created_at)}
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">CPF não encontrado na base local.</p>
          )}
        </div>
      )}
    </div>
  );
}

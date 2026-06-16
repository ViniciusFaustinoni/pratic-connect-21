import { useState, useMemo } from 'react';
import { Plus, Clock, CheckCircle2, Wallet, XCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { NovaSolicitacaoModal } from '@/components/financeiro/NovaSolicitacaoModal';
import { SolicitacaoDetalheDialog } from '@/components/financeiro/SolicitacaoDetalheDialog';
import {
  useSolicitacoesFinanceiras,
  useSolicitacoesKpis,
  SolicitacaoFinanceira,
  SOLICITACAO_STATUS_CONFIG,
  SOLICITACAO_TIPO_LABEL,
  SOLICITACAO_CATEGORIAS,
} from '@/hooks/useSolicitacoesFinanceiras';

const formatBRL = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatData = (d: string | null) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—');

const TABS: { value: string; label: string }[] = [
  { value: 'todos', label: 'Todas' },
  { value: 'pendente', label: 'Aguardando liberação' },
  { value: 'aprovado', label: 'Liberadas' },
  { value: 'pago', label: 'Pagas' },
  { value: 'rejeitado', label: 'Rejeitadas' },
];

export default function SolicitacoesFinanceiras() {
  const [tab, setTab] = useState('todos');
  const [modalNova, setModalNova] = useState(false);
  const [selecionada, setSelecionada] = useState<SolicitacaoFinanceira | null>(null);

  const { data: solicitacoes, isLoading } = useSolicitacoesFinanceiras();
  const { data: kpis } = useSolicitacoesKpis();

  const filtradas = useMemo(() => {
    if (!solicitacoes) return [];
    if (tab === 'todos') return solicitacoes;
    return solicitacoes.filter((s) => s.status === tab);
  }, [solicitacoes, tab]);

  const categoriaLabel = (v: string) =>
    SOLICITACAO_CATEGORIAS.find((c) => c.value === v)?.label ?? v;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Solicitações e Liberações Financeiras</h1>
          <p className="text-muted-foreground">
            Solicitações de pagamento e reembolso · liberação dos sócios · pagamento pelo financeiro
          </p>
        </div>
        <Button onClick={() => setModalNova(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nova solicitação
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard
          icon={<Clock className="h-5 w-5 text-amber-500" />}
          titulo="Aguardando liberação"
          valor={formatBRL(kpis?.pendentesValor ?? 0)}
          sub={`${kpis?.pendentesQtd ?? 0} solicitações`}
        />
        <KpiCard
          icon={<CheckCircle2 className="h-5 w-5 text-blue-500" />}
          titulo="Liberadas (a pagar)"
          valor={formatBRL(kpis?.aprovadasValor ?? 0)}
          sub={`${kpis?.aprovadasQtd ?? 0} solicitações`}
        />
        <KpiCard
          icon={<Wallet className="h-5 w-5 text-green-600" />}
          titulo="Pagas no mês"
          valor={formatBRL(kpis?.pagasMesValor ?? 0)}
          sub="Este mês"
        />
        <KpiCard
          icon={<XCircle className="h-5 w-5 text-destructive" />}
          titulo="Rejeitadas"
          valor={String(kpis?.rejeitadasQtd ?? 0)}
          sub="Total"
        />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <FileText className="h-10 w-10 mb-2 opacity-50" />
              <p>Nenhuma solicitação nesta aba.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Liberações</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((s) => {
                  const status = SOLICITACAO_STATUS_CONFIG[s.status];
                  return (
                    <TableRow
                      key={s.id}
                      className="cursor-pointer"
                      onClick={() => setSelecionada(s)}
                    >
                      <TableCell className="font-medium">
                        <div>{s.solicitante_nome}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[220px]">{s.descricao}</div>
                      </TableCell>
                      <TableCell>{SOLICITACAO_TIPO_LABEL[s.tipo] || s.tipo}</TableCell>
                      <TableCell>{categoriaLabel(s.categoria)}</TableCell>
                      <TableCell className="text-right font-medium">{formatBRL(s.valor)}</TableCell>
                      <TableCell>
                        <span className="text-muted-foreground">
                          {s.aprovacoes_count}/{s.aprovacoes_necessarias}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status?.variant || 'secondary'}>{status?.label || s.status}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatData(s.created_at)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <NovaSolicitacaoModal open={modalNova} onClose={() => setModalNova(false)} />
      <SolicitacaoDetalheDialog
        solicitacao={selecionada}
        open={!!selecionada}
        onClose={() => setSelecionada(null)}
      />
    </div>
  );
}

function KpiCard({
  icon, titulo, valor, sub,
}: { icon: React.ReactNode; titulo: string; valor: string; sub: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{titulo}</p>
          {icon}
        </div>
        <p className="text-2xl font-bold mt-2">{valor}</p>
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}

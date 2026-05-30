import { useState } from 'react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Search, ClipboardCheck, FileSignature, AlertTriangle } from 'lucide-react';
import {
  useAnalisesRelacionamento,
  useUltimaAnaliseRecebida,
  TIPO_CFG, STATUS_CFG,
  type AnaliseRelacionamento,
  type AnaliseRelacionamentoStatus, type AnaliseRelacionamentoTipo,
} from '@/hooks/useAnalisesRelacionamento';
import AnaliseRelacionamentoDrawer from '@/components/relacionamento/AnaliseRelacionamentoDrawer';

export default function AnalisesRelacionamento() {
  const [status, setStatus] = useState<AnaliseRelacionamentoStatus | 'todos'>('pendente');
  const [tipo, setTipo] = useState<AnaliseRelacionamentoTipo | 'todos'>('todos');
  const [busca, setBusca] = useState('');
  const [selecionada, setSelecionada] = useState<AnaliseRelacionamento | null>(null);

  const { data, isLoading } = useAnalisesRelacionamento({ status, tipo, busca });

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <ClipboardCheck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Análises de Relacionamento</h1>
          <p className="text-sm text-muted-foreground">
            Casos pós-assinatura de termo de cancelamento para tratativa com o associado.
          </p>
        </div>
      </div>

      <UltimoCasoChip />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Fila</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Tabs value={status} onValueChange={(v) => setStatus(v as any)}>
            <TabsList>
              <TabsTrigger value="pendente">Pendentes</TabsTrigger>
              <TabsTrigger value="em_andamento">Em Andamento</TabsTrigger>
              <TabsTrigger value="resolvido">Resolvidos</TabsTrigger>
              <TabsTrigger value="todos">Todos</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, CPF ou placa..."
                className="pl-8"
              />
            </div>
            <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
              <SelectTrigger className="w-[230px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                <SelectItem value="troca_titularidade">Troca de Titularidade</SelectItem>
                <SelectItem value="cancelamento_voluntario">Cancelamento Voluntário</SelectItem>
                <SelectItem value="substituicao">Substituição</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Associado</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Placa</TableHead>
                  <TableHead>Assinado em</TableHead>
                  <TableHead className="text-right">Termo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={7}>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                )}
                {!isLoading && (data?.length || 0) === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                      Nenhum caso encontrado.
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && data?.map((row) => {
                  const t = TIPO_CFG[row.tipo];
                  const s = STATUS_CFG[row.status];
                  const meta: any = row.metadata || {};
                  return (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => setSelecionada(row)}
                    >
                      <TableCell>
                        <Badge variant="outline" className={t.cls}>{t.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={s.cls}>{s.label}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{meta.associado_nome || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{meta.associado_cpf || '—'}</TableCell>
                      <TableCell className="font-mono">{meta.placa || meta.placa_antiga || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.termo_assinado_em
                          ? format(new Date(row.termo_assinado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.termo_url ? (
                          <a
                            href={row.termo_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <FileSignature className="h-3.5 w-3.5" /> Ver
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AnaliseRelacionamentoDrawer
        analise={selecionada}
        open={!!selecionada}
        onOpenChange={(o) => { if (!o) setSelecionada(null); }}
      />
    </div>
  );
}

function UltimoCasoChip() {
  const { data, isLoading } = useUltimaAnaliseRecebida();

  if (isLoading || data === null) return null;

  const { diasDesde, total30d } = data;

  let variant: 'default' | 'amber' | 'destructive' = 'default';
  if (diasDesde > 30) variant = 'destructive';
  else if (diasDesde > 7) variant = 'amber';

  const tempo =
    diasDesde === 0
      ? 'hoje'
      : formatDistanceToNowStrict(new Date(data.createdAt), {
          locale: ptBR,
          addSuffix: true,
        });

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            {variant === 'destructive' && (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            )}
            <Badge
              variant="outline"
              className={
                variant === 'destructive'
                  ? 'border-destructive text-destructive'
                  : variant === 'amber'
                    ? 'border-amber-500 text-amber-700 dark:text-amber-300'
                    : 'border-muted-foreground text-muted-foreground'
              }
            >
              Último caso: {tempo}
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs space-y-1">
          <p className="font-medium">Origem da ingestão</p>
          <p className="text-xs text-muted-foreground">
            3 triggers preenchem esta fila:
          </p>
          <ul className="list-disc pl-4 text-xs text-muted-foreground">
            <li>contratos.autentique_cancelamento_assinado_em</li>
            <li>solicitacoes_troca_titularidade.termo_cancelamento_assinado_em</li>
            <li>solicitacoes_substituicao_placa.termo_cancelamento_assinado_em</li>
          </ul>
          <p className="text-xs text-muted-foreground pt-1">
            Total nos últimos 30 dias: <strong>{total30d}</strong>
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function BannerFilaSilenciosa() {
  const { data } = useUltimaAnaliseRecebida();
  if (!data || data.diasDesde <= 14) return null;

  return (
    <Alert variant="destructive" className="mb-3">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Fila silenciosa há {data.diasDesde} dias</AlertTitle>
      <AlertDescription>
        Sem novos casos desde {format(new Date(data.createdAt), 'dd/MM/yyyy', { locale: ptBR })}.
        Verifique se os triggers de assinatura de termo de cancelamento estão ativos:
        {' '}
        <code className="text-xs bg-muted px-1 rounded">trg_analise_relacionamento_cancelamento_voluntario</code>,
        {' '}
        <code className="text-xs bg-muted px-1 rounded">trg_analise_relacionamento_troca</code>,
        {' '}
        <code className="text-xs bg-muted px-1 rounded">trg_analise_relacionamento_substituicao</code>.
      </AlertDescription>
    </Alert>
  );
}

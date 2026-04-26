import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Building2, Info, Loader2, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useSGABeneficios,
  useSGAProdutos,
  type SGABeneficio,
  type SGAProduto,
  type SGASituacao,
} from '@/hooks/useSGACatalogo';

function matchTexto(haystack: string, q: string) {
  return haystack.toLowerCase().includes(q.trim().toLowerCase());
}

export default function PlanosSGA() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'produtos' | 'beneficios'>('produtos');
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState<SGASituacao>('ativo');
  const [detalhe, setDetalhe] = useState<unknown>(null);

  const produtosQ = useSGAProdutos();
  const beneficiosQ = useSGABeneficios(situacao);

  const produtosFiltrados = useMemo(() => {
    const items = produtosQ.data?.items ?? [];
    if (!busca) return items;
    return items.filter((p) =>
      matchTexto(
        `${p.codigo_produto ?? ''} ${p.descricao ?? ''} ${p.descricao_tipo_veiculo ?? ''}`,
        busca,
      ),
    );
  }, [produtosQ.data, busca]);

  const beneficiosFiltrados = useMemo(() => {
    const items = beneficiosQ.data?.items ?? [];
    if (!busca) return items;
    return items.filter((b) =>
      matchTexto(`${b.codigo_beneficio ?? ''} ${b.descricao ?? ''}`, busca),
    );
  }, [beneficiosQ.data, busca]);

  function refresh() {
    if (tab === 'produtos') {
      queryClient.invalidateQueries({ queryKey: ['sga-catalogo', 'produtos'] });
    } else {
      queryClient.invalidateQueries({ queryKey: ['sga-catalogo', 'beneficios'] });
    }
  }

  const carregando = tab === 'produtos' ? produtosQ.isLoading : beneficiosQ.isLoading;
  const erro = tab === 'produtos' ? produtosQ.error : beneficiosQ.error;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Building2 className="h-6 w-6 text-primary" />
            Planos SGA (Hinova)
          </h1>
          <p className="text-sm text-muted-foreground">
            Visualização somente leitura do catálogo cadastrado no SGA.
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={carregando}>
          {carregando ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Atualizar da Hinova
        </Button>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Tela somente leitura</AlertTitle>
        <AlertDescription>
          Os dados abaixo refletem o cadastro atual no SGA. A criação e edição de planos no SGA
          continua sendo feita pelo painel da Hinova — esta tela serve para consultar os códigos
          existentes e mapeá-los aos planos locais quando necessário.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Catálogo</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'produtos' | 'beneficios')}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <TabsList>
                <TabsTrigger value="produtos">Produtos / Planos</TabsTrigger>
                <TabsTrigger value="beneficios">Benefícios</TabsTrigger>
              </TabsList>

              <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center md:justify-end">
                {tab === 'beneficios' && (
                  <Select value={situacao} onValueChange={(v) => setSituacao(v as SGASituacao)}>
                    <SelectTrigger className="w-full md:w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativos</SelectItem>
                      <SelectItem value="inativo">Inativos</SelectItem>
                      <SelectItem value="todos">Todos</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Buscar por código ou nome…"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {erro && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro ao consultar SGA</AlertTitle>
                <AlertDescription>
                  {erro instanceof Error ? erro.message : 'Erro desconhecido'}
                </AlertDescription>
              </Alert>
            )}

            <TabsContent value="produtos" className="mt-4">
              <ProdutosTable
                loading={produtosQ.isLoading}
                items={produtosFiltrados}
                onShowDetalhe={setDetalhe}
                cached={produtosQ.data?.meta.cached}
                total={produtosQ.data?.items.length ?? 0}
              />
            </TabsContent>

            <TabsContent value="beneficios" className="mt-4">
              <BeneficiosTable
                loading={beneficiosQ.isLoading}
                items={beneficiosFiltrados}
                onShowDetalhe={setDetalhe}
                cached={beneficiosQ.data?.meta.cached}
                total={beneficiosQ.data?.items.length ?? 0}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do registro SGA</DialogTitle>
            <DialogDescription>JSON completo retornado pela API da Hinova.</DialogDescription>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(detalhe, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface TableProps<T> {
  loading: boolean;
  items: T[];
  onShowDetalhe: (item: unknown) => void;
  cached?: boolean;
  total: number;
}

function MetaLine({ cached, mostrando, total }: { cached?: boolean; mostrando: number; total: number }) {
  return (
    <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
      <span>
        Mostrando <strong>{mostrando}</strong> de {total}
      </span>
      {cached && <Badge variant="secondary">Cache</Badge>}
    </div>
  );
}

function ProdutosTable({ loading, items, onShowDetalhe, cached, total }: TableProps<SGAProduto>) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Buscando produtos no SGA…
      </div>
    );
  }
  return (
    <>
      <MetaLine cached={cached} mostrando={items.length} total={total} />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Código</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Tipo veículo</TableHead>
              <TableHead>Base</TableHead>
              <TableHead>Formato</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Regional</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  Nenhum produto encontrado.
                </TableCell>
              </TableRow>
            )}
            {items.map((p, idx) => {
              const vigente = String(p.vigente ?? '').toUpperCase() === 'S';
              return (
                <TableRow key={`${p.codigo_produto ?? idx}`}>
                  <TableCell className="font-mono text-xs">{String(p.codigo_produto ?? '—')}</TableCell>
                  <TableCell className="font-medium">{p.descricao ?? '—'}</TableCell>
                  <TableCell>{p.descricao_tipo_veiculo ?? '—'}</TableCell>
                  <TableCell>{p.base_cobranca ?? '—'}</TableCell>
                  <TableCell>{p.formato_cobranca ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={vigente ? 'default' : 'secondary'}>
                      {vigente ? 'Vigente' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.regionais?.map((r) => r.nome_regional).filter(Boolean).join(', ') || '—'}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => onShowDetalhe(p)}>
                      Ver
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function BeneficiosTable({ loading, items, onShowDetalhe, cached, total }: TableProps<SGABeneficio>) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Buscando benefícios no SGA…
      </div>
    );
  }
  return (
    <>
      <MetaLine cached={cached} mostrando={items.length} total={total} />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Código</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  Nenhum benefício encontrado.
                </TableCell>
              </TableRow>
            )}
            {items.map((b, idx) => {
              const ativa = String(b.situacao ?? '').toLowerCase().includes('ativ');
              return (
                <TableRow key={`${b.codigo_beneficio ?? idx}`}>
                  <TableCell className="font-mono text-xs">{String(b.codigo_beneficio ?? '—')}</TableCell>
                  <TableCell className="font-medium">{b.descricao ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={ativa ? 'default' : 'secondary'}>{b.situacao ?? '—'}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => onShowDetalhe(b)}>
                      Ver
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

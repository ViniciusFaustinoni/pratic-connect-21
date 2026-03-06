import { useState, useMemo } from 'react';
import { useConfigLimitesVeiculo } from '@/hooks/useConfigLimitesVeiculo';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRight, AlertTriangle, Search, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useSubstituicoes } from '@/hooks/useSubstituicaoVeiculo';
import { STATUS_SUBSTITUICAO_LABELS, STATUS_SUBSTITUICAO_CORES } from '@/types/substituicao';
import type { StatusSubstituicao } from '@/types/substituicao';

const TAB_FILTERS: Record<string, StatusSubstituicao[] | null> = {
  pendentes: ['aguardando_aprovacao'],
  aprovadas: ['aprovada'],
  rejeitadas: ['rejeitada'],
  efetivadas: ['efetivada'],
  todas: null,
};

export default function SubstituicoesPendentesPage() {
  const navigate = useNavigate();
  const { data: substituicoes, isLoading, refetch } = useSubstituicoes();
  const { data: limites } = useConfigLimitesVeiculo();
  const [tab, setTab] = useState('pendentes');
  const [busca, setBusca] = useState('');

  const filtered = useMemo(() => {
    if (!substituicoes) return [];
    let items = substituicoes;

    // Filter by tab
    const statusFilter = TAB_FILTERS[tab];
    if (statusFilter) {
      items = items.filter((s) => statusFilter.includes(s.status as StatusSubstituicao));
    }

    // Filter by search
    if (busca.trim()) {
      const q = busca.toLowerCase();
      items = items.filter(
        (s) =>
          s.associado?.nome?.toLowerCase().includes(q) ||
          s.veiculo_antigo_placa?.toLowerCase().includes(q) ||
          s.veiculo_novo_placa?.toLowerCase().includes(q)
      );
    }

    return items;
  }, [substituicoes, tab, busca]);

  const pendentesCount = useMemo(
    () => substituicoes?.filter((s) => s.status === 'aguardando_aprovacao').length ?? 0,
    [substituicoes]
  );

  const formatCurrency = (v: number | null) =>
    v != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : '—';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Substituições de Veículo</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie as solicitações de substituição de veículo dos associados
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="pendentes">
              Pendentes {pendentesCount > 0 && (
                <Badge variant="destructive" className="ml-1.5 text-xs px-1.5 py-0">{pendentesCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="aprovadas">Aprovadas</TabsTrigger>
            <TabsTrigger value="rejeitadas">Rejeitadas</TabsTrigger>
            <TabsTrigger value="efetivadas">Efetivadas</TabsTrigger>
            <TabsTrigger value="todas">Todas</TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar associado ou placa..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* All tabs share the same table, filtered differently */}
        {Object.keys(TAB_FILTERS).map((tabKey) => (
          <TabsContent key={tabKey} value={tabKey} className="mt-4">
            {isLoading ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Carregando...</CardContent></Card>
            ) : filtered.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma substituição encontrada.</CardContent></Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Associado</TableHead>
                        <TableHead>Veículo Antigo</TableHead>
                        <TableHead>Veículo Novo</TableHead>
                        <TableHead>Mensalidade</TableHead>
                        <TableHead>FIPE Nova</TableHead>
                        <TableHead>Data Solicitação</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-20">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((s) => (
                        <TableRow
                          key={s.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/cadastro/substituicoes/${s.id}`)}
                        >
                          <TableCell className="font-medium">{s.associado?.nome || '—'}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {s.veiculo_antigo_modelo || s.veiculo_antigo?.modelo || '—'}
                              <span className="text-muted-foreground ml-1">
                                {s.veiculo_antigo_placa || s.veiculo_antigo?.placa || ''}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {s.veiculo_novo_modelo || s.veiculo_novo?.modelo || '—'}
                              <span className="text-muted-foreground ml-1">
                                {s.veiculo_novo_placa || s.veiculo_novo?.placa || ''}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">
                              {formatCurrency(s.mensalidade_antiga)} → {formatCurrency(s.mensalidade_nova)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {formatCurrency(s.veiculo_novo_fipe)}
                              {(s.veiculo_novo_fipe ?? 0) > (limites?.fipeLimiteAutorizacao ?? 120000) && (
                                <Badge variant="destructive" className="text-[10px] px-1">
                                  <AlertTriangle className="h-3 w-3 mr-0.5" />FIPE ALTA
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(s.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Badge className={STATUS_SUBSTITUICAO_CORES[s.status as StatusSubstituicao] || 'bg-gray-100 text-gray-800'}>
                              {STATUS_SUBSTITUICAO_LABELS[s.status as StatusSubstituicao] || s.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

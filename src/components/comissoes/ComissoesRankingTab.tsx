import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UserAvatar } from '@/components/UserAvatar';
import { Trophy, Medal, Award, Users, Plus } from 'lucide-react';
import { useComissoesRanking } from '@/hooks/useComissoesRanking';
import { Skeleton } from '@/components/ui/skeleton';

interface ComissoesRankingTabProps {
  mes: number;
  ano: number;
  hasCampanha: boolean;
  onCriarCampanha?: () => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const PosicaoIcon = ({ posicao }: { posicao: number | null }) => {
  if (!posicao) return <span className="text-muted-foreground">-</span>;
  
  switch (posicao) {
    case 1:
      return <Trophy className="h-5 w-5 text-yellow-500" />;
    case 2:
      return <Medal className="h-5 w-5 text-gray-400" />;
    case 3:
      return <Award className="h-5 w-5 text-amber-600" />;
    default:
      return <span className="text-muted-foreground font-medium">{posicao}º</span>;
  }
};

interface RankingTableProps {
  ranking: Array<{
    vendedor_id: string;
    vendedor_nome?: string;
    vendedor_avatar?: string | null;
    vendas_liquidas: number;
    trocas_titularidade: number;
    valor_premio: number;
    posicao_ranking: number | null;
  }>;
  isLoading?: boolean;
}

function RankingTable({ ranking, isLoading }: RankingTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (ranking.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Nenhum vendedor nesta categoria</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[60px]">#</TableHead>
          <TableHead>Vendedor</TableHead>
          <TableHead className="text-right">Vendas Líq.</TableHead>
          <TableHead className="text-right">Trocas</TableHead>
          <TableHead className="text-right">Prêmio</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ranking.map((r, index) => (
          <TableRow 
            key={r.vendedor_id}
            className={index < 3 ? 'bg-muted/30' : ''}
          >
            <TableCell>
              <PosicaoIcon posicao={r.posicao_ranking} />
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <UserAvatar
                  src={r.vendedor_avatar || undefined}
                  name={r.vendedor_nome || 'Vendedor'}
                  size="sm"
                />
                <span className={index < 3 ? 'font-semibold' : ''}>
                  {r.vendedor_nome || 'Desconhecido'}
                </span>
              </div>
            </TableCell>
            <TableCell className="text-right font-medium">
              {r.vendas_liquidas}
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              {r.trocas_titularidade}
            </TableCell>
            <TableCell className="text-right">
              {r.valor_premio > 0 ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  {formatCurrency(r.valor_premio)}
                </Badge>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ComissoesRankingTab({
  mes,
  ano,
  hasCampanha,
  onCriarCampanha,
}: ComissoesRankingTabProps) {
  const { rankingPorCategoria, totalPlacas, faixaPlacas, isLoading } = useComissoesRanking(mes, ano);

  if (!hasCampanha) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma campanha aberta</h3>
            <p className="text-muted-foreground mb-4">
              Crie uma campanha para este mês para visualizar o ranking
            </p>
            {onCriarCampanha && (
              <Button onClick={onCriarCampanha}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Campanha
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Faixa de placas */}
      {faixaPlacas > 0 && (
        <Card className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20 border-yellow-200">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Trophy className="h-8 w-8 text-yellow-600" />
                <div>
                  <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                    Faixa {faixaPlacas} Placas Atingida!
                  </h3>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    Total: {totalPlacas} vendas confirmadas
                  </p>
                </div>
              </div>
              <Badge className="bg-yellow-500 text-white text-lg px-4 py-1">
                {faixaPlacas}+
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rankings por categoria */}
      <Tabs defaultValue="interno-mais" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="interno-mais">
            Interno +1 Ano ({rankingPorCategoria.internoMais1Ano.length})
          </TabsTrigger>
          <TabsTrigger value="interno-menos">
            Interno -1 Ano ({rankingPorCategoria.internoMenos1Ano.length})
          </TabsTrigger>
          <TabsTrigger value="externo">
            Externo ({rankingPorCategoria.externo.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="interno-mais" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Consultores Internos com mais de 1 ano</CardTitle>
            </CardHeader>
            <CardContent>
              <RankingTable ranking={rankingPorCategoria.internoMais1Ano} isLoading={isLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="interno-menos" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Consultores Internos com menos de 1 ano</CardTitle>
            </CardHeader>
            <CardContent>
              <RankingTable ranking={rankingPorCategoria.internoMenos1Ano} isLoading={isLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="externo" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Consultores Externos</CardTitle>
            </CardHeader>
            <CardContent>
              <RankingTable ranking={rankingPorCategoria.externo} isLoading={isLoading} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

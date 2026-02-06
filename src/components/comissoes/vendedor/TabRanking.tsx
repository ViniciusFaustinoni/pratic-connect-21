import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Trophy, Medal, Award, Users } from 'lucide-react';
import type { MeuRanking, RankingPublico } from '@/hooks/useMinhasComissoesExtended';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';

interface TabRankingProps {
  meuRanking: MeuRanking | null;
  rankingPublico: RankingPublico[];
  isLoading: boolean;
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
      return <span className="text-4xl">🥇</span>;
    case 2:
      return <span className="text-4xl">🥈</span>;
    case 3:
      return <span className="text-4xl">🥉</span>;
    default:
      return <span className="text-2xl font-bold text-muted-foreground">{posicao}º</span>;
  }
};

export function TabRanking({
  meuRanking,
  rankingPublico,
  isLoading,
}: TabRankingProps) {
  const { user } = useAuth();
  const userId = user?.id;

  const isTop3 = meuRanking && meuRanking.posicao_ranking && meuRanking.posicao_ranking <= 3;

  // Calcular vendas necessárias para 3º lugar
  const terceiroLugar = rankingPublico.find(r => r.posicao_ranking === 3);
  const vendasParaTerceiro = terceiroLugar 
    ? terceiroLugar.vendas_liquidas - (meuRanking?.vendas_liquidas || 0) + 1
    : null;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!meuRanking) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold mb-2">Ranking Não Disponível</h3>
          <p className="text-muted-foreground">
            O ranking ainda não foi calculado para este mês ou não há campanha ativa.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Card de destaque da posição */}
      <Card className={isTop3 ? 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20 border-yellow-200' : ''}>
        <CardContent className="py-8">
          <div className="flex flex-col items-center text-center">
            <PosicaoIcon posicao={meuRanking.posicao_ranking} />
            
            {isTop3 ? (
              <>
                <h2 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mt-4">
                  Parabéns! 🎉
                </h2>
                <p className="text-muted-foreground mt-2">
                  Você está no Top 3 com {meuRanking.vendas_liquidas} vendas líquidas!
                </p>
                {meuRanking.valor_premio > 0 && (
                  <Badge className="mt-4 bg-yellow-500 text-white text-lg px-4 py-2">
                    Prêmio: {formatCurrency(meuRanking.valor_premio)}
                  </Badge>
                )}
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold mt-4">
                  Você está em {meuRanking.posicao_ranking}º lugar
                </h2>
                <p className="text-muted-foreground mt-2">
                  {meuRanking.vendas_liquidas} vendas líquidas
                </p>
                {vendasParaTerceiro && vendasParaTerceiro > 0 && (
                  <p className="text-blue-600 mt-4 font-medium">
                    Faltam apenas {vendasParaTerceiro} vendas para alcançar o 3º lugar!
                  </p>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info da campanha */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Ranking da Campanha ({meuRanking.total_participantes} participantes)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">#</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Vendas Líquidas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankingPublico.slice(0, 10).map((r) => {
                const isMe = r.vendedor_id === userId;
                return (
                  <TableRow 
                    key={r.vendedor_id}
                    className={isMe ? 'bg-primary/10 font-medium' : ''}
                  >
                    <TableCell>
                      {r.posicao_ranking === 1 && <span className="text-lg">🥇</span>}
                      {r.posicao_ranking === 2 && <span className="text-lg">🥈</span>}
                      {r.posicao_ranking === 3 && <span className="text-lg">🥉</span>}
                      {r.posicao_ranking && r.posicao_ranking > 3 && (
                        <span className="text-muted-foreground">{r.posicao_ranking}º</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {r.vendedor_nome}
                        {isMe && <Badge variant="outline" className="text-xs">Você</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {r.vendas_liquidas}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {rankingPublico.length > 10 && (
            <p className="text-sm text-muted-foreground text-center mt-4">
              Exibindo os 10 primeiros de {meuRanking.total_participantes} participantes
            </p>
          )}
        </CardContent>
      </Card>

      {/* Prêmio do vendedor */}
      {meuRanking.valor_premio > 0 && (
        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Seu Prêmio de Classificação</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                  {formatCurrency(meuRanking.valor_premio)}
                </p>
              </div>
              <Trophy className="h-10 w-10 text-green-600" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

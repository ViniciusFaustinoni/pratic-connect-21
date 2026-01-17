import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, Minus, Layers } from 'lucide-react';
import { formatFipe, formatPercentual, type RateioPorCota } from '@/hooks/useFaixasCotas';

interface RateioDetalhesFaixasCardProps {
  detalhesFaixas: RateioPorCota[];
  isLoading?: boolean;
}

const formatCurrency = (value: number | null) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

export function RateioDetalhesFaixasCard({ detalhesFaixas, isLoading }: RateioDetalhesFaixasCardProps) {
  if (!detalhesFaixas || detalhesFaixas.length === 0) {
    return null;
  }

  const getAjusteBadge = (ajuste: number) => {
    if (ajuste < 0) {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <TrendingDown className="h-3 w-3 mr-1" />
          {formatPercentual(ajuste)}
        </Badge>
      );
    }
    if (ajuste > 0) {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <TrendingUp className="h-3 w-3 mr-1" />
          {formatPercentual(ajuste)}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-gray-50 text-gray-600">
        <Minus className="h-3 w-3 mr-1" />
        0%
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-5 w-5" />
          Detalhes por Faixa FIPE
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Faixa FIPE</TableHead>
              <TableHead className="text-center">Cotas</TableHead>
              <TableHead className="text-center">Contratos</TableHead>
              <TableHead className="text-center">Total Cotas</TableHead>
              <TableHead className="text-center">Ajuste (%)</TableHead>
              <TableHead className="text-right">Valor Base</TableHead>
              <TableHead className="text-right">Valor Final</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detalhesFaixas.map((detalhe, idx) => (
              <TableRow key={detalhe.faixa_id || idx}>
                <TableCell>
                  <span className="font-medium">{formatFipe(detalhe.fipe_de)}</span>
                  <span className="text-muted-foreground mx-1">até</span>
                  <span className="font-medium">{formatFipe(detalhe.fipe_ate)}</span>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{detalhe.quantidade_cotas}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  {detalhe.contratos_na_faixa || 0}
                </TableCell>
                <TableCell className="text-center">
                  {(detalhe.total_cotas_faixa || 0).toLocaleString('pt-BR')}
                </TableCell>
                <TableCell className="text-center">
                  {getAjusteBadge(detalhe.ajuste_percentual)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatCurrency(detalhe.valor_base_cota)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(detalhe.valor_final_cota)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

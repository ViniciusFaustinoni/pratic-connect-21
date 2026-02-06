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
import { UserAvatar } from '@/components/UserAvatar';
import { TrendingUp } from 'lucide-react';
import type { VendedorResumo } from '@/hooks/useComissoesExtended';
import { Skeleton } from '@/components/ui/skeleton';

interface ComissoesResumoTableProps {
  resumoVendedores: VendedorResumo[];
  isLoading: boolean;
  onVendedorClick?: (vendedorId: string) => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function ComissoesResumoTable({
  resumoVendedores,
  isLoading,
  onVendedorClick,
}: ComissoesResumoTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo por Vendedor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const totais = resumoVendedores.reduce(
    (acc, v) => ({
      adesao: acc.adesao + v.total_adesao,
      recorrente: acc.recorrente + v.total_recorrente,
      producao: acc.producao + v.total_producao,
      classificacao: acc.classificacao + v.total_classificacao,
      crescimento: acc.crescimento + v.total_crescimento,
      recorde: acc.recorde + v.total_recorde,
      total: acc.total + v.total_geral,
      vendas: acc.vendas + v.vendas_confirmadas,
    }),
    { adesao: 0, recorrente: 0, producao: 0, classificacao: 0, crescimento: 0, recorde: 0, total: 0, vendas: 0 }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Resumo por Vendedor ({resumoVendedores.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Vendas</TableHead>
                <TableHead className="text-right text-blue-600">Adesão</TableHead>
                <TableHead className="text-right text-green-600">Recorr.</TableHead>
                <TableHead className="text-right text-purple-600">Produção</TableHead>
                <TableHead className="text-right text-orange-600">Classif.</TableHead>
                <TableHead className="text-right text-cyan-600">Cresc.</TableHead>
                <TableHead className="text-right text-yellow-600">Recorde</TableHead>
                <TableHead className="text-right font-bold">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resumoVendedores.map((v) => (
                <TableRow 
                  key={v.vendedor_id}
                  className={onVendedorClick ? 'cursor-pointer hover:bg-muted/50' : ''}
                  onClick={() => onVendedorClick?.(v.vendedor_id)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <UserAvatar
                        src={v.vendedor_avatar || undefined}
                        name={v.vendedor_nome}
                        size="sm"
                      />
                      <span className="truncate max-w-[120px] font-medium">
                        {v.vendedor_nome}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={v.tipo_consultor === 'interno' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {v.tipo_consultor === 'interno' ? 'Int' : 'Ext'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{v.vendas_confirmadas}</TableCell>
                  <TableCell className="text-right text-blue-600">
                    {v.total_adesao > 0 ? formatCurrency(v.total_adesao) : '-'}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    {v.total_recorrente > 0 ? formatCurrency(v.total_recorrente) : '-'}
                  </TableCell>
                  <TableCell className="text-right text-purple-600">
                    {v.total_producao > 0 ? formatCurrency(v.total_producao) : '-'}
                  </TableCell>
                  <TableCell className="text-right text-orange-600">
                    {v.total_classificacao > 0 ? formatCurrency(v.total_classificacao) : '-'}
                  </TableCell>
                  <TableCell className="text-right text-cyan-600">
                    {v.total_crescimento > 0 ? formatCurrency(v.total_crescimento) : '-'}
                  </TableCell>
                  <TableCell className="text-right text-yellow-600">
                    {v.total_recorde > 0 ? formatCurrency(v.total_recorde) : '-'}
                  </TableCell>
                  <TableCell className="text-right font-bold text-primary">
                    {formatCurrency(v.total_geral)}
                  </TableCell>
                </TableRow>
              ))}

              {/* Linha de totais */}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell colSpan={2}>TOTAL</TableCell>
                <TableCell className="text-right">{totais.vendas}</TableCell>
                <TableCell className="text-right text-blue-600">
                  {formatCurrency(totais.adesao)}
                </TableCell>
                <TableCell className="text-right text-green-600">
                  {formatCurrency(totais.recorrente)}
                </TableCell>
                <TableCell className="text-right text-purple-600">
                  {formatCurrency(totais.producao)}
                </TableCell>
                <TableCell className="text-right text-orange-600">
                  {formatCurrency(totais.classificacao)}
                </TableCell>
                <TableCell className="text-right text-cyan-600">
                  {formatCurrency(totais.crescimento)}
                </TableCell>
                <TableCell className="text-right text-yellow-600">
                  {formatCurrency(totais.recorde)}
                </TableCell>
                <TableCell className="text-right font-bold text-primary">
                  {formatCurrency(totais.total)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

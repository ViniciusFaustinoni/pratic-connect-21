import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCustosReparos } from '@/hooks/useCustosReparos';

interface Props {
  ano: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export function CustosReparosPorTipoSinistro({ ano }: Props) {
  const { data, isLoading } = useCustosReparos(ano);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const { tiposSinistro } = data || { tiposSinistro: [] };

  if (tiposSinistro.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Nenhum dado disponível para o período</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Composição de Custos por Tipo de Sinistro</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo de Sinistro</TableHead>
              <TableHead className="text-right">Peças</TableHead>
              <TableHead className="text-right">Mão de Obra</TableHead>
              <TableHead className="text-right">Serv. Terceiros</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tiposSinistro.map(ts => {
              const pecaPercent = ts.total > 0 ? ((ts.peca / ts.total) * 100).toFixed(0) : 0;
              const moPercent = ts.total > 0 ? ((ts.mao_de_obra / ts.total) * 100).toFixed(0) : 0;
              const tercPercent = ts.total > 0 ? ((ts.servico_terceiro / ts.total) * 100).toFixed(0) : 0;
              
              return (
                <TableRow key={ts.tipoSinistro}>
                  <TableCell className="font-medium">{ts.tipoSinistroLabel}</TableCell>
                  <TableCell className="text-right">
                    <div>
                      {formatCurrency(ts.peca)}
                      <span className="text-xs text-muted-foreground ml-1">({pecaPercent}%)</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div>
                      {formatCurrency(ts.mao_de_obra)}
                      <span className="text-xs text-muted-foreground ml-1">({moPercent}%)</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div>
                      {formatCurrency(ts.servico_terceiro)}
                      <span className="text-xs text-muted-foreground ml-1">({tercPercent}%)</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(ts.total)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

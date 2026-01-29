import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

const formatCurrency = (value: number | null) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

const formatPercent = (value: number | null) => {
  return `${(value || 0).toFixed(2)}%`;
};

interface Props {
  ano: number;
}

export function SinistrosPorFaixaFipeTable({ ano }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['sinistros-por-faixa-fipe', ano],
    queryFn: async () => {
      const inicioAno = `${ano}-01-01`;
      const fimAno = `${ano}-12-31`;

      // Buscar sinistros do ano com veículos
      const { data: sinistros, error } = await supabase
        .from('sinistros')
        .select(`
          id,
          valor_indenizacao,
          veiculo_id,
          veiculos!inner(valor_fipe)
        `)
        .in('status', ['aprovado', 'indenizado', 'pago'])
        .gte('data_ocorrencia', inicioAno)
        .lte('data_ocorrencia', fimAno);

      if (error) throw error;

      // Definir faixas FIPE
      const faixas = [
        { label: 'Até R$ 30.000', min: 0, max: 30000 },
        { label: 'R$ 30.001 - R$ 50.000', min: 30001, max: 50000 },
        { label: 'R$ 50.001 - R$ 80.000', min: 50001, max: 80000 },
        { label: 'R$ 80.001 - R$ 120.000', min: 80001, max: 120000 },
        { label: 'R$ 120.001 - R$ 200.000', min: 120001, max: 200000 },
        { label: 'Acima de R$ 200.000', min: 200001, max: Infinity },
      ];

      // Agrupar por faixa
      const porFaixa = faixas.map((faixa) => ({
        ...faixa,
        quantidade: 0,
        valorTotal: 0,
        valorMedio: 0,
      }));

      let totalValor = 0;
      let totalQuantidade = 0;

      (sinistros || []).forEach((s) => {
        const valorFipe = (s.veiculos as any)?.valor_fipe || 0;
        const faixaIndex = faixas.findIndex((f) => valorFipe >= f.min && valorFipe <= f.max);
        if (faixaIndex >= 0) {
          porFaixa[faixaIndex].quantidade += 1;
          porFaixa[faixaIndex].valorTotal += s.valor_indenizacao || 0;
          totalValor += s.valor_indenizacao || 0;
          totalQuantidade += 1;
        }
      });

      // Calcular percentuais e médias
      return porFaixa.map((faixa) => ({
        ...faixa,
        valorMedio: faixa.quantidade > 0 ? faixa.valorTotal / faixa.quantidade : 0,
        percentualQtd: totalQuantidade > 0 ? (faixa.quantidade / totalQuantidade) * 100 : 0,
        percentualValor: totalValor > 0 ? (faixa.valorTotal / totalValor) * 100 : 0,
      }));
    },
  });

  if (isLoading) {
    return <Skeleton className="h-[200px] w-full" />;
  }

  if (!data) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Nenhum dado disponível.
      </div>
    );
  }

  const totalSinistros = data.reduce((sum, f) => sum + f.quantidade, 0);

  if (totalSinistros === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Nenhum sinistro com veículo associado no ano selecionado.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Faixa FIPE</TableHead>
          <TableHead className="text-right">Sinistros</TableHead>
          <TableHead className="text-right">% Qtd</TableHead>
          <TableHead className="text-right">Valor Total</TableHead>
          <TableHead className="text-right">Ticket Médio</TableHead>
          <TableHead className="w-[150px]">Participação</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item) => (
          <TableRow key={item.label}>
            <TableCell className="font-medium">
              {item.label}
              {item.percentualValor > 25 && (
                <Badge variant="destructive" className="ml-2 text-xs">
                  Alta concentração
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-right">{item.quantidade}</TableCell>
            <TableCell className="text-right">{formatPercent(item.percentualQtd)}</TableCell>
            <TableCell className="text-right text-destructive">
              {formatCurrency(item.valorTotal)}
            </TableCell>
            <TableCell className="text-right">{formatCurrency(item.valorMedio)}</TableCell>
            <TableCell>
              <Progress value={item.percentualValor} className="h-2" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

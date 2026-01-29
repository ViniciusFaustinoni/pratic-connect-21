import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';

const formatCurrency = (value: number | null) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

const formatPercent = (value: number | null) => {
  return `${(value || 0).toFixed(2)}%`;
};

const tipoLabels: Record<string, string> = {
  roubo_furto: 'Roubo/Furto',
  colisao: 'Colisão',
  incendio: 'Incêndio',
  fenomenos_naturais: 'Fenômenos Naturais',
  terceiros: 'Terceiros',
  perda_total: 'Perda Total',
  outros: 'Outros',
};

interface Props {
  ano: number;
}

export function SinistrosPorTipoTable({ ano }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['sinistros-por-tipo', ano],
    queryFn: async () => {
      const inicioAno = `${ano}-01-01`;
      const fimAno = `${ano}-12-31`;

      // Buscar sinistros do ano agrupados por tipo
      const { data: sinistros, error } = await supabase
        .from('sinistros')
        .select('tipo, valor_indenizacao')
        .in('status', ['aprovado', 'indenizado', 'pago'])
        .gte('data_ocorrencia', inicioAno)
        .lte('data_ocorrencia', fimAno);

      if (error) throw error;

      // Agrupar por tipo
      const porTipo: Record<string, { quantidade: number; valor: number }> = {};
      let totalValor = 0;
      let totalQuantidade = 0;

      (sinistros || []).forEach((s) => {
        const tipo = s.tipo || 'outros';
        if (!porTipo[tipo]) {
          porTipo[tipo] = { quantidade: 0, valor: 0 };
        }
        porTipo[tipo].quantidade += 1;
        porTipo[tipo].valor += s.valor_indenizacao || 0;
        totalValor += s.valor_indenizacao || 0;
        totalQuantidade += 1;
      });

      return Object.entries(porTipo)
        .map(([tipo, dados]) => ({
          tipo,
          label: tipoLabels[tipo] || tipo,
          quantidade: dados.quantidade,
          valor: dados.valor,
          percentualQtd: totalQuantidade > 0 ? (dados.quantidade / totalQuantidade) * 100 : 0,
          percentualValor: totalValor > 0 ? (dados.valor / totalValor) * 100 : 0,
        }))
        .sort((a, b) => b.valor - a.valor);
    },
  });

  if (isLoading) {
    return <Skeleton className="h-[200px] w-full" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Nenhum sinistro registrado no ano selecionado.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tipo de Evento</TableHead>
          <TableHead className="text-right">Quantidade</TableHead>
          <TableHead className="text-right">% Qtd</TableHead>
          <TableHead className="text-right">Valor Total</TableHead>
          <TableHead className="text-right">% Valor</TableHead>
          <TableHead className="w-[150px]">Participação</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item) => (
          <TableRow key={item.tipo}>
            <TableCell className="font-medium">{item.label}</TableCell>
            <TableCell className="text-right">{item.quantidade}</TableCell>
            <TableCell className="text-right">{formatPercent(item.percentualQtd)}</TableCell>
            <TableCell className="text-right text-destructive">
              {formatCurrency(item.valor)}
            </TableCell>
            <TableCell className="text-right">{formatPercent(item.percentualValor)}</TableCell>
            <TableCell>
              <Progress value={item.percentualValor} className="h-2" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

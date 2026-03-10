import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTabelasPreco } from '@/hooks/usePlanos';

interface TabelaPrecosProps {
  titulo?: string;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function TabelaPrecosGeneric({ titulo }: TabelaPrecosProps) {
  const { data: tabelas, isLoading } = useTabelasPreco();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Ordenar por fipe_min
  const tabelasOrdenadas = tabelas?.sort((a, b) => 
    Number(a.fipe_min) - Number(b.fipe_min)
  ) || [];

  if (tabelasOrdenadas.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{titulo || 'Tabela de Preços'}</CardTitle>
          <CardDescription>Nenhuma tabela de preços disponível</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo || 'Tabela de Preços'}</CardTitle>
        <CardDescription>Valores mensais por faixa FIPE</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3">Faixa FIPE</th>
                <th className="text-left py-2 px-3">Linha</th>
                <th className="text-left py-2 px-3">Região</th>
                <th className="text-right py-2 px-3">Valor Mensal</th>
                <th className="text-right py-2 px-3">Valor Deságio</th>
              </tr>
            </thead>
            <tbody>
              {tabelasOrdenadas.slice(0, 20).map((tabela) => {
                const valorMensal = Number(tabela.valor_mensal);

                return (
                  <tr key={tabela.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-3">
                      {formatCurrency(Number(tabela.fipe_min))} - {formatCurrency(Number(tabela.fipe_max))}
                    </td>
                    <td className="py-2 px-3">
                      {tabela.linha_slug || '-'}
                    </td>
                    <td className="py-2 px-3">
                      {tabela.regiao || '-'}
                    </td>
                    <td className="text-right py-2 px-3 font-medium">
                      {valorMensal > 0 ? formatCurrency(valorMensal) : (
                        <span className="text-xs text-muted-foreground italic">Consulte um consultor</span>
                      )}
                    </td>
                    <td className="text-right py-2 px-3">
                      {tabela.valor_desagio ? formatCurrency(Number(tabela.valor_desagio)) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function TabelaPrecosCarros({ titulo }: TabelaPrecosProps) {
  return <TabelaPrecosGeneric titulo={titulo || 'Tabela de Preços - Carros'} />;
}

export function TabelaPrecosMotos() {
  return <TabelaPrecosGeneric titulo="Tabela de Preços - Motos" />;
}

export function TabelaPrecosEletricos() {
  return <TabelaPrecosGeneric titulo="Tabela de Preços - Elétricos" />;
}

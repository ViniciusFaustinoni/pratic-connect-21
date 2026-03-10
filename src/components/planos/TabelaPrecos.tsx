import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
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

  // Ordenar por fipe_de
  const tabelasOrdenadas = tabelas?.sort((a, b) => 
    Number(a.fipe_de) - Number(b.fipe_de)
  ) || [];

  // Verificar se há dados válidos (taxa_comercial > 0)
  const temDadosValidos = tabelasOrdenadas.some(t => Number(t.taxa_comercial) > 0);

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
                <th className="text-right py-2 px-3">Taxa Comercial</th>
                <th className="text-right py-2 px-3">Taxa Administrativa</th>
                <th className="text-right py-2 px-3">Taxa Aplicativo</th>
              </tr>
            </thead>
            <tbody>
              {tabelasOrdenadas.slice(0, 10).map((tabela) => {
                const taxaComercial = Number(tabela.taxa_comercial);
                // Fallback: estimar 2.5% do valor FIPE médio da faixa ao mês
                const fipeMedia = (Number(tabela.fipe_de) + Number(tabela.fipe_ate)) / 2;
                const taxaEstimada = taxaComercial > 0 ? taxaComercial : Math.round(fipeMedia * 0.025 / 12);

                return (
                  <tr key={tabela.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-3">
                      {formatCurrency(Number(tabela.fipe_de))} - {formatCurrency(Number(tabela.fipe_ate))}
                    </td>
                    <td className="text-right py-2 px-3 font-medium">
                      {formatCurrency(taxaEstimada)}
                      {taxaComercial === 0 && <span className="text-xs text-muted-foreground ml-1">*</span>}
                    </td>
                    <td className="text-right py-2 px-3">
                      {formatCurrency(Number(tabela.taxa_administrativa) || 0)}
                    </td>
                    <td className="text-right py-2 px-3">
                      {formatCurrency(Number(tabela.taxa_aplicativo) || 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!temDadosValidos && (
            <p className="text-xs text-muted-foreground mt-2">* Valores estimados</p>
          )}
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

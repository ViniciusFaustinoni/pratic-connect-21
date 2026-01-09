import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  PRECOS_SELECT_RJ, 
  PRECOS_MOTOS_RJ, 
  PRECOS_ELETRICOS,
  calcularPrecoRegiao,
  type Regiao,
  type FaixaPreco,
  type FaixaPrecoMoto,
  type FaixaPrecoEletrico
} from '@/data/planosPrecos';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatFipe = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
};

interface TabelaPrecosCarrosProps {
  titulo?: string;
}

export function TabelaPrecosCarros({ titulo = 'Tabela de Preços' }: TabelaPrecosCarrosProps) {
  const [regiao, setRegiao] = useState<Regiao>('rj');

  const getPrecos = (faixa: FaixaPreco) => {
    return {
      gasolina: calcularPrecoRegiao(faixa.gasolina, regiao),
      desagioGasolina: calcularPrecoRegiao(faixa.desagioGasolina, regiao),
      diesel: calcularPrecoRegiao(faixa.diesel, regiao),
      desagioDiesel: calcularPrecoRegiao(faixa.desagioDiesel, regiao),
    };
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg">{titulo}</CardTitle>
          <Tabs value={regiao} onValueChange={(v) => setRegiao(v as Regiao)}>
            <TabsList className="h-8">
              <TabsTrigger value="rj" className="text-xs px-3">Rio de Janeiro</TabsTrigger>
              <TabsTrigger value="lagos" className="text-xs px-3">Região dos Lagos</TabsTrigger>
              <TabsTrigger value="sp" className="text-xs px-3">São Paulo</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {regiao !== 'rj' && (
          <p className="text-xs text-muted-foreground mt-2">
            * Valores com 10% de desconto em relação ao Rio de Janeiro
          </p>
        )}
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Faixa FIPE</TableHead>
              <TableHead className="text-center font-semibold">Gasolina</TableHead>
              <TableHead className="text-center font-semibold">
                <span className="flex flex-col items-center">
                  <span>Deságio</span>
                  <Badge variant="outline" className="text-[10px] mt-0.5">-10%</Badge>
                </span>
              </TableHead>
              <TableHead className="text-center font-semibold">Diesel</TableHead>
              <TableHead className="text-center font-semibold">
                <span className="flex flex-col items-center">
                  <span>Deságio</span>
                  <Badge variant="outline" className="text-[10px] mt-0.5">-10%</Badge>
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PRECOS_SELECT_RJ.map((faixa, index) => {
              const precos = getPrecos(faixa);
              return (
                <TableRow 
                  key={index}
                  className={index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}
                >
                  <TableCell className="font-medium text-xs whitespace-nowrap">
                    {formatFipe(faixa.fipeMin)} - {formatFipe(faixa.fipeMax)}
                  </TableCell>
                  <TableCell className="text-center text-sm font-semibold text-primary">
                    {formatCurrency(precos.gasolina)}
                  </TableCell>
                  <TableCell className="text-center text-sm text-green-600 dark:text-green-400">
                    {formatCurrency(precos.desagioGasolina)}
                  </TableCell>
                  <TableCell className="text-center text-sm font-semibold text-primary">
                    {formatCurrency(precos.diesel)}
                  </TableCell>
                  <TableCell className="text-center text-sm text-green-600 dark:text-green-400">
                    {formatCurrency(precos.desagioDiesel)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function TabelaPrecosMotos() {
  const [regiao, setRegiao] = useState<Regiao>('rj');

  const getPreco = (valor: number | null) => {
    if (valor === null) return null;
    return calcularPrecoRegiao(valor, regiao);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg">Tabela de Preços - Motos</CardTitle>
          <Tabs value={regiao} onValueChange={(v) => setRegiao(v as Regiao)}>
            <TabsList className="h-8">
              <TabsTrigger value="rj" className="text-xs px-3">Rio de Janeiro</TabsTrigger>
              <TabsTrigger value="lagos" className="text-xs px-3">Região dos Lagos</TabsTrigger>
              <TabsTrigger value="sp" className="text-xs px-3">São Paulo</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Faixa FIPE</TableHead>
              <TableHead className="text-center font-semibold">Advanced</TableHead>
              <TableHead className="text-center font-semibold">Advanced+</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PRECOS_MOTOS_RJ.map((faixa, index) => {
              const advanced = getPreco(faixa.advanced);
              const advancedPlus = getPreco(faixa.advancedPlus);
              return (
                <TableRow 
                  key={index}
                  className={index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}
                >
                  <TableCell className="font-medium text-xs whitespace-nowrap">
                    {formatFipe(faixa.fipeMin)} - {formatFipe(faixa.fipeMax)}
                  </TableCell>
                  <TableCell className="text-center text-sm font-semibold text-primary">
                    {advanced ? formatCurrency(advanced) : '—'}
                  </TableCell>
                  <TableCell className="text-center text-sm font-semibold text-primary">
                    {advancedPlus ? formatCurrency(advancedPlus) : '—'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function TabelaPrecosEletricos() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Tabela de Preços - Elétricos</CardTitle>
        <p className="text-sm text-muted-foreground">Cota de participação: 10% FIPE (sem mínimo)</p>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Faixa FIPE</TableHead>
              <TableHead className="text-center font-semibold">Mensal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PRECOS_ELETRICOS.map((faixa, index) => (
              <TableRow 
                key={index}
                className={index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}
              >
                <TableCell className="font-medium text-xs whitespace-nowrap">
                  {formatFipe(faixa.fipeMin)} - {formatFipe(faixa.fipeMax)}
                </TableCell>
                <TableCell className="text-center text-sm font-semibold text-primary">
                  {formatCurrency(faixa.mensal)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

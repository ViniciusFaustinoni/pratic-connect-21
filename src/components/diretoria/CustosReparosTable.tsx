import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Wrench, Cog, Users2 } from 'lucide-react';
import { useCustosReparos } from '@/hooks/useCustosReparos';

interface Props {
  ano: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const CATEGORIA_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  peca: { label: 'Peças', icon: Cog, color: 'bg-blue-500' },
  mao_de_obra: { label: 'Mão de Obra', icon: Users2, color: 'bg-green-500' },
  servico_terceiro: { label: 'Serviços Terceiros', icon: Wrench, color: 'bg-orange-500' },
};

export function CustosReparosTable({ ano }: Props) {
  const { data, isLoading } = useCustosReparos(ano);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const { categorias, totalGeral, totalItens, ticketMedio } = data || { 
    categorias: [], 
    totalGeral: 0, 
    totalItens: 0, 
    ticketMedio: 0 
  };

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {categorias.map(cat => {
          const config = CATEGORIA_CONFIG[cat.tipo];
          const Icon = config?.icon || Cog;
          const percentual = totalGeral > 0 ? (cat.valor / totalGeral) * 100 : 0;
          
          return (
            <Card key={cat.tipo}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">{config?.label}</span>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold">{formatCurrency(cat.valor)}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Progress value={percentual} className={`h-2 ${config?.color}`} />
                  <span className="text-sm text-muted-foreground">{percentual.toFixed(1)}%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{cat.itens} itens</p>
              </CardContent>
            </Card>
          );
        })}

        {/* Card Total */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">TOTAL</span>
            </div>
            <p className="text-2xl font-bold text-primary">{formatCurrency(totalGeral)}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Ticket Médio: {formatCurrency(ticketMedio)}
            </p>
            <p className="text-xs text-muted-foreground">{totalItens} itens</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela Detalhada */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Qtd Itens</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead className="text-right">% do Total</TableHead>
                <TableHead className="text-right">Ticket Médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categorias.map(cat => {
                const config = CATEGORIA_CONFIG[cat.tipo];
                const percentual = totalGeral > 0 ? (cat.valor / totalGeral) * 100 : 0;
                const ticketCat = cat.itens > 0 ? cat.valor / cat.itens : 0;
                
                return (
                  <TableRow key={cat.tipo}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${config?.color}`} />
                        {config?.label}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{cat.itens}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(cat.valor)}</TableCell>
                    <TableCell className="text-right">{percentual.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{formatCurrency(ticketCat)}</TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="font-bold bg-muted/50">
                <TableCell>TOTAL</TableCell>
                <TableCell className="text-right">{totalItens}</TableCell>
                <TableCell className="text-right">{formatCurrency(totalGeral)}</TableCell>
                <TableCell className="text-right">100%</TableCell>
                <TableCell className="text-right">{formatCurrency(ticketMedio)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

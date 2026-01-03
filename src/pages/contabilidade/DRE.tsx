import { useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBalancete } from '@/hooks/useContabilidade';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function DRE() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());

  const { data: balancete, isLoading } = useBalancete(mes, ano);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Calcular valores da DRE
  const receitas = balancete
    ?.filter(c => c.tipo === 'receita')
    .reduce((sum, c) => sum + c.creditos, 0) || 0;

  const despesas = balancete
    ?.filter(c => c.tipo === 'despesa')
    .reduce((sum, c) => sum + c.debitos, 0) || 0;

  // Agrupar despesas por subcategoria (nível 3)
  const despesasPorCategoria = balancete
    ?.filter(c => c.tipo === 'despesa' && c.nivel === 3 && c.debitos > 0)
    .sort((a, b) => b.debitos - a.debitos) || [];

  // Agrupar receitas por subcategoria (nível 3)
  const receitasPorCategoria = balancete
    ?.filter(c => c.tipo === 'receita' && c.nivel === 3 && c.creditos > 0)
    .sort((a, b) => b.creditos - a.creditos) || [];

  const resultado = receitas - despesas;

  interface LinhaItem {
    descricao: string;
    valor: number;
    destaque?: boolean;
    subtotal?: boolean;
    total?: boolean;
    nivel?: number;
  }

  const linhas: LinhaItem[] = [
    { descricao: 'RECEITAS', valor: 0, destaque: true },
    ...receitasPorCategoria.map(c => ({
      descricao: c.descricao,
      valor: c.creditos,
      nivel: 1,
    })),
    { descricao: 'TOTAL DE RECEITAS', valor: receitas, subtotal: true },
    { descricao: '', valor: 0 },
    { descricao: 'DESPESAS', valor: 0, destaque: true },
    ...despesasPorCategoria.map(c => ({
      descricao: c.descricao,
      valor: -c.debitos,
      nivel: 1,
    })),
    { descricao: 'TOTAL DE DESPESAS', valor: -despesas, subtotal: true },
    { descricao: '', valor: 0 },
    { descricao: 'RESULTADO DO PERÍODO', valor: resultado, total: true },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">DRE</h1>
          <p className="text-muted-foreground">
            Demonstração do Resultado do Exercício
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={String(mes)} onValueChange={(v) => setMes(parseInt(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>
                  {format(new Date(2000, i), 'MMMM', { locale: ptBR })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(ano)} onValueChange={(v) => setAno(parseInt(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => (
                <SelectItem key={i} value={String(now.getFullYear() - 2 + i)}>
                  {now.getFullYear() - 2 + i}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon">
            <Printer className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* DRE */}
      <Card>
        <CardHeader>
          <CardTitle className="text-center">
            DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO
            <br />
            <span className="text-base font-normal text-muted-foreground">
              {format(new Date(ano, mes - 1), 'MMMM yyyy', { locale: ptBR }).toUpperCase()}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando DRE...
            </div>
          ) : (
            <div className="max-w-2xl mx-auto">
              <div className="border rounded-lg divide-y">
                {linhas.map((linha, index) => {
                  if (!linha.descricao) {
                    return <div key={index} className="h-4 bg-muted/30" />;
                  }

                  return (
                    <div
                      key={index}
                      className={cn(
                        'flex items-center justify-between px-4 py-3',
                        linha.destaque && 'bg-muted/50 font-semibold',
                        linha.subtotal && 'bg-muted/30 font-medium',
                        linha.total && 'bg-primary/10 font-bold text-lg'
                      )}
                      style={linha.nivel ? { paddingLeft: `${linha.nivel * 24 + 16}px` } : undefined}
                    >
                      <span>{linha.descricao}</span>
                      {linha.valor !== 0 && (
                        <span className={cn(
                          linha.valor < 0 ? 'text-red-600' : 'text-green-600',
                          (linha.subtotal || linha.total) && 'font-semibold'
                        )}>
                          {linha.valor < 0 ? '(' : ''}
                          {formatCurrency(Math.abs(linha.valor))}
                          {linha.valor < 0 ? ')' : ''}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Resumo Visual */}
              <div className="mt-8 grid grid-cols-3 gap-4 text-center">
                <div className="p-4 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <p className="text-sm text-muted-foreground">Receitas</p>
                  <p className="text-xl font-bold text-green-600">
                    {formatCurrency(receitas)}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <p className="text-sm text-muted-foreground">Despesas</p>
                  <p className="text-xl font-bold text-red-600">
                    {formatCurrency(despesas)}
                  </p>
                </div>
                <div className={cn(
                  'p-4 rounded-lg',
                  resultado >= 0
                    ? 'bg-blue-100 dark:bg-blue-900/30'
                    : 'bg-orange-100 dark:bg-orange-900/30'
                )}>
                  <p className="text-sm text-muted-foreground">Resultado</p>
                  <p className={cn(
                    'text-xl font-bold',
                    resultado >= 0 ? 'text-blue-600' : 'text-orange-600'
                  )}>
                    {formatCurrency(resultado)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

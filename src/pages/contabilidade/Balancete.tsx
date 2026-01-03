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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { useBalancete } from '@/hooks/useContabilidade';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function Balancete() {
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

  // Agrupar por tipo
  const porTipo = balancete?.reduce((acc, conta) => {
    if (!acc[conta.tipo]) {
      acc[conta.tipo] = [];
    }
    acc[conta.tipo].push(conta);
    return acc;
  }, {} as Record<string, typeof balancete>);

  const tipoLabels: Record<string, string> = {
    ativo: 'ATIVO',
    passivo: 'PASSIVO',
    patrimonio_liquido: 'PATRIMÔNIO LÍQUIDO',
    receita: 'RECEITAS',
    despesa: 'DESPESAS',
  };

  const tipoOrdem = ['ativo', 'passivo', 'patrimonio_liquido', 'receita', 'despesa'];

  // Calcular totais gerais
  const totais = balancete?.reduce(
    (acc, conta) => ({
      debitos: acc.debitos + conta.debitos,
      creditos: acc.creditos + conta.creditos,
    }),
    { debitos: 0, creditos: 0 }
  ) || { debitos: 0, creditos: 0 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Balancete</h1>
          <p className="text-muted-foreground">
            Balancete de verificação do período
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

      {/* Balancete */}
      <Card>
        <CardHeader>
          <CardTitle className="text-center">
            BALANCETE DE VERIFICAÇÃO
            <br />
            <span className="text-base font-normal text-muted-foreground">
              {format(new Date(ano, mes - 1), 'MMMM yyyy', { locale: ptBR }).toUpperCase()}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando balancete...
            </div>
          ) : !balancete || balancete.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum lançamento encontrado no período
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Código</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right w-[150px]">Débitos</TableHead>
                    <TableHead className="text-right w-[150px]">Créditos</TableHead>
                    <TableHead className="text-right w-[150px]">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tipoOrdem.map((tipo) => {
                    const contas = porTipo?.[tipo];
                    if (!contas || contas.length === 0) return null;

                    const contasComMovimento = contas.filter(c => c.debitos > 0 || c.creditos > 0);
                    if (contasComMovimento.length === 0) return null;

                    const totalTipo = contasComMovimento.reduce(
                      (acc, c) => ({
                        debitos: acc.debitos + c.debitos,
                        creditos: acc.creditos + c.creditos,
                        saldo: acc.saldo + c.saldo,
                      }),
                      { debitos: 0, creditos: 0, saldo: 0 }
                    );

                    return (
                      <React.Fragment key={tipo}>
                        {/* Grupo Header */}
                        <TableRow className="bg-muted/50">
                          <TableCell colSpan={5} className="font-semibold">
                            {tipoLabels[tipo]}
                          </TableCell>
                        </TableRow>
                        
                        {/* Contas */}
                        {contasComMovimento.map((conta) => (
                          <TableRow key={conta.id}>
                            <TableCell className="font-mono text-sm">
                              {conta.codigo}
                            </TableCell>
                            <TableCell
                              style={{ paddingLeft: `${conta.nivel * 16 + 16}px` }}
                              className={cn(conta.sintetica && 'font-medium')}
                            >
                              {conta.descricao}
                            </TableCell>
                            <TableCell className="text-right">
                              {conta.debitos > 0 ? formatCurrency(conta.debitos) : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {conta.creditos > 0 ? formatCurrency(conta.creditos) : '-'}
                            </TableCell>
                            <TableCell className={cn(
                              'text-right font-medium',
                              conta.saldo > 0 ? 'text-blue-600' : conta.saldo < 0 ? 'text-red-600' : ''
                            )}>
                              {formatCurrency(Math.abs(conta.saldo))}
                              {conta.saldo !== 0 && (conta.saldo > 0 ? ' D' : ' C')}
                            </TableCell>
                          </TableRow>
                        ))}

                        {/* Subtotal do grupo */}
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={2} className="font-semibold text-right">
                            Total {tipoLabels[tipo]}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(totalTipo.debitos)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(totalTipo.creditos)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(Math.abs(totalTipo.saldo))}
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="font-bold text-right">
                      TOTAIS GERAIS
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(totais.debitos)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(totais.creditos)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {Math.abs(totais.debitos - totais.creditos) < 0.01 ? (
                        <span className="text-green-600">✓ Balanceado</span>
                      ) : (
                        <span className="text-red-600">
                          {formatCurrency(Math.abs(totais.debitos - totais.creditos))}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import React from 'react';

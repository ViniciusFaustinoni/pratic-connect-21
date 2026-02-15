import React, { useState } from 'react';
import { Download, Printer, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { useBalanceteCompleto } from '@/hooks/useContabilidade';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { exportarRelatorioPDF, exportarRelatorioCSV, imprimirRelatorio } from '@/lib/contabilidade-exports';
import { toast } from 'sonner';

const tipoLabels: Record<string, string> = {
  ativo: 'ATIVO', passivo: 'PASSIVO', patrimonio_liquido: 'PATRIMÔNIO SOCIAL',
  receita: 'RECEITAS', despesa: 'DESPESAS',
};
const tipoOrdem = ['ativo', 'passivo', 'patrimonio_liquido', 'receita', 'despesa'];

export default function Balancete() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [nivelMax, setNivelMax] = useState(4); // 2=sintético, 4=analítico

  const { data: balancete, isLoading } = useBalanceteCompleto(mes, ano);

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  // Filtrar por nível
  const contasFiltradas = balancete?.filter(c => c.nivel <= nivelMax) || [];

  const porTipo = contasFiltradas.reduce((acc, conta) => {
    if (!acc[conta.tipo]) acc[conta.tipo] = [];
    acc[conta.tipo].push(conta);
    return acc;
  }, {} as Record<string, typeof contasFiltradas>);

  const totais = contasFiltradas.reduce((acc, c) => ({
    saldoAnterior: acc.saldoAnterior + (c.sintetica ? 0 : c.saldoAnterior),
    debitos: acc.debitos + (c.sintetica ? 0 : c.debitos),
    creditos: acc.creditos + (c.sintetica ? 0 : c.creditos),
    saldoAtual: acc.saldoAtual + (c.sintetica ? 0 : c.saldoAtual),
  }), { saldoAnterior: 0, debitos: 0, creditos: 0, saldoAtual: 0 });

  const equilibrado = Math.abs(totais.debitos - totais.creditos) < 0.01;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Balancete de Verificação</h1>
          <p className="text-muted-foreground">Verificação de saldos do período</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={String(mes)} onValueChange={(v) => setMes(parseInt(v))}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>
                  {format(new Date(2000, i), 'MMMM', { locale: ptBR })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(ano)} onValueChange={(v) => setAno(parseInt(v))}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => (
                <SelectItem key={i} value={String(now.getFullYear() - 2 + i)}>{now.getFullYear() - 2 + i}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(nivelMax)} onValueChange={(v) => setNivelMax(parseInt(v))}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2">Sintético</SelectItem>
              <SelectItem value="3">Intermediário</SelectItem>
              <SelectItem value="4">Analítico</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={imprimirRelatorio}><Printer className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => {
            if (!balancete) return toast.error('Sem dados');
            exportarRelatorioCSV({
              titulo: 'Balancete',
              periodo: format(new Date(ano, mes - 1), 'MMMM yyyy', { locale: ptBR }),
              dados: contasFiltradas.filter(c => c.debitos > 0 || c.creditos > 0 || Math.abs(c.saldoAnterior) > 0.01).map(c => ({
                codigo: c.codigo, descricao: c.descricao, saldoAnterior: c.saldoAnterior,
                debitos: c.debitos, creditos: c.creditos, saldoAtual: c.saldoAtual,
              })),
              colunas: [
                { header: 'Código', key: 'codigo', align: 'left' },
                { header: 'Descrição', key: 'descricao', align: 'left' },
                { header: 'Saldo Anterior', key: 'saldoAnterior', align: 'right' },
                { header: 'Débitos', key: 'debitos', align: 'right' },
                { header: 'Créditos', key: 'creditos', align: 'right' },
                { header: 'Saldo Atual', key: 'saldoAtual', align: 'right' },
              ],
            });
            toast.success('CSV gerado!');
          }}><Download className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">Total Débitos</p>
          <p className="text-2xl font-bold">{formatCurrency(totais.debitos)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">Total Créditos</p>
          <p className="text-2xl font-bold">{formatCurrency(totais.creditos)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">Saldo Devedor</p>
          <p className="text-2xl font-bold">{formatCurrency(Math.max(0, totais.saldoAtual))}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">Saldo Credor</p>
          <p className="text-2xl font-bold">{formatCurrency(Math.abs(Math.min(0, totais.saldoAtual)))}</p>
        </CardContent></Card>
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle className="text-center">
            BALANCETE DE VERIFICAÇÃO
            <br /><span className="text-base font-normal text-muted-foreground">
              {format(new Date(ano, mes - 1), 'MMMM yyyy', { locale: ptBR }).toUpperCase()}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Código</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right w-[120px]">Saldo Anterior</TableHead>
                    <TableHead className="text-right w-[120px]">Débitos</TableHead>
                    <TableHead className="text-right w-[120px]">Créditos</TableHead>
                    <TableHead className="text-right w-[120px]">Saldo Atual</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tipoOrdem.map((tipo) => {
                    const contas = porTipo[tipo];
                    if (!contas?.length) return null;
                    const contasVisiveis = contas.filter(c => c.debitos > 0 || c.creditos > 0 || Math.abs(c.saldoAnterior) > 0.01 || c.sintetica);
                    if (!contasVisiveis.length) return null;

                    return (
                      <React.Fragment key={tipo}>
                        <TableRow className="bg-muted/50">
                          <TableCell colSpan={6} className="font-semibold">{tipoLabels[tipo]}</TableCell>
                        </TableRow>
                        {contasVisiveis.map((c) => (
                          <TableRow key={c.id} className={cn(c.sintetica && 'bg-muted/20')}>
                            <TableCell className="font-mono text-xs">{c.codigo}</TableCell>
                            <TableCell style={{ paddingLeft: `${c.nivel * 16 + 16}px` }}
                              className={cn(c.sintetica && 'font-medium')}>
                              {c.descricao}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {Math.abs(c.saldoAnterior) > 0.01 ? formatCurrency(c.saldoAnterior) : '-'}
                            </TableCell>
                            <TableCell className="text-right text-sm">{c.debitos > 0 ? formatCurrency(c.debitos) : '-'}</TableCell>
                            <TableCell className="text-right text-sm">{c.creditos > 0 ? formatCurrency(c.creditos) : '-'}</TableCell>
                            <TableCell className="text-right text-sm font-medium">
                              {Math.abs(c.saldoAtual) > 0.01 ? formatCurrency(c.saldoAtual) : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="font-bold text-right">TOTAIS GERAIS</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(totais.saldoAnterior)}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(totais.debitos)}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(totais.creditos)}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(totais.saldoAtual)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conferência */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-center gap-2">
            {equilibrado ? (
              <div className="flex items-center gap-2 text-green-600">
                <Check className="h-5 w-5" /><span className="font-medium">✓ Balancete equilibrado</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-600">
                <X className="h-5 w-5" /><span className="font-medium">⚠ Diferença: {formatCurrency(Math.abs(totais.debitos - totais.creditos))}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

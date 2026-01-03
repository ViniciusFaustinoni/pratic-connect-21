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
} from '@/components/ui/table';
import { ContaCombobox } from '@/components/contabilidade';
import { useRazaoConta, usePlanoContas } from '@/hooks/useContabilidade';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function RazaoConta() {
  const now = new Date();
  const [contaId, setContaId] = useState('');
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());

  const { data: contas } = usePlanoContas();
  const { data: razao, isLoading } = useRazaoConta(contaId, mes, ano);

  const contaSelecionada = contas?.find(c => c.id === contaId);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Calcular saldo acumulado
  let saldoAcumulado = 0;
  const movimentacoes = razao?.map((item: any) => {
    const debito = item.tipo === 'debito' ? Number(item.valor) : 0;
    const credito = item.tipo === 'credito' ? Number(item.valor) : 0;
    
    if (contaSelecionada?.natureza === 'devedora') {
      saldoAcumulado += debito - credito;
    } else {
      saldoAcumulado += credito - debito;
    }

    return {
      ...item,
      debito,
      credito,
      saldo: saldoAcumulado,
    };
  }) || [];

  const totalDebitos = movimentacoes.reduce((sum: number, m: any) => sum + m.debito, 0);
  const totalCreditos = movimentacoes.reduce((sum: number, m: any) => sum + m.credito, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Razão da Conta</h1>
          <p className="text-muted-foreground">
            Movimentação analítica de uma conta
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" disabled={!contaId}>
            <Printer className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" disabled={!contaId}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-1.5 block">Conta</label>
              <ContaCombobox
                value={contaId}
                onValueChange={setContaId}
                placeholder="Selecione uma conta..."
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Mês</label>
              <Select value={String(mes)} onValueChange={(v) => setMes(parseInt(v))}>
                <SelectTrigger>
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
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Ano</label>
              <Select value={String(ano)} onValueChange={(v) => setAno(parseInt(v))}>
                <SelectTrigger>
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Razão */}
      {contaId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-center">
              RAZÃO ANALÍTICO
              <br />
              <span className="text-base font-normal">
                {contaSelecionada?.codigo} - {contaSelecionada?.descricao}
              </span>
              <br />
              <span className="text-sm font-normal text-muted-foreground">
                {format(new Date(ano, mes - 1), 'MMMM yyyy', { locale: ptBR }).toUpperCase()}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando razão...
              </div>
            ) : movimentacoes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma movimentação encontrada no período
              </div>
            ) : (
              <>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Data</TableHead>
                        <TableHead className="w-[120px]">Lançamento</TableHead>
                        <TableHead>Histórico</TableHead>
                        <TableHead className="text-right w-[120px]">Débito</TableHead>
                        <TableHead className="text-right w-[120px]">Crédito</TableHead>
                        <TableHead className="text-right w-[140px]">Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movimentacoes.map((mov: any) => (
                        <TableRow key={mov.id}>
                          <TableCell>
                            {format(new Date(mov.lancamento.data_competencia), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {mov.lancamento.numero}
                          </TableCell>
                          <TableCell className="max-w-[300px] truncate">
                            {mov.lancamento.historico}
                          </TableCell>
                          <TableCell className="text-right">
                            {mov.debito > 0 ? formatCurrency(mov.debito) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {mov.credito > 0 ? formatCurrency(mov.credito) : '-'}
                          </TableCell>
                          <TableCell className={cn(
                            'text-right font-medium',
                            mov.saldo >= 0 ? 'text-blue-600' : 'text-red-600'
                          )}>
                            {formatCurrency(Math.abs(mov.saldo))}
                            {mov.saldo >= 0 ? ' D' : ' C'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Resumo */}
                <div className="mt-6 grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg border text-center">
                    <p className="text-sm text-muted-foreground">Total Débitos</p>
                    <p className="text-xl font-bold">{formatCurrency(totalDebitos)}</p>
                  </div>
                  <div className="p-4 rounded-lg border text-center">
                    <p className="text-sm text-muted-foreground">Total Créditos</p>
                    <p className="text-xl font-bold">{formatCurrency(totalCreditos)}</p>
                  </div>
                  <div className={cn(
                    'p-4 rounded-lg text-center',
                    saldoAcumulado >= 0
                      ? 'bg-blue-100 dark:bg-blue-900/30'
                      : 'bg-red-100 dark:bg-red-900/30'
                  )}>
                    <p className="text-sm text-muted-foreground">Saldo Final</p>
                    <p className={cn(
                      'text-xl font-bold',
                      saldoAcumulado >= 0 ? 'text-blue-600' : 'text-red-600'
                    )}>
                      {formatCurrency(Math.abs(saldoAcumulado))}
                      {saldoAcumulado >= 0 ? ' D' : ' C'}
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

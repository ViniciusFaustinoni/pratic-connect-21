import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Scale, Download, FileSpreadsheet, Check, X, Loader2 } from 'lucide-react';
import { useBalanceteCompleto } from '@/hooks/useContabilidade';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { exportarRelatorioPDF, exportarRelatorioCSV } from '@/lib/contabilidade-exports';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const meses = [
  { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' },
];

const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const formatPct = (v: number) => isNaN(v) || !isFinite(v) ? '-' : `${v.toFixed(1)}%`;

export default function BalancoPatrimonial() {
  const currentDate = new Date();
  const [mes, setMes] = useState(currentDate.getMonth() + 1);
  const [ano, setAno] = useState(currentDate.getFullYear());
  const [showAnalise, setShowAnalise] = useState(false);
  const [notas, setNotas] = useState('');

  const { data: contasAtual, isLoading: loadingAtual } = useBalanceteCompleto(mes, ano);
  const { data: contasAnterior, isLoading: loadingAnterior } = useBalanceteCompleto(mes, ano - 1);

  const isLoading = loadingAtual || loadingAnterior;

  const classificar = (contas: typeof contasAtual) => {
    if (!contas) return null;
    const calcSaldo = (c: typeof contas[0], natureza: 'devedora' | 'credora') =>
      natureza === 'devedora' ? c.saldoAtual : -c.saldoAtual;

    const ativoC = contas.filter(c => c.codigo?.startsWith('1.1') && !c.sintetica);
    const ativoNC = contas.filter(c => c.codigo?.startsWith('1.2') && !c.sintetica);
    const passC = contas.filter(c => c.codigo?.startsWith('2.1') && !c.sintetica);
    const passNC = contas.filter(c => c.codigo?.startsWith('2.2') && !c.sintetica);
    const pl = contas.filter(c => c.codigo?.startsWith('3') && !c.sintetica);

    const tAC = ativoC.reduce((s, c) => s + c.saldoAtual, 0);
    const tANC = ativoNC.reduce((s, c) => s + c.saldoAtual, 0);
    const tPC = passC.reduce((s, c) => s + (-c.saldoAtual), 0);
    const tPNC = passNC.reduce((s, c) => s + (-c.saldoAtual), 0);
    const tPL = pl.reduce((s, c) => s + (-c.saldoAtual), 0);
    const tAtivo = tAC + tANC;
    const tPassivoPL = tPC + tPNC + tPL;

    return {
      ativoCirculante: { contas: ativoC, total: tAC },
      ativoNaoCirculante: { contas: ativoNC, total: tANC },
      totalAtivo: tAtivo,
      passivoCirculante: { contas: passC, total: tPC },
      passivoNaoCirculante: { contas: passNC, total: tPNC },
      totalPassivo: tPC + tPNC,
      patrimonioSocial: { contas: pl, total: tPL },
      totalPassivoPL: tPassivoPL,
      equilibrado: Math.abs(tAtivo - tPassivoPL) < 0.01,
      diferenca: Math.abs(tAtivo - tPassivoPL),
    };
  };

  const atual = classificar(contasAtual);
  const anterior = classificar(contasAnterior);

  const GrupoContas = ({ titulo, contas, total, totalAnterior, natureza, totalGrupo }: {
    titulo: string; contas: typeof contasAtual; total: number; totalAnterior?: number;
    natureza: 'devedora' | 'credora'; totalGrupo: number;
  }) => {
    const contaAnteriorMap = new Map(
      (natureza === 'devedora' ? [...(anterior?.ativoCirculante.contas || []), ...(anterior?.ativoNaoCirculante.contas || [])]
        : [...(anterior?.passivoCirculante.contas || []), ...(anterior?.passivoNaoCirculante.contas || []), ...(anterior?.patrimonioSocial.contas || [])]
      ).map(c => [c.id, c])
    );

    return (
      <div className="space-y-1">
        <div className="font-semibold text-sm bg-muted/50 px-3 py-2 rounded flex justify-between">
          <span>{titulo}</span>
        </div>
        {contas && contas.length > 0 ? (
          <>
            {contas.map(c => {
              const saldo = natureza === 'devedora' ? c.saldoAtual : -c.saldoAtual;
              if (Math.abs(saldo) < 0.01) return null;
              const cAnt = contaAnteriorMap.get(c.id);
              const saldoAnt = cAnt ? (natureza === 'devedora' ? cAnt.saldoAtual : -cAnt.saldoAtual) : 0;
              const varH = saldoAnt !== 0 ? ((saldo - saldoAnt) / Math.abs(saldoAnt)) * 100 : 0;
              const pctV = totalGrupo !== 0 ? (saldo / totalGrupo) * 100 : 0;

              return (
                <div key={c.id} className="flex justify-between px-3 py-1 text-sm hover:bg-muted/30 rounded gap-2">
                  <span className="text-muted-foreground flex-1 min-w-0 truncate">{c.codigo} - {c.descricao}</span>
                  <span className="w-28 text-right shrink-0">{formatCurrency(saldo)}</span>
                  {anterior && <span className="w-28 text-right shrink-0 text-muted-foreground">{formatCurrency(saldoAnt)}</span>}
                  {showAnalise && (
                    <>
                      <span className="w-16 text-right shrink-0 text-xs text-muted-foreground">{formatPct(pctV)}</span>
                      {anterior && <span className={cn('w-16 text-right shrink-0 text-xs', varH > 0 ? 'text-green-600' : varH < 0 ? 'text-red-600' : 'text-muted-foreground')}>{formatPct(varH)}</span>}
                    </>
                  )}
                </div>
              );
            })}
            <div className="flex justify-between px-3 py-2 font-medium border-t mt-2 gap-2">
              <span>Subtotal {titulo}</span>
              <span className="w-28 text-right">{formatCurrency(total)}</span>
              {anterior && <span className="w-28 text-right text-muted-foreground">{formatCurrency(totalAnterior || 0)}</span>}
              {showAnalise && (
                <>
                  <span className="w-16" />
                  {anterior && <span className="w-16" />}
                </>
              )}
            </div>
          </>
        ) : (
          <p className="px-3 py-2 text-sm text-muted-foreground italic">Nenhuma conta neste grupo</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Scale className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Balanço Patrimonial</h1>
          </div>
          <p className="text-muted-foreground">Posição patrimonial e financeira da associação</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label>Mês:</Label>
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>{meses.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label>Ano:</Label>
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>{Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i).map(a =>
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="analise" checked={showAnalise} onCheckedChange={setShowAnalise} />
            <Label htmlFor="analise" className="text-sm">Análise V/H</Label>
          </div>
          <Button variant="outline" size="sm" onClick={() => {
            if (!atual) return toast.error('Gere o balanço primeiro');
            const periodo = `${meses.find(m => m.value === mes)?.label}_${ano}`;
            const dados: Array<Record<string, any>> = [];
            dados.push({ descricao: 'ATIVO CIRCULANTE', valor: '' });
            atual.ativoCirculante.contas.forEach(c => { if (Math.abs(c.saldoAtual) > 0.01) dados.push({ descricao: `  ${c.codigo} - ${c.descricao}`, valor: c.saldoAtual }); });
            dados.push({ descricao: 'Subtotal Ativo Circulante', valor: atual.ativoCirculante.total });
            dados.push({ descricao: 'ATIVO NÃO CIRCULANTE', valor: '' });
            atual.ativoNaoCirculante.contas.forEach(c => { if (Math.abs(c.saldoAtual) > 0.01) dados.push({ descricao: `  ${c.codigo} - ${c.descricao}`, valor: c.saldoAtual }); });
            dados.push({ descricao: 'Subtotal Ativo Não Circulante', valor: atual.ativoNaoCirculante.total });
            dados.push({ descricao: 'TOTAL DO ATIVO', valor: atual.totalAtivo });
            dados.push({ descricao: '', valor: '' });
            dados.push({ descricao: 'PASSIVO CIRCULANTE', valor: '' });
            atual.passivoCirculante.contas.forEach(c => { if (Math.abs(c.saldoAtual) > 0.01) dados.push({ descricao: `  ${c.codigo} - ${c.descricao}`, valor: -c.saldoAtual }); });
            dados.push({ descricao: 'Subtotal Passivo Circulante', valor: atual.passivoCirculante.total });
            dados.push({ descricao: 'PASSIVO NÃO CIRCULANTE', valor: '' });
            atual.passivoNaoCirculante.contas.forEach(c => { if (Math.abs(c.saldoAtual) > 0.01) dados.push({ descricao: `  ${c.codigo} - ${c.descricao}`, valor: -c.saldoAtual }); });
            dados.push({ descricao: 'Subtotal Passivo Não Circulante', valor: atual.passivoNaoCirculante.total });
            dados.push({ descricao: 'PATRIMÔNIO SOCIAL', valor: '' });
            atual.patrimonioSocial.contas.forEach(c => { if (Math.abs(c.saldoAtual) > 0.01) dados.push({ descricao: `  ${c.codigo} - ${c.descricao}`, valor: -c.saldoAtual }); });
            dados.push({ descricao: 'Subtotal Patrimônio Social', valor: atual.patrimonioSocial.total });
            dados.push({ descricao: 'TOTAL PASSIVO + PATRIMÔNIO SOCIAL', valor: atual.totalPassivoPL });
            exportarRelatorioPDF({
              titulo: 'Balanço Patrimonial',
              subtitulo: 'Associação de Proteção Veicular',
              periodo,
              dados,
              colunas: [
                { header: 'Descrição', key: 'descricao', align: 'left' },
                { header: 'Valor (R$)', key: 'valor', align: 'right' },
              ],
            });
            toast.success('PDF gerado com sucesso');
          }}>
            <Download className="h-4 w-4 mr-2" />PDF
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card><CardContent className="py-12 flex flex-col items-center text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mb-4" /><p>Carregando...</p>
        </CardContent></Card>
      ) : !atual ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Selecione o período</CardContent></Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><CardContent className="pt-6">
              <div className="text-sm font-medium text-muted-foreground">Total do Ativo</div>
              <div className="text-2xl font-bold">{formatCurrency(atual.totalAtivo)}</div>
              {anterior && <div className="text-xs text-muted-foreground">Anterior: {formatCurrency(anterior.totalAtivo)}</div>}
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <div className="text-sm font-medium text-muted-foreground">Total Passivo + Patrimônio Social</div>
              <div className="text-2xl font-bold">{formatCurrency(atual.totalPassivoPL)}</div>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <div className="text-sm font-medium text-muted-foreground">Equilíbrio</div>
              <div className={`text-2xl font-bold flex items-center gap-2 ${atual.equilibrado ? 'text-green-600' : 'text-red-600'}`}>
                {atual.equilibrado ? <><Check className="h-5 w-5" /> OK</> : <>Dif: {formatCurrency(atual.diferenca)}</>}
              </div>
            </CardContent></Card>
          </div>

          {/* Cabeçalho */}
          <Card>
            <CardContent className="py-4 text-center border-b">
              <h2 className="text-lg font-bold">SGA PRATIC - ASSOCIAÇÃO DE PROTEÇÃO VEICULAR</h2>
              <h3 className="text-md font-semibold text-muted-foreground">BALANÇO PATRIMONIAL</h3>
              <p className="text-sm text-muted-foreground">
                Competência: {meses.find(m => m.value === mes)?.label} de {ano}
                {anterior && ` | Comparativo: ${ano - 1}`}
              </p>
              {/* Column headers */}
              <div className="flex justify-end gap-2 mt-2 text-xs text-muted-foreground">
                <span className="w-28 text-right">{ano}</span>
                {anterior && <span className="w-28 text-right">{ano - 1}</span>}
                {showAnalise && <span className="w-16 text-right">AV%</span>}
                {showAnalise && anterior && <span className="w-16 text-right">AH%</span>}
              </div>
            </CardContent>
          </Card>

          {/* Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="bg-blue-50 dark:bg-blue-950/30">
                <CardTitle className="text-blue-700 dark:text-blue-400">ATIVO</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <GrupoContas titulo="ATIVO CIRCULANTE" contas={atual.ativoCirculante.contas} total={atual.ativoCirculante.total}
                  totalAnterior={anterior?.ativoCirculante.total} natureza="devedora" totalGrupo={atual.totalAtivo} />
                <GrupoContas titulo="ATIVO NÃO CIRCULANTE" contas={atual.ativoNaoCirculante.contas} total={atual.ativoNaoCirculante.total}
                  totalAnterior={anterior?.ativoNaoCirculante.total} natureza="devedora" totalGrupo={atual.totalAtivo} />
                <div className="flex justify-between px-3 py-3 font-bold text-lg bg-blue-100 dark:bg-blue-900/30 rounded">
                  <span>TOTAL DO ATIVO</span>
                  <span>{formatCurrency(atual.totalAtivo)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="bg-green-50 dark:bg-green-950/30">
                <CardTitle className="text-green-700 dark:text-green-400">PASSIVO + PATRIMÔNIO SOCIAL</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <GrupoContas titulo="PASSIVO CIRCULANTE" contas={atual.passivoCirculante.contas} total={atual.passivoCirculante.total}
                  totalAnterior={anterior?.passivoCirculante.total} natureza="credora" totalGrupo={atual.totalPassivoPL} />
                <GrupoContas titulo="PASSIVO NÃO CIRCULANTE" contas={atual.passivoNaoCirculante.contas} total={atual.passivoNaoCirculante.total}
                  totalAnterior={anterior?.passivoNaoCirculante.total} natureza="credora" totalGrupo={atual.totalPassivoPL} />
                <GrupoContas titulo="PATRIMÔNIO SOCIAL" contas={atual.patrimonioSocial.contas} total={atual.patrimonioSocial.total}
                  totalAnterior={anterior?.patrimonioSocial.total} natureza="credora" totalGrupo={atual.totalPassivoPL} />
                <div className="flex justify-between px-3 py-3 font-bold text-lg bg-green-100 dark:bg-green-900/30 rounded">
                  <span>TOTAL PASSIVO + PS</span>
                  <span>{formatCurrency(atual.totalPassivoPL)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Verificação */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-center gap-3">
                {atual.equilibrado ? (
                  <>
                    <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <Check className="h-6 w-6 text-green-600" />
                    </div>
                    <span className="text-green-700 dark:text-green-400 font-medium">✓ Balanço equilibrado</span>
                  </>
                ) : (
                  <>
                    <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <X className="h-6 w-6 text-red-600" />
                    </div>
                    <span className="text-red-700 dark:text-red-400 font-medium">⚠ Diferença de {formatCurrency(atual.diferenca)}</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Notas Explicativas */}
          <Card>
            <CardHeader><CardTitle className="text-base">Notas Explicativas</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                placeholder="Adicione notas explicativas sobre as demonstrações contábeis..."
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={4}
              />
            </CardContent>
          </Card>

          <div className="text-center text-sm text-muted-foreground">
            <p>Gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
          </div>
        </>
      )}
    </div>
  );
}

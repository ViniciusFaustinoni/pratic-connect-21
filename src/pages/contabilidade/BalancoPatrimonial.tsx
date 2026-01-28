import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Scale, Download, FileSpreadsheet, Check, X, Loader2 } from 'lucide-react';
import { useBalancete } from '@/hooks/useContabilidade';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { exportarRelatorioPDF, exportarRelatorioCSV } from '@/lib/contabilidade-exports';
import { toast } from 'sonner';

const BalancoPatrimonial = () => {
  const currentDate = new Date();
  const [mes, setMes] = useState(currentDate.getMonth() + 1);
  const [ano, setAno] = useState(currentDate.getFullYear());

  const { data: contas, isLoading } = useBalancete(mes, ano);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  // Classificar contas por código
  const classificarContas = () => {
    if (!contas) return null;

    const ativoCirculante = contas.filter(c => c.codigo?.startsWith('1.1'));
    const ativoNaoCirculante = contas.filter(c => c.codigo?.startsWith('1.2'));
    const passivoCirculante = contas.filter(c => c.codigo?.startsWith('2.1'));
    const passivoNaoCirculante = contas.filter(c => c.codigo?.startsWith('2.2'));
    const patrimonioLiquido = contas.filter(c => c.codigo?.startsWith('3'));

    // Calcular saldo por natureza da conta
    const calcularSaldo = (conta: typeof contas[0]) => {
      const saldo = conta.debitos - conta.creditos;
      // Ativo (devedora): saldo positivo quando débitos > créditos
      // Passivo/PL (credora): saldo positivo quando créditos > débitos
      if (conta.natureza === 'devedora') {
        return saldo;
      } else {
        return -saldo;
      }
    };

    const somarSaldos = (lista: typeof contas, naturezaEsperada: 'devedora' | 'credora' = 'devedora') => {
      return lista.reduce((acc, c) => {
        const saldo = calcularSaldo(c);
        return acc + Math.abs(saldo);
      }, 0);
    };

    const totalAtivoCirculante = ativoCirculante.reduce((acc, c) => acc + (c.debitos - c.creditos), 0);
    const totalAtivoNaoCirculante = ativoNaoCirculante.reduce((acc, c) => acc + (c.debitos - c.creditos), 0);
    const totalAtivo = totalAtivoCirculante + totalAtivoNaoCirculante;

    const totalPassivoCirculante = passivoCirculante.reduce((acc, c) => acc + (c.creditos - c.debitos), 0);
    const totalPassivoNaoCirculante = passivoNaoCirculante.reduce((acc, c) => acc + (c.creditos - c.debitos), 0);
    const totalPL = patrimonioLiquido.reduce((acc, c) => acc + (c.creditos - c.debitos), 0);
    const totalPassivoPL = totalPassivoCirculante + totalPassivoNaoCirculante + totalPL;

    return {
      ativo: {
        circulante: { contas: ativoCirculante, total: totalAtivoCirculante },
        naoCirculante: { contas: ativoNaoCirculante, total: totalAtivoNaoCirculante },
        total: totalAtivo,
      },
      passivo: {
        circulante: { contas: passivoCirculante, total: totalPassivoCirculante },
        naoCirculante: { contas: passivoNaoCirculante, total: totalPassivoNaoCirculante },
        total: totalPassivoCirculante + totalPassivoNaoCirculante,
      },
      patrimonioLiquido: { contas: patrimonioLiquido, total: totalPL },
      totalPassivoPL,
      equilibrado: Math.abs(totalAtivo - totalPassivoPL) < 0.01,
      diferenca: Math.abs(totalAtivo - totalPassivoPL),
    };
  };

  const balanco = classificarContas();

  // Componente para renderizar grupo de contas
  const GrupoContas = ({ 
    titulo, 
    contas: contasGrupo, 
    total, 
    natureza 
  }: { 
    titulo: string; 
    contas: typeof contas; 
    total: number;
    natureza: 'devedora' | 'credora';
  }) => (
    <div className="space-y-1">
      <div className="font-semibold text-sm bg-muted/50 px-3 py-2 rounded flex justify-between">
        <span>{titulo}</span>
      </div>
      {contasGrupo && contasGrupo.length > 0 ? (
        <>
          {contasGrupo.map(conta => {
            const saldo = natureza === 'devedora' 
              ? (conta.debitos - conta.creditos) 
              : (conta.creditos - conta.debitos);
            if (Math.abs(saldo) < 0.01) return null;
            return (
              <div key={conta.id} className="flex justify-between px-3 py-1 text-sm hover:bg-muted/30 rounded">
                <span className="text-muted-foreground">{conta.codigo} - {conta.descricao}</span>
                <span className={saldo < 0 ? 'text-red-600' : ''}>{formatCurrency(saldo)}</span>
              </div>
            );
          })}
          <div className="flex justify-between px-3 py-2 font-medium border-t mt-2">
            <span>Subtotal {titulo}</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </>
      ) : (
        <div className="px-3 py-2 text-sm text-muted-foreground italic">
          Nenhuma conta neste grupo
        </div>
      )}
    </div>
  );

  const meses = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' },
  ];

  const anos = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Scale className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Balanço Patrimonial</h1>
          </div>
          <p className="text-muted-foreground">Posição patrimonial e financeira da empresa</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label>Mês:</Label>
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {meses.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label>Ano:</Label>
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {anos.map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              if (!balanco) {
                toast.error('Nenhum dado para exportar');
                return;
              }
              const dados = [
                ...(balanco.ativo.circulante.contas || []).map(c => ({
                  grupo: 'ATIVO CIRCULANTE',
                  codigo: c.codigo,
                  descricao: c.descricao,
                  saldo: c.debitos - c.creditos,
                })),
                ...(balanco.ativo.naoCirculante.contas || []).map(c => ({
                  grupo: 'ATIVO NÃO CIRCULANTE',
                  codigo: c.codigo,
                  descricao: c.descricao,
                  saldo: c.debitos - c.creditos,
                })),
                ...(balanco.passivo.circulante.contas || []).map(c => ({
                  grupo: 'PASSIVO CIRCULANTE',
                  codigo: c.codigo,
                  descricao: c.descricao,
                  saldo: c.creditos - c.debitos,
                })),
                ...(balanco.passivo.naoCirculante.contas || []).map(c => ({
                  grupo: 'PASSIVO NÃO CIRCULANTE',
                  codigo: c.codigo,
                  descricao: c.descricao,
                  saldo: c.creditos - c.debitos,
                })),
                ...(balanco.patrimonioLiquido.contas || []).map(c => ({
                  grupo: 'PATRIMÔNIO LÍQUIDO',
                  codigo: c.codigo,
                  descricao: c.descricao,
                  saldo: c.creditos - c.debitos,
                })),
              ].filter(d => Math.abs(d.saldo) > 0.01);
              
              exportarRelatorioPDF({
                titulo: 'Balanço Patrimonial',
                periodo: `${meses.find(m => m.value === mes)?.label} de ${ano}`,
                dados,
                colunas: [
                  { header: 'Grupo', key: 'grupo', align: 'left' },
                  { header: 'Código', key: 'codigo', align: 'left' },
                  { header: 'Descrição', key: 'descricao', align: 'left' },
                  { header: 'Saldo', key: 'saldo', align: 'right' },
                ],
              });
              toast.success('PDF gerado com sucesso!');
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              if (!balanco) {
                toast.error('Nenhum dado para exportar');
                return;
              }
              const dados = [
                ...(balanco.ativo.circulante.contas || []).map(c => ({
                  grupo: 'ATIVO CIRCULANTE',
                  codigo: c.codigo,
                  descricao: c.descricao,
                  saldo: c.debitos - c.creditos,
                })),
                ...(balanco.ativo.naoCirculante.contas || []).map(c => ({
                  grupo: 'ATIVO NÃO CIRCULANTE',
                  codigo: c.codigo,
                  descricao: c.descricao,
                  saldo: c.debitos - c.creditos,
                })),
                ...(balanco.passivo.circulante.contas || []).map(c => ({
                  grupo: 'PASSIVO CIRCULANTE',
                  codigo: c.codigo,
                  descricao: c.descricao,
                  saldo: c.creditos - c.debitos,
                })),
                ...(balanco.passivo.naoCirculante.contas || []).map(c => ({
                  grupo: 'PASSIVO NÃO CIRCULANTE',
                  codigo: c.codigo,
                  descricao: c.descricao,
                  saldo: c.creditos - c.debitos,
                })),
                ...(balanco.patrimonioLiquido.contas || []).map(c => ({
                  grupo: 'PATRIMÔNIO LÍQUIDO',
                  codigo: c.codigo,
                  descricao: c.descricao,
                  saldo: c.creditos - c.debitos,
                })),
              ].filter(d => Math.abs(d.saldo) > 0.01);
              
              exportarRelatorioCSV({
                titulo: 'Balanço Patrimonial',
                periodo: `${meses.find(m => m.value === mes)?.label} de ${ano}`,
                dados,
                colunas: [
                  { header: 'Grupo', key: 'grupo', align: 'left' },
                  { header: 'Código', key: 'codigo', align: 'left' },
                  { header: 'Descrição', key: 'descricao', align: 'left' },
                  { header: 'Saldo', key: 'saldo', align: 'right' },
                ],
              });
              toast.success('CSV gerado com sucesso!');
            }}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-4" />
              <p>Carregando balanço patrimonial...</p>
            </div>
          </CardContent>
        </Card>
      ) : !balanco ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <Scale className="h-12 w-12 mb-4 opacity-50" />
              <p>Selecione o período para visualizar o balanço</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm font-medium text-muted-foreground">Total do Ativo</div>
                <div className="text-2xl font-bold text-blue-600">{formatCurrency(balanco.ativo.total)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm font-medium text-muted-foreground">Total Passivo + PL</div>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(balanco.totalPassivoPL)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm font-medium text-muted-foreground">Diferença</div>
                <div className={`text-2xl font-bold ${balanco.equilibrado ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(balanco.diferenca)}
                  {balanco.equilibrado && <Check className="inline ml-2 h-5 w-5" />}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cabeçalho do Relatório */}
          <Card>
            <CardContent className="py-4 text-center border-b">
              <h2 className="text-lg font-bold">SGA PRATIC - ASSOCIAÇÃO DE PROTEÇÃO VEICULAR</h2>
              <h3 className="text-md font-semibold text-muted-foreground">BALANÇO PATRIMONIAL</h3>
              <p className="text-sm text-muted-foreground">
                Competência: {meses.find(m => m.value === mes)?.label} de {ano}
              </p>
            </CardContent>
          </Card>

          {/* Grid Ativo x Passivo */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ATIVO */}
            <Card>
              <CardHeader className="bg-blue-50 dark:bg-blue-950/30">
                <CardTitle className="text-blue-700 dark:text-blue-400">ATIVO</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <GrupoContas 
                  titulo="ATIVO CIRCULANTE" 
                  contas={balanco.ativo.circulante.contas} 
                  total={balanco.ativo.circulante.total}
                  natureza="devedora"
                />
                
                <GrupoContas 
                  titulo="ATIVO NÃO CIRCULANTE" 
                  contas={balanco.ativo.naoCirculante.contas} 
                  total={balanco.ativo.naoCirculante.total}
                  natureza="devedora"
                />

                <div className="flex justify-between px-3 py-3 font-bold text-lg bg-blue-100 dark:bg-blue-900/30 rounded mt-4">
                  <span>TOTAL DO ATIVO</span>
                  <span>{formatCurrency(balanco.ativo.total)}</span>
                </div>
              </CardContent>
            </Card>

            {/* PASSIVO + PL */}
            <Card>
              <CardHeader className="bg-green-50 dark:bg-green-950/30">
                <CardTitle className="text-green-700 dark:text-green-400">PASSIVO + PATRIMÔNIO LÍQUIDO</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <GrupoContas 
                  titulo="PASSIVO CIRCULANTE" 
                  contas={balanco.passivo.circulante.contas} 
                  total={balanco.passivo.circulante.total}
                  natureza="credora"
                />
                
                <GrupoContas 
                  titulo="PASSIVO NÃO CIRCULANTE" 
                  contas={balanco.passivo.naoCirculante.contas} 
                  total={balanco.passivo.naoCirculante.total}
                  natureza="credora"
                />
                
                <GrupoContas 
                  titulo="PATRIMÔNIO LÍQUIDO" 
                  contas={balanco.patrimonioLiquido.contas} 
                  total={balanco.patrimonioLiquido.total}
                  natureza="credora"
                />

                <div className="flex justify-between px-3 py-3 font-bold text-lg bg-green-100 dark:bg-green-900/30 rounded mt-4">
                  <span>TOTAL PASSIVO + PL</span>
                  <span>{formatCurrency(balanco.totalPassivoPL)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Verificação de Equilíbrio */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-center gap-3">
                {balanco.equilibrado ? (
                  <>
                    <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <Check className="h-6 w-6 text-green-600" />
                    </div>
                    <span className="text-green-700 dark:text-green-400 font-medium">
                      ✓ Balanço equilibrado - Ativo igual a Passivo + PL
                    </span>
                  </>
                ) : (
                  <>
                    <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <X className="h-6 w-6 text-red-600" />
                    </div>
                    <span className="text-red-700 dark:text-red-400 font-medium">
                      ⚠ Balanço desequilibrado - Diferença de {formatCurrency(balanco.diferenca)}
                    </span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Rodapé */}
          <div className="text-center text-sm text-muted-foreground">
            <p>Relatório gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
          </div>
        </>
      )}
    </div>
  );
};

export default BalancoPatrimonial;

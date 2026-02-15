import { useState } from 'react';
import { Download, Printer, ToggleLeft, ToggleRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useDREEstruturado, type DRESecao } from '@/hooks/useContabilidade';
import { IndicadoresDRE } from '@/components/contabilidade';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { exportarRelatorioPDF, imprimirRelatorio } from '@/lib/contabilidade-exports';
import { toast } from 'sonner';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatPct = (value: number) => `${value.toFixed(1)}%`;

interface LinhaProps {
  label: string;
  valorAtual: number;
  valorAnterior?: number;
  showAnterior: boolean;
  destaque?: boolean;
  subtotal?: boolean;
  total?: boolean;
  resultado?: boolean;
  indent?: boolean;
  negativo?: boolean;
  pct?: number;
}

function Linha({ label, valorAtual, valorAnterior, showAnterior, destaque, subtotal, total, resultado, indent, negativo, pct }: LinhaProps) {
  const val = negativo ? -valorAtual : valorAtual;
  const valAnt = negativo ? -(valorAnterior || 0) : (valorAnterior || 0);

  return (
    <div className={cn(
      'flex items-center px-4 py-2 text-sm',
      destaque && 'bg-muted/50 font-semibold text-xs uppercase tracking-wide',
      subtotal && 'bg-muted/30 font-medium border-t',
      total && 'bg-primary/10 font-bold text-base border-t-2',
      resultado && 'font-semibold',
      indent && 'pl-10',
    )}>
      <span className="flex-1">{label}</span>
      {pct !== undefined && (
        <span className="w-16 text-right text-xs text-muted-foreground mr-4">{formatPct(pct)}</span>
      )}
      <span className={cn('w-36 text-right', val < 0 ? 'text-red-600' : val > 0 ? 'text-green-600' : '')}>
        {val !== 0 ? (negativo ? `(${formatCurrency(Math.abs(val))})` : formatCurrency(val)) : '-'}
      </span>
      {showAnterior && (
        <span className={cn('w-36 text-right text-muted-foreground', valAnt < 0 ? 'text-red-400' : '')}>
          {valAnt !== 0 ? formatCurrency(valAnt) : '-'}
        </span>
      )}
    </div>
  );
}

function SecaoDRE({ secao, showAnterior, negativo }: { secao: DRESecao; showAnterior: boolean; negativo?: boolean }) {
  return (
    <>
      <Linha label={secao.titulo} valorAtual={0} showAnterior={showAnterior} destaque />
      {secao.contas.map((c) => (
        <Linha key={c.codigo} label={`${c.codigo} ${c.descricao}`} valorAtual={c.valorAtual} valorAnterior={c.valorAnterior}
          showAnterior={showAnterior} indent negativo={negativo} />
      ))}
      <Linha label={`TOTAL ${secao.titulo}`} valorAtual={secao.totalAtual} valorAnterior={secao.totalAnterior}
        showAnterior={showAnterior} subtotal negativo={negativo} />
    </>
  );
}

export default function DRE() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [compararAnterior, setCompararAnterior] = useState(false);

  const { data: dre, isLoading } = useDREEstruturado(mes, ano, compararAnterior);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">DRE</h1>
          <p className="text-muted-foreground">Demonstração do Superávit ou Déficit do Exercício</p>
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
          <div className="flex items-center gap-2 ml-2">
            <Switch id="comparar" checked={compararAnterior} onCheckedChange={setCompararAnterior} />
            <Label htmlFor="comparar" className="text-sm">Comparar</Label>
          </div>
          <Button variant="outline" size="icon" onClick={imprimirRelatorio}><Printer className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => toast.info('Exportação PDF em breve')}><Download className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Indicadores */}
      {dre && (
        <IndicadoresDRE
          sinistralidade={dre.indicadores.sinistralidade}
          custoAdmin={dre.indicadores.custoAdmin}
          margemOperacional={dre.indicadores.margemOperacional}
          margemFinal={dre.indicadores.margemFinal}
        />
      )}

      {/* DRE Estruturado */}
      <Card>
        <CardHeader>
          <CardTitle className="text-center">
            DEMONSTRAÇÃO DO SUPERÁVIT / DÉFICIT DO EXERCÍCIO
            <br />
            <span className="text-base font-normal text-muted-foreground">
              {format(new Date(ano, mes - 1), 'MMMM yyyy', { locale: ptBR }).toUpperCase()}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando DRE...</div>
          ) : !dre ? (
            <div className="text-center py-8 text-muted-foreground">Sem dados</div>
          ) : (
            <div className="max-w-3xl mx-auto border rounded-lg divide-y overflow-hidden">
              {/* Header */}
              <div className="flex items-center px-4 py-2 bg-muted font-semibold text-xs uppercase tracking-wide">
                <span className="flex-1">Descrição</span>
                <span className="w-36 text-right">Período Atual</span>
                {compararAnterior && <span className="w-36 text-right">Período Anterior</span>}
              </div>

              {/* Receitas Operacionais */}
              <SecaoDRE secao={dre.receitasOperacionais} showAnterior={compararAnterior} />

              {/* Despesas com Benefícios Mutualistas */}
              <SecaoDRE secao={dre.despBeneficios} showAnterior={compararAnterior} negativo />

              {/* Resultado Operacional Bruto */}
              <Linha label="RESULTADO OPERACIONAL BRUTO" valorAtual={dre.resultadoBrutoAtual}
                valorAnterior={dre.resultadoBrutoAnterior} showAnterior={compararAnterior} resultado
                pct={dre.totalReceitasAtual > 0 ? (dre.resultadoBrutoAtual / dre.totalReceitasAtual) * 100 : 0} />

              {/* Despesas Administrativas */}
              <SecaoDRE secao={dre.despAdministrativas} showAnterior={compararAnterior} negativo />

              {/* Resultado Operacional Líquido */}
              <Linha label="RESULTADO OPERACIONAL LÍQUIDO" valorAtual={dre.resultadoOpAtual}
                valorAnterior={dre.resultadoOpAnterior} showAnterior={compararAnterior} resultado />

              {/* Resultado Financeiro */}
              {dre.receitasFinanceiras && dre.receitasFinanceiras.contas.length > 0 && (
                <SecaoDRE secao={dre.receitasFinanceiras} showAnterior={compararAnterior} />
              )}
              <SecaoDRE secao={dre.despFinanceiras} showAnterior={compararAnterior} negativo />

              {/* Outras Receitas */}
              {dre.outrasReceitas.contas.length > 0 && (
                <SecaoDRE secao={dre.outrasReceitas} showAnterior={compararAnterior} />
              )}

              {/* Outras Despesas */}
              {dre.outrasDespesas.contas.length > 0 && (
                <SecaoDRE secao={dre.outrasDespesas} showAnterior={compararAnterior} negativo />
              )}

              {/* Resultado Antes dos Tributos */}
              <Linha label="RESULTADO ANTES DOS TRIBUTOS" valorAtual={dre.resultadoAntesTributosAtual}
                valorAnterior={dre.resultadoAntesTributosAnterior} showAnterior={compararAnterior} resultado />

              {/* Tributos */}
              {dre.despTributos && dre.despTributos.contas.length > 0 && (
                <SecaoDRE secao={dre.despTributos} showAnterior={compararAnterior} negativo />
              )}

              {/* Resultado Final */}
              <Linha
                label={dre.resultadoFinalAtual >= 0 ? 'SUPERÁVIT DO EXERCÍCIO' : 'DÉFICIT DO EXERCÍCIO'}
                valorAtual={dre.resultadoFinalAtual}
                valorAnterior={dre.resultadoFinalAnterior}
                showAnterior={compararAnterior}
                total
                pct={dre.indicadores.margemFinal}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

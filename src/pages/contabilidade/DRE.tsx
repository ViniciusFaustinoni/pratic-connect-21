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
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function DRE() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());

  const { data: dre, isLoading } = useQuery({
    queryKey: ['dre', mes, ano],
    queryFn: async () => {
      const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
      const dataFim = mes === 12 
        ? `${ano + 1}-01-01`
        : `${ano}-${String(mes + 1).padStart(2, '0')}-01`;
      
      // Buscar receitas com join no lancamento
      const { data: receitas } = await supabase
        .from('lancamentos_partidas')
        .select(`
          valor,
          lancamento:lancamentos_contabeis!inner(data_competencia, status),
          conta:plano_contas!inner(codigo, descricao, tipo)
        `)
        .eq('tipo', 'credito')
        .eq('conta.tipo', 'receita')
        .eq('lancamento.status', 'ativo')
        .gte('lancamento.data_competencia', dataInicio)
        .lt('lancamento.data_competencia', dataFim);
      
      // Buscar despesas
      const { data: despesas } = await supabase
        .from('lancamentos_partidas')
        .select(`
          valor,
          lancamento:lancamentos_contabeis!inner(data_competencia, status),
          conta:plano_contas!inner(codigo, descricao, tipo)
        `)
        .eq('tipo', 'debito')
        .eq('conta.tipo', 'despesa')
        .eq('lancamento.status', 'ativo')
        .gte('lancamento.data_competencia', dataInicio)
        .lt('lancamento.data_competencia', dataFim);
      
      // Agrupar receitas por conta
      const receitasPorConta = new Map<string, { codigo: string; descricao: string; valor: number }>();
      receitas?.forEach((r: any) => {
        const key = r.conta.codigo;
        receitasPorConta.set(key, {
          codigo: r.conta.codigo,
          descricao: r.conta.descricao,
          valor: (receitasPorConta.get(key)?.valor || 0) + Number(r.valor)
        });
      });
      
      // Agrupar despesas por conta
      const despesasPorConta = new Map<string, { codigo: string; descricao: string; valor: number }>();
      despesas?.forEach((d: any) => {
        const key = d.conta.codigo;
        despesasPorConta.set(key, {
          codigo: d.conta.codigo,
          descricao: d.conta.descricao,
          valor: (despesasPorConta.get(key)?.valor || 0) + Number(d.valor)
        });
      });
      
      const receitasArray = Array.from(receitasPorConta.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));
      const despesasArray = Array.from(despesasPorConta.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));
      
      return {
        receitas: receitasArray,
        despesas: despesasArray,
        totalReceitas: receitasArray.reduce((acc, r) => acc + r.valor, 0),
        totalDespesas: despesasArray.reduce((acc, d) => acc + d.valor, 0),
      };
    }
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const receitas = dre?.totalReceitas || 0;
  const despesas = dre?.totalDespesas || 0;
  const resultado = receitas - despesas;

  interface LinhaItem {
    codigo?: string;
    descricao: string;
    valor: number;
    destaque?: boolean;
    subtotal?: boolean;
    total?: boolean;
    nivel?: number;
  }

  const linhas: LinhaItem[] = [
    { descricao: 'RECEITAS OPERACIONAIS', valor: 0, destaque: true },
    ...(dre?.receitas || []).map(r => ({
      codigo: r.codigo,
      descricao: r.descricao,
      valor: r.valor,
      nivel: 1,
    })),
    { descricao: 'TOTAL DE RECEITAS', valor: receitas, subtotal: true },
    { descricao: '', valor: 0 },
    { descricao: 'DESPESAS OPERACIONAIS', valor: 0, destaque: true },
    ...(dre?.despesas || []).map(d => ({
      codigo: d.codigo,
      descricao: d.descricao,
      valor: -d.valor,
      nivel: 1,
    })),
    { descricao: 'TOTAL DE DESPESAS', valor: -despesas, subtotal: true },
    { descricao: '', valor: 0 },
    { descricao: 'RESULTADO OPERACIONAL', valor: resultado, total: true },
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
                      <span className="flex items-center gap-2">
                        {linha.codigo && (
                          <span className="font-mono text-sm text-muted-foreground">
                            {linha.codigo}
                          </span>
                        )}
                        <span>{linha.descricao}</span>
                      </span>
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

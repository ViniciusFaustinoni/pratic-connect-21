import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign, TrendingUp, AlertTriangle, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import type { MinhasComissoesAdesao, MinhaDeducao, MeuResumoTipo } from '@/hooks/useMinhasComissoesExtended';
import { TIPO_DEDUCAO_LABELS } from '@/types/comissoes';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TabAdesaoProps {
  resumoAdesao: MeuResumoTipo | undefined;
  adesoes: MinhasComissoesAdesao[];
  deducoes: MinhaDeducao[];
  totalDeducoes: number;
  isLoading: boolean;
  onContestar: (id: string, motivo: string) => void;
  isContestando: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

// Faixas de adesão (simuladas - em produção viriam do BD)
const FAIXAS_ADESAO = [
  { vendas_min: 1, percentual: 10 },
  { vendas_min: 5, percentual: 12 },
  { vendas_min: 10, percentual: 15 },
  { vendas_min: 15, percentual: 18 },
  { vendas_min: 20, percentual: 20 },
  { vendas_min: 25, percentual: 22 },
];

function getFaixaAtual(vendas: number) {
  let faixaAtual = FAIXAS_ADESAO[0];
  for (const faixa of FAIXAS_ADESAO) {
    if (vendas >= faixa.vendas_min) {
      faixaAtual = faixa;
    }
  }
  return faixaAtual;
}

function getProximaFaixa(vendas: number) {
  for (const faixa of FAIXAS_ADESAO) {
    if (vendas < faixa.vendas_min) {
      return faixa;
    }
  }
  return null;
}

export function TabAdesao({
  resumoAdesao,
  adesoes,
  deducoes,
  totalDeducoes,
  isLoading,
  onContestar,
  isContestando,
}: TabAdesaoProps) {
  const [contestacaoAberta, setContestacaoAberta] = useState<string | null>(null);
  const [motivoContestacao, setMotivoContestacao] = useState('');

  const vendasMes = resumoAdesao?.quantidade || 0;
  const valorTotalAdesoes = adesoes.reduce((sum, a) => sum + a.valor_adesao, 0);
  const valorBruto = resumoAdesao?.valor_total || 0;
  
  const faixaAtual = getFaixaAtual(vendasMes);
  const proximaFaixa = getProximaFaixa(vendasMes);
  
  // Cálculo do antecipado (10%)
  const antecipado = valorBruto * 0.10;
  const valorLiquido = valorBruto - totalDeducoes - antecipado;

  // Progresso para próxima faixa
  const progressValue = proximaFaixa
    ? ((vendasMes - faixaAtual.vendas_min) / (proximaFaixa.vendas_min - faixaAtual.vendas_min)) * 100
    : 100;

  const handleContestar = () => {
    if (contestacaoAberta && motivoContestacao.trim()) {
      onContestar(contestacaoAberta, motivoContestacao);
      setContestacaoAberta(null);
      setMotivoContestacao('');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cards informativos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Vendas e Faixa */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Vendas no Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{vendasMes}</p>
            <div className="mt-2 space-y-1 text-sm">
              <p className="text-muted-foreground">
                Faixa atual: <span className="font-medium text-foreground">{faixaAtual.percentual}%</span>
              </p>
              {proximaFaixa && (
                <p className="text-blue-600">
                  Próxima faixa: {proximaFaixa.vendas_min} vendas = {proximaFaixa.percentual}%
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Valores e Deduções */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              Valores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total adesões:</span>
              <span className="font-medium">{formatCurrency(valorTotalAdesoes)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor bruto ({faixaAtual.percentual}%):</span>
              <span className="font-medium">{formatCurrency(valorBruto)}</span>
            </div>
            <div className="flex justify-between text-destructive">
              <span>Deduções:</span>
              <span className="font-medium">-{formatCurrency(totalDeducoes)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Valor Líquido */}
        <Card className="bg-green-50 dark:bg-green-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-700 dark:text-green-400">
              Valor Líquido 1ª Fase
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-700 dark:text-green-400">
              {formatCurrency(valorLiquido)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Após deduções e antecipado (10%: {formatCurrency(antecipado)})
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de progresso */}
      {proximaFaixa && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progresso para próxima faixa</span>
              <span className="text-sm text-muted-foreground">
                Faltam {proximaFaixa.vendas_min - vendasMes} vendas para {proximaFaixa.percentual}%
              </span>
            </div>
            <Progress value={progressValue} className="h-3" />
            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
              <span>{faixaAtual.percentual}% ({faixaAtual.vendas_min}+ vendas)</span>
              <span>{proximaFaixa.percentual}% ({proximaFaixa.vendas_min}+ vendas)</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de deduções (se houver) */}
      {deducoes.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-orange-700">
              <AlertTriangle className="h-4 w-4" />
              Deduções do Mês ({deducoes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {deducoes.slice(0, 5).map((d) => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {TIPO_DEDUCAO_LABELS[d.tipo] || d.tipo}
                    </Badge>
                    <span className="text-muted-foreground truncate max-w-[200px]">
                      {d.descricao || d.associado_nome || '-'}
                    </span>
                  </div>
                  <span className="font-medium text-destructive">
                    -{formatCurrency(d.valor)}
                  </span>
                </div>
              ))}
              {deducoes.length > 5 && (
                <p className="text-xs text-muted-foreground">
                  E mais {deducoes.length - 5} deduções...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela de vendas individuais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vendas Individuais ({adesoes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {adesoes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma venda registrada neste mês
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>Associado</TableHead>
                    <TableHead>Placa</TableHead>
                    <TableHead className="text-right">Adesão</TableHead>
                    <TableHead className="text-right">Dedução</TableHead>
                    <TableHead className="text-right">Líquido</TableHead>
                    <TableHead className="w-[80px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adesoes.map((a, index) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell className="truncate max-w-[150px]">
                        {a.associado_nome || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {a.placa || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(a.valor_adesao)}
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        {a.valor_deducao > 0 ? `-${formatCurrency(a.valor_deducao)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium text-primary">
                        {formatCurrency(a.valor_liquido)}
                      </TableCell>
                      <TableCell>
                        {a.status === 'pendente' && (
                          <Dialog 
                            open={contestacaoAberta === a.id} 
                            onOpenChange={(open) => {
                              if (!open) {
                                setContestacaoAberta(null);
                                setMotivoContestacao('');
                              }
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setContestacaoAberta(a.id)}
                              >
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Contestar Comissão</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <p className="text-sm text-muted-foreground">
                                  Contrato: {a.contrato_numero || a.id.slice(0, 8)}
                                </p>
                                <Textarea
                                  placeholder="Descreva o motivo da contestação..."
                                  value={motivoContestacao}
                                  onChange={(e) => setMotivoContestacao(e.target.value)}
                                  rows={4}
                                />
                              </div>
                              <DialogFooter>
                                <Button 
                                  variant="outline" 
                                  onClick={() => setContestacaoAberta(null)}
                                >
                                  Cancelar
                                </Button>
                                <Button 
                                  onClick={handleContestar}
                                  disabled={!motivoContestacao.trim() || isContestando}
                                >
                                  Enviar Contestação
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

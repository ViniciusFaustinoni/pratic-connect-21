import { useState } from 'react';
import { Lock, Unlock, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useFechamentos, useCriarFechamento } from '@/hooks/useContabilidade';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const meses = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function Fechamentos() {
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; mes: number } | null>(null);

  const { data: fechamentos, isLoading } = useFechamentos(ano);
  const criarFechamento = useCriarFechamento();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getFechamento = (mes: number) => {
    return fechamentos?.find(f => f.mes === mes);
  };

  const getStatus = (mes: number) => {
    const fechamento = getFechamento(mes);
    if (!fechamento) return 'aberto';
    return fechamento.status;
  };

  const handleFechar = async (mes: number) => {
    try {
      await criarFechamento.mutateAsync({ mes, ano });
      setConfirmDialog(null);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
    aberto: {
      icon: Clock,
      color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      label: 'Aberto',
    },
    em_fechamento: {
      icon: AlertCircle,
      color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      label: 'Em Fechamento',
    },
    fechado: {
      icon: CheckCircle,
      color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      label: 'Fechado',
    },
    reaberto: {
      icon: Unlock,
      color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      label: 'Reaberto',
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fechamentos</h1>
          <p className="text-muted-foreground">
            Controle de fechamento contábil mensal
          </p>
        </div>

        <Select value={String(ano)} onValueChange={(v) => setAno(parseInt(v))}>
          <SelectTrigger className="w-[120px]">
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

      {/* Calendar Grid */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          Carregando fechamentos...
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {meses.map((nomeMes, index) => {
            const mes = index + 1;
            const status = getStatus(mes);
            const fechamento = getFechamento(mes);
            const config = statusConfig[status];
            const Icon = config.icon;
            const isFuturo = ano > now.getFullYear() || 
                            (ano === now.getFullYear() && mes > now.getMonth() + 1);

            return (
              <Card
                key={mes}
                className={cn(
                  'relative overflow-hidden',
                  status === 'fechado' && 'border-green-200 dark:border-green-900/50'
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{nomeMes}</CardTitle>
                    <Badge className={config.color}>
                      <Icon className="h-3 w-3 mr-1" />
                      {config.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {fechamento ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Débitos:</span>
                        <span>{formatCurrency(Number(fechamento.total_debitos))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Créditos:</span>
                        <span>{formatCurrency(Number(fechamento.total_creditos))}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>Resultado:</span>
                        <span className={cn(
                          Number(fechamento.resultado_periodo) >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        )}>
                          {formatCurrency(Number(fechamento.resultado_periodo))}
                        </span>
                      </div>
                      {fechamento.data_fechamento && (
                        <p className="text-xs text-muted-foreground pt-2">
                          Fechado em: {format(new Date(fechamento.data_fechamento), 'dd/MM/yyyy HH:mm')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        {isFuturo 
                          ? 'Período futuro'
                          : 'Período ainda não fechado'
                        }
                      </p>
                      {!isFuturo && (
                        <Button
                          className="w-full"
                          size="sm"
                          onClick={() => setConfirmDialog({ open: true, mes })}
                        >
                          <Lock className="h-4 w-4 mr-2" />
                          Fechar Período
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Legenda */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            {Object.entries(statusConfig).map(([key, value]) => {
              const Icon = value.icon;
              return (
                <div key={key} className="flex items-center gap-2">
                  <Badge className={value.color}>
                    <Icon className="h-3 w-3 mr-1" />
                    {value.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <AlertDialog
        open={confirmDialog?.open}
        onOpenChange={(open) => !open && setConfirmDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Fechamento</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a fechar o período de{' '}
              <strong>
                {confirmDialog && meses[confirmDialog.mes - 1]} de {ano}
              </strong>.
              <br /><br />
              Após o fechamento, novos lançamentos não poderão ser feitos neste período.
              Esta ação pode ser revertida posteriormente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDialog && handleFechar(confirmDialog.mes)}
              disabled={criarFechamento.isPending}
            >
              {criarFechamento.isPending ? 'Fechando...' : 'Confirmar Fechamento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { FileText, Wrench, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAutoCenterHistorico } from '@/hooks/useAutoCenterHistorico';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_COLORS: Record<string, string> = {
  pendente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  enviada: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  respondida: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  aprovada: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  recusada: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  aberta: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  em_andamento: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  concluida: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  cancelada: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
}

function formatCurrency(value: number | null) {
  if (value == null) return null;
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

interface Props {
  autoCenterId: string;
}

export function AutoCenterHistorico({ autoCenterId }: Props) {
  const { cotacoes, ordens, isLoading } = useAutoCenterHistorico(autoCenterId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="flex items-center gap-2 font-medium">
          <History className="h-4 w-4" /> Histórico de Orçamentos
        </h3>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const items = [
    ...cotacoes.map((c) => ({
      id: c.id,
      type: 'cotacao' as const,
      label: 'Cotação de Peças',
      status: c.status || 'pendente',
      valor: c.valor_total,
      date: c.created_at,
      protocolo: c.sinistro?.protocolo,
    })),
    ...ordens.map((o) => ({
      id: o.id,
      type: 'ordem' as const,
      label: `OS ${o.numero}`,
      status: o.status || 'aberta',
      valor: o.valor_orcamento,
      date: o.created_at,
      protocolo: o.sinistro?.protocolo,
    })),
  ].sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 font-medium">
        <History className="h-4 w-4" /> Histórico de Orçamentos
      </h3>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum orçamento registrado</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-3 rounded-lg border p-3">
              <div className="mt-0.5 rounded-md bg-muted p-1.5">
                {item.type === 'cotacao' ? (
                  <FileText className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{item.label}</p>
                  <Badge className={`shrink-0 text-xs ${STATUS_COLORS[item.status] || ''}`}>
                    {item.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{formatDate(item.date)}</span>
                  {item.protocolo && <span>Sinistro: {item.protocolo}</span>}
                  {formatCurrency(item.valor) && (
                    <span className="font-medium text-foreground">{formatCurrency(item.valor)}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

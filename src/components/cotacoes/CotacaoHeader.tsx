import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, Layers, Clock, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUS_COTACAO_LABELS, STATUS_COTACAO_COLORS } from '@/types/vendas';
import type { StatusCotacao } from '@/types/vendas';

interface CotacaoHeaderProps {
  cotacao: {
    id: string;
    numero?: string | null;
    status: string;
    created_at: string;
    valor_fipe?: number | null;
    veiculo_marca?: string | null;
    veiculo_modelo?: string | null;
    veiculo_ano?: number | null;
    veiculo_placa?: string | null;
    leads?: { nome?: string | null } | null;
    dados_extras?: { planos_comparacao?: unknown[] } | null;
  };
}

const formatCurrency = (value: number | null | undefined) => {
  if (!value) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
};

const formatDateTime = (date: string) => {
  return new Date(date).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const calcularValidade = (createdAt: string) => {
  const created = new Date(createdAt);
  return new Date(created.getTime() + 7 * 24 * 60 * 60 * 1000);
};

const isExpirada = (createdAt: string) => {
  const validade = calcularValidade(createdAt);
  return new Date() > validade;
};

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
  warning?: boolean;
}

function MetricCard({ icon, label, value, highlight, warning }: MetricCardProps) {
  return (
    <div className={cn(
      "flex items-center gap-3 rounded-lg border p-3",
      "bg-card/50 backdrop-blur-sm",
      highlight && "border-primary/50 bg-primary/5",
      warning && "border-destructive/50 bg-destructive/5"
    )}>
      <div className={cn(
        "flex h-10 w-10 items-center justify-center rounded-lg",
        highlight ? "bg-primary/10 text-primary" : warning ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
      )}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn(
          "font-semibold",
          warning && "text-destructive"
        )}>{value}</p>
      </div>
    </div>
  );
}

export function CotacaoHeader({ cotacao }: CotacaoHeaderProps) {
  const validade = calcularValidade(cotacao.created_at);
  const expirada = isExpirada(cotacao.created_at);
  const planosComparacao = (cotacao.dados_extras as { planos_comparacao?: unknown[] } | null)?.planos_comparacao;
  const numPlanos = planosComparacao?.length || 1;

  return (
    <Card className="bg-gradient-to-br from-card via-card to-muted/30 border-border/50">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Linha 1: Badge + Nome */}
          <div className="flex flex-wrap items-center gap-3">
            <Badge className={cn(STATUS_COTACAO_COLORS[cotacao.status as StatusCotacao], "text-xs")}>
              {STATUS_COTACAO_LABELS[cotacao.status as StatusCotacao]}
            </Badge>
            <h1 className="text-2xl font-bold tracking-tight">
              {cotacao.leads?.nome || 'Cotação Avulsa'}
            </h1>
          </div>

          {/* Linha 2: Veículo resumido */}
          <p className="text-muted-foreground flex items-center gap-2">
            <span className="font-medium text-foreground">
              {cotacao.veiculo_marca} {cotacao.veiculo_modelo}
            </span>
            <span className="text-muted-foreground">
              {cotacao.veiculo_ano}
            </span>
            {cotacao.veiculo_placa && (
              <>
                <span>•</span>
                <span className="font-mono uppercase">{cotacao.veiculo_placa}</span>
              </>
            )}
          </p>

          {/* Métricas em destaque */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MetricCard
              icon={<DollarSign className="h-5 w-5" />}
              label="Valor FIPE"
              value={formatCurrency(cotacao.valor_fipe)}
              highlight
            />
            <MetricCard
              icon={<Layers className="h-5 w-5" />}
              label="Planos Cotados"
              value={`${numPlanos} ${numPlanos === 1 ? 'opção' : 'opções'}`}
            />
            <MetricCard
              icon={<Clock className="h-5 w-5" />}
              label={expirada ? 'Expirada em' : 'Válida até'}
              value={formatDate(validade.toISOString())}
              warning={expirada}
            />
          </div>

          {/* Linha de rodapé: número e data */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border/50">
            <span className="font-mono">
              #{cotacao.numero || cotacao.id.slice(0, 8).toUpperCase()}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Criada em {formatDateTime(cotacao.created_at)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

import { Trophy, TrendingUp, TrendingDown, FileText, Clock, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { UserAvatar } from '@/components/UserAvatar';
import { cn } from '@/lib/utils';
import type { ConsultorMetricas } from '@/hooks/usePropostasMetricas';

interface ConsultorCardProps {
  consultor: ConsultorMetricas;
  onClick?: () => void;
  isSelected?: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function getRankingIcon(ranking: number) {
  if (ranking === 1) return { emoji: '🥇', label: '#1' };
  if (ranking === 2) return { emoji: '🥈', label: '#2' };
  if (ranking === 3) return { emoji: '🥉', label: '#3' };
  return null;
}

function getPerformanceColor(consultor: ConsultorMetricas) {
  const variacao = consultor.propostasFechadasAnterior > 0
    ? ((consultor.propostasFechadas - consultor.propostasFechadasAnterior) / consultor.propostasFechadasAnterior) * 100
    : consultor.propostasFechadas > 0 ? 100 : 0;

  if (variacao >= 10) return 'border-green-500/50 bg-green-500/5';
  if (variacao >= 0) return 'border-yellow-500/50 bg-yellow-500/5';
  return 'border-red-500/50 bg-red-500/5';
}

function getPerformanceBadge(consultor: ConsultorMetricas) {
  const variacao = consultor.propostasFechadasAnterior > 0
    ? ((consultor.propostasFechadas - consultor.propostasFechadasAnterior) / consultor.propostasFechadasAnterior) * 100
    : consultor.propostasFechadas > 0 ? 100 : 0;

  if (variacao >= 20) return { label: 'Excelente', color: 'bg-green-100 text-green-800' };
  if (variacao >= 10) return { label: 'Bom', color: 'bg-emerald-100 text-emerald-800' };
  if (variacao >= 0) return { label: 'Regular', color: 'bg-yellow-100 text-yellow-800' };
  if (variacao >= -10) return { label: 'Atenção', color: 'bg-orange-100 text-orange-800' };
  return { label: 'Crítico', color: 'bg-red-100 text-red-800' };
}

export function ConsultorCard({ consultor, onClick, isSelected }: ConsultorCardProps) {
  const performanceBadge = getPerformanceBadge(consultor);
  const variacao = consultor.propostasFechadasAnterior > 0
    ? ((consultor.propostasFechadas - consultor.propostasFechadasAnterior) / consultor.propostasFechadasAnterior) * 100
    : consultor.propostasFechadas > 0 ? 100 : 0;

  return (
    <Card 
      className={cn(
        "cursor-pointer hover:shadow-lg transition-all duration-200 border-2",
        isSelected ? "ring-2 ring-primary border-primary" : getPerformanceColor(consultor)
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Header com Avatar e Ranking */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <UserAvatar 
              src={consultor.avatar_url} 
              name={consultor.nome} 
              size="md"
            />
            <div>
              <h3 className="font-semibold text-foreground line-clamp-1">{consultor.nome}</h3>
              <Badge className={cn("text-xs", performanceBadge.color)}>
                {performanceBadge.label}
              </Badge>
            </div>
          </div>
        </div>

        {/* Métricas Principais */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-bold text-primary">{consultor.propostasFechadas}</p>
            <p className="text-[10px] text-muted-foreground">Fechadas</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-bold text-yellow-600">{consultor.emCotacao}</p>
            <p className="text-[10px] text-muted-foreground">Cotação</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-bold text-orange-600">{consultor.contratoEnviado}</p>
            <p className="text-[10px] text-muted-foreground">Enviados</p>
          </div>
        </div>

        {/* Valor Fechado */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-muted-foreground">Valor Fechado</span>
          <span className="font-semibold text-green-600">
            {formatCurrency(consultor.valorFechado)}
          </span>
        </div>

        {/* Variação */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">vs. Anterior</span>
          <span className={cn(
            "inline-flex items-center gap-1 text-sm font-medium",
            variacao >= 0 ? "text-green-600" : "text-red-500"
          )}>
            {variacao >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {variacao >= 0 ? '+' : ''}{variacao.toFixed(0)}%
          </span>
        </div>

        {/* Taxa de Conversão */}
        <div className="mt-3 pt-3 border-t">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Taxa de Conversão</span>
            <span className="font-medium">{consultor.taxaConversao.toFixed(0)}%</span>
          </div>
          <Progress value={consultor.taxaConversao} className="h-1.5" />
        </div>
      </CardContent>
    </Card>
  );
}

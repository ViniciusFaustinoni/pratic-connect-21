import { Star, Award, AlertTriangle, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { UserAvatar } from '@/components/UserAvatar';
import { cn } from '@/lib/utils';
import type { ConsultorMetricas } from '@/hooks/usePropostasMetricas';

interface ConsultorCardNewProps {
  consultor: ConsultorMetricas;
  ranking: number;
  onClick: () => void;
}

function formatCurrency(value: number): string {
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}k`;
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function getRankingDisplay(ranking: number) {
  if (ranking === 1) return { emoji: '🥇', bg: 'bg-yellow-500/10 border-yellow-500/30' };
  if (ranking === 2) return { emoji: '🥈', bg: 'bg-gray-400/10 border-gray-400/30' };
  if (ranking === 3) return { emoji: '🥉', bg: 'bg-orange-500/10 border-orange-500/30' };
  return { emoji: `#${ranking}`, bg: '' };
}

function getPerformanceBadge(taxaConversao: number) {
  if (taxaConversao >= 30) {
    return { 
      label: 'Top', 
      icon: Star,
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      progressColor: 'bg-yellow-500',
    };
  }
  if (taxaConversao >= 10) {
    return { 
      label: 'Regular', 
      icon: Award,
      className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      progressColor: 'bg-green-500',
    };
  }
  return { 
    label: 'Atenção', 
    icon: AlertTriangle,
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    progressColor: 'bg-red-500',
  };
}

function abbreviateName(fullName: string): string {
  const parts = fullName.split(' ');
  if (parts.length <= 2) return fullName;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

export function ConsultorCardNew({ consultor, ranking, onClick }: ConsultorCardNewProps) {
  const rankingDisplay = getRankingDisplay(ranking);
  const performanceBadge = getPerformanceBadge(consultor.taxaConversao);
  const Icon = performanceBadge.icon;

  return (
    <Card 
      className={cn(
        "cursor-pointer hover:shadow-lg transition-all duration-200 group overflow-hidden",
        "border hover:border-primary/40",
        ranking <= 3 && rankingDisplay.bg
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Top row: avatar + name + ranking */}
        <div className="flex items-start gap-3 mb-4">
          <div className="relative">
            <UserAvatar 
              src={consultor.avatar_url} 
              name={consultor.nome} 
              size="md"
            />
            <span className={cn(
              "absolute -top-1 -right-1 text-[10px] font-bold min-w-[20px] h-5 flex items-center justify-center rounded-full border",
              ranking <= 3 
                ? "bg-background border-primary/30 shadow-sm" 
                : "bg-muted border-border text-muted-foreground"
            )}>
              {rankingDisplay.emoji}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-tight truncate">
              {abbreviateName(consultor.nome)}
            </h3>
            <Badge className={cn("mt-1 gap-0.5 text-[10px] px-1.5 py-0", performanceBadge.className)}>
              <Icon className="h-2.5 w-2.5" />
              {performanceBadge.label}
            </Badge>
          </div>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {[
            { value: consultor.cotacoesRealizadas, label: 'Cotações', color: consultor.cotacoesRealizadas > 0 ? 'text-purple-600' : '' },
            { value: consultor.emCotacao, label: 'Abertas', color: consultor.emCotacao > 0 ? 'text-yellow-600' : '' },
            { value: consultor.contratoEnviado, label: 'Enviadas', color: consultor.contratoEnviado > 0 ? 'text-blue-600' : '' },
            { value: consultor.propostasFechadas, label: 'Fechadas', color: consultor.propostasFechadas > 0 ? 'text-green-600' : '' },
          ].map((metric) => (
            <div key={metric.label} className="text-center p-1.5 rounded-md bg-muted/40">
              <p className={cn("text-base font-bold leading-none", metric.color || "text-muted-foreground")}>
                {metric.value}
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{metric.label}</p>
            </div>
          ))}
        </div>

        {/* Value + Conversion */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Valor fechado</span>
            <span className={cn(
              "font-semibold",
              consultor.valorFechado > 0 ? "text-green-600" : "text-muted-foreground"
            )}>
              {formatCurrency(consultor.valorFechado)}
            </span>
          </div>
          
          {/* Conversion bar */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Conversão</span>
              <span className={cn(
                "font-semibold",
                consultor.taxaConversao >= 30 ? "text-green-600" :
                consultor.taxaConversao >= 10 ? "text-yellow-600" : "text-red-500"
              )}>
                {consultor.taxaConversao.toFixed(0)}%
              </span>
            </div>
            <Progress 
              value={Math.min(consultor.taxaConversao, 100)} 
              className="h-1.5"
              indicatorClassName={performanceBadge.progressColor}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 pt-2 border-t border-border/50">
          <Button 
            variant="ghost" 
            className="w-full justify-between text-xs text-muted-foreground hover:text-foreground h-7 px-1"
          >
            Ver detalhes
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

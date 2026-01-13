import { Star, Award, AlertTriangle, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

function getRankingBadge(ranking: number) {
  if (ranking === 1) {
    return {
      emoji: '🥇',
      className: 'bg-yellow-500/20 border-yellow-500 text-yellow-700',
    };
  }
  if (ranking === 2) {
    return {
      emoji: '🥈',
      className: 'bg-gray-400/20 border-gray-400 text-gray-700',
    };
  }
  if (ranking === 3) {
    return {
      emoji: '🥉',
      className: 'bg-orange-500/20 border-orange-500 text-orange-700',
    };
  }
  return null;
}

function getPerformanceBadge(taxaConversao: number) {
  if (taxaConversao >= 30) {
    return { 
      label: 'Top Performer', 
      icon: Star,
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' 
    };
  }
  if (taxaConversao >= 10) {
    return { 
      label: 'Regular', 
      icon: Award,
      className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
    };
  }
  return { 
    label: 'Atenção', 
    icon: AlertTriangle,
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' 
  };
}

export function ConsultorCardNew({ consultor, ranking, onClick }: ConsultorCardNewProps) {
  const rankingBadge = getRankingBadge(ranking);
  const performanceBadge = getPerformanceBadge(consultor.taxaConversao);
  const Icon = performanceBadge.icon;

  return (
    <Card 
      className={cn(
        "cursor-pointer hover:shadow-lg transition-all duration-200 group",
        "border hover:border-primary/50",
        rankingBadge && "ring-1 ring-opacity-50",
        ranking === 1 && "ring-yellow-500",
        ranking === 2 && "ring-gray-400",
        ranking === 3 && "ring-orange-500"
      )}
      onClick={onClick}
    >
      {/* Header com Ranking */}
      {rankingBadge && (
        <div className={cn(
          "px-4 py-2 border-b text-sm font-semibold flex items-center gap-2",
          rankingBadge.className
        )}>
          <span className="text-lg">{rankingBadge.emoji}</span>
          #{ranking}
        </div>
      )}
      
      <CardContent className={cn("p-5", !rankingBadge && "pt-6")}>
        {/* Avatar e Nome */}
        <div className="flex flex-col items-center text-center mb-4">
          <UserAvatar 
            src={consultor.avatar_url} 
            name={consultor.nome} 
            size="lg"
            className="mb-3"
          />
          <h3 className="font-semibold text-foreground text-sm leading-tight min-h-[2.5rem] flex items-center">
            {consultor.nome}
          </h3>
          <Badge className={cn("mt-2 gap-1", performanceBadge.className)}>
            <Icon className="h-3 w-3" />
            {performanceBadge.label}
          </Badge>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className={cn(
              "text-lg font-bold",
              consultor.emCotacao > 0 ? "text-yellow-600" : "text-muted-foreground"
            )}>
              {consultor.emCotacao}
            </p>
            <p className="text-[10px] text-muted-foreground">Cotação</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className={cn(
              "text-lg font-bold",
              consultor.contratoEnviado > 0 ? "text-blue-600" : "text-muted-foreground"
            )}>
              {consultor.contratoEnviado}
            </p>
            <p className="text-[10px] text-muted-foreground">Enviadas</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className={cn(
              "text-lg font-bold",
              consultor.propostasFechadas > 0 ? "text-green-600" : "text-muted-foreground"
            )}>
              {consultor.propostasFechadas}
            </p>
            <p className="text-[10px] text-muted-foreground">Fechadas</p>
          </div>
        </div>

        {/* Valor e Taxa */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">💰 Valor fechado</span>
            <span className={cn(
              "font-semibold",
              consultor.valorFechado > 0 ? "text-green-600" : "text-muted-foreground"
            )}>
              {formatCurrency(consultor.valorFechado)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">📈 Conversão</span>
            <span className={cn(
              "font-semibold",
              consultor.taxaConversao >= 30 ? "text-green-600" :
              consultor.taxaConversao >= 10 ? "text-yellow-600" : "text-red-500"
            )}>
              {consultor.taxaConversao.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Botão Ver Detalhes */}
        <div className="mt-4 pt-3 border-t">
          <Button 
            variant="ghost" 
            className="w-full justify-between text-sm text-muted-foreground hover:text-foreground"
          >
            Ver Detalhes
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

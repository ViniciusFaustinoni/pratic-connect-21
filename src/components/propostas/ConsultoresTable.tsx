import { Star, Award, AlertTriangle, ArrowUpDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { UserAvatar } from '@/components/UserAvatar';
import { cn } from '@/lib/utils';
import type { ConsultorMetricas } from '@/hooks/usePropostasMetricas';

interface ConsultoresTableProps {
  consultores: ConsultorMetricas[];
  onSelect: (id: string) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
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
      label: 'Reg', 
      icon: Award,
      className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      progressColor: 'bg-green-500',
    };
  }
  return { 
    label: 'Aten', 
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

function getRankingEmoji(ranking: number) {
  if (ranking === 1) return '🥇';
  if (ranking === 2) return '🥈';
  if (ranking === 3) return '🥉';
  return String(ranking);
}

function getTopBorderColor(ranking: number) {
  if (ranking === 1) return 'border-l-4 border-l-yellow-500';
  if (ranking === 2) return 'border-l-4 border-l-gray-400';
  if (ranking === 3) return 'border-l-4 border-l-orange-500';
  return '';
}

export function ConsultoresTable({ consultores, onSelect }: ConsultoresTableProps) {
  if (consultores.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhum consultor encontrado
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-12 text-center">#</TableHead>
            <TableHead>Consultor</TableHead>
            <TableHead className="text-center w-20">Cotações</TableHead>
            <TableHead className="text-center w-20">Abertas</TableHead>
            <TableHead className="text-center w-20">Enviadas</TableHead>
            <TableHead className="text-center w-20">Fechadas</TableHead>
            <TableHead className="text-right w-28">Valor</TableHead>
            <TableHead className="text-center w-32">Conversão</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {consultores.map((consultor, index) => {
            const ranking = consultor.ranking;
            const performanceBadge = getPerformanceBadge(consultor.taxaConversao);
            
            return (
              <TableRow 
                key={consultor.id}
                className={cn(
                  "cursor-pointer hover:bg-muted/50 transition-colors",
                  getTopBorderColor(ranking)
                )}
                onClick={() => onSelect(consultor.id)}
              >
                <TableCell className={cn(
                  "text-center text-sm font-bold",
                  ranking <= 3 ? "text-foreground" : "text-muted-foreground"
                )}>
                  {getRankingEmoji(ranking)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <UserAvatar 
                      src={consultor.avatar_url} 
                      name={consultor.nome} 
                      size="sm"
                    />
                    <div>
                      <p className="font-medium text-sm leading-tight">{abbreviateName(consultor.nome)}</p>
                      <Badge className={cn("text-[10px] px-1.5 py-0 mt-0.5", performanceBadge.className)}>
                        {performanceBadge.label}
                      </Badge>
                    </div>
                  </div>
                </TableCell>
                <TableCell className={cn(
                  "text-center font-semibold text-sm",
                  consultor.cotacoesRealizadas > 0 ? "text-purple-600" : "text-muted-foreground"
                )}>
                  {consultor.cotacoesRealizadas}
                </TableCell>
                <TableCell className={cn(
                  "text-center font-semibold text-sm",
                  consultor.emCotacao > 0 ? "text-yellow-600" : "text-muted-foreground"
                )}>
                  {consultor.emCotacao}
                </TableCell>
                <TableCell className={cn(
                  "text-center font-semibold text-sm",
                  consultor.contratoEnviado > 0 ? "text-blue-600" : "text-muted-foreground"
                )}>
                  {consultor.contratoEnviado}
                </TableCell>
                <TableCell className={cn(
                  "text-center font-semibold text-sm",
                  consultor.propostasFechadas > 0 ? "text-green-600" : "text-muted-foreground"
                )}>
                  {consultor.propostasFechadas}
                </TableCell>
                <TableCell className={cn(
                  "text-right font-semibold text-sm",
                  consultor.valorFechado > 0 ? "text-green-600" : "text-muted-foreground"
                )}>
                  {formatCurrency(consultor.valorFechado)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress 
                      value={Math.min(consultor.taxaConversao, 100)} 
                      className="h-1.5 flex-1"
                      indicatorClassName={performanceBadge.progressColor}
                    />
                    <span className={cn(
                      "text-xs font-semibold w-8 text-right",
                      consultor.taxaConversao >= 30 ? "text-green-600" :
                      consultor.taxaConversao >= 10 ? "text-yellow-600" : "text-red-500"
                    )}>
                      {consultor.taxaConversao.toFixed(0)}%
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

import { Star, Award, AlertTriangle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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

function getRankingDisplay(ranking: number) {
  if (ranking === 1) return { emoji: '🥇', className: 'text-yellow-600 font-bold' };
  if (ranking === 2) return { emoji: '🥈', className: 'text-gray-500 font-bold' };
  if (ranking === 3) return { emoji: '🥉', className: 'text-orange-600 font-bold' };
  return { emoji: String(ranking), className: 'text-muted-foreground' };
}

function getPerformanceBadge(taxaConversao: number) {
  if (taxaConversao >= 30) {
    return { 
      label: 'Top', 
      icon: Star,
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' 
    };
  }
  if (taxaConversao >= 10) {
    return { 
      label: 'Reg', 
      icon: Award,
      className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
    };
  }
  return { 
    label: 'Aten', 
    icon: AlertTriangle,
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' 
  };
}

function abbreviateName(fullName: string): string {
  const parts = fullName.split(' ');
  if (parts.length <= 2) return fullName;
  
  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  
  return `${firstName} ${lastName}`;
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
            <TableHead className="text-center w-24">Cotação</TableHead>
            <TableHead className="text-center w-24">Enviadas</TableHead>
            <TableHead className="text-center w-24">Fechadas</TableHead>
            <TableHead className="text-right w-32">Valor Mês</TableHead>
            <TableHead className="text-center w-28">Conversão</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {consultores.map((consultor, index) => {
            const ranking = index + 1;
            const rankingDisplay = getRankingDisplay(ranking);
            const performanceBadge = getPerformanceBadge(consultor.taxaConversao);
            
            return (
              <TableRow 
                key={consultor.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onSelect(consultor.id)}
              >
                <TableCell className={cn("text-center text-lg", rankingDisplay.className)}>
                  {rankingDisplay.emoji}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <UserAvatar 
                      src={consultor.avatar_url} 
                      name={consultor.nome} 
                      size="sm"
                    />
                    <div>
                      <p className="font-medium text-sm">{abbreviateName(consultor.nome)}</p>
                      <Badge className={cn("text-[10px] px-1.5 py-0", performanceBadge.className)}>
                        {performanceBadge.label}
                      </Badge>
                    </div>
                  </div>
                </TableCell>
                <TableCell className={cn(
                  "text-center font-semibold",
                  consultor.emCotacao > 0 ? "text-yellow-600" : "text-muted-foreground"
                )}>
                  {consultor.emCotacao}
                </TableCell>
                <TableCell className={cn(
                  "text-center font-semibold",
                  consultor.contratoEnviado > 0 ? "text-blue-600" : "text-muted-foreground"
                )}>
                  {consultor.contratoEnviado}
                </TableCell>
                <TableCell className={cn(
                  "text-center font-semibold",
                  consultor.propostasFechadas > 0 ? "text-green-600" : "text-muted-foreground"
                )}>
                  {consultor.propostasFechadas}
                </TableCell>
                <TableCell className={cn(
                  "text-right font-semibold",
                  consultor.valorFechado > 0 ? "text-green-600" : "text-muted-foreground"
                )}>
                  {formatCurrency(consultor.valorFechado)}
                </TableCell>
                <TableCell className="text-center">
                  <span className={cn(
                    "font-semibold",
                    consultor.taxaConversao >= 30 ? "text-green-600" :
                    consultor.taxaConversao >= 10 ? "text-yellow-600" : "text-red-500"
                  )}>
                    {consultor.taxaConversao.toFixed(0)}%
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

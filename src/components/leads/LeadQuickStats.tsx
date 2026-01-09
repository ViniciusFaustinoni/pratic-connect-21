import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, FileText, Clock, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LeadQuickStatsProps {
  totalCotacoes: number;
  diasNoFunil: number;
  ultimaAtividade: string;
}

export function LeadQuickStats({ totalCotacoes, diasNoFunil, ultimaAtividade }: LeadQuickStatsProps) {
  const ultimaAtividadeFormatada = formatDistanceToNow(new Date(ultimaAtividade), {
    addSuffix: true,
    locale: ptBR,
  });

  const stats = [
    {
      icon: FileText,
      label: "Cotações",
      value: totalCotacoes.toString(),
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/40",
    },
    {
      icon: Clock,
      label: "Dias no funil",
      value: diasNoFunil.toString(),
      color: "text-amber-600",
      bgColor: "bg-amber-100 dark:bg-amber-900/40",
    },
    {
      icon: Activity,
      label: "Última atividade",
      value: ultimaAtividadeFormatada,
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-900/40",
    },
  ];

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3 bg-muted/50 rounded-t-lg border-b">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Estatísticas
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 divide-y divide-border">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <div className={`p-2.5 rounded-lg ${stat.bgColor} shadow-sm`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{stat.label}</p>
              <p className="font-semibold text-sm truncate">{stat.value}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

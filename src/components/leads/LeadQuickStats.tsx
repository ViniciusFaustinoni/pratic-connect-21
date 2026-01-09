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
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      icon: Clock,
      label: "Dias no funil",
      value: diasNoFunil.toString(),
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    {
      icon: Activity,
      label: "Última atividade",
      value: ultimaAtividadeFormatada,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Estatísticas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${stat.bgColor}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="font-medium text-sm truncate">{stat.value}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

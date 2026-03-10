import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Phone, Car, Calendar, User, Clock, MessageCircle, 
  AlertTriangle, ArrowRight, CheckCircle
} from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export interface AtivacaoItem {
  id: string;
  codigo: string;
  nome: string;
  telefone: string;
  email?: string;
  veiculo?: string;
  placa?: string;
  etapa: string;
  entrou_etapa_em: string;
  valor?: number;
  agendamento?: string;
  progresso?: number;
  pendencia?: string;
  consultor: string;
  docsAprovados?: number;
  docsTotal?: number;
  created_at: string;
  detalheFase?: string | null;
  faseOriginal?: string;
}

export interface Etapa {
  id: string;
  nome: string;
  icone: React.ElementType;
  cor: string;
  descricao: string;
  sla: number | null;
}

interface AtivacaoCardProps {
  item: AtivacaoItem;
  etapa: Etapa;
  onClick?: () => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function AtivacaoCard({ item, etapa, onClick }: AtivacaoCardProps) {
  const diasNaEtapa = differenceInDays(new Date(), new Date(item.entrou_etapa_em));
  
  const slaStatus = !etapa.sla 
    ? 'ok' 
    : diasNaEtapa > etapa.sla 
      ? 'atrasado' 
      : diasNaEtapa >= etapa.sla - 1 
        ? 'atencao' 
        : 'ok';

  const whatsappNumber = item.telefone?.replace(/\D/g, "") || "";

  const getSlaLabel = () => {
    if (!etapa.sla) return null;
    const diff = etapa.sla - diasNaEtapa;
    if (diff < 0) {
      return `${Math.abs(diff)}d atrasado`;
    }
    return `${diff}d restante`;
  };

  return (
    <Card 
      className={cn(
        "group cursor-pointer transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-lg",
        "bg-card/80 backdrop-blur-sm",
        slaStatus === 'atrasado' && "border-l-[3px] border-l-red-500",
        slaStatus === 'atencao' && "border-l-[3px] border-l-amber-500",
        slaStatus === 'ok' && etapa.sla && "border-l-[3px] border-l-emerald-500"
      )}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2.5">
        {/* Header - Avatar, Nome, Código, SLA */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Avatar */}
            <div 
              className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0"
              style={{ backgroundColor: etapa.cor }}
            >
              {item.nome.charAt(0).toUpperCase()}
            </div>
            
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate">{item.nome}</p>
              <p className="text-xs text-muted-foreground">{item.codigo}</p>
            </div>
          </div>
          
          {/* SLA Indicator */}
          {etapa.sla && (
            <Badge 
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0.5 font-medium",
                slaStatus === 'atrasado' && "bg-red-500/10 text-red-500 border-red-500/20",
                slaStatus === 'atencao' && "bg-amber-500/10 text-amber-500 border-amber-500/20",
                slaStatus === 'ok' && "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
              )}
            >
              {slaStatus === 'atrasado' ? (
                <AlertTriangle className="h-2.5 w-2.5 mr-1" />
              ) : (
                <Clock className="h-2.5 w-2.5 mr-1" />
              )}
              {getSlaLabel()}
            </Badge>
          )}
        </div>

        {/* Veículo */}
        {item.veiculo && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Car className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{item.veiculo}</span>
            {item.placa && item.placa !== '-' && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 ml-auto font-mono">
                {item.placa}
              </Badge>
            )}
          </div>
        )}

        {/* Detalhe da fase - sub-status preciso */}
        {item.detalheFase && (
          <div className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-md bg-muted/60">
            <span className="text-muted-foreground truncate">{item.detalheFase}</span>
          </div>
        )}

        {/* Info adicional por etapa */}
        {item.etapa === 'pagamento' && item.valor && (
          <div className="flex items-center justify-between text-xs px-2 py-1.5 rounded-md bg-amber-500/10">
            <span className="text-muted-foreground">Valor:</span>
            <span className="font-semibold text-amber-600">
              {formatCurrency(item.valor)}
            </span>
          </div>
        )}

        {item.etapa === 'vistoria' && item.agendamento && (
          <div className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-md bg-blue-500/10">
            <Calendar className="h-3 w-3 text-blue-500" />
            <span className="text-blue-600">
              Agendada: {format(new Date(item.agendamento), "dd/MM 'às' HH:mm", { locale: ptBR })}
            </span>
          </div>
        )}

        {/* Documentos Progress */}
        {item.docsAprovados !== undefined && item.docsTotal !== undefined && item.docsTotal > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Documentos</span>
              <span className={cn(
                "font-medium",
                item.docsAprovados === item.docsTotal ? "text-emerald-500" : "text-amber-500"
              )}>
                {item.docsAprovados}/{item.docsTotal}
              </span>
            </div>
            <Progress 
              value={(item.docsAprovados / item.docsTotal) * 100} 
              className="h-1.5"
            />
          </div>
        )}

        {/* Progresso geral */}
        {item.progresso && !item.docsTotal && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium">{item.progresso}%</span>
            </div>
            <Progress value={item.progresso} className="h-1.5" />
          </div>
        )}

        {/* Pendência */}
        {item.pendencia && (
          <div className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-md bg-amber-500/10 text-amber-600">
            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{item.pendencia}</span>
          </div>
        )}

        {/* Footer - Consultor e Ações */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          {/* Consultor */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
              <User className="h-3 w-3" />
            </div>
            <span className="truncate max-w-[80px]">{item.consultor}</span>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full hover:bg-emerald-500/20 hover:text-emerald-500"
              onClick={(e) => {
                e.stopPropagation();
                window.open(`https://wa.me/55${whatsappNumber}`, '_blank');
              }}
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </Button>
            {etapa.id !== 'ativo' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full hover:bg-primary/20 hover:text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  // TODO: Implementar ação de avançar etapa
                }}
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
            {etapa.id === 'ativo' && (
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

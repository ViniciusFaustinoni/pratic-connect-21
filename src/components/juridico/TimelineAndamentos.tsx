import { 
  FileText, 
  Scale, 
  Users, 
  Mail, 
  Bell, 
  Clock,
  Loader2,
  BookOpen,
  Search,
  Newspaper,
  LucideIcon
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Andamento {
  id: string;
  data: string;
  tipo: string;
  descricao: string;
  gera_prazo: boolean;
  prazo_data?: string;
  prazo_cumprido?: boolean;
}

interface TimelineAndamentosProps {
  andamentos: Andamento[];
  isLoading?: boolean;
}

const tipoConfig: Record<string, { icon: LucideIcon; cor: string; label: string }> = {
  despacho: { icon: FileText, cor: 'bg-gray-500', label: 'Despacho' },
  decisao: { icon: Scale, cor: 'bg-blue-500', label: 'Decisão' },
  sentenca: { icon: Scale, cor: 'bg-purple-500', label: 'Sentença' },
  acordao: { icon: BookOpen, cor: 'bg-indigo-500', label: 'Acórdão' },
  peticao: { icon: FileText, cor: 'bg-green-500', label: 'Petição' },
  audiencia: { icon: Users, cor: 'bg-yellow-500', label: 'Audiência' },
  pericia: { icon: Search, cor: 'bg-cyan-500', label: 'Perícia' },
  citacao: { icon: Mail, cor: 'bg-orange-500', label: 'Citação' },
  intimacao: { icon: Bell, cor: 'bg-red-500', label: 'Intimação' },
  publicacao: { icon: Newspaper, cor: 'bg-teal-500', label: 'Publicação' },
  outros: { icon: FileText, cor: 'bg-slate-500', label: 'Outros' },
};

const formatDate = (dateStr: string) => {
  try {
    const date = new Date(dateStr);
    return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    return dateStr;
  }
};

const formatPrazoDate = (dateStr: string) => {
  try {
    const date = new Date(dateStr);
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return dateStr;
  }
};

const getPrazoStatus = (prazoData?: string, cumprido?: boolean) => {
  if (cumprido) {
    return { label: 'Cumprido', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' };
  }
  if (prazoData) {
    const prazo = new Date(prazoData);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (prazo < hoje) {
      return { label: 'Vencido', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' };
    }
    return { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' };
  }
  return null;
};

export function TimelineAndamentos({ andamentos, isLoading }: TimelineAndamentosProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!andamentos || andamentos.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
        <p>Nenhum andamento registrado</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      {/* Linha vertical conectando os itens */}
      <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-border" />

      {andamentos.map((andamento, index) => {
        const config = tipoConfig[andamento.tipo] || tipoConfig.outros;
        const Icon = config.icon;
        const prazoStatus = andamento.gera_prazo ? getPrazoStatus(andamento.prazo_data, andamento.prazo_cumprido) : null;

        return (
          <div
            key={andamento.id}
            className={cn(
              "relative flex gap-4 pb-6",
              index === andamentos.length - 1 && "pb-0"
            )}
          >
            {/* Círculo com ícone */}
            <div
              className={cn(
                "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white",
                config.cor
              )}
            >
              <Icon className="h-5 w-5" />
            </div>

            {/* Conteúdo */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="secondary" className="font-medium">
                  {config.label}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {formatDate(andamento.data)}
                </span>
              </div>

              <p className="text-sm mt-2 text-foreground">
                {andamento.descricao}
              </p>

              {/* Indicador de prazo */}
              {andamento.gera_prazo && andamento.prazo_data && (
                <div className="flex items-center gap-2 mt-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Prazo: {formatPrazoDate(andamento.prazo_data)}
                  </span>
                  {prazoStatus && (
                    <Badge className={cn("text-xs", prazoStatus.className)}>
                      {prazoStatus.label}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

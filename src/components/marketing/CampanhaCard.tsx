import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calendar, Users, TrendingUp, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CampanhaCardProps {
  campanha: {
    id: string;
    codigo?: string;
    nome: string;
    tipo: string;
    status: string;
    data_inicio: string;
    data_fim?: string;
    orcamento_total?: number;
    valor_gasto?: number;
    totalLeads?: number;
    totalConversoes?: number;
  };
  onClick?: () => void;
}

const tipoConfig: Record<string, { label: string; className: string }> = {
  trafego_pago: { label: 'Tráfego Pago', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  organico: { label: 'Orgânico', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  indicacao: { label: 'Indicação', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' },
  evento: { label: 'Evento', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' },
  parceria: { label: 'Parceria', className: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300' },
  email: { label: 'E-mail', className: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300' },
};

const statusConfig: Record<string, { label: string; className: string }> = {
  rascunho: { label: 'Rascunho', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
  ativa: { label: 'Ativa', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  pausada: { label: 'Pausada', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
  finalizada: { label: 'Finalizada', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  cancelada: { label: 'Cancelada', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
};

export function CampanhaCard({ campanha, onClick }: CampanhaCardProps) {
  const {
    codigo,
    nome,
    tipo,
    status,
    data_inicio,
    data_fim,
    orcamento_total,
    valor_gasto,
    totalLeads = 0,
    totalConversoes = 0,
  } = campanha;

  const cpl = totalLeads > 0 && valor_gasto ? valor_gasto / totalLeads : 0;
  const progressoOrcamento = orcamento_total && orcamento_total > 0 
    ? ((valor_gasto || 0) / orcamento_total) * 100 
    : 0;

  const tipoInfo = tipoConfig[tipo] || { label: tipo, className: 'bg-gray-100 text-gray-800' };
  const statusInfo = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800' };

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Código */}
        {codigo && (
          <p className="text-xs text-muted-foreground font-mono">{codigo}</p>
        )}

        {/* Nome */}
        <h3 className="font-semibold mt-1 line-clamp-1">{nome}</h3>

        {/* Badges */}
        <div className="flex gap-2 mt-2 flex-wrap">
          <Badge className={tipoInfo.className} variant="secondary">
            {tipoInfo.label}
          </Badge>
          <Badge className={statusInfo.className} variant="secondary">
            {statusInfo.label}
          </Badge>
        </div>

        {/* Período */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-3">
          <Calendar className="h-3 w-3" />
          <span>
            {format(new Date(data_inicio), 'dd/MM/yy', { locale: ptBR })}
            {' - '}
            {data_fim 
              ? format(new Date(data_fim), 'dd/MM/yy', { locale: ptBR }) 
              : 'Sem fim'
            }
          </span>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t text-center">
          <div>
            <div className="flex items-center justify-center gap-1">
              <Users className="h-3 w-3 text-muted-foreground" />
              <p className="text-lg font-bold">{totalLeads}</p>
            </div>
            <p className="text-xs text-muted-foreground">Leads</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-600" />
              <p className="text-lg font-bold text-green-600">{totalConversoes}</p>
            </div>
            <p className="text-xs text-muted-foreground">Conv.</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1">
              <DollarSign className="h-3 w-3 text-muted-foreground" />
              <p className="text-lg font-bold">R$ {cpl.toFixed(0)}</p>
            </div>
            <p className="text-xs text-muted-foreground">CPL</p>
          </div>
        </div>

        {/* Progresso Orçamento */}
        {orcamento_total && orcamento_total > 0 && (
          <div className="mt-3">
            <Progress value={Math.min(progressoOrcamento, 100)} className="h-2" />
            <p className="text-xs text-muted-foreground text-center mt-1">
              {progressoOrcamento.toFixed(0)}% do orçamento
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

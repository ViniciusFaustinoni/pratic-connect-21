import { useNavigate } from 'react-router-dom';
import { AlertTriangle, AlertCircle, Info, CheckCircle, ShieldAlert } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAlertasUrgentes } from '@/hooks/useEventosDashboard';

interface AlertaItemProps {
  tipo: 'vermelho' | 'amarelo' | 'azul';
  count: number;
  msg: string;
  acao?: string;
}

function AlertaItem({ tipo, count, msg, acao }: AlertaItemProps) {
  const navigate = useNavigate();
  const config = {
    vermelho: { 
      icon: AlertTriangle, 
      dot: 'bg-red-500', 
      text: 'text-red-700', 
      countBg: 'bg-red-100 text-red-700',
    },
    amarelo: { 
      icon: AlertCircle, 
      dot: 'bg-amber-500', 
      text: 'text-amber-700', 
      countBg: 'bg-amber-100 text-amber-700',
    },
    azul: { 
      icon: Info, 
      dot: 'bg-blue-500', 
      text: 'text-blue-700', 
      countBg: 'bg-blue-100 text-blue-700',
    },
  };
  const c = config[tipo];
  const Icon = c.icon;

  return (
    <div className="flex items-center justify-between py-2.5 group">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${c.dot} shrink-0`} />
        <span className={`inline-flex items-center justify-center min-w-[26px] h-[22px] rounded-md text-xs font-bold ${c.countBg}`}>
          {count}
        </span>
        <span className="text-sm text-foreground/80">{msg}</span>
      </div>
      {acao && (
        <Button 
          size="sm" 
          variant="ghost" 
          className="text-xs text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => navigate(acao)}
        >
          Ver →
        </Button>
      )}
    </div>
  );
}

export default function EventosAlertasUrgentes() {
  const { data, isLoading } = useAlertasUrgentes();

  if (isLoading) {
    return (
      <Card className="border-border/60">
        <CardContent className="p-5 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const temAlertas = (data?.vermelhos?.length || 0) + (data?.amarelos?.length || 0) > 0;

  if (!temAlertas) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200/60">
        <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
        <span className="text-sm font-medium text-emerald-700">
          Nenhum alerta crítico no momento — tudo sob controle.
        </span>
      </div>
    );
  }

  const allAlertas = [
    ...(data?.vermelhos || []).map(a => ({ ...a, tipo: 'vermelho' as const })),
    ...(data?.amarelos || []).map(a => ({ ...a, tipo: 'amarelo' as const })),
    ...(data?.azuis || []).filter(a => a.count > 0).map(a => ({ ...a, tipo: 'azul' as const })),
  ];

  return (
    <Card className="border-red-200/60 bg-gradient-to-r from-red-50/40 via-card to-card border-border/60">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className="h-4 w-4 text-red-500" />
          <h3 className="text-sm font-semibold text-foreground">Ações Urgentes</h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">
            {(data?.vermelhos?.length || 0) + (data?.amarelos?.length || 0)} alertas
          </span>
        </div>
        <div className="divide-y divide-border/50">
          {allAlertas.map(a => (
            <AlertaItem key={a.key} tipo={a.tipo} count={a.count} msg={a.msg} acao={a.acao} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

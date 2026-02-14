import { useNavigate } from 'react-router-dom';
import { AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAlertasUrgentes } from '@/hooks/useEventosDashboard';

interface AlertaCardProps {
  tipo: 'vermelho' | 'amarelo' | 'azul';
  count: number;
  msg: string;
  acao?: string;
}

function AlertaCard({ tipo, count, msg, acao }: AlertaCardProps) {
  const navigate = useNavigate();
  const config = {
    vermelho: { icon: AlertTriangle, bg: 'bg-red-50 border-red-200', text: 'text-red-800', iconColor: 'text-red-600' },
    amarelo: { icon: AlertCircle, bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-800', iconColor: 'text-yellow-600' },
    azul: { icon: Info, bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800', iconColor: 'text-blue-600' },
  };
  const c = config[tipo];
  const Icon = c.icon;

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${c.bg}`}>
      <div className="flex items-center gap-3">
        <Icon className={`h-5 w-5 ${c.iconColor} shrink-0`} />
        <span className={`text-sm font-medium ${c.text}`}>
          <strong>{count}</strong> {msg}
        </span>
      </div>
      {acao && (
        <Button size="sm" variant="ghost" className={c.text} onClick={() => navigate(acao)}>
          Ver
        </Button>
      )}
    </div>
  );
}

export default function EventosAlertasUrgentes() {
  const { data, isLoading } = useAlertasUrgentes();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Alertas e Ações Urgentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const temAlertas = (data?.vermelhos?.length || 0) + (data?.amarelos?.length || 0) > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Alertas e Ações Urgentes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {!temAlertas && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium text-green-800">
              Tudo sob controle! Nenhum alerta crítico no momento.
            </span>
          </div>
        )}
        {data?.vermelhos?.map(a => (
          <AlertaCard key={a.key} tipo="vermelho" count={a.count} msg={a.msg} acao={a.acao} />
        ))}
        {data?.amarelos?.map(a => (
          <AlertaCard key={a.key} tipo="amarelo" count={a.count} msg={a.msg} acao={a.acao} />
        ))}
        {data?.azuis?.map(a => (
          <AlertaCard key={a.key} tipo="azul" count={a.count} msg={a.msg} acao={a.acao} />
        ))}
      </CardContent>
    </Card>
  );
}

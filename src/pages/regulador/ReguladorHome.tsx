import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarDays, Clock, ClipboardList } from 'lucide-react';
import { useVistoriasEvento, useVistoriasEventoContadores } from '@/hooks/useVistoriasEvento';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  agendada: 'Agendada',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

const STATUS_COLORS: Record<string, string> = {
  agendada: 'bg-blue-100 text-blue-700',
  em_andamento: 'bg-amber-100 text-amber-700',
  concluida: 'bg-green-100 text-green-700',
  cancelada: 'bg-red-100 text-red-700',
};

export default function ReguladorHome() {
  const { data: contadores, isLoading: loadingContadores } = useVistoriasEventoContadores();
  const { data: vistoriasHoje, isLoading: loadingVistorias } = useVistoriasEvento({ periodo: 'hoje' });

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-bold">Dashboard</h1>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <CalendarDays className="h-6 w-6 mx-auto text-blue-500 mb-1" />
            <p className="text-2xl font-bold">{loadingContadores ? '-' : contadores?.hoje}</p>
            <p className="text-xs text-muted-foreground">Hoje</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Clock className="h-6 w-6 mx-auto text-amber-500 mb-1" />
            <p className="text-2xl font-bold">{loadingContadores ? '-' : contadores?.semana}</p>
            <p className="text-xs text-muted-foreground">Semana</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <ClipboardList className="h-6 w-6 mx-auto text-emerald-500 mb-1" />
            <p className="text-2xl font-bold">{loadingContadores ? '-' : contadores?.pendentes}</p>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>
      </div>

      {/* Vistorias de hoje */}
      <div>
        <h2 className="text-sm font-semibold mb-2">Vistorias de Hoje</h2>
        {loadingVistorias ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !vistoriasHoje?.length ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma vistoria agendada para hoje.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {vistoriasHoje.map((v: any) => (
              <Card key={v.id}>
                <CardContent className="pt-3 pb-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{v.sinistro?.associado?.nome}</span>
                    <Badge className={STATUS_COLORS[v.status] || ''} variant="secondary">
                      {STATUS_LABELS[v.status] || v.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {v.horario_agendado?.substring(0, 5)} — {v.sinistro?.veiculo?.placa} ({v.sinistro?.veiculo?.marca} {v.sinistro?.veiculo?.modelo})
                  </div>
                  <div className="text-xs text-muted-foreground">
                    📍 {v.endereco_rua}, {v.endereco_numero} — {v.endereco_bairro}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

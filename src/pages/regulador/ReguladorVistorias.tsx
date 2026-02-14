import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Play } from 'lucide-react';
import { useVistoriasEvento } from '@/hooks/useVistoriasEvento';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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

type PeriodoFiltro = 'hoje' | 'amanha' | 'semana' | 'todas';
type StatusFiltro = 'agendada' | 'em_andamento' | 'concluida' | 'todas';

export default function ReguladorVistorias() {
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('todas');
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('todas');

  const { data: vistorias, isLoading } = useVistoriasEvento({ periodo, status: statusFiltro });

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-bold">Vistorias</h1>

      {/* Filtros de período */}
      <div className="flex gap-2 overflow-x-auto">
        {([
          ['hoje', 'Hoje'],
          ['amanha', 'Amanhã'],
          ['semana', 'Semana'],
          ['todas', 'Todas'],
        ] as [PeriodoFiltro, string][]).map(([key, label]) => (
          <Button
            key={key}
            variant={periodo === key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriodo(key)}
            className="text-xs whitespace-nowrap"
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Filtros de status */}
      <div className="flex gap-2 overflow-x-auto">
        {([
          ['todas', 'Todas'],
          ['agendada', 'Agendadas'],
          ['em_andamento', 'Em Andamento'],
          ['concluida', 'Concluídas'],
        ] as [StatusFiltro, string][]).map(([key, label]) => (
          <Button
            key={key}
            variant={statusFiltro === key ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setStatusFiltro(key)}
            className="text-xs whitespace-nowrap"
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !vistorias?.length ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma vistoria encontrada para os filtros selecionados.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {vistorias.map((v: any) => (
            <Card key={v.id}>
              <CardContent className="pt-4 space-y-2">
                {/* Header do card */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm">{v.sinistro?.associado?.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.sinistro?.veiculo?.placa} — {v.sinistro?.veiculo?.marca} {v.sinistro?.veiculo?.modelo} {v.sinistro?.veiculo?.ano_modelo} {v.sinistro?.veiculo?.cor}
                    </p>
                  </div>
                  <Badge className={STATUS_COLORS[v.status] || ''} variant="secondary">
                    {STATUS_LABELS[v.status] || v.status}
                  </Badge>
                </div>

                {/* Tipo evento */}
                <div className="text-xs">
                  <span className="text-muted-foreground">Tipo: </span>
                  <span className="font-medium capitalize">{v.sinistro?.tipo || 'Colisão'}</span>
                </div>

                {/* Data/Hora */}
                <div className="text-xs">
                  <span className="text-muted-foreground">📅 </span>
                  <span>
                    {format(new Date(v.data_agendada + 'T12:00:00'), "dd/MM/yyyy (EEEE)", { locale: ptBR })} às {v.horario_agendado?.substring(0, 5)}
                  </span>
                </div>

                {/* Endereço */}
                <div className="text-xs">
                  <span className="text-muted-foreground">📍 </span>
                  <span>
                    {v.endereco_rua}{v.endereco_numero ? `, ${v.endereco_numero}` : ''} — {v.endereco_bairro}, {v.endereco_cidade}
                  </span>
                </div>

                {/* Ações */}
                {(v.status === 'agendada' || v.status === 'em_andamento') && (
                  <Button
                    size="sm"
                    className="w-full mt-2"
                    variant="default"
                    onClick={() => navigate(`/regulador/vistoria/${v.id}`)}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {v.status === 'em_andamento' ? 'Continuar Vistoria' : 'Iniciar Vistoria'}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

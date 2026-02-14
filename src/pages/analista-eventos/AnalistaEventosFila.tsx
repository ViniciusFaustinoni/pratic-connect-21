import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEventosAguardandoAnalise } from '@/hooks/useEventosAnalise';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AnalistaEventosFila() {
  const navigate = useNavigate();
  const { data: eventos, isLoading } = useEventosAguardandoAnalise();

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Fila de Eventos</h1>
        <Badge variant="secondary">{eventos?.length || 0} pendentes</Badge>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !eventos?.length ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhum evento aguardando análise.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {eventos.map((ev: any) => (
            <Card key={ev.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/analista-eventos/evento/${ev.id}`)}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm">{ev.associado?.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {ev.veiculo?.placa} — {ev.veiculo?.marca} {ev.veiculo?.modelo}
                    </p>
                  </div>
                  <Badge className="bg-amber-100 text-amber-700" variant="secondary">Aguardando</Badge>
                </div>
                <div className="text-xs space-y-1">
                  <p><span className="text-muted-foreground">Tipo: </span><span className="font-medium capitalize">{ev.tipo?.replace(/_/g, ' ') || 'Evento'}</span></p>
                  <p><span className="text-muted-foreground">Data: </span>{ev.data_ocorrencia ? format(new Date(ev.data_ocorrencia), "dd/MM/yyyy HH:mm", { locale: ptBR }) : 'N/A'}</p>
                  <p><span className="text-muted-foreground">Regulador: </span>{ev.regulador_nome}</p>
                </div>
                <Button size="sm" variant="outline" className="w-full mt-2">
                  <Eye className="h-4 w-4 mr-2" /> Analisar Evento
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

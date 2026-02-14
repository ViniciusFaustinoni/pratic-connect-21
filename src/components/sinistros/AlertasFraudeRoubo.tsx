import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ShieldAlert, Radio, MapPin, Activity, Clock } from 'lucide-react';
import { format, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AlertasFraudeRouboProps {
  veiculoId: string;
  dataOcorrencia: string;
}

interface Alerta {
  tipo: 'critico' | 'alto' | 'medio' | 'baixo';
  titulo: string;
  descricao: string;
  icon: React.ElementType;
}

export function AlertasFraudeRoubo({ veiculoId, dataOcorrencia }: AlertasFraudeRouboProps) {
  const { data: rastreador } = useQuery({
    queryKey: ['rastreador-fraude', veiculoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rastreadores')
        .select('id, codigo, status, ultima_posicao_lat, ultima_posicao_lng, ultima_comunicacao, modo_rastreamento')
        .eq('veiculo_id', veiculoId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const alertas: Alerta[] = [];

  if (!rastreador) {
    alertas.push({
      tipo: 'critico',
      titulo: 'Sem rastreador instalado',
      descricao: 'Veículo não possui rastreador ativo. Impossível verificar localização e histórico.',
      icon: Radio,
    });
  } else {
    // Verificar última comunicação
    if (rastreador.ultima_comunicacao) {
      const horasSemComunicacao = differenceInHours(new Date(), new Date(rastreador.ultima_comunicacao));
      
      if (horasSemComunicacao > 48) {
        alertas.push({
          tipo: 'critico',
          titulo: 'Rastreador sem comunicação há mais de 48h',
          descricao: `Última comunicação: ${format(new Date(rastreador.ultima_comunicacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}. Possível desconexão proposital.`,
          icon: Activity,
        });
      } else if (horasSemComunicacao > 12) {
        alertas.push({
          tipo: 'alto',
          titulo: 'Comunicação intermitente',
          descricao: `Última comunicação há ${horasSemComunicacao}h. Verificar se houve desconexão próxima ao horário do evento.`,
          icon: Activity,
        });
      }

      // Verificar se desconexão foi próxima ao evento
      const dataEvento = new Date(dataOcorrencia);
      const ultComm = new Date(rastreador.ultima_comunicacao);
      const diffEventoComm = Math.abs(differenceInHours(dataEvento, ultComm));
      
      if (diffEventoComm <= 2) {
        alertas.push({
          tipo: 'alto',
          titulo: 'Desconexão próxima ao evento',
          descricao: `Rastreador parou de comunicar ${diffEventoComm}h antes/depois do evento reportado. Padrão compatível com fraude.`,
          icon: ShieldAlert,
        });
      }
    } else {
      alertas.push({
        tipo: 'medio',
        titulo: 'Sem dados de comunicação',
        descricao: 'Rastreador não possui registro de última comunicação.',
        icon: Clock,
      });
    }

    // Verificar se rastreador tem posição
    if (!rastreador.ultima_posicao_lat || !rastreador.ultima_posicao_lng) {
      alertas.push({
        tipo: 'medio',
        titulo: 'Sem posição GPS registrada',
        descricao: 'Rastreador não possui coordenadas GPS registradas.',
        icon: MapPin,
      });
    }
  }

  if (alertas.length === 0) {
    alertas.push({
      tipo: 'baixo',
      titulo: 'Nenhuma anomalia detectada',
      descricao: 'Rastreador operando normalmente. Sem indicadores de fraude.',
      icon: Activity,
    });
  }

  const tipoColors: Record<string, string> = {
    critico: 'bg-red-100 text-red-800 border-red-300',
    alto: 'bg-orange-100 text-orange-800 border-orange-300',
    medio: 'bg-amber-100 text-amber-800 border-amber-300',
    baixo: 'bg-green-100 text-green-800 border-green-300',
  };

  const tipoLabels: Record<string, string> = {
    critico: 'Crítico',
    alto: 'Alto',
    medio: 'Médio',
    baixo: 'Normal',
  };

  const hasHighRisk = alertas.some(a => a.tipo === 'critico' || a.tipo === 'alto');

  return (
    <Card className={hasHighRisk ? 'border-red-500/50' : ''}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className={`h-5 w-5 ${hasHighRisk ? 'text-red-500' : 'text-muted-foreground'}`} />
          Verificação de Fraude
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alertas.map((alerta, idx) => {
          const Icon = alerta.icon;
          return (
            <div key={idx} className={`p-3 rounded-lg border ${tipoColors[alerta.tipo]}`}>
              <div className="flex items-start gap-2">
                <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm">{alerta.titulo}</p>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {tipoLabels[alerta.tipo]}
                    </Badge>
                  </div>
                  <p className="text-xs opacity-80">{alerta.descricao}</p>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

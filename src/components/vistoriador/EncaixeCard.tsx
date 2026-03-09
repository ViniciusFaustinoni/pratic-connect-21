import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MapPin, Navigation, Clock, Car, User, Wrench, ClipboardCheck, Loader2, FastForward } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EncaixeDisponivel, usePuxarEncaixe } from '@/hooks/useEncaixesDisponiveis';
import { TIPO_VISTORIA_LABELS } from '@/types/servicos-rota';

interface EncaixeCardProps {
  encaixe: EncaixeDisponivel;
}

const PERIODO_LABELS: Record<string, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
};

export function EncaixeCard({ encaixe }: EncaixeCardProps) {
  const [assumindo, setAssumindo] = useState(false);
  const puxarEncaixe = usePuxarEncaixe();
  
  // Verificar se a tarefa é para hoje
  const hoje = new Date().toISOString().split('T')[0];
  const isHoje = encaixe.data_agendada === hoje;

  const handleAssumir = async () => {
    setAssumindo(true);
    try {
      await puxarEncaixe.mutateAsync({ 
        id: encaixe.id, 
        tipo: encaixe.tipo,
        isAdiantamento: encaixe.isAdiantamento,
      });
    } finally {
      setAssumindo(false);
    }
  };

  const handleNavegar = () => {
    if (encaixe.latitude && encaixe.longitude) {
      window.location.href = `https://www.google.com/maps/dir/?api=1&destination=${encaixe.latitude},${encaixe.longitude}`;
    } else {
      const endereco = [
        encaixe.endereco_logradouro,
        encaixe.endereco_numero,
        encaixe.endereco_bairro,
        encaixe.endereco_cidade,
      ]
        .filter(Boolean)
        .join(', ');
      window.location.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(endereco)}`;
    }
  };

  const formatarEndereco = () => {
    const partes = [
      encaixe.endereco_logradouro,
      encaixe.endereco_numero,
      encaixe.endereco_bairro,
    ].filter(Boolean);
    return partes.join(', ') || 'Endereço não informado';
  };

  const getTipoLabel = () => {
    if (encaixe.tipo === 'instalacao') return 'Instalação';
    if (encaixe.tipo_vistoria && encaixe.tipo_vistoria in TIPO_VISTORIA_LABELS) {
      return `Vistoria ${TIPO_VISTORIA_LABELS[encaixe.tipo_vistoria as keyof typeof TIPO_VISTORIA_LABELS]}`;
    }
    return 'Vistoria';
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-4">
        {/* Header com distância/adiantamento e tipo */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {encaixe.tipo === 'instalacao' ? (
              <Wrench className="h-5 w-5 text-primary" />
            ) : (
              <ClipboardCheck className="h-5 w-5 text-primary" />
            )}
            <div>
              <p className="font-medium text-sm">{getTipoLabel()}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(encaixe.data_agendada), "dd/MM", { locale: ptBR })}
                {encaixe.periodo && ` • ${PERIODO_LABELS[encaixe.periodo] || encaixe.periodo}`}
              </p>
            </div>
          </div>
          
          {/* Badge diferenciado para adiantamento */}
          {encaixe.isAdiantamento ? (
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-semibold">
              <FastForward className="h-3 w-3 mr-1" />
              Adiantamento
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-primary/10 text-primary font-semibold">
              {encaixe.distancia_km} km
            </Badge>
          )}
        </div>

        {/* Cliente */}
        <div className="flex items-start gap-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">{encaixe.cliente_nome}</p>
            {encaixe.cliente_telefone && (
              <p className="text-xs text-muted-foreground">{encaixe.cliente_telefone}</p>
            )}
          </div>
        </div>

        {/* Veículo */}
        {encaixe.placa && (
          <div className="flex items-center gap-2 text-sm">
            <Car className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-mono font-medium">{encaixe.placa}</span>
            {encaixe.marca && encaixe.modelo && (
              <span className="text-muted-foreground">
                {encaixe.marca} {encaixe.modelo}
              </span>
            )}
          </div>
        )}

        {/* Endereço */}
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p>{formatarEndereco()}</p>
            {encaixe.endereco_cidade && (
              <p className="text-xs text-muted-foreground">{encaixe.endereco_cidade}</p>
            )}
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleNavegar}
          >
            <Navigation className="mr-2 h-4 w-4" />
            Ver no Mapa
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={handleAssumir}
            disabled={assumindo}
          >
            {assumindo ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {encaixe.isAdiantamento ? (isHoje ? 'Iniciando...' : 'Adiantando...') : 'Assumindo...'}
              </>
            ) : encaixe.isAdiantamento ? (
              <>
                <FastForward className="mr-2 h-4 w-4" />
                {isHoje ? 'Executar Agora' : 'Adiantar para Hoje'}
              </>
            ) : (
              'Assumir'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMyAssociado, useMyVehicles } from '@/hooks/useMyData';
import { useSolicitarAssistencia } from '@/hooks/useAppAssociado';
import { TipoAssistencia } from '@/types/app-associado';
import {
  ArrowLeft, Truck, Key, Circle, Fuel, Battery,
  HelpCircle, Phone, ChevronRight, AlertCircle, History,
  MapPin, Navigation, Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Fix Leaflet default icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const tiposAssistencia: { id: TipoAssistencia; icon: typeof Truck; label: string }[] = [
  { id: 'guincho', icon: Truck, label: 'Guincho' },
  { id: 'pane_seca', icon: Fuel, label: 'Pane Seca' },
  { id: 'chaveiro', icon: Key, label: 'Chaveiro' },
  { id: 'troca_pneu', icon: Circle, label: 'Troca de Pneu' },
  { id: 'bateria', icon: Battery, label: 'Bateria' },
  { id: 'outros', icon: HelpCircle, label: 'Outros' },
];

const getStatusBadge = (status: string) => {
  const config: Record<string, { label: string; className: string }> = {
    aberto: { label: 'Aberto', className: 'bg-warning/20 text-warning-foreground border-warning/30' },
    aguardando_prestador: { label: 'Aguardando', className: 'bg-accent text-accent-foreground' },
    prestador_despachado: { label: 'Despachado', className: 'bg-primary/20 text-primary' },
    prestador_a_caminho: { label: 'A Caminho', className: 'bg-secondary text-secondary-foreground' },
    em_atendimento: { label: 'Em Atendimento', className: 'bg-primary/30 text-primary' },
  };
  return config[status] || { label: status, className: 'bg-muted text-muted-foreground' };
};

const getTipoLabel = (tipoId: string) => {
  const tipo = tiposAssistencia.find(t => t.id === tipoId);
  return tipo?.label || tipoId;
};

export default function SolicitarAssistencia() {
  const navigate = useNavigate();
  const { data: associado } = useMyAssociado();
  const { data: veiculos } = useMyVehicles();
  const solicitarAssistencia = useSolicitarAssistencia();

  // Form state
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoAssistencia | null>(null);
  const [veiculoSelecionado, setVeiculoSelecionado] = useState<string>('');
  const [descricao, setDescricao] = useState('');
  const [endereco, setEndereco] = useState('');
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number } | null>(null);
  const [isObtendoLocalizacao, setIsObtendoLocalizacao] = useState(false);
  const [isEnviando, setIsEnviando] = useState(false);

  // Auto-select vehicle if only one
  useEffect(() => {
    if (veiculos?.length === 1) {
      setVeiculoSelecionado(veiculos[0].id);
    }
  }, [veiculos]);

  // Check for open assistance request
  const { data: chamadoAberto } = useQuery({
    queryKey: ['meu-chamado-aberto', associado?.id],
    queryFn: async () => {
      if (!associado?.id) return null;
      const { data, error } = await supabase
        .from('chamados_assistencia')
        .select('id, protocolo, status, tipo_servico')
        .eq('associado_id', associado.id)
        .in('status', ['aberto', 'aguardando_prestador', 'prestador_despachado', 'prestador_a_caminho', 'em_atendimento'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!associado?.id,
  });

  const handleObterLocalizacao = async () => {
    setIsObtendoLocalizacao(true);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude } = position.coords;
      setCoordenadas({ lat: latitude, lng: longitude });
      toast.success('Localização obtida com sucesso!');
    } catch (error) {
      toast.error('Não foi possível obter sua localização');
    } finally {
      setIsObtendoLocalizacao(false);
    }
  };

  const handleSolicitar = async () => {
    if (!tipoSelecionado || !veiculoSelecionado) {
      toast.error('Selecione o tipo de serviço e veículo');
      return;
    }

    if (!coordenadas && !endereco) {
      toast.error('Informe sua localização');
      return;
    }

    setIsEnviando(true);

    try {
      await solicitarAssistencia.mutateAsync({
        tipo: tipoSelecionado,
        veiculo_id: veiculoSelecionado,
        endereco: endereco || `Lat: ${coordenadas?.lat}, Lng: ${coordenadas?.lng}`,
        latitude: coordenadas?.lat || 0,
        longitude: coordenadas?.lng || 0,
        descricao: descricao || undefined,
      });

      toast.success('Assistência solicitada com sucesso!');
      navigate('/app/assistencia/historico');
    } catch (error) {
      toast.error('Erro ao solicitar assistência');
    } finally {
      setIsEnviando(false);
    }
  };

  const handleTipoClick = (tipoId: TipoAssistencia) => {
    if (chamadoAberto) return;
    setTipoSelecionado(tipoSelecionado === tipoId ? null : tipoId);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/home')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold">Assistência 24h</h1>
          <p className="text-sm text-muted-foreground">Selecione o tipo de assistência</p>
        </div>
      </div>

      <div className="flex-1 p-4 pb-24 space-y-4">
        {/* Alert for open request */}
        {chamadoAberto && (
          <Card className="bg-warning/10 border-warning/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-warning/20">
                  <AlertCircle className="h-5 w-5 text-warning" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Você já tem um chamado em aberto</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {chamadoAberto.protocolo} - {getTipoLabel(chamadoAberto.tipo_servico)}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={getStatusBadge(chamadoAberto.status).className}>
                      {getStatusBadge(chamadoAberto.status).label}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => navigate(`/app/assistencia/${chamadoAberto.id}`)}
                  >
                    Ver meu chamado
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Grid of assistance types */}
        <div className="grid grid-cols-2 gap-3">
          {tiposAssistencia.map((tipo) => {
            const Icon = tipo.icon;
            const isSelected = tipoSelecionado === tipo.id;

            return (
              <Card
                key={tipo.id}
                onClick={() => handleTipoClick(tipo.id)}
                className={cn(
                  'cursor-pointer transition-all',
                  'hover:border-primary',
                  isSelected && 'border-2 border-primary bg-primary/5',
                  chamadoAberto && 'opacity-50 pointer-events-none'
                )}
              >
                <CardContent className="p-4 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className={cn(
                        'p-4 rounded-full',
                        isSelected ? 'bg-primary/20' : 'bg-muted'
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-6 w-6',
                          isSelected ? 'text-primary' : 'text-muted-foreground'
                        )}
                      />
                    </div>
                    <p className="font-medium text-sm">{tipo.label}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Expandable form */}
        {tipoSelecionado && !chamadoAberto && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
            <Separator />

            {/* Location */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Localização
              </Label>

              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleObterLocalizacao}
                disabled={isObtendoLocalizacao}
              >
                {isObtendoLocalizacao ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Navigation className="h-4 w-4 mr-2" />
                )}
                {coordenadas ? 'Localização obtida ✓' : 'Usar minha localização atual'}
              </Button>

              {/* Mini map */}
              {coordenadas && (
                <div className="h-40 rounded-lg overflow-hidden border">
                  <MapContainer
                    center={[coordenadas.lat, coordenadas.lng]}
                    zoom={16}
                    className="h-full w-full"
                    zoomControl={false}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={[coordenadas.lat, coordenadas.lng]} />
                  </MapContainer>
                </div>
              )}

              <Input
                placeholder="Ou digite o endereço..."
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Descrição do problema</Label>
              <Textarea
                placeholder="Ex: Carro não liga, bateria descarregou..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={3}
              />
            </div>

            {/* Vehicle selector */}
            {veiculos && veiculos.length > 1 && (
              <div className="space-y-2">
                <Label>Veículo</Label>
                <Select value={veiculoSelecionado} onValueChange={setVeiculoSelecionado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o veículo" />
                  </SelectTrigger>
                  <SelectContent>
                    {veiculos.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.placa} - {v.marca} {v.modelo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Submit button */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleSolicitar}
              disabled={isEnviando || !tipoSelecionado || !veiculoSelecionado}
            >
              {isEnviando ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Solicitando...
                </>
              ) : (
                'Solicitar Assistência'
              )}
            </Button>
          </div>
        )}

        {/* Separator */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-sm text-muted-foreground">ou</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Direct call card */}
        <a href="tel:08009800001" className="block">
          <Card className="bg-accent/50 border-accent hover:bg-accent/70 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-accent">
                  <Phone className="h-5 w-5 text-accent-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Prefere ligar?</p>
                  <p className="text-lg font-semibold">0800 980 0001</p>
                  <p className="text-xs text-muted-foreground">Atendimento 24h</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </a>

        {/* History button */}
        <Button
          variant="ghost"
          className="w-full text-muted-foreground"
          onClick={() => navigate('/app/assistencia/historico')}
        >
          <History className="h-4 w-4 mr-2" />
          Ver histórico de chamados
        </Button>

        {/* Notice */}
        <p className="text-xs text-muted-foreground text-center">
          Assistência disponível 24 horas, 7 dias por semana
        </p>
      </div>
    </div>
  );
}

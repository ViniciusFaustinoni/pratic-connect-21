import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, subHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Loader2, MapPin, AlertTriangle, Route, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { MapContainer, TileLayer, Polyline, Marker, Popup, CircleMarker } from 'react-leaflet';
import { PolylineOSRM } from '@/components/mapa/PolylineOSRM';
import L from 'leaflet';
import type { DateRange } from 'react-day-picker';
import 'leaflet/dist/leaflet.css';

interface ConsultaTrajetoAvancadaProps {
  rastreadorId: string;
  dataOcorrencia: string;
  veiculoPlaca?: string;
}

// Ícone customizado
const markerIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="width: 12px; height: 12px; background: #ef4444; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const presets = [
  { label: '6 horas antes', value: '6h', getRange: (d: Date) => ({ from: subHours(d, 6), to: d }) },
  { label: '24 horas antes', value: '24h', getRange: (d: Date) => ({ from: subHours(d, 24), to: d }) },
  { label: '48 horas antes', value: '48h', getRange: (d: Date) => ({ from: subHours(d, 48), to: d }) },
  { label: '7 dias antes', value: '7d', getRange: (d: Date) => ({ from: subDays(d, 7), to: d }) },
  { label: '24h antes e depois', value: 'completo', getRange: (d: Date) => ({ from: subHours(d, 24), to: subHours(d, -24) }) },
];

export function ConsultaTrajetoAvancada({ 
  rastreadorId, 
  dataOcorrencia,
  veiculoPlaca,
}: ConsultaTrajetoAvancadaProps) {
  const dataEvento = new Date(dataOcorrencia);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [preset, setPreset] = useState('24h');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const selectedPreset = presets.find(p => p.value === '24h');
    if (selectedPreset) {
      const range = selectedPreset.getRange(dataEvento);
      return { from: range.from, to: range.to };
    }
    return undefined;
  });
  const [searchEnabled, setSearchEnabled] = useState(false);

  const handlePresetChange = (value: string) => {
    setPreset(value);
    if (value !== 'custom') {
      const selectedPreset = presets.find(p => p.value === value);
      if (selectedPreset) {
        const range = selectedPreset.getRange(dataEvento);
        setDateRange({ from: range.from, to: range.to });
      }
    }
    setSearchEnabled(false);
  };

  const { data: historico, isLoading, error, refetch } = useQuery({
    queryKey: ['trajeto-avancado', rastreadorId, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      if (!dateRange?.from || !dateRange?.to) throw new Error('Período não selecionado');
      
      const { data, error } = await supabase.functions.invoke('rastreador-historico', {
        body: {
          rastreador_id: rastreadorId,
          data_inicio: dateRange.from.toISOString(),
          data_fim: dateRange.to.toISOString(),
        },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    enabled: searchEnabled && !!dateRange?.from && !!dateRange?.to,
  });

  const trajeto = historico?.trajeto || [];
  const paradas = historico?.paradas || [];
  const polylinePositions = trajeto.map((p: any) => [p.latitude, p.longitude] as [number, number]);
  const ultimaPosicao = trajeto.length > 0 ? trajeto[trajeto.length - 1] : null;

  const handleSearch = () => {
    setSearchEnabled(true);
    refetch();
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Search className="h-4 w-4" />
          Consulta Avançada
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" />
            Consulta Avançada de Trajeto
            {veiculoPlaca && <Badge variant="outline">{veiculoPlaca}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Período do sinistro */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Data do sinistro: {format(dataEvento, "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </div>

          {/* Controles de período */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Período de Consulta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Select value={preset} onValueChange={handlePresetChange}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Selecione período" />
                  </SelectTrigger>
                  <SelectContent>
                    {presets.map(p => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Período personalizado</SelectItem>
                  </SelectContent>
                </Select>

                {preset === 'custom' && (
                  <DatePickerWithRange
                    date={dateRange}
                    onDateChange={(range) => {
                      setDateRange(range);
                      setSearchEnabled(false);
                    }}
                    className="w-auto"
                  />
                )}

                <Button 
                  onClick={handleSearch}
                  disabled={!dateRange?.from || !dateRange?.to || isLoading}
                  className="gap-2"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Buscar
                </Button>
              </div>

              {dateRange?.from && dateRange?.to && (
                <div className="text-xs text-muted-foreground">
                  Período: {format(dateRange.from, "dd/MM/yyyy HH:mm", { locale: ptBR })} 
                  {' → '}
                  {format(dateRange.to, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resultado */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>Erro ao buscar trajeto: {error.message}</AlertDescription>
            </Alert>
          )}

          {searchEnabled && !isLoading && !error && trajeto.length === 0 && (
            <Alert>
              <MapPin className="h-4 w-4" />
              <AlertDescription>
                Nenhum trajeto encontrado no período selecionado
              </AlertDescription>
            </Alert>
          )}

          {trajeto.length > 0 && (
            <>
              {/* Estatísticas */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{trajeto.length} pontos</Badge>
                <Badge variant="secondary">{paradas.length} paradas</Badge>
                {historico?.fonte && (
                  <Badge variant={historico.fonte === 'api' ? 'default' : 'outline'}>
                    {historico.fonte === 'api' ? '🟢 API' : '🟡 Local'}
                  </Badge>
                )}
              </div>

              {/* Mapa */}
              <div className="h-80 rounded-lg overflow-hidden border">
                <MapContainer
                  center={ultimaPosicao ? [ultimaPosicao.latitude, ultimaPosicao.longitude] : [-15.7801, -47.9292]}
                  zoom={12}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; OpenStreetMap'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {polylinePositions.length > 0 && (
                    <>
                      <PolylineOSRM
                        positions={polylinePositions}
                        color="#3b82f6" weight={3} opacity={0.8}
                      />
                      {/* Início */}
                      <CircleMarker
                        center={polylinePositions[0]}
                        radius={8}
                        pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 1 }}
                      >
                        <Popup>
                          <strong className="text-green-600">Início</strong>
                          <p>{format(new Date(trajeto[0].data_posicao), "dd/MM HH:mm", { locale: ptBR })}</p>
                        </Popup>
                      </CircleMarker>
                      {/* Fim */}
                      <Marker position={polylinePositions[polylinePositions.length - 1]} icon={markerIcon}>
                        <Popup>
                          <strong className="text-red-600">Fim</strong>
                          <p>{format(new Date(trajeto[trajeto.length - 1].data_posicao), "dd/MM HH:mm", { locale: ptBR })}</p>
                        </Popup>
                      </Marker>
                    </>
                  )}
                </MapContainer>
              </div>

              {/* Lista de paradas */}
              {paradas.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Paradas Identificadas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {paradas.map((parada: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded-md text-sm">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                              #{idx + 1}
                            </Badge>
                            <div>
                              <span className="font-medium">{parada.duracao_minutos} minutos</span>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(parada.inicio), "dd/MM HH:mm", { locale: ptBR })} - 
                                {format(new Date(parada.fim), "HH:mm", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                          <code className="text-xs">
                            {parada.latitude.toFixed(4)}, {parada.longitude.toFixed(4)}
                          </code>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

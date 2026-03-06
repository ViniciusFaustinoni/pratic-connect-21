import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, CircleMarker } from "react-leaflet";
import { useRotaRealMultiWaypoint } from "@/hooks/useRotaRealMultiWaypoint";
import L from "leaflet";
import { format, formatDistanceToNow, subHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Car,
  Phone,
  Navigation,
  Gauge,
  Power,
  Clock,
  ClipboardCheck,
  RefreshCw,
  Route,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { MapaVistoriasContent } from "@/components/mapa/MapaVistoriasContent";

// Leaflet icon fix
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom icons
const createCustomIcon = (color: string) => {
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
};

const markerIcons = {
  online: createCustomIcon("green"),
  atencao: createCustomIcon("yellow"),
  offline: createCustomIcon("red"),
  sem_dados: createCustomIcon("grey"),
};

interface FlyToProps {
  position: [number, number] | null;
  zoom?: number;
}

function FlyToPosition({ position, zoom = 15 }: FlyToProps) {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.flyTo(position, zoom, { duration: 1 });
    }
  }, [position, zoom, map]);

  return null;
}

interface Veiculo {
  rastreador_id: string;
  codigo: string;
  plataforma: string;
  status: string;
  placa: string | null;
  marca: string | null;
  modelo: string | null;
  associado_nome: string | null;
  associado_telefone: string | null;
  latitude: number | null;
  longitude: number | null;
  velocidade: number | null;
  ignicao: boolean | null;
  ultima_comunicacao: string | null;
  horas_sem_comunicacao: number;
  status_comunicacao: string;
}

export default function Mapa() {
  // Estados
  const [abaAtiva, setAbaAtiva] = useState<string>("veiculos");
  const [posicaoSelecionada, setPosicaoSelecionada] = useState<[number, number] | null>(null);
  const [trajetoAtivo, setTrajetoAtivo] = useState<string | null>(null);
  const [pontosTrajetoAtivo, setPontosTrajetoAtivo] = useState<Array<{ latitude: number; longitude: number; velocidade: number; data_posicao: string }>>([]);
  const [trajetoLoading, setTrajetoLoading] = useState(false);

  // Search states
  const [termoBusca, setTermoBusca] = useState("");
  const [resultadosBusca, setResultadosBusca] = useState<Veiculo[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [showResultados, setShowResultados] = useState(false);
  const [veiculoSelecionado, setVeiculoSelecionado] = useState<Veiculo | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResultados(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search vehicles by plate
  const buscarVeiculos = useCallback(async (termo: string) => {
    if (termo.length < 3) {
      setResultadosBusca([]);
      setShowResultados(false);
      return;
    }
    setBuscando(true);
    try {
      const { data, error } = await supabase
        .from("view_rastreadores_posicao")
        .select("*")
        .or(`placa.ilike.%${termo}%,associado_nome.ilike.%${termo}%`)
        .limit(10);

      if (error) throw error;
      setResultadosBusca((data || []) as Veiculo[]);
      setShowResultados(true);
    } catch (err: any) {
      toast.error("Erro ao buscar veículos");
    } finally {
      setBuscando(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (termoBusca.length < 3) {
      setResultadosBusca([]);
      setShowResultados(false);
      return;
    }
    const timeout = setTimeout(() => buscarVeiculos(termoBusca), 400);
    return () => clearTimeout(timeout);
  }, [termoBusca, buscarVeiculos]);

  const carregarTrajeto = useCallback(async (rastreadorId: string) => {
    if (trajetoAtivo === rastreadorId) {
      setTrajetoAtivo(null);
      setPontosTrajetoAtivo([]);
      return;
    }
    setTrajetoLoading(true);
    try {
      const quatroHorasAtras = subHours(new Date(), 4).toISOString();
      const { data, error } = await supabase
        .from('rastreador_posicoes')
        .select('latitude, longitude, velocidade, data_posicao')
        .eq('rastreador_id', rastreadorId)
        .gte('data_posicao', quatroHorasAtras)
        .order('data_posicao', { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) {
        toast.info('Nenhum ponto de trajeto nas últimas 4 horas');
        return;
      }
      setPontosTrajetoAtivo(data);
      setTrajetoAtivo(rastreadorId);
    } catch (err: any) {
      toast.error('Erro ao carregar trajeto: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setTrajetoLoading(false);
    }
  }, [trajetoAtivo]);

  const velocidadeMediaTrajeto = useMemo(() => {
    const emMovimento = pontosTrajetoAtivo.filter(p => p.velocidade > 0);
    if (emMovimento.length === 0) return 0;
    return Math.round(emMovimento.reduce((acc, p) => acc + p.velocidade, 0) / emMovimento.length);
  }, [pontosTrajetoAtivo]);

  // Mutation para atualizar posição individual
  const atualizarPosicao = useMutation({
    mutationFn: async (rastreadorId: string) => {
      const { data, error } = await supabase.functions.invoke('rastreador-posicao', {
        body: { rastreador_id: rastreadorId }
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao buscar posição');
      return data;
    },
    onSuccess: async () => {
      // Refresh the selected vehicle data
      if (veiculoSelecionado) {
        const { data } = await supabase
          .from("view_rastreadores_posicao")
          .select("*")
          .eq("rastreador_id", veiculoSelecionado.rastreador_id)
          .single();
        if (data) {
          const v = data as Veiculo;
          setVeiculoSelecionado(v);
          if (v.latitude && v.longitude) {
            setPosicaoSelecionada([v.latitude, v.longitude]);
          }
        }
      }
      toast.success('Posição atualizada!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar posição');
    }
  });

  const selecionarVeiculo = (veiculo: Veiculo) => {
    if (veiculo.latitude && veiculo.longitude) {
      setVeiculoSelecionado(veiculo);
      setPosicaoSelecionada([veiculo.latitude, veiculo.longitude]);
      setShowResultados(false);
      setTrajetoAtivo(null);
      setPontosTrajetoAtivo([]);
    } else {
      toast.error("Veículo sem posição GPS");
    }
  };

  const limparSelecao = () => {
    setVeiculoSelecionado(null);
    setPosicaoSelecionada(null);
    setTermoBusca("");
    setResultadosBusca([]);
    setShowResultados(false);
    setTrajetoAtivo(null);
    setPontosTrajetoAtivo([]);
  };

  const abrirWhatsApp = (telefone: string | null) => {
    if (!telefone) {
      toast.error("Telefone não cadastrado");
      return;
    }
    const numero = telefone.replace(/\D/g, "");
    window.open(`https://wa.me/55${numero}`, "_blank");
  };

  const abrirGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "online": return "🟢 Online";
      case "atencao": return "🟡 Atenção";
      case "offline": return "🔴 Offline";
      default: return "⚪ Sem dados";
    }
  };

  const centroInicial: [number, number] = [-15.7801, -47.9292];

  // Sub-component for OSRM-enhanced trajectory rendering (needs hooks at top level)
  const TrajetoOSRM = useCallback(({ pontos }: { pontos: typeof pontosTrajetoAtivo }) => {
    const pontosLatLng = useMemo(() => pontos.map(p => [p.latitude, p.longitude] as [number, number]), [pontos]);
    const { coordenadasRota, isLoading } = useRotaRealMultiWaypoint(pontosLatLng);

    return (
      <>
        <Polyline
          positions={coordenadasRota}
          pathOptions={{
            color: '#8b5cf6',
            weight: isLoading ? 3 : 4,
            opacity: isLoading ? 0.5 : 0.85,
            dashArray: isLoading ? '10, 10' : undefined,
          }}
        />
        <CircleMarker
          center={[pontos[0].latitude, pontos[0].longitude]}
          radius={7}
          pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 1 }}
        >
          <Popup>
            <div className="text-xs">
              <strong className="text-green-600">Início do trajeto</strong>
              <p>{format(new Date(pontos[0].data_posicao), "dd/MM HH:mm", { locale: ptBR })}</p>
            </div>
          </Popup>
        </CircleMarker>
        <CircleMarker
          center={[pontos[pontos.length - 1].latitude, pontos[pontos.length - 1].longitude]}
          radius={7}
          pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1 }}
        >
          <Popup>
            <div className="text-xs">
              <strong className="text-red-600">Fim do trajeto</strong>
              <p>{format(new Date(pontos[pontos.length - 1].data_posicao), "dd/MM HH:mm", { locale: ptBR })}</p>
            </div>
          </Popup>
        </CircleMarker>
      </>
    );
  }, []);

  // Render do mapa de veículos
  const renderMapaVeiculos = () => (
    <MapContainer
      center={centroInicial}
      zoom={4}
      className="h-full w-full"
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='Tiles &copy; Esri'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      />
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
        attribution=""
      />

      <FlyToPosition position={posicaoSelecionada} />

      {/* Only render the selected vehicle marker */}
      {veiculoSelecionado && veiculoSelecionado.latitude && veiculoSelecionado.longitude && (() => {
        const v = veiculoSelecionado;
        const icon = markerIcons[v.status_comunicacao as keyof typeof markerIcons] || markerIcons.sem_dados;

        return (
          <Marker
            key={v.rastreador_id}
            position={[v.latitude!, v.longitude!]}
            icon={icon}
          >
            <Popup>
              <div className="min-w-[200px]">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-sm">{v.placa || "Sem placa"}</h3>
                  <span className="text-xs">{getStatusLabel(v.status_comunicacao)}</span>
                </div>

                <div className="text-xs space-y-1 mb-2">
                  <p><strong>Veículo:</strong> {v.marca} {v.modelo}</p>
                  <p><strong>Associado:</strong> {v.associado_nome || "-"}</p>
                </div>

                <div className="flex items-center gap-3 text-xs mb-2">
                  <span className="flex items-center gap-1">
                    <Gauge className="h-3 w-3" />
                    {v.velocidade || 0} km/h
                  </span>
                  <span className="flex items-center gap-1">
                    <Power className="h-3 w-3" />
                    {v.ignicao ? "Ligado" : "Desligado"}
                  </span>
                </div>

                {v.ultima_comunicacao && (
                  <p className="text-xs text-gray-500 mb-3">
                    Última comunicação:{" "}
                    {format(new Date(v.ultima_comunicacao), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                )}

                <div className="flex gap-2 flex-wrap">
                  {v.associado_telefone && (
                    <button
                      onClick={() => abrirWhatsApp(v.associado_telefone)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                    >
                      <Phone className="h-3 w-3" />
                      WhatsApp
                    </button>
                  )}
                  <button
                    onClick={() => abrirGoogleMaps(v.latitude!, v.longitude!)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                  >
                    <Navigation className="h-3 w-3" />
                    Google Maps
                  </button>
                  <button
                    onClick={() => carregarTrajeto(v.rastreador_id)}
                    disabled={trajetoLoading}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs text-white ${
                      trajetoAtivo === v.rastreador_id
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-purple-600 hover:bg-purple-700'
                    }`}
                  >
                    <Route className="h-3 w-3" />
                    {trajetoAtivo === v.rastreador_id ? 'Fechar Trajeto' : 'Ver Trajeto'}
                  </button>
                  <button
                    onClick={() => atualizarPosicao.mutate(v.rastreador_id)}
                    disabled={atualizarPosicao.isPending}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                  >
                    <RefreshCw className={`h-3 w-3 ${atualizarPosicao.isPending ? 'animate-spin' : ''}`} />
                    Atualizar
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })()}

      {/* Trajeto ativo com rota real */}
      {trajetoAtivo && pontosTrajetoAtivo.length > 1 && (
        <TrajetoOSRM pontos={pontosTrajetoAtivo} />
      )}
    </MapContainer>
  );

  // Badge de trajeto ativo
  const renderTrajetoBadge = () => {
    if (!trajetoAtivo || pontosTrajetoAtivo.length === 0) return null;
    return (
      <div className="absolute top-16 right-4 z-[400] bg-background/95 backdrop-blur-sm px-3 py-2 rounded-lg border shadow-sm text-xs space-y-1">
        <div className="flex items-center gap-2 font-medium">
          <Route className="h-3.5 w-3.5 text-purple-500" />
          Trajeto (4h)
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="text-xs">{pontosTrajetoAtivo.length} pontos</Badge>
          <Badge variant="secondary" className="text-xs">Vel. média: {velocidadeMediaTrajeto} km/h</Badge>
        </div>
        <button
          onClick={() => { setTrajetoAtivo(null); setPontosTrajetoAtivo([]); }}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          Fechar trajeto
        </button>
      </div>
    );
  };

  // Search bar floating over the map
  const renderSearchBar = () => (
    <div ref={searchRef} className="absolute top-4 left-4 right-4 md:left-4 md:right-auto md:w-96 z-[400]">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por placa ou nome do associado..."
          value={termoBusca}
          onChange={(e) => setTermoBusca(e.target.value.toUpperCase())}
          className="pl-9 pr-9 h-10 bg-background/95 backdrop-blur-sm shadow-lg border"
        />
        {(termoBusca || veiculoSelecionado) && (
          <button
            onClick={limparSelecao}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Dropdown de resultados */}
      {showResultados && resultadosBusca.length > 0 && (
        <div className="mt-1 bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg max-h-72 overflow-y-auto">
          {resultadosBusca.map((v) => (
            <button
              key={v.rastreador_id}
              className="w-full text-left px-4 py-3 hover:bg-muted/50 border-b last:border-b-0 transition-colors"
              onClick={() => selecionarVeiculo(v)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-sm">{v.placa || "Sem placa"}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {v.marca} {v.modelo}
                  </span>
                </div>
                <span className="text-xs">{getStatusLabel(v.status_comunicacao)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{v.associado_nome || "Sem associado"}</p>
            </button>
          ))}
        </div>
      )}

      {showResultados && termoBusca.length >= 3 && resultadosBusca.length === 0 && !buscando && (
        <div className="mt-1 bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg px-4 py-3 text-sm text-muted-foreground">
          Nenhum veículo encontrado para "{termoBusca}"
        </div>
      )}

      {buscando && (
        <div className="mt-1 bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg px-4 py-3 text-sm text-muted-foreground">
          Buscando...
        </div>
      )}
    </div>
  );

  // Vehicle info card when selected
  const renderVeiculoInfo = () => {
    if (!veiculoSelecionado) return null;
    const v = veiculoSelecionado;
    return (
      <div className="absolute bottom-4 left-4 z-[400] bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg p-3 max-w-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Car className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">{v.placa}</span>
          </div>
          <span className="text-xs">{getStatusLabel(v.status_comunicacao)}</span>
        </div>
        <div className="text-xs space-y-1 text-muted-foreground">
          <p>{v.marca} {v.modelo} • {v.associado_nome || "Sem associado"}</p>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Gauge className="h-3 w-3" /> {v.velocidade || 0} km/h
            </span>
            <span className="flex items-center gap-1">
              <Power className="h-3 w-3" /> {v.ignicao ? "Ligado" : "Desligado"}
            </span>
          </div>
          {v.ultima_comunicacao && (
            <p className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(v.ultima_comunicacao), { addSuffix: true, locale: ptBR })}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] p-2 md:p-4">
      <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="flex flex-col h-full">
        <TabsList className="w-fit mb-2 md:mb-4">
          <TabsTrigger value="veiculos" className="gap-2 text-xs md:text-sm">
            <Car className="h-4 w-4" />
            <span className="hidden sm:inline">Veículos em Tempo Real</span>
            <span className="sm:hidden">Veículos</span>
          </TabsTrigger>
          <TabsTrigger value="vistorias" className="gap-2 text-xs md:text-sm">
            <ClipboardCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Vistorias Pendentes</span>
            <span className="sm:hidden">Vistorias</span>
          </TabsTrigger>
        </TabsList>

        {/* Aba de Veículos */}
        <TabsContent value="veiculos" className="flex-1 mt-0">
          <div className="relative h-full rounded-lg overflow-hidden">
            {renderMapaVeiculos()}
            {renderSearchBar()}
            {renderTrajetoBadge()}
            {renderVeiculoInfo()}
          </div>
        </TabsContent>

        {/* Aba de Vistorias */}
        <TabsContent value="vistorias" className="flex-1 mt-0">
          <MapaVistoriasContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}

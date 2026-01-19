import { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  Search,
  ClipboardCheck,
  Phone,
  Navigation,
  Locate,
  Calendar,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { useVistoriasMapa, VistoriaMapa } from "@/hooks/useVistoriasMapa";
import { TIPO_VISTORIA_LABELS } from "@/types/servicos-rota";

// Ícone vermelho para vistorias pendentes
const vistoriaIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Componente para centralizar mapa
function FlyToPosition({ position, zoom = 15 }: { position: [number, number] | null; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, zoom, { duration: 1 });
    }
  }, [position, zoom, map]);
  return null;
}

export function MapaVistoriasContent() {
  const { data: vistorias, isLoading, refetch, isRefetching } = useVistoriasMapa();
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroBusca, setFiltroBusca] = useState("");
  const [posicaoSelecionada, setPosicaoSelecionada] = useState<[number, number] | null>(null);
  const [vistoriaSelecionada, setVistoriaSelecionada] = useState<string | null>(null);

  // Filtrar vistorias
  const vistoriasFiltradas = useMemo(() => {
    if (!vistorias) return [];

    return vistorias.filter((v) => {
      if (filtroTipo !== "todos" && v.tipo_vistoria !== filtroTipo) return false;

      if (filtroBusca) {
        const termo = filtroBusca.toLowerCase();
        const placa = v.placa?.toLowerCase() || "";
        const associado = v.associado_nome?.toLowerCase() || "";
        const bairro = v.endereco_bairro?.toLowerCase() || "";

        if (!placa.includes(termo) && !associado.includes(termo) && !bairro.includes(termo)) {
          return false;
        }
      }

      return true;
    });
  }, [vistorias, filtroTipo, filtroBusca]);

  // Vistorias com coordenadas
  const vistoriasComCoordenadas = useMemo(() => {
    return vistoriasFiltradas.filter((v) => v.latitude && v.longitude);
  }, [vistoriasFiltradas]);

  // Selecionar vistoria
  const selecionarVistoria = (vistoria: VistoriaMapa) => {
    if (vistoria.latitude && vistoria.longitude) {
      setPosicaoSelecionada([vistoria.latitude, vistoria.longitude]);
      setVistoriaSelecionada(vistoria.id);
    } else {
      toast.error("Vistoria sem coordenadas GPS");
    }
  };

  // Abrir WhatsApp
  const abrirWhatsApp = (telefone: string | null) => {
    if (!telefone) {
      toast.error("Telefone não cadastrado");
      return;
    }
    const numero = telefone.replace(/\D/g, "");
    window.open(`https://wa.me/55${numero}`, "_blank");
  };

  // Abrir Google Maps
  const abrirGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
  };

  const centroInicial: [number, number] = [-22.9068, -43.1729]; // Rio de Janeiro

  return (
    <div className="flex h-full gap-4">
      {/* Sidebar */}
      <Card className="w-80 flex-shrink-0 flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Vistorias Pendentes</CardTitle>
            </div>
            <Badge variant="secondary">{vistoriasFiltradas.length}</Badge>
          </div>

          {/* Info de coordenadas */}
          <div className="flex gap-2 mt-2">
            <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
              {vistoriasComCoordenadas.length} no mapa
            </Badge>
            <Badge className="bg-muted text-muted-foreground">
              {vistoriasFiltradas.length - vistoriasComCoordenadas.length} sem GPS
            </Badge>
          </div>

          {/* Filtro de Tipo */}
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="h-9 mt-3">
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="entrada">📥 Entrada</SelectItem>
              <SelectItem value="saida">📤 Saída</SelectItem>
              <SelectItem value="sinistro">⚠️ Sinistro</SelectItem>
              <SelectItem value="periodica">🔄 Periódica</SelectItem>
              <SelectItem value="cancelamento">❌ Cancelamento</SelectItem>
              <SelectItem value="manutencao">🔧 Manutenção</SelectItem>
            </SelectContent>
          </Select>

          {/* Campo de Busca */}
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar placa, associado ou bairro..."
              value={filtroBusca}
              onChange={(e) => setFiltroBusca(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full px-4 pb-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="p-3 border rounded-lg">
                    <Skeleton className="h-5 w-24 mb-2" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                  </div>
                ))}
              </div>
            ) : vistoriasFiltradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <ClipboardCheck className="h-12 w-12 mb-2 opacity-50" />
                <p className="text-sm">Nenhuma vistoria pendente</p>
              </div>
            ) : (
              <div className="space-y-2">
                {vistoriasFiltradas.map((v) => (
                  <div
                    key={v.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                      vistoriaSelecionada === v.id ? "border-primary bg-primary/5" : ""
                    } ${!v.latitude ? "opacity-60" : ""}`}
                    onClick={() => selecionarVistoria(v)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm truncate">
                            {v.placa || "Sem placa"}
                          </span>
                          <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                            {TIPO_VISTORIA_LABELS[v.tipo_vistoria as keyof typeof TIPO_VISTORIA_LABELS] || v.tipo_vistoria}
                          </Badge>
                        </div>

                        <p className="text-xs text-muted-foreground truncate">
                          {v.associado_nome || "Sem associado"}
                        </p>

                        {v.endereco_bairro && (
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" />
                            {v.endereco_bairro}, {v.endereco_cidade}
                          </p>
                        )}

                        {v.data_agendada && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(v.data_agendada), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        )}

                        {!v.latitude && (
                          <p className="text-xs text-orange-600 mt-1">⚠️ Sem coordenadas GPS</p>
                        )}
                      </div>

                      {v.latitude && v.longitude && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            selecionarVistoria(v);
                          }}
                        >
                          <Locate className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Mapa */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-red-600" />
            <CardTitle className="text-base">Mapa de Vistorias Pendentes</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </CardHeader>

        <CardContent className="flex-1 p-0 relative">
          <MapContainer
            center={centroInicial}
            zoom={10}
            className="h-full w-full"
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <FlyToPosition position={posicaoSelecionada} />

            {vistoriasComCoordenadas.map((v) => (
              <Marker
                key={v.id}
                position={[v.latitude!, v.longitude!]}
                icon={vistoriaIcon}
              >
                <Popup>
                  <div className="min-w-[200px]">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-sm">{v.placa || "Sem placa"}</h3>
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                        {TIPO_VISTORIA_LABELS[v.tipo_vistoria as keyof typeof TIPO_VISTORIA_LABELS] || v.tipo_vistoria}
                      </span>
                    </div>

                    <div className="text-xs space-y-1 mb-2">
                      <p><strong>Associado:</strong> {v.associado_nome || "-"}</p>
                      <p><strong>Veículo:</strong> {v.marca} {v.modelo}</p>
                      {v.data_agendada && (
                        <p><strong>Agendada:</strong> {format(new Date(v.data_agendada), "dd/MM/yyyy", { locale: ptBR })}</p>
                      )}
                      <p><strong>Local:</strong> {v.endereco_bairro}, {v.endereco_cidade}</p>
                    </div>

                    <div className="flex gap-2">
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
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs text-muted-foreground border shadow-sm">
            {vistoriasComCoordenadas.length} vistorias no mapa • Atualização a cada 1 min
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

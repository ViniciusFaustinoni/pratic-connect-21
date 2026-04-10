import { useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Phone,
  Users,
  User,
  GitBranchPlus,
} from "lucide-react";
import { toast } from "sonner";
import { MapaVistoriasContent } from "@/components/mapa/MapaVistoriasContent";
import { useVistoriadoresRealtime } from "@/hooks/useVistoriadoresRealtime";
import { useConfigAtribuicaoManual } from "@/hooks/useAtribuicaoManual";
import { createVistoriadorMarkerSvg, COR_VISTORIADOR, svgToDataUrl } from "@/lib/rota-colors";

// Leaflet icon fix
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function getVistoriadorIconEquipe(color: string = COR_VISTORIADOR): L.Icon {
  return new L.Icon({
    iconUrl: svgToDataUrl(createVistoriadorMarkerSvg(color)),
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

export default function Mapa() {
  const [abaAtiva, setAbaAtiva] = useState<string>("atribuicoes");

  const { data: atribuicaoManualAtiva } = useConfigAtribuicaoManual();
  const { data: vistoriadores } = useVistoriadoresRealtime();

  const vistoriadoresEmServico = useMemo(() => {
    return vistoriadores?.filter(v => v.em_servico && v.latitude && v.longitude) || [];
  }, [vistoriadores]);

  const abrirWhatsApp = (telefone: string | null) => {
    if (!telefone) { toast.error("Telefone não cadastrado"); return; }
    const numero = telefone.replace(/\D/g, "");
    window.open(`https://wa.me/55${numero}`, "_blank");
  };

  const centroInicial: [number, number] = [-15.7801, -47.9292];

  const renderMapaEquipe = () => (
    <MapContainer center={centroInicial} zoom={10} className="h-full w-full" style={{ height: "100%", width: "100%" }}>
      <TileLayer attribution='Tiles &copy; Esri' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
      <TileLayer url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png" attribution="" />
      {vistoriadoresEmServico.map((v) => (
        <Marker key={`eq-${v.vistoriador_id}`} position={[v.latitude, v.longitude]} icon={getVistoriadorIconEquipe()}>
          <Popup>
            <div className="min-w-[200px]">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-blue-600" />
                <h3 className="font-bold text-sm">{v.vistoriador_nome}</h3>
              </div>
              <div className="text-xs space-y-1 mb-2">
                <p className={`flex items-center gap-1 ${
                  v.status_operacional === 'em_andamento' ? 'text-blue-600' :
                  v.status_operacional === 'em_rota' ? 'text-purple-600' :
                  v.status_operacional === 'em_contato' ? 'text-amber-600' :
                  'text-green-600'
                }`}>
                  <span className={`w-2 h-2 rounded-full animate-pulse ${
                    v.status_operacional === 'em_andamento' ? 'bg-blue-500' :
                    v.status_operacional === 'em_rota' ? 'bg-purple-500' :
                    v.status_operacional === 'em_contato' ? 'bg-amber-500' :
                    'bg-green-500'
                  }`} />
                  {v.status_operacional === 'em_andamento' ? 'Realizando Tarefa' :
                   v.status_operacional === 'em_rota' ? 'Em Rota' :
                   v.status_operacional === 'em_contato' ? 'Em Contato com Associado' :
                   'Aguardando Atribuição'}
                </p>
                <p className="text-muted-foreground">
                  Atualizado: {formatDistanceToNow(new Date(v.updated_at), { addSuffix: true, locale: ptBR })}
                </p>
              </div>
              {v.telefone && (
                <button onClick={() => abrirWhatsApp(v.telefone)} className="flex items-center justify-center gap-1 w-full px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                  <Phone className="h-3 w-3" />Contatar
                </button>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] p-2 md:p-4">
      <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="flex flex-col h-full">
        <TabsList className="w-fit mb-2 md:mb-4">
          <TabsTrigger value="equipe" className="gap-2 text-xs md:text-sm">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Equipe</span>
            <span className="sm:hidden">Equipe</span>
          </TabsTrigger>
          <TabsTrigger value="atribuicoes" className="gap-2 text-xs md:text-sm">
            <GitBranchPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Atribuições {atribuicaoManualAtiva ? '(Manual)' : '(Auto)'}</span>
            <span className="sm:hidden">Atrib.</span>
          </TabsTrigger>
        </TabsList>

        {/* Aba Equipe */}
        <TabsContent value="equipe" className="flex-1 mt-0">
          <div className="relative h-full rounded-lg overflow-hidden">
            {renderMapaEquipe()}
            <div className="absolute top-4 right-4 z-[400] bg-background/95 backdrop-blur-sm rounded-lg border shadow-sm px-3 py-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4 text-blue-600" />
                <span>{vistoriadoresEmServico.length} em campo</span>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Aba Atribuições */}
        <TabsContent value="atribuicoes" className="flex-1 mt-0">
          <MapaVistoriasContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}

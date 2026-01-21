import { MapaMobileContent } from "@/components/mapa/MapaMobileContent";
import "leaflet/dist/leaflet.css";

export default function VistoriadorMapa() {
  return (
    <div className="absolute inset-0 overflow-hidden map-shell">
      <MapaMobileContent />
    </div>
  );
}

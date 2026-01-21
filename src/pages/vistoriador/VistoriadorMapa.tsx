import { MapaMobileContent } from "@/components/mapa/MapaMobileContent";
import "leaflet/dist/leaflet.css";

export default function VistoriadorMapa() {
  return (
    <div className="h-full w-full -mx-4 -my-4 overflow-hidden map-shell">
      <MapaMobileContent />
    </div>
  );
}

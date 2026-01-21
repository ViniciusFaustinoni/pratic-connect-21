import { MapaMobileContent } from "@/components/mapa/MapaMobileContent";
import "leaflet/dist/leaflet.css";

export default function InstaladorMapa() {
  return (
    <div className="h-full w-full overflow-hidden map-shell">
      <MapaMobileContent />
    </div>
  );
}

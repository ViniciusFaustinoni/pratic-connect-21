import { MapaMobileContent } from "@/components/mapa/MapaMobileContent";
import "leaflet/dist/leaflet.css";

export default function VistoriadorMapa() {
  return (
    <div className="h-[calc(100vh-140px)] -mx-4 -mt-4">
      <MapaMobileContent />
    </div>
  );
}

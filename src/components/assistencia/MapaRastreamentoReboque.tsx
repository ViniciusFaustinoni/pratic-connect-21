import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/integrations/supabase/client';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { Button } from '@/components/ui/button';
import { Maximize2, X, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

// Haversine
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateMinutes(distanceKm: number) {
  if (distanceKm < 1) return 0;
  if (distanceKm < 5) return Math.round(distanceKm * 4);
  if (distanceKm <= 20) return Math.round(distanceKm * 3);
  return Math.round(distanceKm * 2.5);
}

// Icons
const vehicleIcon = new L.DivIcon({
  html: `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:#ef4444;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)"><svg width="16" height="16" fill="white" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg></div>`,
  className: '', iconSize: [32, 32], iconAnchor: [16, 32],
});

const truckIcon = new L.DivIcon({
  html: `<div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(59,130,246,.5);animation:pulse 2s infinite"><svg width="18" height="18" fill="white" viewBox="0 0 24 24"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg></div>`,
  className: '', iconSize: [36, 36], iconAnchor: [18, 36],
});

const destinoIcon = new L.DivIcon({
  html: `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:#10b981;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)"><svg width="16" height="16" fill="white" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg></div>`,
  className: '', iconSize: [32, 32], iconAnchor: [16, 32],
});

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (positions.length >= 2 && !fitted.current) {
      map.fitBounds(positions as L.LatLngBoundsExpression, { padding: [50, 50] });
      fitted.current = true;
    }
  }, [positions, map]);
  return null;
}

// Smooth marker movement
function AnimatedMarker({ position, icon }: { position: [number, number]; icon: L.DivIcon }) {
  const markerRef = useRef<L.Marker>(null);
  const prevPos = useRef(position);

  useEffect(() => {
    const marker = markerRef.current;
    if (marker && (prevPos.current[0] !== position[0] || prevPos.current[1] !== position[1])) {
      const start = prevPos.current;
      const end = position;
      const duration = 1000;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        const lat = start[0] + (end[0] - start[0]) * t;
        const lng = start[1] + (end[1] - start[1]) * t;
        marker.setLatLng([lat, lng]);
        if (t < 1) requestAnimationFrame(animate);
      };
      animate();
      prevPos.current = position;
    }
  }, [position]);

  return <Marker ref={markerRef} position={position} icon={icon} />;
}

export interface MapaRastreamentoReboqueProps {
  chamadoId: string;
  posicaoVeiculo: { lat: number; lng: number } | null;
  posicaoDestino?: { lat: number; lng: number } | null;
  nomeReboquista?: string;
  telefoneReboquista?: string;
  altura?: string;
  expandivel?: boolean;
  isPublic?: boolean;
  onPosicaoAtualizada?: (data: { lat: number; lng: number; distanciaKm: number; tempoEstimadoMin: number }) => void;
}

export default function MapaRastreamentoReboque({
  chamadoId,
  posicaoVeiculo,
  posicaoDestino,
  nomeReboquista,
  telefoneReboquista,
  altura = "300px",
  expandivel = false,
  isPublic = false,
  onPosicaoAtualizada,
}: MapaRastreamentoReboqueProps) {
  const [reboquistaPos, setReboquistaPos] = useState<{ lat: number; lng: number } | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [distanciaKm, setDistanciaKm] = useState<number | null>(null);
  const [tempoMin, setTempoMin] = useState<number | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval>>();
  const channelRef = useRef<any>(null);

  const client = isPublic ? publicSupabase : supabase;

  // Fetch initial position
  useEffect(() => {
    const fetchInitial = async () => {
      const { data } = await client
        .from('despacho_reboque_tracking')
        .select('latitude, longitude')
        .eq('chamado_id', chamadoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setReboquistaPos({ lat: Number(data.latitude), lng: Number(data.longitude) });
      }
    };
    fetchInitial();
  }, [chamadoId]);

  // Update distance/time whenever position changes
  useEffect(() => {
    if (!reboquistaPos || !posicaoVeiculo) return;
    const dist = haversineKm(reboquistaPos.lat, reboquistaPos.lng, posicaoVeiculo.lat, posicaoVeiculo.lng);
    const mins = estimateMinutes(dist);
    setDistanciaKm(Math.round(dist * 10) / 10);
    setTempoMin(mins);
    onPosicaoAtualizada?.({ lat: reboquistaPos.lat, lng: reboquistaPos.lng, distanciaKm: dist, tempoEstimadoMin: mins });
  }, [reboquistaPos, posicaoVeiculo]);

  // Realtime subscription
  useEffect(() => {
    const channel = client
      .channel(`tracking-${chamadoId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'despacho_reboque_tracking',
        filter: `chamado_id=eq.${chamadoId}`,
      }, (payload: any) => {
        const { latitude, longitude } = payload.new;
        setReboquistaPos({ lat: Number(latitude), lng: Number(longitude) });
        setIsOnline(true);
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          setIsOnline(true);
          if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = undefined; }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsOnline(false);
          startPolling();
        }
      });

    channelRef.current = channel;
    return () => { client.removeChannel(channel); if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [chamadoId]);

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      const { data } = await client
        .from('despacho_reboque_tracking')
        .select('latitude, longitude')
        .eq('chamado_id', chamadoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setReboquistaPos({ lat: Number(data.latitude), lng: Number(data.longitude) });
      }
    }, 10000);
  }, [chamadoId]);

  const center: [number, number] = posicaoVeiculo
    ? [posicaoVeiculo.lat, posicaoVeiculo.lng]
    : reboquistaPos ? [reboquistaPos.lat, reboquistaPos.lng] : [-15.78, -47.93];

  const fitPositions: [number, number][] = [];
  if (posicaoVeiculo) fitPositions.push([posicaoVeiculo.lat, posicaoVeiculo.lng]);
  if (reboquistaPos) fitPositions.push([reboquistaPos.lat, reboquistaPos.lng]);
  if (posicaoDestino) fitPositions.push([posicaoDestino.lat, posicaoDestino.lng]);

  const routeLine: [number, number][] = [];
  if (reboquistaPos && posicaoVeiculo) {
    routeLine.push([reboquistaPos.lat, reboquistaPos.lng], [posicaoVeiculo.lat, posicaoVeiculo.lng]);
  }

  const mapContent = (h: string) => (
    <div className="relative" style={{ height: h }}>
      <MapContainer center={center} zoom={13} className="h-full w-full rounded-lg" zoomControl={false} scrollWheelZoom={true}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {fitPositions.length >= 2 && <FitBounds positions={fitPositions} />}
        {posicaoVeiculo && <Marker position={[posicaoVeiculo.lat, posicaoVeiculo.lng]} icon={vehicleIcon} />}
        {posicaoDestino && <Marker position={[posicaoDestino.lat, posicaoDestino.lng]} icon={destinoIcon} />}
        {reboquistaPos && <AnimatedMarker position={[reboquistaPos.lat, reboquistaPos.lng]} icon={truckIcon} />}
        {routeLine.length === 2 && <Polyline positions={routeLine} pathOptions={{ color: '#3b82f6', weight: 3, dashArray: '8, 8' }} />}
      </MapContainer>

      {/* Connection indicator */}
      <div className={cn(
        "absolute top-2 right-2 z-[1000] flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm",
        isOnline ? "bg-green-500/20 text-green-700" : "bg-red-500/20 text-red-700"
      )}>
        <div className={cn("w-2 h-2 rounded-full", isOnline ? "bg-green-500 animate-pulse" : "bg-red-500")} />
        {isOnline ? "Ao vivo" : "Reconectando..."}
      </div>

      {/* Expand button */}
      {expandivel && !fullscreen && (
        <Button
          size="icon"
          variant="secondary"
          className="absolute bottom-2 right-2 z-[1000] h-8 w-8 shadow-lg"
          onClick={() => setFullscreen(true)}
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );

  return (
    <>
      {mapContent(altura)}

      {/* Fullscreen overlay */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-background">
          {mapContent("100dvh")}
          <Button
            size="icon"
            variant="secondary"
            className="absolute top-4 right-4 z-[1001] shadow-lg"
            onClick={() => setFullscreen(false)}
          >
            <X className="h-5 w-5" />
          </Button>

          {/* Floating info card */}
          <div className="absolute bottom-6 left-4 right-4 z-[1001] bg-card/95 backdrop-blur-sm rounded-xl p-4 shadow-lg border">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">{nomeReboquista || "Reboquista"}</p>
                {distanciaKm !== null && tempoMin !== null && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    📍 {distanciaKm} km • ⏰ {tempoMin > 0 ? `~${tempoMin} min` : 'Quase lá!'}
                  </p>
                )}
              </div>
              {telefoneReboquista && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.location.href = `tel:${telefoneReboquista}`}>
                  <Phone className="h-3.5 w-3.5" /> Ligar
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

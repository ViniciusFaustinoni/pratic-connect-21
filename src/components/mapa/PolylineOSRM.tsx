import { useMemo } from 'react';
import { Polyline } from 'react-leaflet';
import { useRotaRealMultiWaypoint } from '@/hooks/useRotaRealMultiWaypoint';

interface PolylineOSRMProps {
  positions: [number, number][];
  color?: string;
  weight?: number;
  opacity?: number;
}

/**
 * Drop-in replacement for Polyline that converts raw GPS points
 * into a road-following route via OSRM. Shows dashed line while loading.
 */
export function PolylineOSRM({ positions, color = '#3b82f6', weight = 3, opacity = 0.8 }: PolylineOSRMProps) {
  const { coordenadasRota, isLoading } = useRotaRealMultiWaypoint(positions);

  return (
    <Polyline
      positions={coordenadasRota}
      pathOptions={{
        color,
        weight: isLoading ? weight - 1 : weight,
        opacity: isLoading ? opacity * 0.5 : opacity,
        dashArray: isLoading ? '10, 10' : undefined,
      }}
    />
  );
}

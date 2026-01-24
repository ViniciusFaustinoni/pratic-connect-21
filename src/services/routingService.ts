/**
 * Serviço de roteamento usando OSRM (Open Source Routing Machine)
 * Busca rotas reais seguindo as ruas da cidade
 */

interface OSRMRoute {
  geometry: {
    type: string;
    coordinates: [number, number][]; // [lng, lat] - formato GeoJSON
  };
  distance: number; // metros
  duration: number; // segundos
}

interface OSRMResponse {
  code: string;
  routes: OSRMRoute[];
}

export interface RotaResult {
  coordenadas: [number, number][]; // [lat, lng] - formato Leaflet
  distanciaKm: number;
  tempoMinutos: number;
}

// Cache simples em memória
const routeCache = new Map<string, { data: RotaResult; timestamp: number }>();
const CACHE_TTL = 30000; // 30 segundos

/**
 * Gera chave única para cache baseada nas coordenadas (arredondadas)
 */
function getCacheKey(origem: [number, number], destino: [number, number]): string {
  // Arredondar para 4 casas decimais (~11m de precisão)
  const o = origem.map(c => c.toFixed(4)).join(',');
  const d = destino.map(c => c.toFixed(4)).join(',');
  return `${o}->${d}`;
}

/**
 * Busca rota real usando OSRM API pública
 * @param origem Coordenadas [lat, lng] do ponto de partida
 * @param destino Coordenadas [lat, lng] do ponto de chegada
 * @returns Rota com coordenadas, distância e tempo estimado
 */
export async function getRouteOSRM(
  origem: [number, number],
  destino: [number, number]
): Promise<RotaResult> {
  // Verificar cache
  const cacheKey = getCacheKey(origem, destino);
  const cached = routeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // OSRM espera coordenadas no formato [lng, lat]
  const origemOSRM = `${origem[1]},${origem[0]}`;
  const destinoOSRM = `${destino[1]},${destino[0]}`;
  
  const url = `https://router.project-osrm.org/route/v1/driving/${origemOSRM};${destinoOSRM}?geometries=geojson&overview=full`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`OSRM API error: ${response.status}`);
    }
    
    const data: OSRMResponse = await response.json();
    
    if (data.code !== 'Ok' || !data.routes.length) {
      throw new Error('No route found');
    }
    
    const route = data.routes[0];
    
    // Converter coordenadas de [lng, lat] (GeoJSON) para [lat, lng] (Leaflet)
    const coordenadas = route.geometry.coordinates.map(
      ([lng, lat]) => [lat, lng] as [number, number]
    );
    
    const result: RotaResult = {
      coordenadas,
      distanciaKm: route.distance / 1000,
      tempoMinutos: Math.round(route.duration / 60),
    };
    
    // Salvar no cache
    routeCache.set(cacheKey, { data: result, timestamp: Date.now() });
    
    return result;
  } catch (error) {
    console.error('[routingService] Erro ao buscar rota OSRM:', error);
    
    // Fallback: retornar linha reta
    return {
      coordenadas: [origem, destino],
      distanciaKm: calcularDistanciaHaversine(origem, destino),
      tempoMinutos: 0,
    };
  }
}

/**
 * Calcula distância em linha reta usando fórmula de Haversine
 */
function calcularDistanciaHaversine(
  origem: [number, number],
  destino: [number, number]
): number {
  const R = 6371; // Raio da Terra em km
  const [lat1, lon1] = origem;
  const [lat2, lon2] = destino;
  
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

/**
 * Limpa cache expirado
 */
export function clearExpiredCache(): void {
  const now = Date.now();
  for (const [key, value] of routeCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      routeCache.delete(key);
    }
  }
}

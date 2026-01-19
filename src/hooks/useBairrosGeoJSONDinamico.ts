import { useQuery } from "@tanstack/react-query";
import { BairrosGeoJSON } from "./useBairrosGeoJSON";

// Cache local de GeoJSON por cidade
const geoJSONCache = new Map<string, BairrosGeoJSON>();

/**
 * Normaliza nome de cidade para cache key
 */
function normalizarCidade(cidade: string): string {
  return cidade
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Busca polígonos de bairros via Nominatim + Overpass API (OpenStreetMap)
 * para qualquer cidade do Brasil
 */
export async function fetchBairrosGeoJSON(cidade: string, uf?: string): Promise<BairrosGeoJSON | null> {
  if (!cidade) return null;

  const cacheKey = normalizarCidade(cidade);
  
  // Verificar cache
  if (geoJSONCache.has(cacheKey)) {
    console.log(`📦 Cache hit para ${cidade}`);
    return geoJSONCache.get(cacheKey)!;
  }

  // Tentar arquivo local primeiro para Rio de Janeiro
  const cidadeLower = cidade.toLowerCase();
  if (cidadeLower.includes("rio de janeiro") || cidadeLower === "rio") {
    try {
      const response = await fetch("/data/bairros-rj.geojson");
      if (response.ok) {
        const geojson = await response.json();
        console.log(`📁 Usando arquivo local bairros-rj.geojson`);
        geoJSONCache.set(cacheKey, geojson);
        return geojson;
      }
    } catch (e) {
      console.warn("Arquivo local não disponível, usando Overpass API");
    }
  }

  console.log(`🌐 Buscando bairros via Overpass API para: ${cidade}`);

  try {
    // Query Overpass para buscar bairros da cidade
    // Busca por admin_level=10 (bairros) e place=neighbourhood
    const overpassQuery = `
      [out:json][timeout:60];
      area["name"~"${cidade}","i"]["admin_level"~"^[678]$"]["boundary"="administrative"]->.city;
      (
        relation["boundary"="administrative"]["admin_level"="10"](area.city);
        relation["place"="neighbourhood"](area.city);
        relation["place"="suburb"](area.city);
        way["boundary"="administrative"]["admin_level"="10"](area.city);
        way["place"="neighbourhood"](area.city);
      );
      out body geom;
    `;

    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(overpassQuery)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }

    const osmData = await response.json();
    console.log(`📍 Overpass retornou ${osmData.elements?.length || 0} elementos para ${cidade}`);

    // Converter OSM para GeoJSON
    const geojson = osmToGeoJSON(osmData);
    
    console.log(`✅ Convertido para ${geojson.features.length} polígonos`);

    // Cachear resultado se houver features
    if (geojson.features.length > 0) {
      geoJSONCache.set(cacheKey, geojson);
    }

    return geojson;
  } catch (error) {
    console.warn(`❌ Não foi possível carregar bairros para ${cidade}:`, error);
    return { type: "FeatureCollection", features: [] };
  }
}

/**
 * Converter resposta OSM para GeoJSON
 */
function osmToGeoJSON(osmData: { elements?: OsmElement[] }): BairrosGeoJSON {
  const features: BairrosGeoJSON["features"] = [];

  if (!osmData.elements) {
    return { type: "FeatureCollection", features };
  }

  for (const element of osmData.elements) {
    const name = element.tags?.name || element.tags?.["name:pt"] || "Desconhecido";

    // Processar ways (polígonos simples) com geometry inline
    if (element.type === "way" && element.geometry && element.geometry.length > 2) {
      const coords = element.geometry.map((node) => [node.lon, node.lat]);
      
      // Fechar o polígono se necessário
      if (coords.length > 0 && 
          (coords[0][0] !== coords[coords.length - 1][0] || 
           coords[0][1] !== coords[coords.length - 1][1])) {
        coords.push([...coords[0]]);
      }

      features.push({
        type: "Feature",
        properties: { name },
        geometry: { type: "Polygon", coordinates: [coords] },
      });
    }

    // Processar relations (multipolígonos)
    if (element.type === "relation" && element.members) {
      const outerRings: number[][][] = [];
      
      for (const member of element.members) {
        if (member.role === "outer" && member.geometry && member.geometry.length > 2) {
          const coords = member.geometry.map((node) => [node.lon, node.lat]);
          
          // Fechar o polígono se necessário
          if (coords.length > 0 && 
              (coords[0][0] !== coords[coords.length - 1][0] || 
               coords[0][1] !== coords[coords.length - 1][1])) {
            coords.push([...coords[0]]);
          }
          
          outerRings.push(coords);
        }
      }

      if (outerRings.length === 1) {
        features.push({
          type: "Feature",
          properties: { name },
          geometry: { type: "Polygon", coordinates: outerRings },
        });
      } else if (outerRings.length > 1) {
        features.push({
          type: "Feature",
          properties: { name },
          geometry: { type: "MultiPolygon", coordinates: outerRings.map(ring => [ring]) },
        });
      }
    }
  }

  return { type: "FeatureCollection", features };
}

// Tipos OSM
interface OsmNode {
  lat: number;
  lon: number;
}

interface OsmMember {
  type: string;
  ref: number;
  role: string;
  geometry?: OsmNode[];
}

interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  tags?: Record<string, string>;
  geometry?: OsmNode[];
  members?: OsmMember[];
}

/**
 * Hook React Query para buscar GeoJSON de bairros dinamicamente
 */
export function useBairrosGeoJSONDinamico(cidade: string | null, uf?: string) {
  return useQuery({
    queryKey: ["bairros-geojson-dinamico", cidade, uf],
    queryFn: () => (cidade ? fetchBairrosGeoJSON(cidade, uf) : null),
    staleTime: 1000 * 60 * 60 * 24, // 24 horas
    gcTime: 1000 * 60 * 60 * 24,
    enabled: !!cidade,
    retry: 1,
  });
}

/**
 * Identifica a cidade predominante de uma lista de vistorias
 */
export function identificarCidadePredominante(
  vistorias: Array<{ endereco_cidade?: string | null }>
): string | null {
  if (!vistorias.length) return null;

  const contagem = new Map<string, number>();
  
  for (const v of vistorias) {
    if (v.endereco_cidade) {
      const cidade = v.endereco_cidade.trim();
      contagem.set(cidade, (contagem.get(cidade) || 0) + 1);
    }
  }

  let maior = { cidade: null as string | null, count: 0 };
  
  for (const [cidade, count] of contagem) {
    if (count > maior.count) {
      maior = { cidade, count };
    }
  }

  return maior.cidade;
}

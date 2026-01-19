import { useQuery } from "@tanstack/react-query";

export interface BairrosGeoJSON {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: {
      name: string;
      [key: string]: unknown;
    };
    geometry: {
      type: "Polygon" | "MultiPolygon";
      coordinates: number[][][] | number[][][][];
    };
  }>;
}

export function useBairrosGeoJSON() {
  return useQuery({
    queryKey: ["bairros-geojson"],
    queryFn: async (): Promise<BairrosGeoJSON> => {
      const response = await fetch("/data/bairros-rj.geojson");
      if (!response.ok) throw new Error("Erro ao carregar GeoJSON dos bairros");
      return response.json();
    },
    staleTime: Infinity, // Cachear permanentemente - o arquivo não muda
    gcTime: Infinity,
  });
}

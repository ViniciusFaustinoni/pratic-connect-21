import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCallback } from 'react';

interface ConfigGps {
  ativa: boolean;
  raioMetros: number;
}

export interface ResultadoValidacao {
  aprovado: boolean;
  distancia: number | null;
  dentroDoRaio: boolean;
  gpsIndisponivel: boolean;
  pulou?: boolean;
}

function haversineMetros(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function obterPosicaoAtual(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização não suportada'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000,
    });
  });
}

export function useValidacaoPresenca() {
  const { data: configGps } = useQuery<ConfigGps>({
    queryKey: ['config-gps-validacao'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', ['gps_validacao_ativa', 'gps_raio_metros']);
      const map = Object.fromEntries((data || []).map(d => [d.chave, d.valor]));
      return {
        ativa: map.gps_validacao_ativa !== 'false',
        raioMetros: parseFloat(map.gps_raio_metros) || 500,
      };
    },
    staleTime: 1000 * 60 * 10,
  });

  const validarPresenca = useCallback(
    async (
      servicoId: string,
      enderecoCompleto: string,
      latDestino?: number | null,
      lonDestino?: number | null,
    ): Promise<ResultadoValidacao> => {
      const config = configGps || { ativa: true, raioMetros: 500 };

      // Se validação desativada
      if (!config.ativa) {
        return { aprovado: true, distancia: null, dentroDoRaio: true, gpsIndisponivel: false, pulou: true };
      }

      let latVist: number | null = null;
      let lonVist: number | null = null;
      let latDest = latDestino ?? null;
      let lonDest = lonDestino ?? null;

      // Obter posição do vistoriador
      try {
        const pos = await obterPosicaoAtual();
        latVist = pos.coords.latitude;
        lonVist = pos.coords.longitude;
      } catch {
        // GPS indisponível
      try {
          await (supabase as any).from('registros_presenca').insert({
            servico_id: servicoId,
            gps_indisponivel: true,
            latitude_destino: latDest,
            longitude_destino: lonDest,
          });
        } catch { /* silent */ }
        return { aprovado: true, distancia: null, dentroDoRaio: false, gpsIndisponivel: true };
      }

      // Se não temos coordenadas do destino, geocodificar
      if (latDest == null || lonDest == null) {
        try {
          const { data: geo } = await supabase.functions.invoke('geocode-endereco', {
            body: { endereco: enderecoCompleto },
          });
          if (geo?.success && geo.latitude && geo.longitude) {
            latDest = geo.latitude;
            lonDest = geo.longitude;
          }
        } catch { /* silent */ }
      }

      // Se ainda sem destino, registrar e aprovar
      if (latDest == null || lonDest == null) {
      try {
          await (supabase as any).from('registros_presenca').insert({
            servico_id: servicoId,
            latitude_vistoriador: latVist,
            longitude_vistoriador: lonVist,
            gps_indisponivel: false,
            dentro_do_raio: true,
            confirmou_presenca: false,
          });
        } catch { /* silent */ }
        return { aprovado: true, distancia: null, dentroDoRaio: true, gpsIndisponivel: false };
      }

      // Calcular distância
      const distancia = Math.round(haversineMetros(latVist, lonVist, latDest, lonDest));
      const dentroDoRaio = distancia <= config.raioMetros;

      // Registrar
      try {
        await (supabase as any).from('registros_presenca').insert({
          servico_id: servicoId,
          latitude_vistoriador: latVist,
          longitude_vistoriador: lonVist,
          latitude_destino: latDest,
          longitude_destino: lonDest,
          distancia_metros: distancia,
          dentro_do_raio: dentroDoRaio,
          confirmou_presenca: false,
        });
      } catch { /* silent */ }

      return {
        aprovado: dentroDoRaio,
        distancia,
        dentroDoRaio,
        gpsIndisponivel: false,
      };
    },
    [configGps],
  );

  const confirmarPresenca = useCallback(async (servicoId: string) => {
    try {
      await (supabase as any)
        .from('registros_presenca')
        .update({ confirmou_presenca: true })
        .eq('servico_id', servicoId)
        .order('created_at', { ascending: false })
        .limit(1);
    } catch { /* silent */ }
  }, []);

  return { validarPresenca, confirmarPresenca, configGps };
}

/**
 * Bypass de geolocalização EXCLUSIVO para o sandbox de preview Lovable.
 *
 * Ativação: apenas em hostnames `id-preview--*.lovable.app` (sandbox de QA)
 * OU quando localStorage.PRATIC_PREVIEW_GEO_BYPASS === '1' for setado
 * manualmente para debugging.
 *
 * NUNCA ativa em:
 * - app.praticcar.org (produção)
 * - pratic-connect-21.lovable.app (published)
 * - localhost (dev local — use GPS real ou setar a flag explicitamente)
 *
 * Motivo: o browser headless do sandbox não consegue obter GPS real, o que
 * trava o fluxo do instalador em "Localização Desativada → Tentar Novamente"
 * e impede QA automatizado dos serviços de campo.
 */

const MOCK_COORDS = {
  // Centro do Rio de Janeiro — região onde concentramos a maioria dos testes.
  latitude: -22.9068,
  longitude: -43.1729,
  accuracy: 15,
  altitude: null as number | null,
  altitudeAccuracy: null as number | null,
  heading: null as number | null,
  speed: null as number | null,
};

function shouldBypass(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const host = window.location.hostname;
    const isSandbox =
      /^id-preview--.*\.lovable\.app$/.test(host) ||
      /\.lovableproject\.com$/.test(host) ||
      /^id-preview--.*\.lovableproject\.com$/.test(host);
    const flag = window.localStorage?.getItem('PRATIC_PREVIEW_GEO_BYPASS') === '1';
    return isSandbox || flag;
  } catch {
    return false;
  }
}

function buildPosition(): GeolocationPosition {
  return {
    coords: {
      ...MOCK_COORDS,
      toJSON() {
        return { ...MOCK_COORDS };
      },
    } as GeolocationCoordinates,
    timestamp: Date.now(),
    toJSON() {
      return { coords: { ...MOCK_COORDS }, timestamp: Date.now() };
    },
  } as GeolocationPosition;
}

export function installPreviewGeolocationBypass() {
  if (!shouldBypass()) return;
  if (!('geolocation' in navigator)) return;
  if ((navigator.geolocation as any).__praticPreviewMocked) return;

  console.warn(
    '[PreviewGeoBypass] Sandbox detectado — injetando coordenadas mockadas (-22.9068, -43.1729). NÃO usar em produção.'
  );

  const mocked: Geolocation = {
    getCurrentPosition: (success, _error, _options) => {
      setTimeout(() => success(buildPosition()), 50);
    },
    watchPosition: (success, _error, _options) => {
      setTimeout(() => success(buildPosition()), 50);
      // devolve um id qualquer; clearWatch é no-op funcional pq não há timer ativo
      return Math.floor(Math.random() * 1_000_000);
    },
    clearWatch: () => {},
  };

  (mocked as any).__praticPreviewMocked = true;

  try {
    Object.defineProperty(navigator, 'geolocation', {
      value: mocked,
      configurable: true,
    });
  } catch (err) {
    console.error('[PreviewGeoBypass] Falha ao redefinir navigator.geolocation', err);
  }
}

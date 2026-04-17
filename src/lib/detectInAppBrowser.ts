/**
 * Detecta se a página está sendo aberta dentro de um navegador
 * embutido (in-app browser) de redes sociais. Esses navegadores
 * (WhatsApp, Instagram, Facebook, TikTok) bloqueiam ou degradam
 * APIs como getUserMedia, impedindo o liveview da câmera.
 */
export type InAppBrowser = 'whatsapp' | 'instagram' | 'facebook' | 'tiktok';

export function detectInAppBrowser(): InAppBrowser | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent || '';
  if (/WhatsApp/i.test(ua)) return 'whatsapp';
  if (/Instagram/i.test(ua)) return 'instagram';
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'facebook';
  if (/TikTok|musical_ly/i.test(ua)) return 'tiktok';
  return null;
}

export function getInAppBrowserName(b: InAppBrowser): string {
  switch (b) {
    case 'whatsapp': return 'WhatsApp';
    case 'instagram': return 'Instagram';
    case 'facebook': return 'Facebook';
    case 'tiktok': return 'TikTok';
  }
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
}

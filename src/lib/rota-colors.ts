// Paleta de cores vibrantes para rotas
export const ROTA_COLORS = [
  '#3B82F6', // Azul
  '#10B981', // Verde
  '#8B5CF6', // Roxo
  '#F59E0B', // Amarelo/Laranja
  '#EF4444', // Vermelho
  '#06B6D4', // Cyan
  '#EC4899', // Rosa
  '#84CC16', // Lima
  '#F97316', // Laranja
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#A855F7', // Roxo claro
];

// Cor para vistorias sem rota atribuída
export const SEM_ROTA_COLOR = '#9CA3AF'; // Cinza

/**
 * Retorna a cor para uma rota específica baseada no índice
 */
export function getRotaColor(rotaId: string | null, rotasIds: string[]): string {
  if (!rotaId) return SEM_ROTA_COLOR;
  const index = rotasIds.indexOf(rotaId);
  if (index === -1) return SEM_ROTA_COLOR;
  return ROTA_COLORS[index % ROTA_COLORS.length];
}

/**
 * Gera um ícone Leaflet colorido dinamicamente
 */
export function createColoredMarkerSvg(color: string): string {
  return `
    <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 24 16 24s16-12 16-24c0-8.837-7.163-16-16-16z" fill="${color}"/>
      <circle cx="16" cy="16" r="8" fill="white"/>
    </svg>
  `;
}

/**
 * Converte SVG em Data URL para usar como ícone
 */
export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

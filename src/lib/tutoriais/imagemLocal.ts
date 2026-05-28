// Resolve URLs de imagem de tutorial:
// - `local:<filename>` → asset bundle de `src/assets/tutoriais/`
// - http(s)://...      → URL pública (Storage `tutoriais`)
// - undefined/null     → null (componente mostra placeholder)

const ASSETS = import.meta.glob('@/assets/tutoriais/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const POR_NOME: Record<string, string> = {};
for (const [path, url] of Object.entries(ASSETS)) {
  const nome = path.split('/').pop();
  if (nome) POR_NOME[nome] = url;
}

export function resolverImagemTutorial(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith('local:')) {
    const nome = value.slice(6);
    return POR_NOME[nome] ?? null;
  }
  return value;
}

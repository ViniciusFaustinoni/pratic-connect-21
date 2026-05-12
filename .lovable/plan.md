## Diagnóstico

Conferi as vistorias do ALEXANDRE (xandiboladao5@gmail.com / Moto G 15) e ele lida com **31 fotos por vistoria** (`vistorias.id=e86d7c19...`, `nfotos=31`). Cada foto está armazenada em ~180 KB JPEG, mas quando renderizada como `<img src="...jpg">` sem transform, o navegador **decodifica a imagem em tamanho original (≈1280×960)**, ocupando ~5 MB de RAM por foto na memória de pixels — independentemente do CSS dizer "10×10 px".

O componente `VistoriaFotoSequencial` (usado em `InstaladorChecklist`, `ExecutarVistoriaCompleta` e `ExecutarRetirada`) renderiza:
- **Strip horizontal com TODAS as 31 fotos** como `<img>` 10×10 px, mas com URL pública crua → ~150 MB de pixels decodificados.
- Preview grande da foto atual também em URL crua (~5 MB).

Em paralelo, `FotoCapture` (cards individuais em outras seções) também usa URL pública direta. No Moto G 15 (3 GB RAM, heap JS Chrome ~256 MB) isso estoura facilmente — o `imageCompressor` já é defensivo na captura, mas o problema está em **exibir** o que já foi enviado.

O endpoint de transform do Supabase Storage está habilitado: testei e a mesma foto a 80×80 q=60 retorna **1.5 KB** em vez de 180 KB (e o navegador decodifica ~25 KB de pixels em vez de 5 MB) — redução de ~200×.

## O que vou alterar

1. **Criar `src/lib/storage/imageTransform.ts`** — helper único:
   - `transformedUrl(url, { width, height, quality, resize })` — converte URLs `…/storage/v1/object/public/<bucket>/<path>` em `…/storage/v1/render/image/public/<bucket>/<path>?width=…&height=…&quality=…&resize=cover`. Devolve a URL original quando o padrão não bate (ex.: blob:, http externo).
   - `THUMB`, `PREVIEW`, `FULL` presets.

2. **`src/components/vistorias/VistoriaFotoSequencial.tsx`**
   - Strip de thumbnails: usar `transformedUrl(url, THUMB /* 96×96 q60 */)` + `width={40} height={40}`.
   - Preview principal da foto atual: `transformedUrl(url, PREVIEW /* 960×720 q75 */)`.
   - Manter `loading="lazy"` e `decoding="async"`.

3. **`src/components/instalador/FotoCapture.tsx`**
   - Quando `fotoUrl` é remoto (não preview blob:), aplicar `transformedUrl(fotoUrl, PREVIEW)`. Preview local (blob:) continua igual.

4. **`src/components/instalador/FotosManutencao.tsx`** (linha 149)
   - Mesmo tratamento para o `<img>` da galeria de manutenção.

5. **Liberar memória ao avançar de etapa em `InstaladorChecklist`**
   - Pequeno ajuste: ao trocar `etapaAtual`, chamar um `requestIdleCallback` que itera `document.querySelectorAll('img[data-vistoria-foto]')` removidas e força GC (apenas garantia; o ganho real está no item 1-4).

## Impacto esperado

- Strip de 31 thumbnails: de ~150 MB → ~0.8 MB de pixels decodificados.
- Preview grande: de ~5 MB → ~2.7 MB (960×720).
- Bytes baixados: de ~5.6 MB (31 × 180 KB) → ~50 KB (31 × 1.5 KB) por vistoria — **carregamento 100× mais leve em rede 3G/4G fraca**.
- Sem mudanças no fluxo, no banco, em policies de storage ou nas edge functions. Sem mudar a captura/compressão (já está bem).

## Detalhes técnicos

```ts
// src/lib/storage/imageTransform.ts
const RX = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/;
export const THUMB   = { width: 96,  height: 96,  quality: 60, resize: 'cover' as const };
export const PREVIEW = { width: 960, height: 720, quality: 75, resize: 'contain' as const };

export function transformedUrl(url?: string|null, opts?: {...}) {
  if (!url || url.startsWith('blob:') || url.startsWith('data:')) return url ?? '';
  const m = url.match(RX);
  if (!m) return url;
  const [_, bucket, path] = m;
  const base = url.split('/storage/v1/')[0];
  const qs = new URLSearchParams();
  if (opts?.width)   qs.set('width', String(opts.width));
  if (opts?.height)  qs.set('height', String(opts.height));
  if (opts?.quality) qs.set('quality', String(opts.quality));
  if (opts?.resize)  qs.set('resize', opts.resize);
  // preserva query original (ex.: ?v=cachebust) → mover para o final
  const [pathOnly, originalQs] = path.split('?');
  if (originalQs) new URLSearchParams(originalQs).forEach((v,k) => qs.set(k,v));
  return `${base}/storage/v1/render/image/public/${bucket}/${pathOnly}?${qs.toString()}`;
}
```

Tudo o que renderiza foto de vistoria/instalação/manutenção do instalador passa a usar esse helper. Nada muda para o usuário visualmente — só cai o consumo de RAM/banda.

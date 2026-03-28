

# Corrigir Exibição de Vídeo na Galeria de Fotos da Vistoria

## Problema
No modal "Fotos da Vistoria" do `PropostaMidiaGrid`, todos os itens (incluindo vídeos 360°) são renderizados com `<img>`. Vídeos `.webm`/`.mp4` não carregam em tags `<img>`, resultando em imagem quebrada.

## Correção

### `src/components/cadastro/proposta/PropostaMidiaGrid.tsx`

**A) Área principal do modal galeria (linhas 223-231)**
- Verificar se `fotos[galeriaIndex].tipo` começa com `video_360`
- Se sim, renderizar `<video>` com controles em vez de `<img>`

**B) Thumbnails (linhas 257-270)**
- Mesma verificação: se o tipo é vídeo, renderizar `<video>` no thumbnail (muted, sem controles) ou um ícone de play sobre fundo escuro

**C) Thumbnails na grid de preview (linhas 122-143)**
- Verificar se a foto é um vídeo e renderizar adequadamente com ícone de play

Lógica auxiliar:
```ts
const isVideo = (tipo?: string) => tipo?.startsWith('video_360');
```

No render principal:
```tsx
{isVideo(fotos[galeriaIndex].tipo) ? (
  <video src={url} controls autoPlay className="max-h-[70vh] max-w-full object-contain" playsInline />
) : (
  <img src={url} alt={...} className="max-h-[70vh] max-w-full object-contain" />
)}
```

| Arquivo | Ação |
|---|---|
| `src/components/cadastro/proposta/PropostaMidiaGrid.tsx` | Detectar vídeos e renderizar `<video>` em vez de `<img>` na galeria, thumbnails e preview |


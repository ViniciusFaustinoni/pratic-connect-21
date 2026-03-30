

# Suporte a Vídeo no VisualizadorFoto

## Problema

O componente `VisualizadorFoto` renderiza apenas `<img>`. Quando um vídeo 360° é incluído na lista de mídias, ele aparece como imagem quebrada mostrando o alt text "video_360".

Isso afeta:
- `SinistroAnalise.tsx` — mistura fotos e vídeos no array `todasFotos` sem filtrar
- Qualquer outro local que passe vídeos para o `VisualizadorFoto`

## Solução

Tornar o `VisualizadorFoto` capaz de exibir tanto fotos quanto vídeos, detectando automaticamente pelo URL ou por um campo opcional `tipo`.

## Alterações

### 1. `src/components/analise/VisualizadorFoto.tsx`

- Expandir a interface para aceitar `tipo?: string` opcional em cada item
- Criar helper `isVideo(item)` que verifica se `tipo` começa com `video` ou se a URL contém extensões de vídeo (`.mp4`, `.webm`, `.mov`)
- No conteúdo principal: se for vídeo, renderizar `<video controls autoPlay playsInline>` em vez de `<img>` (sem zoom/rotação para vídeos)
- Nos thumbnails: se for vídeo, renderizar ícone de Play em vez de thumbnail de imagem
- Esconder controles de zoom/rotação quando o item atual for vídeo

### 2. `src/pages/eventos/SinistroAnalise.tsx` (linha ~1180)

- Ao montar o array `todasFotos` para o `VisualizadorFoto`, passar o campo `tipo` de cada foto para que o visualizador saiba distinguir vídeos

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/analise/VisualizadorFoto.tsx` | Adicionar suporte a vídeo (detecção + renderização) |
| `src/pages/eventos/SinistroAnalise.tsx` | Passar `tipo` no array de fotos do visualizador |


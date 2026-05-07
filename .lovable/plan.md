## Diagnóstico

O app já tem `lib/imageCompressor.ts` com perfis adaptativos por `deviceMemory` (low: 960px/q0.6, mid: 1280px/q0.7, high: 1600px/q0.72) e usa `createImageBitmap` para baixar o peak RAM. Funciona bem na autovistoria pública e no `InstaladorChecklist`. Mas restam 5 brechas que causam o erro de "memória insuficiente" em celulares antigos do instalador:

| # | Ponto | Problema |
|---|---|---|
| 1 | `CapturaFoto.tsx` | Sem compressão, sem `revokeObjectURL` — usado em toda vistoria |
| 2 | `InstaladorChecklist.tsx:613` | Branch de upload sem chamar `compressImage` |
| 3 | Vários `useState<{file, preview}[]>` | Blob URLs nunca revogadas ao remover/desmontar |
| 4 | `imageCompressor` | Sem fallback ao detectar OOM (retorna o arquivo original — pior caso) |
| 5 | Seleção múltipla | Compressões em paralelo competem pelo mesmo heap |

## Mudanças

### 1. `CapturaFoto.tsx` — comprimir + revogar

Substituir `URL.createObjectURL(file)` direto por:
- `compressImage(file)` antes de gerar preview
- `useEffect` cleanup que chama `revokePreview(value)` no unmount
- Aviso visual "Otimizando…" durante compressão

### 2. `InstaladorChecklist.tsx` — comprimir branch faltante

No bloco da linha ~611–617 (upload direto de ressalva), aplicar `compressImage` igual aos demais blocos (455, 642). É só replicar o padrão já existente no arquivo.

### 3. `imageCompressor.ts` — retry em escala menor

Quando `compressViaImageBitmap` falhar (OOM no Android), antes de cair para o caminho legado pesado, tentar de novo no mesmo bitmap path com perfil **um nível abaixo** (high→mid→low). Hoje só temos uma tentativa.

Adicionar também um **mutex global** (semáforo de 1 compressão simultânea) para evitar 4–6 imagens sendo decodificadas em paralelo quando o usuário seleciona várias de uma vez.

### 4. `imageCompressor.ts` — modo "memória crítica"

Antes de cada compressão, ler `(performance as any).memory?.usedJSHeapSize / jsHeapSizeLimit`. Se > 0.75, **forçar perfil `low`** independentemente do device, e (após upload) sugerir `gc()` indireto soltando referências (`bitmap = null` já é feito).

### 5. Hook `usePhotoList` (novo, opcional)

Pequeno utilitário `useObjectUrl(file)` que cria a Object URL no `useEffect` e revoga no cleanup automaticamente. Migrar `CapturaFoto`, `VideoCapture` e onde houver `{file, preview}[]` para usar — elimina vazamentos por esquecimento.

Escopo desta entrega: criar o hook e migrar `CapturaFoto` e `InstaladorChecklist` (`fotosRessalva`). Outros consumidores ficam para uma 2ª passada.

## Validação manual

1. No celular antigo (ou DevTools → Performance → CPU 4×, Memory throttling): abrir uma vistoria, tirar 8 fotos seguidas.
2. Verificar console: cada `[compressImage]` deve mostrar peso final ≤ 500 KB no perfil low.
3. Memory tab: heap não pode crescer linearmente — deve estabilizar (= revoke funcionando).
4. Selecionar 5 fotos da galeria de uma vez: devem comprimir **uma de cada vez**, sem travar.

## Arquivos

- `src/components/vistoriador/CapturaFoto.tsx` (compressão + cleanup)
- `src/pages/instalador/InstaladorChecklist.tsx` (branch ~613)
- `src/lib/imageCompressor.ts` (retry escalonado + mutex + modo crítico)
- `src/hooks/useObjectUrl.ts` (novo)

Sem mudanças de schema, edge function ou backend.



# Corrigir Preview e Confirmação do Vídeo Antes do Upload

## Problema
Quando o vídeo termina de gravar, o componente `VideoCapture` chama `onCapture(file)` imediatamente no `mediaRecorder.onstop` (linha 88), iniciando o upload sem dar chance ao usuário de assistir o vídeo gravado e decidir se está bom.

O usuário não consegue:
1. Ver o vídeo durante a gravação (o preview ao vivo funciona, mas fica coberto por overlay escuro)
2. Revisar o vídeo gravado antes de confirmar o envio

## Correções

### `src/components/instalador/VideoCapture.tsx`

**A) Separar gravação de upload** — Adicionar estado intermediário `pendingFile`:
- No `mediaRecorder.onstop`: setar `previewUrl` e guardar o arquivo em `pendingFile`, mas **não** chamar `onCapture`
- Mostrar o vídeo gravado com controles de playback
- Adicionar dois botões: **"Confirmar e Enviar"** (chama `onCapture(pendingFile)`) e **"Gravar Novamente"** (limpa e volta ao estado inicial)

**B) Melhorar preview ao vivo durante gravação**:
- Reduzir opacidade do overlay de `bg-black/40` para `bg-black/20` para o vídeo ao vivo ser mais visível

**Fluxo revisado**:
```text
[Gravar Vídeo] → [Gravando... (preview ao vivo)] → [Parar] 
→ [Preview do vídeo com play] → [Confirmar e Enviar | Gravar Novamente]
→ [Upload em andamento] → [✓ Enviado]
```

## Arquivo alterado

| Arquivo | Ação |
|---|---|
| `src/components/instalador/VideoCapture.tsx` | Adicionar estado `pendingFile`, separar preview de upload, botões de confirmar/regravar |


## Diagnóstico

No fluxo **Vistoria Interna** (PYL9A01), o usuário seleciona o vídeo da galeria → vê o player com os botões **"Confirmar e Enviar"** / **"Gravar Novamente"** → clica em **"Próximo"** e recebe o toast *"Falta enviar: vídeo 360°"*.

**Causa**: ao escolher um arquivo da galeria, o `VideoCapture` apenas guarda em estado local (`pendingFile` + `previewUrl`) — o upload só dispara quando o usuário clica explicitamente em "Confirmar e Enviar" (`handleConfirmUpload` → `onCapture` → `handleVideoCapture` → `uploadVideoMutation`). Ou seja, o vídeo fica em "rascunho local" até o clique explícito.

O DB confirma: `vistorias.video_360_url` para PYL9A01 foi gravado às `13:09:48 UTC`, ou seja, ~3 min DEPOIS do screenshot (10:06 BRT = 13:06 UTC). No momento do screenshot o vídeo ainda não tinha sido enviado — o toast estava correto, mas a UX é enganosa: vendo o player rodando, o coordenador acha que "já está pronto" e tenta avançar.

A etapa de revisão manual (`Confirmar e Enviar`) faz sentido para **gravação ao vivo** (técnico em campo pode querer regravar antes de enviar), mas **não faz sentido para seleção de galeria no fluxo interno** — o coordenador já escolheu o arquivo conscientemente.

## Correção proposta

Em `src/components/instalador/VideoCapture.tsx`, no `handleFileUpload` (linha 245-272):

- Quando `cameraOnly === false` (modo Vistoria Interna), após validar o arquivo selecionado da galeria, disparar automaticamente `onCapture(file)` — pulando o estado `isPendingReview`. Mantém o `previewUrl` local apenas para exibição enquanto o upload roda.
- O `confirmed` (controlado pelo pai via `!!videoUrl && !uploadingVideo`) continua sendo a fonte da verdade do "enviado".
- Para gravação ao vivo (`startRecording`) o fluxo **não muda** — mantém a revisão manual via `isPendingReview` para permitir regravar antes de enviar (importante para técnico em campo, que não tem o arquivo "pronto" como na galeria).

Resultado: no Vistoria Interna, selecionar da galeria = subir imediatamente. O coordenador vê spinner com progresso, depois o check verde, e o "Próximo" funciona naturalmente.

## Arquivos

- `src/components/instalador/VideoCapture.tsx` — ajuste em `handleFileUpload` para auto-disparar `onCapture` quando `cameraOnly=false`.

Nenhuma mudança em hooks, mutations, edge functions ou DB.

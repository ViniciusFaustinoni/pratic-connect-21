

## Live preview de vídeo — auditoria e padronização total

### Estado real (após inspeção do código)

| Local | Componente | Live preview hoje? |
|---|---|---|
| Autovistoria pública (`AutovistoriaCotacao.tsx`) | `VideoCapture` (instalador) | ✅ Já tem |
| Autovistoria do associado (`Autovistoria.tsx`) | `VideoCapture` | ✅ Já tem |
| Cotação pública vídeo 360 (`CotacaoPublicaCompleta.tsx`) | `VideoCapture` | ✅ Já tem |
| Vistoria de evento — regulador (`VistoriaEventoMidias.tsx`) | `VideoCapture` | ✅ Já tem |
| Instalador — vistoria completa (`ExecutarVistoriaCompleta.tsx`) | `VideoCapture` | ✅ Já tem |
| Instalador — retirada (`ExecutarRetirada.tsx`) | `VideoCapture` | ✅ Já tem |
| Vistoria presencial sinistro (`VistoriaPresencialDialog.tsx`) | MediaRecorder próprio | ✅ Já tem |
| **Instalador — checklist legacy (`InstaladorChecklist.tsx`)** | `<input capture>` cru, sem preview | ❌ **Falha** |
| **Sinistro — vistoria de evento etapa 1 (`EventoEtapa1Vistoria.tsx`)** | `<input capture>` cru, sem preview | ❌ **Falha** |
| **Sinistro — registrar atualização (`RegistrarAtualizacaoDialog.tsx`)** | `<input>` cru | ❌ **Falha** |

Ou seja: o `VideoCapture` já cobre 7 dos 10 pontos com live preview real. Restam 3 telas usando o `<input type="file" capture>` legado, que delega ao app de câmera nativo e não dá preview embutido.

Adicionalmente, verifiquei o `VideoCapture` em si e ele já tem:
- Live preview com `<video autoPlay muted playsInline>` + attach via `useEffect` (resolve o race condition de mount).
- Detecção de in-app browser (WhatsApp/Instagram/Facebook/TikTok) com banner + botão "tentar de novo".
- Codec MP4/H.264 prioritário (Safari/iOS), fallback WebM.
- Cronômetro + "REC" pulsante + botão "Parar".
- Etapa de revisão "Confirmar e Enviar" / "Gravar Novamente".
- Limpeza correta dos tracks ao desmontar.

### O que vou fazer

#### 1. Substituir os 3 pontos restantes pelo `VideoCapture`

**a) `src/pages/instalador/InstaladorChecklist.tsx` (linhas ~1280–1327)**
Trocar o bloco do botão "Gravar Vídeo 360°" + `<input id="video-input">` por:
```tsx
<VideoCapture
  onCapture={handleVideoCapture}
  videoUrl={videoUrl}
  uploading={uploadingVideo}
  confirmed={!!videoUrl}
  maxDuration={120}
  label="Vídeo 360° do veículo"
  cameraOnly
/>
```
Remove o `getElementById` e o input cru.

**b) `src/components/evento/EventoEtapa1Vistoria.tsx`**
Duas instâncias de `<input type="file" accept="video/*" capture>` (linhas ~225 e ~346 — fluxo de substituição e fluxo normal). Trocar ambos pelo `VideoCapture` mantendo as props `video`, `setVideo`, `videoPreviewUrl`, `removeVideo`.

**c) `src/components/sinistros/RegistrarAtualizacaoDialog.tsx` (linha ~230)**
Trocar o `<input type="file" accept="video/*">` pelo `VideoCapture`. Esse é dialog interno do staff, mas ainda assim ganha live preview e é usado em campo.

#### 2. Pequena melhoria no `VideoCapture` (corrige um edge case)

Hoje, se o usuário não tem permissão de microfone mas tem de câmera, `getUserMedia({ video, audio: true })` falha inteiro. Vou adicionar fallback: se a primeira chamada falhar com `NotAllowedError` ou `NotFoundError` no áudio, tentar de novo com `audio: false` e mostrar aviso "vídeo sem áudio".

Também adicionar um `console.info` com `[VideoCapture] live stream attached` + dimensões reais do stream, para facilitar debugging via console quando o usuário relatar problema.

#### 3. Padronizar `InAppBrowserBanner` no topo das telas críticas

Telas onde o vídeo é obrigatório e o link costuma ser aberto via WhatsApp:
- `AutovistoriaCotacao.tsx` (já tem)
- `CotacaoPublicaCompleta.tsx` (já tem)
- `Autovistoria.tsx` do associado (verificar — adicionar se faltar)

### Critérios de aceitação

1. Em **todas** as 10 telas listadas acima, ao iniciar a gravação o usuário vê o que a câmera está capturando em tempo real, com cronômetro e botão "Parar" sempre visíveis.
2. Após parar, vídeo entra em modo "Confirmar e Enviar / Gravar Novamente".
3. `InstaladorChecklist`, `EventoEtapa1Vistoria` e `RegistrarAtualizacaoDialog` não usam mais `<input capture>` cru para vídeo.
4. Em WhatsApp/Instagram in-app browser: banner aparece antes; se a câmera falhar, instrução clara para abrir no Safari/Chrome + opção "Gravar mesmo assim".
5. Se o microfone for negado, vídeo continua gravando sem áudio (com aviso).
6. Tracks são liberados (`getTracks().stop()`) ao sair / refazer / cancelar — sem LED de câmera ligado em background.

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/components/instalador/VideoCapture.tsx` | + fallback sem áudio, + log de debug |
| `src/pages/instalador/InstaladorChecklist.tsx` | Substitui input cru por `<VideoCapture>` |
| `src/components/evento/EventoEtapa1Vistoria.tsx` | Substitui 2 inputs crus por `<VideoCapture>` |
| `src/components/sinistros/RegistrarAtualizacaoDialog.tsx` | Substitui input cru por `<VideoCapture>` |
| `src/components/associado/Autovistoria.tsx` | + `<InAppBrowserBanner>` no topo (se faltar) |

### Fora de escopo

- Streaming ao vivo para servidor durante gravação.
- Edição/corte do vídeo no navegador.
- Compressão pesada via ffmpeg.wasm (mantém regravação manual se ficar grande).
- Múltiplas câmeras simultâneas.


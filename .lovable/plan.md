

## Causa raiz (definitiva)

O `<video ref={videoPreviewRef}>` em `VideoCapture.tsx` está dentro do branch `isRecording ? (...) : ...` (linhas 241-271). O fluxo de `startRecording` é:

```
1. getUserMedia() resolve com stream
2. acessa videoPreviewRef.current  ← ainda é NULL (vídeo não montado)
3. if (videoPreviewRef.current) { ... }  ← pulado silenciosamente
4. setIsRecording(true)  ← React MONTA o <video> agora, sem srcObject
5. usuário vê tela preta até parar a gravação
```

O `srcObject` **nunca chega ao elemento**. Quando o usuário para de gravar, criamos um Object URL do blob final e aí sim o `<video src=...>` da tela "hasVideo" aparece — daí a impressão de que "só vê depois que termina".

Em iOS/in-app, o bug é igual; só fica mascarado porque o usuário acha que "é restrição de navegador".

## Correção raiz (em VideoCapture.tsx)

**1. Manter o `<video>` sempre montado** (deixa de ser condicional). Em vez de aparecer só quando `isRecording`, fica sempre no DOM e só alterna visibilidade/contêiner via CSS. Garante que `videoPreviewRef.current` nunca seja `null` quando `startRecording` rodar.

**2. Atribuir `srcObject` via `useEffect`** que reage a um novo state `liveStream`:

```ts
const [liveStream, setLiveStream] = useState<MediaStream | null>(null);

useEffect(() => {
  const v = videoPreviewRef.current;
  if (!v || !liveStream) return;
  v.srcObject = liveStream;
  v.muted = true;
  v.playsInline = true;
  v.play().catch(err => console.warn('[VideoCapture] play():', err));
}, [liveStream]);
```

**3. `startRecording` simplificado**: chama `getUserMedia`, faz `setLiveStream(stream)` e `setIsRecording(true)`. O `useEffect` cuida do attach + play assim que o React confirma o ref.

**4. Limpeza**: ao parar/desmontar, `setLiveStream(null)` e `v.srcObject = null` (já existe parcialmente). Garantir que tracks param sempre.

**5. iOS hardening reforçado**: `v.setAttribute('playsinline', '')` + `v.setAttribute('webkit-playsinline', '')` antes do `play()` (o JSX `playsInline` cobre isso, mas reforço programático ajuda em WebViews antigos).

## Por que isso resolve definitivamente

- `videoPreviewRef.current` **sempre existe** quando o stream chega → fim do "if pulado silenciosamente".
- O `useEffect` desacopla o attach do timing do gesto → React garante que o DOM já refletiu o ref.
- Funciona idêntico em Chrome Android, Safari iOS e in-app (a falha real de in-app continua sendo tratada pelo `cameraBlocked`).

## Arquivo a editar
- `src/components/instalador/VideoCapture.tsx` — único arquivo. Não toca em `AutovistoriaCotacao.tsx`, `ExecutarVistoriaCompleta.tsx`, `ExecutarRetirada.tsx` nem `InstaladorChecklist.tsx` — todos consomem o componente igual e herdam a correção.

## Validação
1. Cotação pública (mobile real Android Chrome) — clicar "Gravar Vídeo": preview da câmera aparece **imediatamente**, com timer e contorno HUD.
2. iOS Safari — mesmo comportamento.
3. WhatsApp/Instagram in-app — continua mostrando o aviso "abrir no Chrome/Safari" quando `getUserMedia` falha (sem regressão).
4. Parar a gravação → vídeo final aparece com controles + botão "Confirmar e Enviar".


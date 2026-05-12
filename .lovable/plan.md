## Problema

No `VideoCapture.tsx` (usado em Vistoria 360°, Instalação e Manutenção do app do instalador), o preview da câmera ao vivo e o player do vídeo já gravado usam `aspect-video` (16:9). Em celular no modo retrato, isso resulta em uma faixa horizontal pequena (~30% da tela), exatamente como mostra o screenshot enviado.

## Solução

Trocar o contêiner de preview por uma área **vertical grande**, ocupando a maior parte da tela durante a gravação e revisão, sem mexer em qualquer lógica de captura, upload ou compressão.

### Mudanças no `src/components/instalador/VideoCapture.tsx`

1. **Contêiner principal do preview** (hoje `aspect-video`):
   - Trocar para `aspect-[3/4] sm:aspect-video` com `min-h-[60vh] sm:min-h-0` para que no celular ocupe ~60% da altura visível (≈ 3x a área atual) e no desktop mantenha 16:9.
   - Manter `object-cover` no `<video>` ao vivo e `object-contain` no player de revisão.

2. **Modo gravação imersivo (opcional, dentro do mesmo contêiner)**:
   - Quando `isRecording === true`, aplicar `fixed inset-0 z-50 rounded-none` no contêiner para virar tela cheia "estilo câmera nativa", com HUDs (timer no topo, botão Parar no rodapé) já existentes — só precisam dos paddings de safe-area (`pt-[env(safe-area-inset-top)]`, `pb-[env(safe-area-inset-bottom)]`).
   - Sair do fullscreen automaticamente em `stopRecording`.

3. **HUD do botão "Parar Gravação"**:
   - Aumentar para `size="lg"` e botão circular vermelho (mais visível em fullscreen), mantendo o handler atual `stopRecording`.

4. **Player de revisão (`hasVideo && !isRecording`)**:
   - Manter o mesmo contêiner ampliado (mesma `aspect-[3/4]` + `min-h-[60vh]`), garantindo que o técnico revise o vídeo no mesmo tamanho em que foi gravado.

### O que NÃO muda

- `getUserMedia`, `MediaRecorder`, bitrate adaptativo, fallback sem áudio, lógica de upload/confirmação, revogação de blob, detecção de in-app browser e mensagens de erro permanecem intactos.
- Estados, refs e efeitos do componente (incluindo o attach do stream via `useEffect`) ficam idênticos.
- Nenhuma alteração nos componentes que consomem `VideoCapture` (`VistoriaFotoSequencial`, `FotosManutencao`, fluxo de instalação) — a API do componente não muda.

## Arquivo afetado

- `src/components/instalador/VideoCapture.tsx` (apenas classes Tailwind do contêiner e do HUD)

## Validação

- Preview no celular (Moto G 15, viewport ~360×800): área de gravação passa de ~200px para ~480px de altura.
- Em modo paisagem/desktop: continua 16:9 sem distorção.
- Gravação, parar, revisar, gravar novamente e enviar funcionam igual ao fluxo atual.

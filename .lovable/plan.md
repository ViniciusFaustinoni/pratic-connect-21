

## Causa raiz da mensagem "Devido à insuficiência de memória, não foi possível concluir a operação anterior"

**Essa mensagem NÃO vem do nosso código** — é uma notificação **nativa do Chrome no Android** (string oficial: "Due to insufficient memory, the previous operation could not be completed"). Ela aparece quando:

1. O Chrome **mata o processo da aba** porque o sistema operacional ficou sem RAM, e
2. Ao restaurar, a "operação anterior" (no caso, o input `<input type="file" capture="environment">` abrindo a câmera nativa) não pôde ser concluída.

### Por que acontece especificamente na autovistoria
Olhando `src/components/cotacao-publica/AutovistoriaCotacao.tsx` + `src/lib/imageCompressor.ts`, identifico 3 picos de memória que, em celulares de entrada (1-2GB RAM, Android Go, navegadores embarcados como WhatsApp/Instagram), estouram:

| Pico | Onde | Custo |
|---|---|---|
| **Câmera nativa do Android** abre em outro processo | tag `<input capture="environment">` | SO mata a aba do Chrome em background para liberar RAM para a câmera |
| **`compressImage`** decodifica a foto inteira em `<canvas>` | `imageCompressor.ts` linha 74-76 | Foto de 12MP = ~48MB de RGBA descomprimido no canvas |
| **Vídeo 360°** (etapa 1) precedeu as fotos | `VideoCapture.tsx` mantém blob do vídeo + preview | Vídeo de até 2 min em alta qualidade pode passar de 100MB |

Quando Diego (LTW1H22) gravou o vídeo 360° e depois tentou tirar a primeira foto, o Chrome já estava perto do limite — abrir a câmera fez o SO matar a aba.

### Confirmação no código
- `AutovistoriaCotacao.tsx:135` comprime apenas se `> 500KB`, mas usa `maxWidth: 1920` (alto).
- O `videoUrl` (blob URL) é mantido vivo (linha 45) durante toda a etapa 2 das fotos, pressionando o heap.
- Não há gating por dispositivo: usuários em Android Go recebem a mesma resolução de processamento que iPhone Pro.

---

## Plano de correção (otimização para celulares fracos)

### 1. Detectar dispositivos com pouca memória e degradar graciosamente
Criar `src/hooks/useDeviceCapability.ts` lendo `navigator.deviceMemory` e `navigator.hardwareConcurrency`:
- `lowEnd`: `deviceMemory <= 2` ou `hardwareConcurrency <= 4`.
- Em `lowEnd`, aplicar perfis mais agressivos de compressão e UI.

### 2. Compressão mais agressiva e por slices em `imageCompressor.ts`
- Reduzir `maxWidth/maxHeight` de **1920 → 1280** (e 960 em low-end). 1280px é mais que suficiente para vistoria/OCR de chassi/odômetro.
- `quality` de 0.75 → 0.7 (0.6 em low-end).
- Reduzir o threshold "já pequeno" de 500KB → 250KB para sempre passar fotos pelo canvas em low-end (libera o `File` original mais cedo).
- Após `canvas.toBlob`, **chamar explicitamente `img.src = ''`** antes do `URL.revokeObjectURL` para forçar GC do bitmap decodificado.

### 3. Liberar o vídeo 360° antes da etapa de fotos
Em `AutovistoriaCotacao.tsx`, ao avançar para a etapa 2:
- Revogar o blob URL do preview do vídeo (mantém só a `arquivo_url` do servidor).
- Limpar `pendingFile` no `VideoCapture` após upload bem-sucedido (hoje fica em estado).

### 4. Banner orientativo para low-end
Quando `lowEnd === true`, mostrar antes da câmera abrir:
> "Para evitar travamentos, feche outros apps antes de tirar a foto. Detectamos que seu aparelho tem memória limitada."

E recomendar **agendamento presencial** como alternativa, com botão direto.

### 5. Resiliência: persistir progresso já existe, reforçar UX após crash
A reidratação por `useFotosCotacaoVistoria` já recupera fotos do servidor (linhas 63-99). Após detectar que a página foi restaurada (usar `PerformanceNavigationTiming.type === 'back_forward'` ou `document.wasDiscarded`), exibir toast: "Continuamos de onde você parou. Toque para fotografar a próxima."

### 6. Telemetria mínima
Logar `navigator.deviceMemory`, `userAgent` e `performance.memory.usedJSHeapSize` (Chrome) no momento do upload — para auditarmos quais dispositivos estouram. Console log apenas, sem persistir PII.

---

## Arquivos a editar
- `src/hooks/useDeviceCapability.ts` *(novo)* — detecção de low-end.
- `src/lib/imageCompressor.ts` — perfis adaptativos + GC explícito do bitmap.
- `src/components/cotacao-publica/AutovistoriaCotacao.tsx` — revogar vídeo ao avançar, banner low-end, detecção de restauração da aba.
- `src/components/instalador/VideoCapture.tsx` — liberar `pendingFile` após upload confirmado.

## O que **não** podemos resolver
A mensagem em si é exibida pelo Chrome **antes** do nosso JS rodar (a aba foi descartada). Não dá para suprimi-la — só para **reduzir a probabilidade de ocorrer** e **garantir que, ao reabrir, o usuário continue de onde parou**. Com as mudanças acima, a expectativa é eliminar o caso em ~95% dos celulares Android Go/entry-level.

## Validação
1. Testar autovistoria em emulador Android com 1GB RAM (Android Studio → Pixel 2 com `-memory 1024`) e medir uso de heap antes/depois.
2. Cotação real em aparelho de baixo custo (ex.: Samsung A03/A04) — concluir vídeo + 4 fotos sem tela branca.
3. Conferir log no console que mostra perfil aplicado: `[compressImage] Perfil low-end ativo: maxWidth=960`.
4. Forçar discard via `chrome://discards` e verificar que a página retoma do ponto certo.


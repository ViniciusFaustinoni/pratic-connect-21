

## Causa raiz

**Bug #1 — Overlay bloqueia visão da câmera ao vivo**  
`src/components/instalador/VideoCapture.tsx` linhas 221–239: durante a gravação, o `<div className="absolute inset-0 flex items-center justify-center bg-black/20">` cobre o vídeo inteiro com timer + botão "Parar Gravação" centralizados no meio. O preview ao vivo (`<video ref={videoPreviewRef}>`) está renderizando, mas fica atrás de uma camada escura com elementos no centro — exatamente onde o usuário precisa enxergar o veículo.

**Bug #2 — Duas fontes de instrução conflitantes**  
- Bloco "Instruções de Gravação" em `AutovistoriaCotacao.tsx` linhas 291–316 (7 passos: começa pela **frente**).  
- Rodapé fixo no `VideoCapture.tsx` linha 335–337 ("Inicie pelo **chassi** e faça uma volta completa…").  

São conflitantes (frente vs chassi) e redundantes. A função `getInstrucoesVideo360(tipoVeiculo)` é a fonte de verdade canônica (varia por moto/carro) — o rodapé hardcoded do `VideoCapture` é resíduo legado.

## Correção

### Fix 1 — `src/components/instalador/VideoCapture.tsx` (gravação ao vivo limpa)

Mover timer e botão "Parar" para **fora da área do vídeo**, em barras finas no topo e rodapé, sem overlay escuro cobrindo a imagem:

- **Topo (barra fina, fundo gradiente preto→transparente)**: bolinha vermelha pulsante + `00:42 / 02:00`. Ocupa só ~40px de altura.
- **Rodapé (barra fina)**: botão "Parar Gravação" centralizado, com fundo gradiente transparente→preto.
- **Remover** o `bg-black/20` que cobre tudo.
- Vídeo ao vivo `<video>` permanece full-area (`object-cover`), totalmente visível.

Resultado: usuário enxerga 100% do que a câmera captura, com HUD discreto nas extremidades (padrão Instagram/TikTok/WhatsApp Stories).

### Fix 2 — Eliminar instrução duplicada

**Remover** o `<p>` da linha 335–337 do `VideoCapture.tsx`:
```tsx
<p>Inicie pelo chassi e faça uma volta completa de 360° no veículo</p>
```
**Remover** também o `<span>Máximo {formatTime(maxDuration)}</span>` da linha 324–326 (estado idle) — a duração já consta no bloco principal de instruções.

A única fonte de verdade passa a ser o bloco "Instruções de Gravação" (de `getInstrucoesVideo360`) renderizado pelo `AutovistoriaCotacao.tsx` (e equivalentes). O `VideoCapture` vira componente puramente funcional, sem narrativa própria.

### Auditoria de outros consumidores

Verificar se algum outro lugar usava aquele rodapé como única instrução (ex.: `Autovistoria.tsx` do associado já tem seu próprio bloco de instruções). Se houver consumidor sem instruções externas, o bloco precisa ser adicionado lá — não reintroduzido no componente.

## Não mexer

- Lógica de `MediaRecorder`, mime-types MP4/WebM (corrigido recentemente).
- `getInstrucoesVideo360` — é a fonte de verdade.
- Layout de fora-da-gravação (placeholder idle, preview pós-gravação).

## Validação

1. Abrir link público de cotação → etapa autovistoria → "Gravar Vídeo".
2. Durante gravação: deve ser possível enxergar o veículo claramente; timer no canto superior, botão "Parar" no rodapé, **sem** camada escura no meio.
3. Conferir que existe **uma única** lista de instruções na tela (a numerada 1–7), sem texto extra de "inicie pelo chassi" embaixo do player.
4. Testar em iPhone Safari (que foi o caso do print).

## Resultado

Vistoriador grava enxergando o veículo em tempo real. Instrução única e consistente — sem o conflito "frente vs chassi".


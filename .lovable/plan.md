## O que entendi

Hoje, na autovistoria pública (`AutovistoriaCotacao.tsx`):

1. Foto 1 (**motor**) → upload OK → auto-avança para foto 2 (**chassi**) após 300 ms.
2. Foto 2 (**chassi**) → upload OK → o `setFotoAtualIndex` tenta avançar mas trava na própria foto 2 (`Math.min(prev+1, totalFotos-1)`), então o painel continua mostrando o chassi com selo "Foto enviada".
3. O bloco do **vídeo 360°** só aparece **abaixo**, depois do botão "Refazer Foto" e das instruções, condicionado a `todasFotosEnviadas`.

Em telas pequenas o associado não vê o vídeo aparecer e acredita que terminou. É exatamente o que você descreveu.

## O que vou mudar

Transformar o fluxo em uma máquina de etapas linear: `fotos → video → finalizar`. Assim que a foto do **chassi** é aceita (sem mismatch de placa / sem falha de OCR), a tela troca para a etapa do vídeo automaticamente — mesma UX do avanço entre as fotos.

### Mudanças em `src/components/cotacao-publica/AutovistoriaCotacao.tsx`

1. **Novo estado `etapa`** (`'fotos' | 'video'`), derivado:
   - Inicia em `'fotos'`.
   - Vira `'video'` automaticamente quando `todasFotosEnviadas && !videoUrl`.
   - Vira `'fotos'` se o usuário tocar num número de etapa anterior (refazer uma foto) — preserva a possibilidade de refazer.

2. **Auto-advance no `handleFileChange`** (linha ~267):
   - Se a foto recém-enviada era a **última** (`fotoAtualIndex === totalFotos - 1`) e tudo passou (sem `bloqueadoPorPlaca`, sem `odometroOcrFalhou`), em vez de tentar `prev + 1`, setar `etapa = 'video'`.
   - Caso contrário, mantém o comportamento atual (avança índice da próxima foto).

3. **Reidratação** (linha ~118):
   - Se ao reabrir o link todas as fotos já estão enviadas e o vídeo ainda não, abrir já em `etapa = 'video'`.
   - Se vídeo também já existe, abrir em `'fotos'` mostrando a última (para revisão) — finalizar continua sticky.

4. **Render**:
   - Quando `etapa === 'video'`: esconder o painel de fotos (mantém só a barra de progresso/numerada no topo, que já existe e permite voltar) e exibir o **bloco do vídeo 360°** como conteúdo principal, com `scrollIntoView` suave ao montar.
   - Mantém o botão "Refazer" do vídeo e o `onReset` que zera `videoUrl`, voltando o estado para `'video'` (não para fotos).
   - Botão "Finalizar" continua sticky igual hoje, aparecendo quando `todasEnviadas`.

5. **Toast de transição**: ao virar `'video'` automaticamente, dispara um `toast.success('Fotos concluídas! Agora grave o vídeo 360°.')` para reforçar a mudança.

### Não muda

- Config canônica (`motor + chassi + video_360`), validações de placa/OCR, upload, finalização (`finalizarMutation`), persistência, hidratação de sessão anterior.
- Componente `Autovistoria.tsx` do associado interno (escopo é só a autovistoria pública da cotação, que é a tela onde o problema acontece).
- A etapa numérica clicável no topo continua permitindo voltar manualmente para refazer qualquer foto.

## Validação

Após implementar, vou testar no preview com a credencial de diretor: abrir uma cotação com autovistoria pendente, simular as 2 fotos e confirmar que a tela troca sozinha para o vídeo, sem precisar rolar.
## Diagnóstico

Investiguei o serviço `LTB4J74` (instalação com encaixe, ID `0edf10a4-...`) e encontrei o problema.

A atribuição no mapa **funcionou** — só que foi para o técnico **errado**:

- `servicos.profissional_id` = **WALLACE NUNES** (`f6313b28-...`)
- `instalacoes.instalador_id` = **WALLACE NUNES**
- Log `servicos_atribuicoes_log`: "Atribuição manual pelo painel" às 16:35:13 UTC
- O `[TESTE] VISTORIADOR` (`46477310-...`) **não tem nenhum serviço atribuído** — por isso o app dele não recebeu nada.

### Por que caiu no técnico errado

Os dois vistoriadores estão com posição GPS praticamente idêntica:

| Técnico | Lat | Lng | em_servico |
|---|---|---|---|
| WALLACE NUNES | -22.9193252 | -43.4167186 | true |
| [TESTE] VISTORIADOR | -22.9193766 | -43.4168007 | true |

Distância entre eles: **~10 metros**.

A função `handleTaskDragEnd` em `src/components/mapa/MapaVistoriasContent.tsx` (linhas 501–524) pega o técnico **mais próximo** do ponto onde a tarefa foi solta, dentro de um raio de 5 km. Com dois marcadores praticamente colados, qualquer pequeno desvio do mouse faz cair no Wallace em vez do TESTE.

O `AlertDialog` de confirmação mostra o nome do técnico antes de aplicar (linha 1454), mas é fácil clicar "Confirmar" sem notar quando há sobreposição.

## Plano de correção

### 1. Detectar sobreposição e forçar escolha explícita

Em `handleTaskDragEnd` (e no equivalente `handleTecnicoDragEnd`):

- Após encontrar o técnico mais próximo, verificar se existem **outros técnicos a menos de ~150 m** dele.
- Se houver, em vez de abrir direto o dialog de confirmação, abrir um novo **dialog de seleção** listando todos os técnicos sobrepostos (nome, distância, nº de tarefas no dia) para o coordenador escolher manualmente.
- Se não houver sobreposição, mantém o fluxo atual.

### 2. Reforçar o dialog de confirmação atual

No `AlertDialog` de `assignConfirmation` (linhas 1447+):

- Destacar o nome do técnico em fonte maior / badge colorido.
- Mostrar também a foto/iniciais e o telefone, para o coordenador conferir antes de confirmar.

### 3. Ajustar o ícone arrastável

Quando dois ou mais marcadores de técnico estão a < 50 m um do outro, aplicar um leve offset visual (spider) ou badge "+N" para deixar claro que há sobreposição — evita a ambiguidade na origem.

### 4. (Opcional, fora deste escopo) Reatribuir o serviço atual

Se o coordenador quiser, posso já mover o serviço `LTB4J74` do Wallace para o `[TESTE] VISTORIADOR` agora, para o teste continuar.

## Arquivos afetados

- `src/components/mapa/MapaVistoriasContent.tsx` — lógica drag-end, novo dialog de seleção, reforço do dialog de confirmação, offset visual de marcadores sobrepostos.

## Perguntas

1. Quer que eu também reatribua o serviço `LTB4J74` para o `[TESTE] VISTORIADOR` agora (item 4)?
2. Para o item 3 (offset de marcadores sobrepostos), prefere "spider" (abre em leque ao clicar) ou apenas badge "+N" no marcador?
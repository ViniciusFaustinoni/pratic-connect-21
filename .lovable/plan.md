

## Plano: Atribuição via Drag-and-Drop Individual + Badge de Contagem no Técnico

### Entendimento

O coordenador arrasta **uma tarefa por vez** (o pin da tarefa no mapa) e solta sobre o técnico para atribuí-la. O ícone do técnico deve exibir um **badge numérico** com a quantidade de tarefas pendentes atribuídas a ele. A multi-seleção atual (selecionar várias e clicar no técnico) será substituída por este fluxo mais intuitivo de drag-and-drop individual.

### Mudanças

#### 1. Tornar os markers de tarefa arrastáveis (em vez do técnico)

Atualmente o **técnico** é draggable e ao soltar perto de uma tarefa, atribui. O requisito inverte a lógica: a **tarefa** é arrastada até o técnico.

- Markers de tarefas sem técnico (`!v.vistoriador_id`) e não realizadas passam a ser `draggable={true}` quando `atribuicaoManualAtiva`.
- No `dragend` da tarefa, calcular o técnico mais próximo (dentro de 5km). Se encontrar, abrir o diálogo de confirmação para atribuir aquela única tarefa.
- O marker do técnico deixa de ser `draggable`.

#### 2. Badge numérico no ícone do técnico

Substituir o `L.Icon` do técnico por um `L.DivIcon` que renderiza o SVG do vistoriador + um badge circular no canto superior direito com o número de tarefas pendentes (usando `tarefasPorTecnico`).

- Se 0 tarefas: sem badge.
- Se 1+: badge com fundo vermelho/laranja e número branco.
- Cache por `(color, count)` para performance.

#### 3. Remover multi-seleção

- Remover o state `servicosParaAtribuir` (array) e toda a lógica de toggle/seleção.
- Remover a barra amarela `renderAssignBar`.
- Remover os botões "Selecionar p/ Atribuir" dos popups e da lista lateral.
- Simplificar `handleTecnicoClick` — já não será necessário.
- Manter o diálogo de confirmação, mas sempre para 1 tarefa (como era originalmente, mas agora disparado pelo drag da tarefa).

#### 4. Legenda atualizada

Substituir o texto "Selecione tarefas e clique no técnico" por "Arraste a tarefa até o técnico para atribuir".

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `src/components/mapa/MapaVistoriasContent.tsx` | Inverter drag (tarefa draggable), remover multi-seleção, badge no técnico, legenda |
| `src/lib/rota-colors.ts` | Adicionar `createVistoriadorMarkerWithBadgeSvg(color, count)` ou usar `L.DivIcon` inline |

### Fluxo visual

```text
Coordenador abre mapa
  → Vê tarefas (pins coloridos) e técnicos (círculos azuis com badge "3")
  → Arrasta pin da tarefa ABC-1234 até o técnico João
  → Diálogo: "Atribuir ABC-1234 ao técnico João?"
  → Confirma → Badge do João muda de "3" para "4"
  → Arrasta outra tarefa DEF-5678 até João
  → Confirma → Badge muda para "5"
```

### O que NÃO muda
- Fluxo automático de atribuição (edge functions)
- Hook `useAtribuirServicoManual`
- Diálogo de cancelamento de rota
- View `view_vistorias_mapa`
- Tooltips numerados e cores por status


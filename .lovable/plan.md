
## Diagnóstico

Na rota `/monitoramento/mapa` → aba "Atribuições", ao tentar arrastar um técnico (pin com ícone de pessoa) para uma vistoria/rota, o gesto de arrastar é capturado pelo Leaflet e move o **mapa inteiro** em vez de iniciar o drag-and-drop do técnico.

### Causa raiz (a confirmar na próxima rodada)

O Leaflet, por padrão, intercepta todos os eventos de mouse/touch dentro do container do mapa para permitir pan/zoom. Marcadores customizados que precisam suportar drag-and-drop HTML5 (ou bibliotecas como react-dnd/dnd-kit) precisam:

1. **Desabilitar a propagação de eventos do Leaflet** no marcador específico via `L.DomEvent.disableClickPropagation` + `L.DomEvent.disableScrollPropagation` no elemento HTML do marker.
2. **Cancelar o drag do mapa** durante o início do drag do pin (`map.dragging.disable()` em `onDragStart` e `enable()` em `onDragEnd`).
3. Ou usar a propriedade nativa `draggable: true` do `L.Marker` do Leaflet se for um drag dentro do próprio mapa — mas aqui o destino é um card de rota fora do mapa, então precisa ser HTML5 DnD ou lib externa.

### Investigação necessária

1. Localizar o componente da aba "Atribuições" → `src/components/mapa/MapaVistoriasContent.tsx` (referenciado em `Mapa.tsx`).
2. Identificar como os técnicos são renderizados (Marker do Leaflet com `divIcon` HTML? Camada DOM sobreposta?) e como o drag está implementado hoje (HTML5 nativo `draggable`? `react-dnd`? `dnd-kit`?).
3. Verificar se já existe `L.DomEvent.disableClickPropagation` aplicado e se o `map.dragging` é controlado durante o drag.
4. Conferir se o destino (card de rota onde solta o técnico) está dentro ou fora do container do mapa — afeta a estratégia.

## Correção planejada

Depende da implementação atual, mas em geral:

### Se usa `L.Marker` + `divIcon` com HTML5 DnD
- No `eventHandlers.add` do Marker, chamar `L.DomEvent.disableClickPropagation(marker.getElement())` e `L.DomEvent.disableScrollPropagation(...)`.
- No `onDragStart` do elemento HTML interno, chamar `map.dragging.disable()`; no `onDragEnd`, `map.dragging.enable()`.
- Garantir `pointer-events: auto` no ícone e `cursor: grab/grabbing`.

### Se usa `dnd-kit` ou `react-dnd`
- Aplicar o sensor com `activationConstraint: { distance: 8 }` para distinguir clique de drag.
- Bloquear `map.dragging` no `onDragStart` do listener da lib.
- Usar `stopPropagation` no `onMouseDown` do handle de drag para o Leaflet não receber o evento.

### Melhoria de UX
- Cursor `grab` no hover do pin do técnico, `grabbing` durante drag.
- Feedback visual (sombra/escala) no card de rota quando o técnico for arrastado por cima.
- Em mobile (touch), garantir que o gesto de drag do pin não conflita com pan do mapa — talvez exigir long-press para iniciar drag.

## Arquivos prováveis

- `src/components/mapa/MapaVistoriasContent.tsx` (componente da aba Atribuições).
- Componente do marker do técnico (provável `VistoriadorMarker.tsx` ou similar dentro de `src/components/mapa/`).
- Componente do card de rota que recebe o drop.
- Possível hook compartilhado de drag (`useTecnicoDragAndDrop` ou similar).

## Não vou mexer

- Lógica de atribuição em si (edge function / mutation que persiste a atribuição).
- Renderização da aba "Equipe" (não tem drag).
- Mapa do instalador/regulador (rotas separadas).

## Resultado

Arrastar um técnico (segurar e mover o pin) inicia o DnD para os cards de rota, **sem mover o mapa**. Pan do mapa continua funcionando ao arrastar em qualquer outra área que não seja o pin do técnico. Funciona em desktop e mobile.

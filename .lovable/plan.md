

## Plano: Drag-and-drop do tecnico ate o servico + rota nas ruas

### Problema
O usuario espera arrastar o pin do **tecnico** ate o **servico** (e nao o contrario). Apos atribuir, a rota deve ser tracada seguindo as ruas do mapa.

### Solucao

Manter o click-to-assign existente como alternativa e **adicionar drag-and-drop nos marcadores de tecnicos**.

### Alteracoes em `src/components/mapa/MapaVistoriasContent.tsx`

**1. Tornar marcadores de tecnicos arrastáveis (quando atribuicaoManualAtiva)**

- Marcador do vistoriador recebe `draggable={!!atribuicaoManualAtiva}`
- No `eventHandlers.dragend`, capturar posicao final do arrasto
- Encontrar o servico nao atribuido mais proximo da posicao final (raio de 800m)
- Se encontrar: abrir dialog de confirmacao (reusa `assignConfirmation` existente)
- Se nao encontrar: toast de erro + retornar marcador a posicao original
- Apos confirmacao ou cancelamento, marcador volta a posicao real do tecnico (GPS)

**2. Retorno visual do marcador**

- Guardar ref do marcador do vistoriador para resetar posicao via `setLatLng()` apos arrastar
- Usar `useRef` com Map de `vistoriador_id -> L.Marker`

**3. Rota nas ruas ja funciona**

- O `linhasDeRota` + `RotaPolyline` ja traca rota real (OSRM) do tecnico ao servico apos atribuicao
- Nenhuma alteracao necessaria neste fluxo

**4. Legenda atualizada**

- Trocar texto de "Clique em Atribuir e depois no tecnico" para "Arraste o tecnico ate o servico ou clique em Atribuir"

### Nao alterado
- Click-to-assign (botao Atribuir no popup/sidebar + clique no tecnico) — mantido como alternativa
- `useAtribuirServicoManual` — mutation continua igual
- `RotaPolyline` / `useRotaRealMultiWaypoint` — ja funciona
- Dialogs de confirmacao — reutilizados


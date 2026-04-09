

## Plano: Mapa de atribuições sempre visível + modo automático visual

### Problema
A aba "Atribuições" só aparece quando `atribuicaoManualAtiva = true`. Ao desativar o modo manual, os técnicos, rotas e serviços desaparecem do mapa. O motor automático já funciona independentemente, mas o diretor perde a visibilidade.

### Solução

**1. Aba "Atribuições" sempre visível** (`src/pages/monitoramento/Mapa.tsx`)
- Remover a condicional `{atribuicaoManualAtiva && ...}` das linhas 484 e 517
- A aba aparece sempre; o label pode mudar: "Atribuições (Manual)" vs "Atribuições (Auto)"

**2. Drag-and-drop já é condicional** (`MapaVistoriasContent.tsx`)
- `draggable={!!atribuicaoManualAtiva}` na linha 667 — já funciona, mantido
- O dragend já verifica `if (!atribuicaoManualAtiva) return` — mantido
- Técnicos, rotas e serviços renderizam sempre (não dependem da flag)

**3. Botões de atribuição manual condicionais** (já está correto)
- "Atribuir" no popup (linha 626) já verifica `atribuicaoManualAtiva`
- Click-to-assign badge (linha 937) já verifica `atribuicaoManualAtiva`
- Nenhuma alteração necessária

**4. Legenda atualizada** (`MapaVistoriasContent.tsx`)
- Quando auto: mostrar badge "Modo Automático" (verde) em vez de "Click-to-assign"
- Quando manual: manter badge "Click-to-assign" + instrução de arrastar

### Alterações
- **`src/pages/monitoramento/Mapa.tsx`** — remover condicional da aba Atribuições (2 blocos, ~4 linhas)
- **`src/components/mapa/MapaVistoriasContent.tsx`** — badge condicional na legenda (~5 linhas)

### Não alterado
- `cron-atribuir-tarefas` — motor automático já funciona independentemente
- `useConfigAtribuicaoManual` — hook mantido para controlar UI de drag/assign
- Rotas (`RotaPolyline`) — já renderizam para serviços atribuídos independente do modo
- Botão de confirmação WhatsApp — já condicional a `atribuicaoManualAtiva`


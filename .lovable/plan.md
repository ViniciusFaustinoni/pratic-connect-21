
## Plano: Corrigir atribuição manual no mapa — click-to-assign + rota

### Problema
1. O drag-and-drop atual exige arrastar o pin do **serviço** até o **técnico**, com raio de 500m — UX confusa e falha silenciosamente
2. O usuário espera o contrário: selecionar serviço, clicar no técnico (ou vice-versa), e ver a rota traçada do técnico até o local do serviço

### Solução: Click-to-assign em dois passos

Substituir o drag-and-drop por um fluxo de dois cliques:

1. Usuário clica num serviço não atribuído (no sidebar ou no pin do mapa) → entra em "modo atribuição" com destaque visual
2. Usuário clica num técnico no mapa → abre dialog de confirmação com distância estimada
3. Após confirmar, o serviço é atribuído e a rota é traçada do técnico ao serviço

### Alterações

**Arquivo: `src/components/mapa/MapaVistoriasContent.tsx`**

1. **Remover drag-and-drop**: Remover `draggable`, `getDraggableIcon`, `handleMarkerDragEnd`, `COR_DRAGGABLE` e toda lógica de arrastar pins

2. **Adicionar estado de seleção para atribuição**:
   - Novo estado `servicoParaAtribuir: VistoriaMapa | null`
   - Ao clicar num serviço não atribuído (botão "Atribuir" no popup ou no card do sidebar), define `servicoParaAtribuir`
   - UI indica visualmente qual serviço está selecionado (pin pulsante ou cor diferente)

3. **Tornar pins de técnicos clicáveis para atribuir**:
   - Quando `servicoParaAtribuir` está definido, clicar num técnico no mapa dispara a confirmação
   - Dialog mostra: serviço selecionado, técnico escolhido, distância calculada
   - Botão confirmar chama `atribuirMutation`

4. **Barra de contexto**: Quando em modo atribuição, mostrar barra fixa no topo do mapa:
   ```
   "Selecione um técnico para: LTB4J74 - Instalação | [Cancelar]"
   ```

5. **Manter rotas existentes** (`linhasDeRota` + `RotaPolyline`): Após atribuição, a rota do técnico ao serviço já aparece automaticamente via a lógica existente de `linhasDeRota`

### Não alterado
- `useAtribuirServicoManual` — mutation continua igual
- `useDesatribuirServico` — cancelamento continua igual
- `useConfigAtribuicaoManual` — flag continua controlando se o modo aparece
- Sidebar e legendas — mantidos
- Rotas polyline — já funcionam para serviços atribuídos

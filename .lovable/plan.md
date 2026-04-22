

## Causa raiz: tarefas sem GPS aparecem com fade e ficam fora do drag-and-drop

### Por que as tarefas #1, #2, #3 estão "bloqueadas"

Nas 3 tarefas do print, o badge **"⚠️ Corrigir endereço para liberar GPS"** está visível em todas. Isso significa que `vistoria.latitude` é `null` (a geocodificação do endereço falhou). A partir disso, o código em `src/components/mapa/MapaVistoriasContent.tsx` aplica **dois efeitos** que dão a sensação de "bloqueado":

1. **Fade visual** (linha 681): 
   ```tsx
   !v.latitude && "opacity-60"
   ```
   O card inteiro fica com 60% de opacidade — parece desabilitado.

2. **Drag-and-drop desligado** (linhas 673 e 920):
   ```tsx
   const isDraggable = !!atribuicaoManualAtiva && !isRealizada 
     && !v.vistoriador_id && !!v.latitude && !!v.servico_id_unificado;
   ```
   Sem latitude, **não é possível arrastar a tarefa para um técnico no mapa** — porque o sistema precisa da coordenada para calcular distância/ETA até o técnico no momento do drop. Esta trava é intencional e correta.

### O que NÃO está bloqueado (mas o usuário não percebe)

Os botões da coluna direita do card (`AtribuirTecnicoPopover`, `AtribuirPrestadorPopover`) **não checam latitude** — eles funcionam para tarefas sem GPS. Linha 777:
```tsx
{!!atribuicaoManualAtiva && !isRealizada && !v.vistoriador_id && !!v.servico_id_unificado && (
  <AtribuirTecnicoPopover ... />
)}
```
Ou seja, a atribuição via clique no ícone "UserPlus" azul está disponível. Mas o **fade de 60% engana** o usuário a achar que o card inteiro está desabilitado, e a única affordance de atribuição que ele tenta (arrastar para o técnico no mapa) está bloqueada.

### Correção raiz

**Arquivo único: `src/components/mapa/MapaVistoriasContent.tsx`**

1. **Remover o fade enganoso** (linha 681). Trocar `!v.latitude && "opacity-60"` por uma marcação visual mais clara que comunica "sem GPS, mas ainda atribuível por clique" — uma borda tracejada amarela à esquerda + um ícone discreto, mantendo opacidade 100%.

2. **Manter o bloqueio de drag** (linhas 673 e 920) — está correto, sem coordenada não há como arrastar no mapa.

3. **Adicionar um badge "Atribuir por clique →"** ao lado do "⚠️ Corrigir endereço" quando `!v.latitude && atribuicaoManualAtiva && !v.vistoriador_id`, apontando para o ícone de UserPlus azul. Isso ensina o coordenador que ele pode atribuir via popover mesmo sem GPS.

4. **Tooltip no card** quando sem latitude: "Sem coordenadas — arraste no mapa indisponível, mas você pode atribuir clicando no ícone de técnico ou prestador à direita."

### Comportamento após a correção

| Situação | Antes | Depois |
|---|---|---|
| Tarefa sem GPS, modo manual ativo | Card com fade 60%, parece bloqueada, drag bloqueado | Card 100% opaco com borda tracejada amarela, drag continua bloqueado, ícones de atribuir destacados, dica visual aponta para eles |
| Tarefa com GPS, modo manual ativo | Card normal, drag liberado | Sem mudança |
| Tarefa já atribuída | Sem mudança | Sem mudança |

### Critérios de aceitação

1. As tarefas #1, #2, #3 do print não aparecem mais com fade — ficam 100% visíveis.
2. Coordenador consegue atribuir uma tarefa sem GPS clicando no ícone azul "UserPlus" e selecionando um técnico (já funcionava no código, mas agora fica visualmente óbvio).
3. Drag-and-drop dessas tarefas continua bloqueado (correto — sem coord não há onde soltar no mapa).
4. Tarefas com GPS continuam com comportamento atual (drag livre, sem badge novo).
5. O botão "Corrigir endereço para liberar GPS" continua disponível como caminho preferido para resolver na raiz.

### Fora de escopo

- Recalcular geocodificação automática em background (já existe `tentarGeocodificarNovamente`).
- Permitir drag de tarefas sem GPS (não faz sentido — o drop precisa de coord para calcular distância).
- Mexer em RLS, edge functions ou na lógica de `useAtribuirServicoManual`.

### Arquivo envolvido

- `src/components/mapa/MapaVistoriasContent.tsx` (única alteração)


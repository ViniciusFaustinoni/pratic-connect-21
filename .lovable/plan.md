

## Plano: Fluxo Multi-Atribuição Manual (Sem Reatribuição)

### Entendimento correto do requisito

O coordenador seleciona **várias tarefas SEM técnico** e depois clica em UM técnico para atribuir todas de uma vez. **Tarefas já atribuídas NÃO podem ser reatribuídas** por este fluxo — apenas desatribuídas (cancelar rota) e depois reatribuídas individualmente se necessário.

### O que está errado hoje

1. **`canAssign` permite reatribuição** (linha 448): a condição atual não exige `!v.vistoriador_id`, permitindo que tarefas já atribuídas sejam reatribuídas. Isso contradiz o requisito.
2. **Seleção única**: o state `servicoParaAtribuir` é um único `VistoriaMapa | null`. Só permite selecionar uma tarefa por vez.
3. **Confirmação e mutação**: o diálogo e a mutação processam uma tarefa por vez.
4. **Drag-and-drop**: o filtro na linha 739 também não exige `!v.vistoriador_id`.

### Correções em `MapaVistoriasContent.tsx`

#### 1. Restaurar restrição `!v.vistoriador_id` no `canAssign`
Somente tarefas sem técnico podem receber o botão "Atribuir". Remover o texto "Reatribuir" do title.

#### 2. Multi-seleção de tarefas
- Trocar `servicoParaAtribuir: VistoriaMapa | null` por `servicosParaAtribuir: VistoriaMapa[]` (array).
- O botão "Atribuir" adiciona/remove a tarefa do array (toggle).
- A barra superior mostra: "Selecione um técnico para: **3 tarefas selecionadas** (placa1, placa2, placa3)".
- Cancelar limpa o array inteiro.

#### 3. Diálogo de confirmação multi-tarefa
- Mostrar lista das tarefas selecionadas (placa + data + horário) e o técnico escolhido.
- Texto: "Deseja atribuir **N tarefas** ao técnico **[nome]**?"
- Listar cada tarefa com placa e horário.

#### 4. Mutação em lote
- Ao confirmar, chamar `atribuirMutation.mutate` sequencialmente para cada tarefa (usando `Promise.allSettled` para não travar em falha parcial).
- Toast de sucesso: "N tarefas atribuídas com sucesso" ou "N de M atribuídas (X falharam)".
- Limpar seleção após conclusão.

#### 5. Drag-and-drop: restaurar filtro `!v.vistoriador_id`
Linha 739: adicionar `&& !v.vistoriador_id` no filtro para que o drag só encontre serviços sem técnico.

#### 6. Popup do técnico com tarefas atribuídas
Mostrar no popup do técnico (linhas 774-816) a lista de tarefas já atribuídas a ele (filtrar `vistoriasComCoordenadas` por `vistoriador_id === tecnico.vistoriador_id`), exibindo placa + horário. Isso ajuda o coordenador a ver a carga antes de empilhar mais.

#### 7. Mapa: todas as tarefas de todos os dias (já implementado)
- Todas as tarefas agendadas com `data_agendada` já aparecem (filtro de "apenas hoje" já foi removido).
- Cores diferenciadas: Hoje (por status), Futuras (`#94A3B8`), Atrasadas (laranja).
- Tooltips numerados cronologicamente (`#N · dd/MM HH:mm`) — já implementado.

### Resumo visual do fluxo

```text
Coordenador abre mapa
  → Vê TODAS as tarefas (hoje, futuras, atrasadas)
  → Clica "Atribuir" em tarefa 1 (sem técnico) ✓ selecionada
  → Clica "Atribuir" em tarefa 2 (sem técnico) ✓ selecionada
  → Clica "Atribuir" em tarefa 3 (sem técnico) ✓ selecionada
  → Barra: "3 tarefas selecionadas — clique no técnico"
  → Clica no técnico no mapa
  → Diálogo: "Atribuir 3 tarefas ao Técnico X?"
     - Tarefa 1: ABC-1234 · 16/04 08:30
     - Tarefa 2: DEF-5678 · 16/04 10:00
     - Tarefa 3: GHI-9012 · 17/04 09:00
  → Confirma → 3 mutações executadas → Toast "3 tarefas atribuídas"
```

### O que NÃO muda
- Fluxo automático de atribuição (edge functions)
- Hook `useAtribuirServicoManual` — já suporta qualquer serviço
- Hook `useServicosParaAtribuir` (aba drag-and-drop) — continua filtrando `profissional_id IS NULL`
- View `view_vistorias_mapa` — já traz 30 dias
- Banco de dados — `servicos.profissional_id` é campo único, garantindo que uma tarefa só tem um técnico

### Arquivo alterado
| Arquivo | Mudança |
|---------|---------|
| `src/components/mapa/MapaVistoriasContent.tsx` | Multi-seleção, restaurar `!v.vistoriador_id`, confirmação em lote, popup do técnico com carga, drag-and-drop corrigido |




## Plano: Melhorar Fluxo Manual de Atribuição + Mapa com Todas as Datas

### Problemas identificados

1. **Atribuição bloqueada quando já existe um profissional**: A condição `canAssign` em `MapaVistoriasContent.tsx` (linha 431) exige `!v.vistoriador_id` — ou seja, se já tem técnico, o botão "Atribuir" não aparece. O coordenador não pode reatribuir nem empilhar tarefas.

2. **Mapa mostra apenas tarefas de HOJE + encaixes**: O filtro em `vistoriasFiltradas` (linhas 211-233) descarta tudo que não seja hoje, atrasado ou encaixe. Tarefas futuras não aparecem.

3. **Tooltips sem numeração cronológica**: Os tooltips mostram data/período mas sem número de ordem.

### Correções

#### 1. Permitir atribuição mesmo com técnico já atribuído (MapaVistoriasContent.tsx)

Remover a condição `!v.vistoriador_id` do `canAssign` (linha 431). Quando já tem profissional atribuído, o botão muda para "Reatribuir" e o fluxo funciona igual (selecionar técnico no mapa → confirmar).

Mesma lógica no drag-and-drop do técnico (linha 711-712): remover filtro `!v.vistoriador_id` do `servicosNaoAtribuidos`.

**Fluxo automático não é afetado** — essa mudança é apenas na UI do mapa de atribuições (manual).

#### 2. Mostrar TODAS as tarefas agendadas no mapa (MapaVistoriasContent.tsx)

Remover o filtro de "apenas hoje/atrasada/encaixe" do `vistoriasFiltradas`. Mostrar todas as tarefas com `data_agendada` (que a view já traz dos últimos 30 dias).

Diferenciar visualmente por data usando cores no pin:
- **Hoje**: cores atuais (por status/confirmação)
- **Futuras**: cor mais suave/transparente (ex: cinza-azulado `#94A3B8`) para não poluir
- **Atrasadas**: laranja como já está

#### 3. Tooltips numerados cronologicamente (MapaVistoriasContent.tsx)

Adicionar numeração sequencial nos tooltips baseada na ordem cronológica (`data_agendada` + `horario_agendado`). Cada tooltip mostrará: `#N · dd/MM HH:mm` (ou `#N · dd/MM M/T` para período).

Implementação:
- Criar um `useMemo` que ordena todas as vistorias por data+hora e atribui um índice sequencial
- No render do tooltip, usar esse índice: `#1 · 15/04 08:30`

#### 4. Legenda atualizada (MapaVistoriasContent.tsx)

Adicionar na legenda a nova cor para "Futuras" e explicar a numeração.

#### 5. Hook useAtribuicaoManual — permitir atribuir serviço já atribuído

O `useAtribuirServicoManual` já funciona para qualquer serviço (não valida se `profissional_id` é null). Nenhuma mudança necessária no hook.

O `useServicosParaAtribuir` (usado na aba drag-and-drop) filtra `.is('profissional_id', null)` — manter assim, pois essa aba é para serviços PENDENTES. A aba do mapa é onde o coordenador reatribui.

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `src/components/mapa/MapaVistoriasContent.tsx` | Remover filtro só-hoje, permitir atribuição com técnico existente, tooltips numerados, legenda atualizada |

### O que NÃO muda

- Fluxo automático de atribuição (edge functions)
- Aba de Atribuição Manual (drag-and-drop) — continua mostrando apenas pendentes
- Hook `useAtribuirServicoManual` — já suporta reatribuição
- View `view_vistorias_mapa` — já traz dados dos últimos 30 dias


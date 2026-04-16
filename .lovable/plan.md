

## Plano: Seleção de Base na Vistoria Tipo Base

### Problema
Atualmente o fluxo de agendamento na base assume uma única base (dados da tabela `configuracoes`). Existem 2 bases cadastradas como `is_base_pratic=true` na tabela `oficinas`:
- **Oficina Praticcar** — Duque de Caxias, RJ
- **Auto GJ** — Realengo, Rio de Janeiro, RJ

O campo `oficina_id` não existe em `agendamentos_base`, impossibilitando saber qual base o cliente escolheu.

### Mudanças

#### 1. Migration SQL
- Adicionar coluna `oficina_id UUID REFERENCES oficinas(id)` em `agendamentos_base`
- Atualizar os 2 registros existentes para apontar para a base de Duque de Caxias (`41ef21e6-8d8e-487f-b6b5-8b26e4653790`)

#### 2. `src/components/cotacao-publica/AgendamentoBase.tsx`
- Adicionar prop `oficinaId` (obrigatória)
- Buscar dados da oficina selecionada via `useOficina(oficinaId)` para exibir nome e endereço no header (substituindo os dados da tabela `configuracoes`)
- Passar `oficinaId` ao `useCriarAgendamentoBase`

#### 3. `src/components/cotacao-publica/AgendamentoVistoriaCompleta.tsx`
- Adicionar etapa intermediária `escolha-base` entre a escolha de local e o agendamento
- Nessa etapa, listar as bases disponíveis (via `useBasesPratic`) como cards clicáveis com nome, endereço e coordenadas
- Ao selecionar, passar a `oficinaId` para `AgendamentoBase`

#### 4. `src/hooks/useAgendamentoBase.ts`
- Na mutation `useCriarAgendamentoBase`, incluir `oficina_id` no INSERT
- Na query `useHorariosDisponiveis`, filtrar por `oficina_id` para que a capacidade seja per-base
- Exportar a interface `AgendamentoBase` com o novo campo

#### 5. `src/components/mapa/MapaVistoriasContent.tsx`
- Na query de pendentes do dia, incluir `oficina_id` no select
- Agrupar contagem de pendentes por `oficina_id` para cada base no mapa

#### 6. `src/components/monitoramento/CalendarioDiaModal.tsx`
- Na query de agendamentos base, incluir `oficina_id` e dados da oficina para exibição
- Mostrar o nome da base ao lado de cada agendamento

#### 7. `src/hooks/useAtribuicaoManual.ts`
- Incluir `oficina_id` no select dos itens base para referência

### Arquivos

| Arquivo | Acao |
|---------|------|
| Nova migration SQL | Adicionar `oficina_id`, atualizar registros existentes |
| `src/components/cotacao-publica/AgendamentoVistoriaCompleta.tsx` | Etapa de seleção de base |
| `src/components/cotacao-publica/AgendamentoBase.tsx` | Receber `oficinaId`, exibir dados da oficina |
| `src/hooks/useAgendamentoBase.ts` | Incluir `oficina_id` em insert/queries |
| `src/components/mapa/MapaVistoriasContent.tsx` | Agrupar pendentes por base |
| `src/components/monitoramento/CalendarioDiaModal.tsx` | Mostrar nome da base |
| `src/hooks/useAtribuicaoManual.ts` | Incluir `oficina_id` no select |


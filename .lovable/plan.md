

## Escopo

Dois fixes cirúrgicos em `src/components/monitoramento/CalendarioDiaModal.tsx`. Sem refatorar a fonte de dados (continuamos lendo `vistorias`, `instalacoes`, `agendamentos_base` como hoje).

## Fix 1 — Aba Base/Rota refletir `local_vistoria` real

**Causa**: o modal divide itens por **tabela de origem** (`agendamentos_base` → Base, `vistorias` + `instalacoes` → Rota). A vistoria da Laiane aparece em Base porque existe um espelho em `agendamentos_base`, mas no banco principal `local_vistoria='cliente'`.

**Correção**: na query de `agendamentos_base` (linha 99–112), trazer também `vistoria_id` e a `local_vistoria` da vistoria vinculada via join. Filtrar fora qualquer agendamento_base cuja vistoria associada tenha `local_vistoria = 'cliente'` — esses pertencem à aba Rota e já são carregados pela query de `vistoriasCampo`.

```ts
.select('..., vistoria_id, vistoria:vistorias!agendamentos_base_vistoria_id_fkey(local_vistoria)')
// no useMemo: filtrar onde row.vistoria?.local_vistoria === 'cliente'
```

Resultado: Laiane some de "Base", aparece em "Rota". Renan/Adriano (`local_vistoria='base'`) continuam em Base.

## Fix 2 — Badge de execução substituindo "Confirmado"

**Causa**: a UI mostra `STATUS_VISTORIA_LABEL[status]` cru. `confirmado` em `agendamentos_base` significa só "técnico atribuído + WhatsApp enviado", não execução.

**Correção**: criar uma função `getStatusExecucao(item)` que retorna o status efetivo:

| Condição (em ordem) | Badge | Cor |
|---|---|---|
| `concluida_em` preenchido OU status ∈ {concluida, realizado, aprovada} | **Concluída** | verde |
| status ∈ {nao_compareceu, faltou} | **Não compareceu** | vermelho |
| `iniciada_em` preenchido OU status ∈ {em_andamento, em_rota} | **Em andamento** | âmbar |
| status = `cancelada/cancelado` | **Cancelada** | vermelho |
| data_agendada < hoje E nenhum dos acima | **Não realizada** | vermelho-claro |
| status = `confirmado` E sem técnico (`atendido_por`/`profissional_id` null) | **Sem técnico** | laranja |
| status = `confirmado` com técnico | **Agendada** | azul |
| default | label atual | atual |

Para itens da aba Base que não trazem `iniciada_em`/`concluida_em` (a tabela `agendamentos_base` não tem esses campos), buscar via join com `vistorias` (já adicionado no Fix 1): `vistoria:vistorias(local_vistoria, status, iniciada_em, concluida_em)`.

Aplicar o mesmo helper em ambas as abas (Rota e Base) para ficar consistente.

## Não mexer

- `RotaCalendario.tsx`, `MapaVistoriasContent.tsx`, mutations de antecipar/atribuir, esquema de banco. A correção é puramente apresentacional + um filtro extra.
- Não migramos a fonte de dados de `vistorias`/`agendamentos_base` para `servicos` (fora de escopo, alto risco).

## Validação

1. Abrir calendário no dia **16/04/2026**:
   - Laiane (RKL2G70) deve aparecer em **Rota** (não em Base) com badge **Não realizada**.
   - Adriano (RKO4F90) em **Base** com badge **Não compareceu**.
   - Renan (PZS6D39) em **Base** com badge **Sem técnico** (e `Não realizada` se já passou do horário — usar a regra de não realizada como prioridade quando data < hoje).
2. Abrir um dia futuro com agendamento confirmado e técnico: badge **Agendada** (azul).
3. Abrir um dia com vistoria realmente concluída: badge **Concluída** (verde).

## Resultado

- Aba Base/Rota passa a refletir o `local_vistoria` real do banco.
- Badges deixam de mentir sobre execução; diretor vê de relance o que aconteceu de fato.


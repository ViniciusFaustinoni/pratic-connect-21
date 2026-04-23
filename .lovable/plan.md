

## Filtros (placa + período) no Histórico de Vínculo

### Diagnóstico

- **Detalhe do rastreador** (`DetalhesRastreadorDialog.tsx`): a "Trilha de auditoria de vínculo" hoje vem de `useRastreadorHistoricoVinculo` e é mesclada na timeline unificada (linhas 322-347), sem filtros próprios. Em rastreadores com muitos eventos, vira ruído.
- **Detalhe do veículo** (`VeiculoDetalhesModal.tsx`, aba "Rastreador"): hoje **só mostra o rastreador atual**, sem nenhum histórico de vínculos passados. Não existe seção de "Histórico de Vínculo" nessa modal — precisa ser criada.
- A tabela `rastreadores_vinculo_historico` tem `placa_anterior`, `placa_nova`, `created_at` e `veiculo_id_anterior` / `veiculo_id_novo` — campos suficientes para filtros por placa e período em ambos os lados.

### Mudanças

**A. Novo componente compartilhado** — `src/components/rastreadores/HistoricoVinculoSection.tsx`

Bloco reutilizável que renderiza a lista filtrada com seu próprio cabeçalho de filtros:

- Props: `{ rastreadorId?: string; veiculoId?: string; titulo?: string }`. Pelo menos um dos dois IDs é obrigatório.
- UI:
  - Cabeçalho colapsável "Histórico de Vínculo" + contador.
  - Linha de filtros: `Input` busca por placa (controlado, debounce 250 ms) + `DatePickerWithRange` (componente já existente em `src/components/ui/date-range-picker.tsx`) + botão "Limpar".
  - Lista cronológica (mais recente primeiro) com ícone, placa anterior → nova, transição de status, autor, origem, data/hora.
  - `EmptyState` quando nenhum registro casa com filtros.
- Lógica:
  - Estado local: `placaFiltro: string`, `periodo: DateRange | undefined`.
  - Hook de dados: novo `useHistoricoVinculoFiltrado` (ver item B) que aceita `rastreadorId | veiculoId` + filtros.

**B. Hook novo** — `src/hooks/useHistoricoVinculoFiltrado.ts`

```ts
useHistoricoVinculoFiltrado({ rastreadorId?, veiculoId?, placa?, dataInicio?, dataFim? })
```

- Query base em `rastreadores_vinculo_historico`.
- Se `rastreadorId`: `.eq('rastreador_id', rastreadorId)`.
- Se `veiculoId`: `.or('veiculo_id_anterior.eq.<id>,veiculo_id_novo.eq.<id>')`.
- Se `placa`: `.or('placa_anterior.ilike.%X%,placa_nova.ilike.%X%')` (uppercase, sem máscara).
- Se `dataInicio`/`dataFim`: `.gte('created_at', startOfDay)` / `.lte('created_at', endOfDay)`.
- Ordenado `created_at desc`, limit 200.
- `queryKey` inclui todos os filtros para cache correto.

**C. Integração no detalhe do rastreador** — `DetalhesRastreadorDialog.tsx`

- Antes da seção "Histórico Completo" (timeline unificada, linha 543), adicionar:
  ```tsx
  <HistoricoVinculoSection rastreadorId={rastreadorId} titulo="Histórico de Vínculo" />
  ```
- **Remover** a inclusão de `historicoVinculo` na timeline unificada (linhas 322-347 + import e query) — passa a viver só na nova seção dedicada com filtros, evitando duplicação visual.

**D. Integração no detalhe do veículo** — `VeiculoDetalhesModal.tsx`, aba "Rastreador"

- Após o bloco do rastreador atual (após linha 324, antes do fechamento do `TabsContent`), adicionar:
  ```tsx
  <Separator />
  <HistoricoVinculoSection veiculoId={veiculoId} titulo="Histórico de Vínculo (este veículo)" />
  ```
- Funciona mesmo quando o veículo não tem rastreador atual (mostra rastreadores que já passaram por ele).

### Arquivos editados

- **Novo** `src/components/rastreadores/HistoricoVinculoSection.tsx` — UI compartilhada com filtros.
- **Novo** `src/hooks/useHistoricoVinculoFiltrado.ts` — query parametrizada.
- `src/components/monitoramento/estoque/DetalhesRastreadorDialog.tsx` — adiciona seção; remove vínculo da timeline unificada.
- `src/components/cadastro/VeiculoDetalhesModal.tsx` — adiciona seção na aba "Rastreador".

### O que NÃO muda

- Tabela `rastreadores_vinculo_historico` e trigger continuam idênticos.
- Hook `useRastreadorHistoricoVinculo` permanece (não é usado depois da remoção, posso depreciar em outra tarefa — mantenho por agora para evitar quebrar usos eventuais).
- RLS já permite leitura pelos roles certos (admin/monitoramento) e não muda.

### Riscos

- Filtro `or` no Postgrest com `ilike` em duas colunas é seguro (já usamos esse padrão em outras buscas). Se a placa for digitada vazia, o filtro é ignorado.
- Um rastreador que entrou e saiu várias vezes do mesmo veículo aparecerá várias vezes — esperado (cada linha é uma transição).
- Limite 200 cobre o caso comum; se algum rastreador antigo passar disso, exibimos um aviso "Mostrando últimos 200 — refine os filtros". Sem paginação nesta tarefa.


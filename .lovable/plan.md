# Cards duplicados em reagendamento/imprevisto — Causa raiz e plano

## Diagnóstico (placa LUJ9I51, do print)

Encontrei **5 instalações + 5 serviços** para o mesmo associado/veículo/contrato:

| # | data    | status         | origem                                   |
|---|---------|----------------|------------------------------------------|
| 1 | 24/04   | cancelada      | Agendamento original (atribuído ao Rafael) |
| 2 | 25/04   | nao_compareceu | Reagendamento manual (insert direto, sem fechar #1) |
| 3 | 25/04   | nao_compareceu | Reagendamento (insert direto)            |
| 4 | 27/04   | nao_compareceu | Reagendamento (insert direto)            |
| 5 | 27/04   | aprovada       | Atual (concluída)                        |

Por isso a tela "Serviços de Campo" mostra 5 linhas para o mesmo veículo: **a query traz tudo dentro do range de data** sem deduplicar por (associado, veículo, tipo). Status terminais entram no histórico, mas hoje todos viram cards "soltos".

## Causa raiz (3 pontos)

**1. `ModalReagendamentoManual.tsx`** faz `INSERT` direto em `servicos` para reagendar e só depois marca o antigo como `reagendada`. Pior: **não cria registro em `instalacoes`**, então a nova instalação tampouco é fechada/criada — cria divergência entre `servicos` e `instalacoes`.

**2. `DuploCheckImprevisto.tsx`** marca o serviço como `nao_compareceu` mas **não fecha a instalação correspondente**, e o link de reagendamento (`enviar-link-reagendamento`) provavelmente cria nova instalação em paralelo (gerando novo `servico` via `sync_instalacao_to_servicos`).

**3. Trigger de dedupe parcial:** existe `trg_dedupe_agendamentos_base_on_insert` (deduplica `agendamentos_base`), **mas não existe equivalente em `servicos` nem em `instalacoes`**. Por isso múltiplas instalações para mesmo (associado, veículo) sobrevivem.

## Regra de negócio (sua definição)

> Apenas **1 card "vivo"** por (associado, veículo, tipo). Mudanças de data viram histórico. Veículos diferentes do mesmo associado podem ter mais de 1 card.

## Plano de correção

### Etapa 1 — Trigger de dedupe em `instalacoes` e `servicos`

Criar `trg_dedupe_instalacao_on_insert` que, ao inserir nova `instalacoes`:
- Encontra outras instalações **não-terminais** com mesmo `(associado_id, veiculo_id)` (ignorando `contrato_id` se diferente — apenas mesmo associado+veículo)
- Marca-as como `cancelada` com observação: *"Substituída por novo agendamento (ID xxx em DD/MM)"*
- Registra `agendamento_anterior_id` (campo novo, nullable) apontando para a anterior, formando cadeia histórica.

Criar `trg_dedupe_servico_on_insert` análogo em `servicos` para mesmo `(associado_id, veiculo_id, tipo)`, marcando antigos como `cancelada`/`reagendada` (preservando `nao_compareceu` se já tiver, apenas mudando status para terminal `reagendada`).

### Etapa 2 — Migrar reagendamento manual para fluxo unificado

`ModalReagendamentoManual.tsx`:
- **Em vez de** `insert servicos` direto, atualizar a `instalacao` correspondente (data + período) — os triggers existentes (`sync_instalacao_update_to_servicos`) propagam para `servicos`.
- Para histórico, gravar o registro anterior numa tabela nova `agendamentos_historico` (ou usar coluna `historico_datas jsonb` em `instalacoes`).

### Etapa 3 — Corrigir `DuploCheckImprevisto`

- Ao marcar serviço como `nao_compareceu`, atualizar a `instalacao` correspondente também para `nao_compareceu` (hoje só atualiza `servicos`).
- Garantir que `enviar-link-reagendamento` **atualize** a instalação existente em vez de criar nova.

### Etapa 4 — Coluna `historico_datas` para preservar timeline

Adicionar `historico_datas jsonb DEFAULT '[]'` em `instalacoes`. Toda mudança de data agendada faz `push` no array com `{data_anterior, periodo_anterior, motivo, alterado_em, alterado_por}`. UI exibe num drawer "Histórico de reagendamentos".

### Etapa 5 — Limpeza retroativa (LUJ9I51 e similares)

Migration única que:
- Detecta grupos duplicados de `instalacoes` por `(associado_id, veiculo_id)` com mais de 1 não-terminal
- Mantém apenas a mais recente (por `created_at`)
- Marca as outras como `cancelada` com observação automática
- Move datas/períodos das antigas para `historico_datas` da remanescente

### Etapa 6 — Filtro defensivo no hook da fila

Em `useServicosCampoUnificado` / `useServicos`, agrupar resultados por `(associado_id, veiculo_id, tipo)` e retornar apenas o mais recente "vivo" + contagem de histórico (badge "5x reagendado") no card.

## Arquivos afetados

- **Nova migration**: trigger de dedupe + coluna `historico_datas` + limpeza retroativa
- `src/components/monitoramento/ModalReagendamentoManual.tsx` — reescrever para atualizar instalação
- `src/components/vistoriador/DuploCheckImprevisto.tsx` — sincronizar instalação
- `supabase/functions/enviar-link-reagendamento/index.ts` — verificar/garantir que **não** cria nova instalação
- `src/hooks/useServicosCampoUnificado.ts` — agregar duplicatas + expor histórico
- `src/components/servicos-campo/ServicosTable.tsx` — badge "Nx reagendado" + drawer com histórico

## Riscos e mitigações

- **Risco**: trigger de dedupe pode cancelar instalações legítimas em casos de borda (ex: associado com 2 veículos iguais). **Mitigação**: chave inclui `veiculo_id`, não só associado.
- **Risco**: limpeza retroativa pode esconder dados. **Mitigação**: nada é deletado, apenas marcado como `cancelada` com observação rastreável; tudo recuperável via `historico_datas`.

## O que eu **NÃO** vou alterar

- Status terminais existentes (`concluida`, `aprovada`) — ficam intocados.
- Lógica de `agendamentos_base` (já tem dedupe próprio funcionando).
- RPC `buscar_tarefa_atual_profissional` (já corrigido na rodada anterior).

Aprova para eu implementar?
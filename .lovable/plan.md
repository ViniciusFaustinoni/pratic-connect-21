## Objetivo

No modal da cotação gerada por troca de titularidade:
1. Exibir o **plano atual do associado antigo** (do contrato em vigor) como referência, antes da lista de planos cotados.
2. Ativar o botão **+ Adicionar** para que o vendedor inclua mais opções de plano no comparativo.

## Mudanças (apenas frontend)

### 1. Novo card "Plano atual do titular antigo"

Em `src/components/cotacoes/CotacaoDetalheModal.tsx`, dentro de `renderPlanos()`, acima do card "Plano Selecionado / Planos para Comparação", incluir um bloco **somente quando** `cotacao.dados_extras.tipo_entrada === 'troca_titularidade'`.

Para alimentar o bloco, criar um hook leve `useTrocaPlanoAtual(cotacaoId)`:

```ts
// src/hooks/useTrocaPlanoAtual.ts
// 1. SELECT id, associado_antigo_id, veiculo_id FROM solicitacoes_troca_titularidade WHERE cotacao_id = X
// 2. SELECT plano_id, valor_mensalidade, data_inicio, status
//    FROM contratos
//    WHERE veiculo_id = sol.veiculo_id AND associado_id = sol.associado_antigo_id
//    ORDER BY created_at DESC LIMIT 1
// 3. SELECT id, nome, codigo FROM planos WHERE id = contrato.plano_id
```

O card mostra: nome do plano, código, valor mensal vigente, data de adesão e um badge "Plano atual do titular anterior". Layout compacto, fundo neutro (`bg-muted/40`), borda esquerda em `primary` para destacar referência sem competir com o card principal.

### 2. Botão Adicionar funcional

O botão hoje está `disabled` e o modal de edição (`CotacaoFormDialog`) já existe e cobre adição de planos via `planos_comparacao` em `dados_extras`. A solução mais segura é reaproveitar:

- Remover `disabled` do botão.
- `onClick` → `setShowEditarModal(true)` (state já existe no arquivo).
- Manter o limite atual `planosExibir.length < 3` para esconder o botão quando 3 planos já foram cotados.

Após salvar, o `useCotacao` invalida e o modal já re-renderiza com o novo plano no comparativo. Nenhuma nova lógica de mutation é necessária.

### 3. Sem migração / sem edge function

Toda a informação já existe em `solicitacoes_troca_titularidade`, `contratos` e `planos`. Não há mudança de backend.

## Arquivos afetados

- `src/components/cotacoes/CotacaoDetalheModal.tsx` (badge troca: já existe; adicionar render do novo card + ativar botão)
- `src/hooks/useTrocaPlanoAtual.ts` (novo)

## Fora do escopo

- Atribuição automática do mesmo plano (apenas referência visual; o vendedor decide).
- Reescrever o fluxo de adição inline (continua via modal de edição existente).
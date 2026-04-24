## Problema

No modal "Configurar equipe e hierarquia" (e no modal de Atribuir Grade) existe o campo **Agência vinculada**, que permite anexar uma agência como parte da cadeia comercial de qualquer vendedor. Isso não condiz com o modelo de negócio: **agência é um tipo de vendedor** (role `agencia`). Quem fecha a venda como agência já é a própria agência — não faz sentido um vendedor CLT/externo "ter uma agência vinculada" como entidade separada da sua hierarquia.

## Objetivo

Remover qualquer ponto da UI que permita atribuir uma agência a um vendedor, mantendo intacta a lógica que paga comissão à agência quando ela é a vendedora da venda.

## O que muda

### 1. `src/components/comissoes/EditarHierarquiaModal.tsx`
- Remover o estado `agenciaId` e todo o seletor "Agência vinculada".
- Remover a lista `agencias` e validações que cruzam agência ↔ supervisor/gerente.
- Remover o nó "Agência vinculada" da prévia da cadeia (Gerente → Supervisor → Usuário).
- Remover a relação "Agência" da função `relacaoSubordinado` (subordinados continuam sendo apenas quem tem `supervisor_id` ou `gerente_id` apontando para o usuário).
- Ao salvar, enviar `agencia_id: null` sempre, garantindo que vínculos antigos sejam zerados ao reeditar.

### 2. `src/components/comissoes/AtribuirGradeModal.tsx`
- Remover o estado `agenciaId` e o seletor "Agência da cadeia".
- Ao salvar via `upsertHierarquia`, enviar `agencia_id: null`.

### 3. `src/pages/configuracoes/AtribuicaoGrades.tsx`
- Remover a coluna/exibição de "Agência" na tabela.
- Remover o filtro de subordinados que considera `agencia_id`.

### 4. Lógica de pagamento (sem alteração)
- `useComissaoDetalhesPagamento.ts` continua funcionando: quando a venda é originada por um usuário com role `agencia`, o snapshot `vendedor_id` já é a própria agência — a parte de "agência" é resolvida pelo próprio vendedor da venda. Não mexemos nesse arquivo.
- O campo `agencia_id` na tabela `comissoes_hierarquia` permanece (sem migration de schema), apenas deixa de ser populado pela UI.

### 5. Tipos
- `HierarquiaVendas.agencia_id` permanece como `string | null` no tipo (mantém compatibilidade com snapshots históricos), mas a UI nunca mais grava valor não-nulo.

## O que NÃO muda

- A role `agencia` continua existindo e segue sendo um vendedor que pode originar vendas.
- Cadeia comercial continua: Gerente → Supervisor → Vendedor (incluindo vendedor com role `agencia`).
- Histórico de comissões já pagas com `agencia_id` preenchido continua íntegro nos snapshots.
- Sem migrations de banco nesta etapa (apenas UI/lógica de escrita).

## Resultado esperado

- O modal "Configurar equipe e hierarquia" passa a mostrar apenas Gerente superior e Supervisor superior — sem o campo Agência.
- Não é possível mais (acidentalmente) anexar uma agência a um vendedor pela interface.
- Comissões de venda originadas por uma agência continuam sendo pagas corretamente, pois o motor já trata a agência como o próprio vendedor da venda.

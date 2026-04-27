## Objetivo

Hoje cada vendedor tem **um único supervisor** e cada parcela da grade aceita apenas **uma linha** com a role `supervisor_vendas`. Vamos permitir:

1. **Vincular N supervisores** ao mesmo vendedor (hierarquia N:N para a role de supervisor).
2. Na **grade de comissão**, em cada parcela com supervisor, escolher como o percentual destinado à supervisão é repartido entre os supervisores do vendedor:
   - **Igualmente** (divisão automática pelo nº de supervisores ativos no momento do pagamento), ou
   - **Personalizado** (percentuais manuais por supervisor; soma obrigatória = 100% do valor da supervisão).

A regra do 1% (não relacionada), grades, vendedor, gerente e agência permanecem inalterados.

## Mudanças no banco

### 1. Nova tabela `hierarquia_vendas_supervisores`
Substitui o uso de `hierarquia_vendas.supervisor_id` (singular) por uma tabela filha N:N, mantendo histórico:

```text
hierarquia_vendas_supervisores
├── id (uuid, pk)
├── hierarquia_id (uuid, fk → hierarquia_vendas)
├── supervisor_id (uuid)
├── percentual_personalizado (numeric, null)   -- usado quando a parcela for "personalizada"
├── ordem (int)
├── created_at, created_by
└── unique(hierarquia_id, supervisor_id)
```

- `hierarquia_vendas.supervisor_id` continua existindo para retrocompatibilidade e é alimentado com o **primeiro** supervisor (compat layer). Migração de dados copia o valor existente para a nova tabela.
- RLS espelha as policies já existentes em `hierarquia_vendas`.

### 2. Coluna em `grades_comissao_parcelas`
- `supervisor_split_mode` `text` `not null default 'igual'` com check `in ('igual','personalizado')`.

Quando `personalizado`, os percentuais individuais ficam em `hierarquia_vendas_supervisores.percentual_personalizado` (definidos por vendedor, não por grade — a grade só diz que a divisão é manual; quem distribui é a hierarquia do vendedor). Validação na UI da hierarquia: soma = 100%.

### 3. RPC `fn_upsert_hierarquia_vendedor`
Novo parâmetro `p_supervisores jsonb` (`[{supervisor_id, percentual_personalizado}]`). Substitui o `p_supervisor_id` singular (mantido como deprecado para retrocompat). A função grava todos os supervisores na nova tabela.

### 4. RPC de geração de comissões (`gerar_comissoes_por_pagamento` na migration `20260424091703…`)
No bloco que resolve `v_destinatario_id` para `supervisor_vendas`:
- Busca todos os supervisores ativos da `hierarquia_vendas_supervisores` para o vendedor.
- Lê `supervisor_split_mode` da parcela.
- Se `igual`: divide o `v_valor_comissao` (e o `v_percentual`) por `count(supervisores)`.
- Se `personalizado`: aplica o `percentual_personalizado` de cada supervisor sobre o valor da supervisão.
- Insere **uma linha em `comissoes` por supervisor**, com `nivel_nome` sufixado (ex: `Supervisor (1/2)`) para não colidir no `ON CONFLICT (cobranca_id, vendedor_id, nivel_nome)`.
- O `calculo_snapshot.cadeia.supervisores` passa a ser um array.

## Mudanças no front

### 1. `GradeComissaoForm.tsx` + `ParcelaEditor.tsx`
- No card de cada parcela, quando houver um nível com role `supervisor_vendas`, exibir um pequeno controle abaixo do nível:
  - Toggle (RadioGroup) **Divisão entre supervisores: [Igualmente] [Personalizado]**.
  - Texto auxiliar: *"A divisão personalizada é definida no cadastro de hierarquia do vendedor. A soma deve totalizar 100%."*
- Persistir `supervisor_split_mode` em `grades_comissao_parcelas`.
- Continua existindo apenas **um** nível `supervisor_vendas` por parcela (a grade define o % total da supervisão; quem fraciona entre pessoas é a hierarquia).

### 2. Tela de Atribuição de Hierarquia (`AtribuicaoGrades.tsx` / componente equivalente)
- Campo "Supervisor" vira **lista** com botão "+ Adicionar supervisor".
- Cada linha: Select de supervisor + Input de % (habilitado só quando alguma parcela da grade vigente do vendedor estiver em modo `personalizado`).
- Validação client-side:
  - Sem duplicar supervisor.
  - Se `personalizado` ativo na grade vigente, soma dos % = 100% (com mensagem de erro inline).
- Chamar a RPC com `p_supervisores`.

### 3. Tela de detalhes de pagamento (`useComissaoDetalhesPagamento.ts` + modal)
- Trocar `supervisor: Profile | null` por `supervisores: { profile, valor, percentual }[]`.
- Listar todos os supervisores no card de quebra de comissão.

## Migração de dados

Migration única que:
1. Cria a tabela e a coluna.
2. `INSERT INTO hierarquia_vendas_supervisores (hierarquia_id, supervisor_id, ordem) SELECT id, supervisor_id, 0 FROM hierarquia_vendas WHERE supervisor_id IS NOT NULL;`
3. Define todas as parcelas existentes com `supervisor_split_mode = 'igual'` (default).

## Itens fora de escopo

- Múltiplos gerentes ou múltiplas agências (continuam 1:1).
- Mudança em comissões já geradas — a nova lógica só vale para comissões geradas após a migração.

## Entregáveis

- 1 migration SQL (tabela + coluna + dados + RLS + RPCs atualizadas).
- Alterações em `GradeComissaoForm.tsx`, `ParcelaEditor.tsx`, `AtribuicaoGrades.tsx` (form de hierarquia), `useComissaoDetalhesPagamento.ts` e o modal de detalhes.
- Atualização da memória `mem://logic/commissions/grade-do-vendedor-prevalece.md` para refletir o split entre múltiplos supervisores.

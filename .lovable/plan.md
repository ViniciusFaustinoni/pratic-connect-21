

# Plano: Vincular Níveis de Comissão a Perfis de Acesso

## Problema

Hoje cada nível de comissão tem apenas um campo texto livre (`nome`). O sistema não sabe **para qual perfil** destinar cada percentual. Quando a grade é atribuída a um usuário, não há como identificar automaticamente "50% vai pro vendedor, 20% vai pra agência".

## Solução

Adicionar uma coluna `role` na tabela `grades_comissao_niveis` que vincula cada nível a um perfil do sistema (`vendedor_clt`, `vendedor_externo`, `agencia`, etc.).

### 1. Migration — Adicionar coluna `role`

```sql
ALTER TABLE public.grades_comissao_niveis
  ADD COLUMN role TEXT;
```

Coluna nullable para não quebrar dados existentes. O `nome` continua como label de exibição.

### 2. `GradeComissaoForm.tsx` — Select de perfil em cada nível

Substituir o campo de texto livre por um **Select** com os perfis comerciais (`vendedor_clt`, `vendedor_externo`, `agencia`) carregados dinamicamente via `useAppRoles`. O campo `nome` será auto-preenchido com o label do perfil selecionado, mas editável para customização (ex: "Vendedor Principal", "Agência Matriz").

Cada nível terá:
```text
[ Select Perfil ▼ ] [ Nome (auto-fill) ] [ __% ]
```

### 3. Persistência

No `handleSave`, incluir o `role` selecionado ao inserir os níveis. Na query de carregamento, ler o `role` junto.

### 4. Validação

- Não permitir dois níveis com o mesmo `role` na mesma grade (um vendedor não pode aparecer duas vezes)
- Perfil é obrigatório em cada nível

## Arquivos afetados

| Arquivo | Alteração |
|---|---|
| Migration SQL | `ADD COLUMN role TEXT` em `grades_comissao_niveis` |
| `src/pages/configuracoes/GradeComissaoForm.tsx` | Select de perfil + auto-fill nome + salvar role |


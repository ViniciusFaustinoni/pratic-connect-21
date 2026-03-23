

# Plano: Cadastro de Agência com CNPJ e Dados Empresariais

## Problema

O formulário de cadastro de usuários sempre pede CPF, mas agências são empresas e precisam de CNPJ, razão social e nome fantasia. Não existe nenhum campo empresarial na tabela `profiles`.

## Solução

### 1. Migration — Adicionar campos empresariais ao `profiles`

```sql
ALTER TABLE public.profiles
  ADD COLUMN cnpj TEXT,
  ADD COLUMN razao_social TEXT,
  ADD COLUMN nome_fantasia TEXT;
```

### 2. `UsuarioForm.tsx` — Formulário condicional

Quando o perfil `agencia` estiver selecionado:
- Esconder o campo CPF
- Mostrar campos: **CNPJ** (com `CnpjInput` mascarado), **Razão Social** e **Nome Fantasia**
- Tornar CNPJ e Razão Social obrigatórios para agência

Quando NÃO for agência: manter o campo CPF como está hoje.

Adicionar os campos ao `formData`:
```typescript
cnpj: '',
razao_social: '',
nome_fantasia: '',
```

No `useEffect` de carregamento, popular esses campos a partir do `usuario`.

No `saveUser`, incluir `cnpj`, `razao_social`, `nome_fantasia` no update/create.

### 3. `create-user` edge function — Aceitar campos empresariais

Atualizar a interface `CreateUserRequest` para incluir `cnpj?`, `razao_social?`, `nome_fantasia?`.

Na verificação de duplicidade: se `cnpj` for informado, verificar se já existe em `profiles`.

No update do profile após criação: salvar `cnpj`, `razao_social`, `nome_fantasia`.

### 4. Validação de CNPJ

Usar o componente `CnpjInput` já existente em `src/components/inputs/MaskedInputs.tsx` para máscara.

Reutilizar `validateCNPJ` de `src/lib/validations` para validação no submit.

## Arquivos afetados

| Arquivo | Alteração |
|---|---|
| Migration SQL | Adicionar `cnpj`, `razao_social`, `nome_fantasia` ao `profiles` |
| `src/pages/configuracoes/UsuarioForm.tsx` | Campos condicionais por perfil agência |
| `supabase/functions/create-user/index.ts` | Aceitar e salvar campos empresariais |

## O que não muda

- Fluxo para outros perfis (CPF continua normal)
- Dashboard da agência
- Tabela `agencia_vendedores`
- Grades de comissão


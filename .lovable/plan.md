

# Criar Acesso ao App via API + Novos Campos CNH e SGA

## Resumo

Quando um associado é criado via API externa (POST /associados), o sistema deve criar automaticamente o acesso ao app (Auth user + profile + role), exigindo **email** e **senha** como campos obrigatórios. Também serão adicionados 3 novos campos: `cnh_numero`, `cnh_categoria`, e `data_cadastro_sga`.

## Alterações

### 1. Migration — Adicionar 3 colunas na tabela `associados`

```sql
ALTER TABLE public.associados
  ADD COLUMN IF NOT EXISTS cnh_numero text,
  ADD COLUMN IF NOT EXISTS cnh_categoria text,
  ADD COLUMN IF NOT EXISTS data_cadastro_sga date;
```

### 2. `supabase/functions/api-externa/index.ts` — POST /associados

**Tornar `email` e `senha` obrigatórios:**
- Validação: `if (!nome || !cpf || !email || !telefone || !senha)` → erro com mensagem clara
- Validar senha mínimo 6 caracteres

**Criar acesso ao app após inserir associado:**
Reutilizar a mesma lógica do `app-criar-senha`:
1. Criar email interno: `{cpf}@associado.pratic.com.br`
2. `supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nome, tipo: 'associado', cpf } })`
3. Atualizar `associados.user_id` com o ID do auth user
4. Criar/atualizar profile (`profiles` table) com `primeiro_acesso: false`
5. Inserir role `associado` em `user_roles`

**Adicionar campos opcionais:**
- `cnh_numero`, `cnh_categoria`, `data_cadastro_sga` nos `optionalFields`

### 3. `supabase/functions/document-ocr/index.ts` — OCR da CNH

O OCR já extrai `categoria` e `numero_registro` da CNH (linha 74 do system prompt). Esses dados já chegam no resultado OCR. Precisamos garantir que o frontend salve esses campos no associado.

### 4. Frontend — Salvar `cnh_numero` e `cnh_categoria` do OCR

Nos hooks que processam OCR da CNH (`useCotacaoContratacao.ts`, `ContratoWizard.tsx`), adicionar ao update do associado:
```ts
cnh_numero: ocrResult.dados.numero_registro,
cnh_categoria: ocrResult.dados.categoria,
```

### 5. `src/components/api-docs/apiEndpoints.ts` — Documentação

**POST Associados:**
- `senha` → required: true, description: 'Senha para acesso ao app (mínimo 6 caracteres)'
- `cnh_numero` → optional, 'Número de registro da CNH'
- `cnh_categoria` → optional, 'Categoria da CNH (A, B, AB, etc.)'
- `data_cadastro_sga` → optional, 'Data de cadastro no SGA (YYYY-MM-DD)'

**GET Associados:**
- Adicionar `cnh_numero`, `cnh_categoria`, `data_cadastro_sga` no response example

## Arquivos

| Arquivo | Ação |
|---|---|
| Migration SQL | Adicionar `cnh_numero`, `cnh_categoria`, `data_cadastro_sga` |
| `supabase/functions/api-externa/index.ts` | Exigir `senha`, criar auth user + profile + role; adicionar novos campos opcionais |
| `src/hooks/useCotacaoContratacao.ts` | Salvar `cnh_numero` e `cnh_categoria` do OCR no associado |
| `src/components/contratos/ContratoWizard.tsx` | Salvar `cnh_numero` e `cnh_categoria` do OCR no associado |
| `src/components/api-docs/apiEndpoints.ts` | Documentar `senha` (obrigatório), `cnh_numero`, `cnh_categoria`, `data_cadastro_sga` |


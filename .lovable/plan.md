
# Plano: Corrigir Erro de Colunas Inexistentes na Listagem de Cotações

## Problema Identificado

A página de cotações está mostrando "Nenhuma cotação em andamento" mesmo havendo 3 cotações no banco de dados. O problema é causado por um erro **HTTP 400** na query:

```
column profiles_1.whatsapp does not exist
```

A query no `useCotacoes.ts` tenta buscar colunas `whatsapp` e `full_name` da tabela `profiles`, porém essas colunas **não existem** no banco de dados.

## Análise Técnica

| Coluna Solicitada | Existe na Tabela `profiles`? |
|-------------------|------------------------------|
| `user_id` | Sim |
| `nome` | Sim |
| `email` | Sim |
| `whatsapp` | **Não** |
| `full_name` | **Não** |

## Solução Recomendada

Existem duas abordagens:

### Opção A: Adicionar as colunas no banco (Recomendada)

Criar as colunas `whatsapp` e `full_name` na tabela `profiles` via SQL, pois elas já são usadas em outras partes do sistema (geração de PDF).

```sql
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS whatsapp TEXT,
ADD COLUMN IF NOT EXISTS full_name TEXT;
```

### Opção B: Remover colunas da query

Ajustar `useCotacoes.ts` para não buscar colunas inexistentes.

**Recomendo a Opção A** porque a funcionalidade de WhatsApp do vendedor no PDF já foi implementada e precisa dessas colunas.

---

## Alterações

### 1. Adicionar colunas via SQL no Supabase

Executar no Supabase SQL Editor:

```sql
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS whatsapp TEXT,
ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Atualizar full_name com valor de nome para registros existentes
UPDATE public.profiles 
SET full_name = nome 
WHERE full_name IS NULL;
```

### 2. Arquivo: `src/hooks/useCotacoes.ts` (fallback temporário)

Enquanto as colunas não forem adicionadas, ou como medida de segurança, ajustar a query para tratar colunas opcionais:

**Linhas 82-95:**

Alterar a query para usar apenas colunas que existem com certeza:
- Remover `whatsapp` e `full_name` da query
- Adicionar lógica de fallback no mapeamento

---

## Comportamento Atual vs. Esperado

| Situação | Atual | Esperado |
|----------|-------|----------|
| Query `/cotacoes` | Erro 400 | Status 200 com dados |
| Listagem de cotações | 0 items | 3 items |
| Cards de cotação | Não aparecem | Visíveis com dados |

---

## Impacto

- **Baixo risco**: Alteração apenas na query do hook
- **Funcionalidades afetadas**: Geração de PDF com botão WhatsApp (precisará das colunas ou usará fallback)

---

## Próximos Passos

1. Adicionar as colunas `whatsapp` e `full_name` no banco de dados
2. Validar que a listagem de cotações volta a funcionar
3. Testar geração de PDF com botão WhatsApp

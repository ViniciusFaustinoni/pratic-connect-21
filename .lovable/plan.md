

# Salvar CNH Validade no Associado + Expor na API Externa

## Situação atual

- O OCR da CNH já extrai o campo `validade` corretamente
- Esse dado é salvo apenas na tabela `contratos` (como `cliente_cnh_validade`) e na `cotacoes`
- A tabela `associados` **não tem** coluna `cnh_validade`
- A API externa (`api-externa/index.ts`) retorna `select('*')` do associado, então basta a coluna existir para aparecer automaticamente no GET
- No POST da API, `cnh_validade` não está na lista de `optionalFields`

## Correções

### 1. Migration — Adicionar coluna `cnh_validade` na tabela `associados`

```sql
ALTER TABLE public.associados ADD COLUMN cnh_validade date;
```

### 2. `supabase/functions/contrato-gerar/index.ts`

Quando o contrato é gerado, já temos `cliente_cnh_validade`. Após criar o contrato, atualizar o associado:

```sql
UPDATE associados SET cnh_validade = contrato.cliente_cnh_validade WHERE id = associado_id
```

### 3. `supabase/functions/ativar-associado/index.ts`

Na ativação, copiar `cnh_validade` do contrato para o associado (caso ainda não esteja preenchido).

### 4. `src/components/contratos/ContratoWizard.tsx`

Quando salva a cotação com dados de OCR da CNH, também atualizar `associados.cnh_validade`.

### 5. `supabase/functions/api-externa/index.ts`

- Adicionar `cnh_validade` à lista de `optionalFields` no POST de associados (linha 90), para que a API aceite esse campo ao criar associados externamente.
- O GET já retorna `select('*')`, então o campo aparecerá automaticamente.

### 6. `src/hooks/useCotacaoContratacao.ts`

Quando salva dados do cliente na cotação (linha 451), também atualizar `associados.cnh_validade` com o valor extraído do OCR.

## Arquivos

| Arquivo | Ação |
|---|---|
| Migration SQL | Adicionar coluna `cnh_validade` (date) na tabela `associados` |
| `supabase/functions/contrato-gerar/index.ts` | Copiar `cliente_cnh_validade` para `associados.cnh_validade` ao gerar contrato |
| `supabase/functions/api-externa/index.ts` | Incluir `cnh_validade` nos `optionalFields` do POST de associados |
| `src/hooks/useCotacaoContratacao.ts` | Atualizar `associados.cnh_validade` ao salvar dados de CNH via OCR |
| `src/components/contratos/ContratoWizard.tsx` | Atualizar `associados.cnh_validade` ao salvar dados de OCR |


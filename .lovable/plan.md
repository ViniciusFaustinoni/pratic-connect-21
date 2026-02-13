
# Criar colunas ausentes na tabela `ordens_servico`

## Problema raiz
A tabela `ordens_servico` **nao possui** as colunas que o sistema inteiro depende para o fluxo de Termo de Saida:
- `autentique_documento_id` (text) - ID do documento no Autentique
- `autentique_url` (text) - Link de assinatura
- `termo_saida_assinado` (boolean) - Flag de assinatura
- `termo_saida_assinado_em` (timestamptz) - Data/hora da assinatura
- `termo_saida_url` (text) - URL do PDF assinado

Sem essas colunas:
1. A edge function `autentique-os-saida-create` tenta gravar `autentique_documento_id` e `autentique_url` mas o update falha silenciosamente
2. O webhook `autentique-webhook` tenta gravar `termo_saida_assinado` mas tambem falha
3. O polling no modal busca `termo_saida_assinado` que nunca existe, entao nunca detecta a assinatura
4. O botao "Liberar Veiculo" nunca aparece

## Solucao

### 1. Adicionar colunas via SQL (migration)

Executar o seguinte SQL no banco:

```sql
ALTER TABLE ordens_servico
  ADD COLUMN IF NOT EXISTS autentique_documento_id text,
  ADD COLUMN IF NOT EXISTS autentique_url text,
  ADD COLUMN IF NOT EXISTS termo_saida_assinado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS termo_saida_assinado_em timestamptz,
  ADD COLUMN IF NOT EXISTS termo_saida_url text;
```

### 2. Atualizar tipos TypeScript

Arquivo `src/integrations/supabase/types.ts` - adicionar os campos ao tipo `ordens_servico` (Row, Insert, Update) para que o TypeScript reconheca essas colunas e elimine os `as any` espalhados pelo codigo.

### 3. Atualizar o select do hook `useOrdemServico`

Arquivo `src/hooks/useOrdensServico.ts` - garantir que o select do detalhe da OS inclua os novos campos (`autentique_documento_id`, `autentique_url`, `termo_saida_assinado`, `termo_saida_assinado_em`, `termo_saida_url`) para que o modal tenha acesso a esses dados.

## Resultado esperado
- Edge function grava `autentique_documento_id` e `autentique_url` com sucesso
- Webhook grava `termo_saida_assinado = true` quando assinatura ocorre
- Polling no modal detecta `termo_saida_assinado = true` e mostra botao "Liberar Veiculo"
- Fluxo completo funciona de ponta a ponta

## Arquivos alterados
- SQL migration (novas colunas)
- `src/integrations/supabase/types.ts` (tipos)
- `src/hooks/useOrdensServico.ts` (select)

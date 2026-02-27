
# Exibir Valor Adicional na Proposta de Contrato (Termo de Afiliacao)

## Problema
O valor adicional da mensalidade (campo `valor_adicional` da cotacao) nao aparece discriminado na proposta/termo de afiliacao assinado pelo associado. Atualmente, o `valor_mensal` do contrato ja inclui o adicional (pois e copiado de `valor_total_mensal`), mas o associado nao consegue ver a composicao do valor.

## Solucao

### 1. Passar `valor_adicional` da cotacao para o contrato

**Arquivo:** `supabase/functions/contrato-gerar/index.ts`
- Na insercao do contrato (linha ~540), adicionar: `valor_adicional: cotacao.valor_adicional || 0`

### 2. Adicionar `valor_adicional` ao mapeamento de dados do template

**Arquivo:** `supabase/functions/_shared/termo-afiliacao-utils.ts`
- Adicionar campo `valor_adicional` na interface `ContratoData` (linha ~64)
- No `mapearDadosParaTemplate`, mapear: `valor_adicional: contrato.valor_adicional || 0`

### 3. Criar variavel de template para valor adicional

**Arquivo:** `supabase/functions/_shared/template-utils.ts`
- No `criarMapeamentoVariaveis`, adicionar:
  - `'contrato.valor_adicional'`: valor formatado em moeda
  - `'contrato.valor_mensal_base'`: valor mensal SEM o adicional (para mostrar composicao)
  - `'contrato.valor_mensal_total'`: alias de `contrato.valor_mensal` (ja existente, que inclui adicional)

### 4. Atualizar template hardcoded (fallback)

**Arquivo:** `supabase/functions/_shared/termo-afiliacao-template.ts`
- Na tabela de valores, apos "Quota Mensal Estimada", adicionar linha condicional mostrando "Valor Adicional" quando > 0, e exibir o total mensal

### 5. Deploy das edge functions afetadas

Funcoes a redeployar: `contrato-gerar`, `autentique-create`, `autentique-create-by-token`

## Resultado
- O template tera as variaveis `{{contrato.valor_adicional}}` e `{{contrato.valor_mensal_base}}` disponiveis
- O template hardcoded (fallback) exibira automaticamente a linha de valor adicional quando houver
- Templates personalizados no banco poderao usar as novas variaveis

## Arquivos Modificados (4)
1. `supabase/functions/contrato-gerar/index.ts`
2. `supabase/functions/_shared/termo-afiliacao-utils.ts`
3. `supabase/functions/_shared/template-utils.ts`
4. `supabase/functions/_shared/termo-afiliacao-template.ts`

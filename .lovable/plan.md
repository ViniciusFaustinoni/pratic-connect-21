

# Plano: Tornar Planos e Benefícios Dinâmicos (Eliminar Hardcoded)

## Diagnóstico

A análise revelou **7 locais** onde dados de planos, coberturas e preços estão hardcoded no código em vez de vir do banco de dados. O sistema principal de cotação do vendedor (`usePlanosCotacao.ts`) já é dinâmico, mas há vários fluxos paralelos e auxiliares que ainda usam dados fixos.

---

## Problemas Encontrados

### 1. `src/types/cotacaoPublica.ts` — Coberturas fixas por categoria
- `COBERTURAS_POR_PLANO` (linhas 150-182): lista hardcoded de coberturas para Básico/Completo/Premium
- `CategoriaPlano` (linha 12): enum fixo `'Básico' | 'Completo' | 'Premium'` — não reflete planos reais do banco (SELECT, ESPECIAL, ADVANCED, etc.)

### 2. `src/hooks/useCalcularCotacao.ts` — Cotação pública totalmente hardcoded
- Preços fallback fixos: `99.90 / 134.87 / 169.83` e adesão `249 / 349 / 449` (linhas 59-63)
- Usa `COBERTURAS_POR_PLANO` hardcoded
- Tags fixas: `'Mais Popular'` e `'Mais Completo'` (linhas 90-91)
- Categorias fixas `['Básico', 'Completo', 'Premium']` — ignora os planos reais

### 3. `src/hooks/useGerarCotacaoPDF.ts` — PDF com coberturas e valores fixos
- `COBERTURAS_POR_PLANO` (linhas 15-40): coberturas diferentes do `cotacaoPublica.ts` (inconsistência)
- `VALORES_PLANO` (linhas 43-47): valores fixos `189.90 / 249.90 / 299.90` — nada a ver com os valores reais
- Planos fixos em `basico / completo / premium`

### 4. `src/pages/vendas/ContratoDetalhe.tsx` — Coberturas mock no detalhe do contrato
- `COBERTURAS_POR_PLANO` (linhas 102-129): terceira versão hardcoded diferente das outras duas
- Faz fallback para `basico` baseado no nome do plano (linha 405)

### 5. `src/config/pricing.ts` — Tabela inteira de preços estática (539 linhas)
- Centenas de preços fixos por região/combustível/categoria
- `ADICIONAIS` com valores fixos (vidros R$29.90, carro reserva R$49.90, etc.)
- Usado por `useCotacaoAvancada.ts` e `QuoteCalculatorModal.tsx`

### 6. `src/hooks/usePlanosCotacao.ts` — Fallbacks hardcoded residuais
- Cota participação fallback `6%` / `R$1.200` (linhas 267-268) — deveria variar por tipo de veículo
- Adesão fallback `R$199.90` (linha 264)
- Tags e destaques baseados em códigos fixos `select-premium`, `select-basic` (linhas 289-299)
- `ADICIONAL_NIVEL_PADRAO` fixo (linhas 81-85)

### 7. Edge Functions — Fallbacks hardcoded
- `autentique-webhook/index.ts` (linha 504): `cota_participacao || 6`, `cota_minima || 1200`
- `aprovar-sinistro/index.ts` (linha 84): mesmos fallbacks

---

## Correções Propostas

### Fase 1: Coberturas dinâmicas (maior impacto visual)

**Arquivo: `src/hooks/useGerarCotacaoPDF.ts`**
- Remover `COBERTURAS_POR_PLANO` e `VALORES_PLANO` hardcoded
- Receber coberturas e valores como parâmetros da cotação já calculada (que vem do banco via `usePlanosCotacao`)

**Arquivo: `src/pages/vendas/ContratoDetalhe.tsx`**
- Remover `COBERTURAS_POR_PLANO` mock
- Buscar coberturas do plano vinculado ao contrato via `planos_beneficios` + `benefits`

**Arquivo: `src/hooks/useCalcularCotacao.ts`**
- Refatorar para buscar planos reais do banco (como `usePlanosCotacao` já faz)
- Usar coberturas da tabela `planos_beneficios` + `benefits` em vez de `COBERTURAS_POR_PLANO`
- Remover categorias fixas `Básico/Completo/Premium`

### Fase 2: Fallbacks seguros no hook principal

**Arquivo: `src/hooks/usePlanosCotacao.ts`**
- Manter fallbacks mas baseados no tipo de veículo/linha (usar `COTAS_TAXAS` do banco)
- Remover tags hardcoded por código — usar campo `destaque` e `tag` que já existem no banco
- Remover `ADICIONAL_NIVEL_PADRAO` — usar apenas `adicional_mensal` do banco

### Fase 3: Eliminar `src/config/pricing.ts`

- Este arquivo de 539 linhas de preços fixos é usado apenas por `useCotacaoAvancada.ts` e `QuoteCalculatorModal.tsx`
- Migrar esses fluxos para usar `usePlanosCotacao` (que já busca do banco)
- Manter apenas funções utilitárias (`detectarRegiao`, `detectarFaixaFipe`, `formatarMoeda`)

### Fase 4: Edge functions

**Arquivos: `autentique-webhook/index.ts`, `aprovar-sinistro/index.ts`**
- Alterar fallbacks de `6% / R$1.200` para buscar do plano do associado — os dados já estão disponíveis no objeto `plano` consultado

---

## Resumo de Alterações

| Arquivo | Ação |
|---|---|
| `src/hooks/useCalcularCotacao.ts` | Refatorar: buscar planos e coberturas do banco |
| `src/hooks/useGerarCotacaoPDF.ts` | Remover hardcoded, receber dados como parâmetro |
| `src/pages/vendas/ContratoDetalhe.tsx` | Buscar coberturas do banco via join |
| `src/hooks/usePlanosCotacao.ts` | Remover tags/destaques por código fixo, usar campos do banco |
| `src/config/pricing.ts` | Manter apenas utilitários, remover tabelas de preço |
| `src/hooks/useCotacaoAvancada.ts` | Migrar para usar hook dinâmico |
| `src/types/cotacaoPublica.ts` | Remover `COBERTURAS_POR_PLANO` e `CategoriaPlano` fixos |
| `supabase/functions/autentique-webhook/index.ts` | Usar cota do plano real |
| `supabase/functions/aprovar-sinistro/index.ts` | Usar cota do plano real |

9 arquivos. Sem alterações de schema no banco — os dados já existem nas tabelas `planos`, `planos_beneficios` e `benefits`.


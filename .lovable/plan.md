
# Auditoria Completa: Cotação, Autentique, ASAAS e Rateio — Diagnóstico e Plano

## Status Geral

| Fluxo | Status |
|-------|--------|
| Cotação — precificação via `usePlanosCotacao` | OK — dinâmico do banco |
| Cotação — precificação via `useCalcularCotacao` (público) | OK — dinâmico do banco |
| Cotação — filtragem por categoria bloqueada | OK — corrigido na sessão anterior |
| Contrato-gerar — valores propagados | OK — lê `valor_adesao` e `valor_mensal` da cotação |
| ASAAS — sandbox, status, régua | OK — corrigido na sessão anterior |
| Rateio — `calcular-rateio-completo` | OK — usa edge function dedicada |
| Gerar cobranças mensais — `valor_mensal` do contrato | OK — lê do banco |

## Problemas Encontrados

### 1. `plano.cobertura_fipe` HARDCODED no Autentique (template-utils)

**Arquivo**: `supabase/functions/_shared/template-utils.ts` (linha 98)

```typescript
'plano.cobertura_fipe': '100%',  // ← HARDCODED
```

O plano Especial tem 80% FIPE, mas o termo de afiliação enviado pelo Autentique sempre exibe "100%". Isso é um erro contratual — o associado de um plano Especial recebe um documento dizendo que tem cobertura de 100% da FIPE quando na verdade é 80%.

**Correção**: Ler `cobertura_fipe` do plano. O campo já existe na tabela `planos` e é propagado via join em `autentique-create`.

```typescript
'plano.cobertura_fipe': `${dados.plano.cobertura_fipe || 100}%`,
```

E adicionar o campo na interface `PlanoData` e no `mapearDadosParaTemplate`.

### 2. `cota_participacao` e `cota_minima` com fallbacks hardcoded no Autentique

**Arquivo**: `supabase/functions/_shared/termo-afiliacao-utils.ts` (linhas 333-334)

```typescript
cota_participacao: plano?.cota_participacao || 6,
cota_minima: plano?.cota_minima || 1200,
```

E em `template-utils.ts` (linhas 99, 101):
```typescript
'plano.cota_participacao': `${dados.plano.cota_participacao || 6}%`,
'plano.cota_minima': formatCurrency(dados.plano.cota_minima || 1200),
```

Esses valores vêm do plano do banco (que já tem os campos preenchidos), então os fallbacks raramente disparam. Mas para planos de aplicativo, a cota é 8% e a mínima R$ 2.000 — e esses valores estão na **cotação**, não no plano base.

**Correção**: Propagar `cota_participacao` e `cota_minima` do contrato (que herda da cotação) em vez de depender exclusivamente do plano. Adicionar campos `cota_participacao` e `cota_minima` no insert do contrato em `contrato-gerar`, lidos da cotação.

### 3. Contrato-gerar não propaga `cobertura_fipe` do plano para o contrato

**Arquivo**: `supabase/functions/contrato-gerar/index.ts` (linha 538)

O contrato é criado com `plano_id` mas não grava `cobertura_fipe` diretamente. O `autentique-create` faz join com `planos(*)`, então **tecnicamente** o dado está disponível — o problema é que o `mapearDadosParaTemplate` não o extrai.

---

## Plano de Correção

### Fase 1: Corrigir `cobertura_fipe` no template Autentique

**Arquivo 1**: `supabase/functions/_shared/termo-afiliacao-utils.ts`
- Adicionar `cobertura_fipe?: number` na interface `PlanoData`
- No `mapearDadosParaTemplate`, adicionar: `cobertura_fipe: plano?.cobertura_fipe || 100`

**Arquivo 2**: `supabase/functions/_shared/template-utils.ts`
- Linha 98: mudar de `'100%'` para `\`${dados.plano.cobertura_fipe || 100}%\``

### Fase 2: Propagar cota contextual para o Autentique

**Arquivo**: `supabase/functions/_shared/termo-afiliacao-utils.ts`
- No `mapearDadosParaTemplate`, usar cota do contrato quando disponível:

```typescript
cota_participacao: contrato.cota_participacao || plano?.cota_participacao || 6,
cota_minima: contrato.cota_minima || plano?.cota_minima || 1200,
```

**Arquivo**: `supabase/functions/contrato-gerar/index.ts`
- Propagar cota da cotação para o contrato no insert (se os campos existirem na tabela `contratos`). Verificar schema — se não existirem, criar migração.

### Fase 3: Verificar se campos existem na tabela contratos

Precisamos confirmar se `cota_participacao`, `cota_minima` e `cobertura_fipe` existem na tabela `contratos`. Se não, criar migração para adicioná-los.

---

## Resumo

| Correção | Impacto | Risco |
|----------|---------|-------|
| `cobertura_fipe` hardcoded '100%' no Autentique | ALTO — erro contratual para planos Especial (80%) | Contratual |
| Cota contextual não propagada | MÉDIO — associados de app recebem cota errada no documento | Contratual |

Correções cirúrgicas: ~3 arquivos de edge functions, possivelmente 1 migração para campos no contrato.

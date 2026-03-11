

# Auditoria: Planos e Benefícios (Vendas) — Problemas e Correções

## Problemas Encontrados

### 1. Bug visual: "0" aparece ao lado do nome do plano (CRÍTICO)

**Arquivo**: `PlanoCardDynamic.tsx`, linha 104

```tsx
{plan.additional_price && plan.additional_price > 0 && (...)}
```

Quando `additional_price` é `0`, o JavaScript avalia `0 && ...` como `0`, e o React renderiza o literal **"0"** na tela. É por isso que todos os cards mostram "SELECT BASIC **0**", "SELECT PREMIUM **0**", etc.

**Correção**: Trocar por `{plan.additional_price != null && plan.additional_price > 0 && (...)}` ou simplesmente `{Number(plan.additional_price) > 0 && (...)}`.

### 2. Calculadora de Preço com mapeamento de cobertura invertido

**Arquivo**: `CalculadoraPreco.tsx`, linhas 85-88

```typescript
const slugCobertura = {
  basica: 'select',      // ERRADO: Select é a linha principal, não básica
  completa: 'lancamento', // ERRADO: Lançamento é só para veículos novos
  premium: 'especial',    // ERRADO: Especial é 80% FIPE, o oposto de premium
};
```

Além disso, a calculadora não filtra por **região** nem **combustível**, misturando preços de RJ, SP e Lagos.

**Correção**: Remover o filtro por cobertura (confuso e incorreto) e adicionar seletor de região. Usar o `mapearRegiaoParaPricing` já existente.

### 3. Alerta de deságio hardcoded na Visão Geral

**Arquivo**: `PlanosBeneficios.tsx`, linhas 222-228

```tsx
<strong> 8% (mínimo R$2.000)</strong>
```

O componente `TabelaCotasTaxas` no Glossário já lê esses valores dinamicamente do banco, mas o alerta na aba Visão Geral tem o texto fixo.

**Correção**: Usar os mesmos hooks (`useCotasTaxas`) para derivar os valores dinamicamente.

### 4. TabelaPrecos mostra dados brutos sem filtro

A tabela mostra as primeiras 20 linhas de `tabelas_preco_mensalidade` sem filtro por região ou linha — mistura tudo e corta arbitrariamente. Pouco útil para o consultor.

**Correção**: Adicionar filtros de região e linha de produto, com paginação adequada.

## Plano de Implementação

### Fase 1: Corrigir bug do "0" no card (1 linha)
- `PlanoCardDynamic.tsx` linha 104: `{Number(plan.additional_price) > 0 && (...)}`

### Fase 2: Corrigir Calculadora de Preço
- Remover mapeamento de cobertura incorreto
- Adicionar seletor de **região** (RJ, Lagos, SP)
- Filtrar resultados por região usando `mapearRegiaoParaPricing`
- Mostrar nome da linha de produto em vez de slug técnico

### Fase 3: Tornar alerta de deságio dinâmico
- `PlanosBeneficios.tsx`: importar hooks de config para ler cota_desagio e mínimo do banco
- Substituir texto hardcoded pelo valor dinâmico

### Fase 4: Melhorar TabelaPrecos
- Adicionar filtros de região e linha de produto
- Mostrar "Consulte um consultor" quando não há dados (conforme policy de UI)
- Remover limite arbitrário de 20 linhas, usar agrupamento por linha

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/planos/PlanoCardDynamic.tsx` | Fix "0" rendering |
| `src/components/planos/CalculadoraPreco.tsx` | Região + remover mapeamento errado |
| `src/pages/vendas/PlanosBeneficios.tsx` | Alerta deságio dinâmico |
| `src/components/planos/TabelaPrecos.tsx` | Filtros de região/linha |




# Plano: Correção Final — Planos e Benefícios Dinâmicos

## Problemas Restantes

### P1: `Cotador.tsx` — `mapearPlanosParaExibicao` hardcoded (linhas 237-293)
O `usePlanosCotacao` já retorna `PlanoCotacao[]` com valores calculados, coberturas do banco, destaque e tag dinâmicos. Mas o `Cotador.tsx` ignora tudo isso e recalcula com percentuais fixos (`0.004/0.0055/0.007`), fallback de coberturas por código (`BASICO/TOTAL/PREMIUM`), e destaque fixo no `isCompleto`. A função `mapearPlanosParaExibicao` é 100% redundante.

### P2: `AppPlano.tsx` — Benefícios e coberturas 100% hardcoded (linhas 40-116)
`BENEFICIOS_POR_TIPO` e `COBERTURAS` são constantes fixas. Qualquer alteração no admin não reflete no app do associado. O `useMyAssociado` busca `planos(id, codigo, nome, descricao, tipo_uso, valor_adesao)` mas não inclui benefícios.

### P3: `CardPlano.tsx` — Mesma duplicação do P2 (linhas 48-72)
Hardcoded idêntico ao AppPlano.

### P4: `CotacaoPublica.tsx` — `getDescricaoCategoria` fixo + fallback coberturas hardcoded (linhas 170-221)
Usa `getDescricaoCategoria(categoria)` do `pricing.ts` (hardcoded BASIC/PREMIUM/EXCLUSIVE), e quando `planos.coberturas` é null, renderiza coberturas fixas por categoria.

---

## Correções

### Fase A: Cotador.tsx — Eliminar `mapearPlanosParaExibicao`

Remover a função `mapearPlanosParaExibicao` (linhas 237-293) e usar diretamente os dados de `planosDB` (que já são `PlanoCotacao[]` do hook `usePlanosCotacao`). Ajustar o `useMemo` na linha 426-431 e a interface `PlanoCalculado` para alinhar com `PlanoCotacao`. Atualizar os componentes de renderização que referenciam campos do `PlanoCalculado` antigo.

### Fase B: AppPlano.tsx + CardPlano.tsx — Benefícios dinâmicos

1. Expandir o select do `useMyAssociado` em `useMyData.ts` para incluir benefícios:
```
planos (
  id, codigo, nome, descricao, tipo_uso, valor_adesao, coberturas,
  planos_beneficios (
    id, included, benefits (id, name, description, icon)
  )
)
```

2. Em `AppPlano.tsx`: remover `BENEFICIOS_POR_TIPO` e `COBERTURAS` constantes. Renderizar benefícios de `plano.planos_beneficios` onde `included = true`. Para coberturas, usar `plano.coberturas` (array do banco).

3. Em `CardPlano.tsx`: aceitar `beneficios` e `coberturas` como props opcionais. Remover as constantes `BENEFICIOS_POR_TIPO` e `COBERTURAS` hardcoded. Quando props não fornecidas, mostrar seção vazia.

### Fase C: CotacaoPublica.tsx — Usar descrição e coberturas do banco

Remover import de `getDescricaoCategoria` do `pricing.ts`. Usar `cotacao.planos?.descricao` diretamente. Remover o bloco de fallback hardcoded (linhas 183-221) — se não há coberturas no banco, não mostrar nada em vez de mostrar dados fictícios.

### Fase D: Limpeza de `pricing.ts`

Remover `getDescricaoCategoria` (já não será usada). Manter `formatarMoeda` (usada por CotacaoPublica e CotacaoContratacao) e funções utilitárias.

---

## Resumo

| Arquivo | Ação |
|---|---|
| `src/pages/vendas/Cotador.tsx` | Remover `mapearPlanosParaExibicao`, usar `PlanoCotacao` direto |
| `src/hooks/useMyData.ts` | Expandir select do associado com benefícios do plano |
| `src/pages/app/AppPlano.tsx` | Remover constantes hardcoded, usar dados do banco |
| `src/components/app/CardPlano.tsx` | Receber benefícios/coberturas como props |
| `src/pages/public/CotacaoPublica.tsx` | Usar descrição do banco, remover fallback fixo |
| `src/config/pricing.ts` | Remover `getDescricaoCategoria` |

6 arquivos.


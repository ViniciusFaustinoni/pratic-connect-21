

# Fix: Benefícios e coberturas excluídos indevidamente da cotação

## Problema
Itens como **Rastreador** e **Assistência 24h** aparecem como "não cobre" na cotação do Voyage QOO5C17 (FIPE ~R$46k), mesmo estando incluídos no plano Select Basic. Há dois bugs distintos no motor de cotação.

## Causa raiz

### Bug 1 — `fipe_range` misturado com elegibilidade
A função `checkAllRules` avalia TODAS as regras, incluindo `fipe_range` (que é regra de **precificação**, não de elegibilidade). Embora hoje as coberturas com `fipe_range` tenham min=0/max=180k (que passa para a maioria dos veículos), a arquitetura está errada e pode causar falsos negativos em cenários de borda.

### Bug 2 — Coberturas não verificadas individualmente para elegibilidade
O loop de elegibilidade individual (linhas 660-677) só verifica **benefícios** (`planos_beneficios`). As **coberturas** vinculadas via `planos_coberturas` nunca são verificadas para regras de `regiao`, `combustivel`, `tipo_uso`, etc. Se no futuro uma cobertura tiver essas regras, elas seriam ignoradas.

### Bug 3 — Preço de benefícios não resolve FIPE variável
`somaBeneficios` usa apenas `preco_sugerido` fixo. Se um benefício tiver regra `fipe_range` com faixas de preço, o valor não é resolvido (diferente das coberturas que já fazem isso).

## Solução

### Arquivo: `src/hooks/usePlanosCotacao.ts`

**1. Separar `fipe_range` de elegibilidade no loop de benefícios (linhas 660-677)**
Ao verificar regras de cada benefício, filtrar `fipe_range` antes de chamar `checkAllRules`:
```ts
const benefitRules = allEligibilityRules
  .filter(r => r.entity_type === 'beneficio' && r.entity_id === pb.benefit_id)
  .filter(r => r.rule_type !== 'fipe_range'); // fipe_range é pricing, não elegibilidade
```

**2. Adicionar loop de elegibilidade para coberturas individuais**
Após o loop de benefícios, adicionar verificação das coberturas:
```ts
for (const pc of coberturasDoPlano) {
  const cobId = (pc as any).cobertura_id;
  const cobRules = allEligibilityRules
    .filter(r => r.entity_type === 'cobertura' && r.entity_id === cobId)
    .filter(r => r.rule_type !== 'fipe_range'); // só elegibilidade
  if (cobRules.length > 0 && !checkAllRules(cobRules, vehicleCtx)) {
    const cobNome = (pc as any).coberturas?.nome;
    if (cobNome && !coberturasRemovidas.includes(cobNome)) {
      coberturasRemovidas.push(cobNome);
    }
  }
}
```

**3. Resolver preço FIPE para benefícios (não só coberturas)**
Alterar `somaBeneficios` para verificar se o benefício tem `fipe_range` e resolver valor por faixa:
```ts
const somaBeneficios = (plano.planos_beneficios || []).reduce((acc, pb) => {
  const fipeRule = allEligibilityRules.find(
    r => r.entity_type === 'beneficio' && r.entity_id === pb.benefit_id
      && r.rule_type === 'fipe_range' && r.is_active
  );
  if (fipeRule) {
    const faixas = fipeRule.rule_config?.faixas || [];
    const faixa = faixas.find(f => valorFipe >= f.de && valorFipe < f.ate);
    return acc + (faixa ? Number(faixa.valor) : 0);
  }
  return acc + Number(pb.benefits?.preco_sugerido || 0);
}, 0);
```

## Impacto
- Rastreador, Assistência e outros benefícios passam a ser exibidos corretamente quando o veículo atende às regras de elegibilidade (região, combustível, tipo de uso, FIPE)
- Regras de `fipe_range` são usadas APENAS para precificação, nunca para inclusão/exclusão
- Coberturas e benefícios com preço variável por FIPE são corretamente totalizados no valor mensal


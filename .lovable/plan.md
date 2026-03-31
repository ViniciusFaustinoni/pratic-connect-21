

# Fix: Itens com preço variável por FIPE mostram R$ 0,00 no formulário do plano

## Problema
Coberturas/benefícios configurados com "Varia com FIPE" têm o campo estático (`valor` / `preco_sugerido`) zerado — o preço real está nas regras `fipe_range` da tabela `entity_eligibility_rules`. O formulário do plano só lê o campo estático, então exibe R$ 0,00.

## Solução

### Arquivo: `src/components/gestao-comercial/PlanoFormSheet.tsx`

1. **Buscar regras `fipe_range` ativas** para todas as coberturas e benefícios (uma query adicional ao montar o formulário)

2. **Exibir "Variável" em vez de R$ 0,00** — para itens que possuem regra `fipe_range`, mostrar um badge "Variável por FIPE" no lugar do preço estático

3. **Ajustar o cálculo de `valorTotal`** — excluir itens com `fipe_range` da soma (já que o valor depende do veículo), e exibir uma nota "(+ itens variáveis)" ao lado do total quando houver itens FIPE-variáveis selecionados

### Detalhes técnicos

- Nova query: `entity_eligibility_rules` filtrada por `rule_type = 'fipe_range'` e `is_active = true`
- Criar um `Set<string>` de entity_ids que têm fipe_range
- Na renderização de cada item: se está no set, mostrar badge "Variável por FIPE" em vez do valor
- No `valorTotal`: adicionar flag `temVariaveis` para indicar que o total é parcial


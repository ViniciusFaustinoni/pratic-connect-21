

## Plano: Aplicar Filtros da Cotação na Calculadora de Preço

### Problema

A calculadora atual (`CalculadoraPreco.tsx`) usa uma lógica própria simplificada para filtrar planos — verifica apenas tipo de veículo (via `vehicle_type` da product_line), FIPE min/max do plano, e preço na tabela. Faltam os filtros que o Cotador aplica:

- Ano mínimo do plano / `requires_recent_year`
- Categorias bloqueadas (`blocked_categories`)
- Exclusão de variantes internas "aplicativo"
- Elegibilidade por modelo (quando veículo é identificado via placa)
- Filtro `supports_app` quando uso é aplicativo

Além disso, o tipo de veículo "elétrico" deve ser simplificado — o user quer apenas **Carro** e **Moto** (elétrico fica dentro de carro, a lógica de pricing nacional já existe na tabela de preços).

### Alterações

**Arquivo:** `src/components/planos/CalculadoraPreco.tsx`

1. **Remover tipo "elétrico" do seletor** — manter apenas Carro e Moto. Remover `TipoVeiculo = 'eletrico'`, o ToggleGroupItem de elétrico, a nota informativa e a lógica `tipoVeiculo === 'eletrico'` para ignorar região. A detecção de elétrico via placa passa a retornar `'carro'`.

2. **Adicionar campo "Ano do Veículo"** — input numérico opcional. Auto-preenchido quando placa é consultada (extrair do campo `ano` do veículo). Usado para aplicar os filtros de ano mínimo.

3. **Aplicar filtros do Cotador no `calcular()`:**
   - Excluir planos com `tipo_uso === 'aplicativo'` ou `categoria === 'aplicativo'` (variantes internas)
   - Verificar `ano_minimo` / `ano_minimo_veiculo` / `ano_fabricacao_minimo` contra o ano informado
   - Verificar `requires_recent_year` da product_line (ano >= anoAtual - 1)
   - Verificar `blocked_categories` da product_line (se categoria informada)
   - Verificar `supports_app` quando `tipoUso === 'aplicativo'`

4. **Buscar dados adicionais no `usePlanosComPrecoMap`:**
   - Expandir a query de planos para incluir `tipo_uso, ano_minimo, ano_minimo_veiculo, ano_fabricacao_minimo`
   - Expandir a query para incluir dados de `product_lines` (via join ou query separada): `requires_recent_year`, `blocked_categories`, `supports_app`, `vehicle_type`, `sort_priority`

5. **Ordenação** — usar `sort_priority` da product_line (como o Cotador) em vez de apenas preço.

### O que NÃO muda

- Não reutiliza `usePlanosCotacao` diretamente (é pesado demais, carrega elegibilidade, cotas, decomposição, etc.)
- Sem elegibilidade por modelo na calculadora (isso é do Cotador completo)
- Sem campos de categoria/marca/modelo manuais — a calculadora é rápida: placa (opcional) + FIPE + ano + tipo + uso + região

### Arquivos afetados

- `src/components/planos/CalculadoraPreco.tsx` — todas as alterações concentradas neste arquivo


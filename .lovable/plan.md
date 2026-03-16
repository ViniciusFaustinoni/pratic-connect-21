

## Plano: Adicionar filtro "Tipo de Veículo" na seleção manual

### Problema
Atualmente, a lista de marcas mistura carros e motos. O vendedor precisa procurar entre centenas de marcas sem distinção clara. O pedido é adicionar um seletor "Carro / Moto" antes da marca, filtrando as opções subsequentes.

### Edições

**`src/components/cotacoes/CotacaoFormDialog.tsx`**

1. **Adicionar um seletor de tipo** entre o divisor "ou selecione manualmente" e os dropdowns de Marca/Modelo/Ano. Dois botões ou um Select simples com opções "Carro" e "Moto", ligado ao state `tipoFipeSelecionado`.

2. **Filtrar marcas pelo tipo selecionado**: No dropdown de Marca, filtrar `marcas` por `m.tipoFipe === tipoFipeSelecionado` ao invés de mostrar todas. Isso elimina a necessidade do sufixo "(Moto)/(Carro)" nas labels duplicadas.

3. **Resetar seleções ao trocar tipo**: Quando o vendedor muda de "Carro" para "Moto" (ou vice-versa), limpar `marcaSelecionada`, `modeloSelecionado`, `anoSelecionado`, `modelos`, `anos` e `valor_fipe`.

4. **Layout**: Mudar o grid de `grid-cols-3` para `grid-cols-4` com o primeiro campo sendo "Tipo", seguido de Marca, Modelo, Ano. Alternativa: colocar o Tipo acima em linha separada com dois botões toggle (visualmente mais claro).

### Resultado
- Vendedor escolhe "Moto" → só vê marcas de moto (HONDA, YAMAHA, etc.)
- Vendedor escolhe "Carro" → só vê marcas de carro
- Marca, modelo e ano resetam ao trocar tipo
- Planos filtrados corretamente via `tipoFipeSelecionado` já existente




## Plano: Badges de atribuição e filtros no catálogo de Coberturas e Benefícios

### O que muda
Na lista do catálogo global (aba Coberturas e aba Benefícios), cada item mostrará um badge com o nome do plano ao qual está atribuído (ou "Sem plano" se não estiver vinculado). Além disso, um filtro de atribuição será adicionado para mostrar apenas itens atribuídos, não atribuídos, ou de um plano específico.

### Detalhes técnicos

**`src/components/gestao-comercial/CatalogoCoberturasBeneficios.tsx`**

1. **Buscar vínculos**: Adicionar duas queries:
   - `planos_coberturas` com `select('cobertura_id, plano_id, planos(nome)')` → mapa `coberturaId → nomePlano`
   - `planos_beneficios` com `select('benefit_id, plano_id, planos(nome)')` → mapa `benefitId → nomePlano`

2. **Novos estados de filtro**: `cobAttrFilter` e `benAttrFilter` com valores `'todos' | 'atribuidos' | 'nao_atribuidos'`

3. **Select de filtro**: Adicionar um `<Select>` ao lado do ordenação em cada aba com opções: "Todos", "Atribuídos", "Não atribuídos"

4. **Filtro na função `filterAndSort`**: Aplicar filtro de atribuição antes da ordenação, consultando o mapa de vínculos

5. **Badge no `ItemList`**: Receber prop `attrMap` (Record de id → nome do plano). Ao lado do nome do item, exibir:
   - Badge verde com nome do plano se atribuído
   - Badge cinza "Sem plano" se não atribuído

### Arquivos
- `src/components/gestao-comercial/CatalogoCoberturasBeneficios.tsx` (único arquivo alterado)


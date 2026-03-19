

# Botão "Se fechar hoje?" na página Planos e Benefícios

## Resumo

Adicionar um botão ao lado da Calculadora na página Planos e Benefícios que, ao clicar, mostra as duas datas de vencimento possíveis para um associado que fechar no dia atual. Usa a mesma lógica já existente no cotador (`CotacaoFormDialog`).

## Implementação

### Arquivo: `src/pages/vendas/PlanosBeneficios.tsx`

Adicionar um novo componente inline (ou um Popover) ao lado do botão `<CalculadoraPreco />`:

- **Botão**: ícone de calendário + texto "Se fechar hoje?" (ou similar)
- **Ao clicar**: abre um Popover mostrando:
  - Data de hoje formatada
  - As duas opções de vencimento calculadas (ex: "Dia 15" e "Dia 20")
  - Texto claro: "Se o associado fechar hoje, as opções de vencimento são: **dia X** ou **dia Y**"

### Lógica de cálculo

Extrair a lógica de `opcoesVencimento` (linhas 230-241 do `CotacaoFormDialog.tsx`) para uma função utilitária reutilizável em `src/utils/vencimento.ts`:

```typescript
export function calcularOpcoesVencimento(diaHoje: number): [number, number] {
  if (diaHoje >= 30 || diaHoje <= 4) return [5, 10];
  if (diaHoje >= 5 && diaHoje <= 9) return [10, 15];
  if (diaHoje >= 10 && diaHoje <= 14) return [15, 20];
  if (diaHoje >= 15 && diaHoje <= 19) return [20, 25];
  if (diaHoje >= 20 && diaHoje <= 24) return [25, 30];
  if (diaHoje >= 25 && diaHoje <= 29) return [30, 5];
  return [5, 10];
}
```

### Refatorar `CotacaoFormDialog.tsx`

Substituir a lógica inline do `useMemo` por chamada a `calcularOpcoesVencimento()` para evitar duplicação.

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/utils/vencimento.ts` | Criar — função utilitária |
| `src/pages/vendas/PlanosBeneficios.tsx` | Adicionar botão com Popover |
| `src/components/cotacoes/CotacaoFormDialog.tsx` | Refatorar para usar função compartilhada |

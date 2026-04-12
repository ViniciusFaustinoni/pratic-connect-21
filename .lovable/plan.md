

## Plano: Padronizar ordem dos badges de elegibilidade

### Problema
Os badges de elegibilidade (Região, Tipo de Uso, Combustível, etc.) aparecem na ordem em que vêm do banco de dados, que pode variar entre coberturas e benefícios, causando inconsistência visual.

### Solução
Ordenar as regras visíveis no componente `RuleBadges` com uma ordem fixa antes de renderizar.

### Alteração em `src/components/gestao-comercial/LinhasPlanos.tsx`

No `RuleBadges`, após filtrar as regras visíveis (linha 112), aplicar um sort baseado em uma ordem predefinida:

```text
Ordem fixa:
1. regiao
2. tipo_uso
3. combustivel
4. tipo_placa
5. ano_range
6. marca_modelo
7. (qualquer outro tipo)
```

Isso é uma mudança de ~5 linhas — adicionar um array de prioridade e um `.sort()` no `visibleRules`.

### Resultado
Todos os badges de coberturas e benefícios seguirão sempre a mesma ordem: Região → Tipo de Uso → Combustível → demais regras.




# Calculadora de Preço — Diagnóstico e Correção

## Problemas Identificados

### 1. Lógica de preço incorreta: fatores multiplicativos em vez do modelo V12

A calculadora aplica "fatores de risco" (ex: `*1.15` para veículo antigo, `*1.20` para uso trabalho) sobre o `valor_mensal` da tabela. Isso é **errado** — o modelo V12 define:

- **Uso aplicativo**: resolvido por `resolverPrecoApp()` (adicional fixo ou coluna dedicada, dependendo da linha/região)
- **Veículo antigo**: não existe fator multiplicativo na tabela de preços — a tabela já tem faixas FIPE separadas

A calculadora inventa preços que não existem no banco.

### 2. Não filtra por `tipo_uso` na tabela

A query retorna todas as linhas (particular + aplicativo misturadas). O resultado mostra valores duplicados ou inconsistentes.

### 3. Dropdown "Cobertura" ainda visível (screenshot)

O screenshot mostra o dropdown de cobertura com mapeamento errado ainda presente. O código atual já removeu, mas a lógica de cálculo continua sem usar o modelo correto.

## Plano de Correção

### Reescrever a função `calcular()` usando o modelo V12

1. **Remover fatores multiplicativos** (`FATOR_VEICULO_ANTIGO`, `FATOR_USO_TRABALHO`) — não se aplicam ao modelo de tabela
2. **Filtrar por `tipo_uso`**: usar `resolverTipoUsoQuery()` para determinar qual `tipo_uso` buscar na tabela
3. **Aplicar adicional app**: usar `resolverPrecoApp()` quando tipo_uso é trabalho/aplicativo
4. **Buscar `adicional_app`** da tabela `configuracoes` (já existe hook em `useConteudosSistema`)
5. **Agrupar resultados por linha** — mostrar cada linha de produto com seu preço, em vez de min/max genérico
6. **Mostrar "Consulte um consultor"** quando não há faixa (conforme policy de UI)

### Resultado esperado

Em vez de "R$ X a R$ Y /mês", mostrar uma lista clara:

```text
Select ........... R$ 189,90/mês
Lançamento ....... R$ 219,90/mês
Especial ......... R$ 249,90/mês
```

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/planos/CalculadoraPreco.tsx` | Reescrever lógica de cálculo com modelo V12 |


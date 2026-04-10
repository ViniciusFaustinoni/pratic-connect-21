

## Plano: Melhorar editor de regra Marca/Modelo/Versao com dropdown hierarquico e anos

### Problema atual
Ao adicionar uma regra de elegibilidade do tipo "Marca / Modelo / Versao" no plano, o formulario mostra 3 campos de texto livre (Marca, Modelo, Versao). O usuario precisa digitar manualmente, sem validacao nem sugestoes.

### Solucao
Substituir os campos de texto por um seletor hierarquico alimentado pela tabela `marcas_modelos`, com:
- Dropdown de marcas (dados do banco)
- Lista colapsavel de modelos ao expandir uma marca
- Multi-selecao (checkboxes) para marcas e modelos
- Campo de anos com multi-selecao (range ou lista)

### Alteracoes

**Arquivo: `src/components/admin/planos/EligibilityRulesEditor.tsx`**

1. Substituir o bloco `ruleType === 'marca_modelo'` (linhas 350-365) por um componente inline que:
   - Usa `useMarcasDistintas()` para listar marcas
   - Ao expandir uma marca, carrega modelos via `useModelosPorMarca(marca)`
   - Permite marcar multiplas marcas e modelos via checkboxes
   - Inclui campo de busca/filtro
   - Adiciona seletor de anos (input numerico com botao "+ Ano" para adicionar multiplos anos a lista)
   - Persiste no `config` como: `{ marcas: [{ marca: "TOYOTA", modelos: ["COROLLA", "HILUX"], anos: [2020, 2021, 2022] }] }`

2. Criar componente `MarcaModeloRuleSelector` (novo arquivo ou inline) que encapsula:
   - ScrollArea com lista de marcas colapsaveis
   - Checkboxes para marca inteira ou modelos especificos
   - Input de busca
   - Seletor de anos (chips removiveis, input para adicionar)

3. Atualizar o `RuleCard` (linhas 148-153) para exibir o resumo do novo formato (ex: "TOYOTA (COROLLA, HILUX) · 2020-2022")

**Arquivo: nenhum outro** — os hooks `useMarcasDistintas` e `useModelosPorMarca` ja existem em `src/hooks/useMarcasModelos.ts`.

### Formato do rule_config salvo

```json
{
  "marcas": [
    { "marca": "TOYOTA", "modelos": ["COROLLA"], "anos": [2020, 2021] },
    { "marca": "HONDA", "modelos": [], "anos": [] }
  ]
}
```

Marcas com `modelos: []` significam "todos os modelos". Anos com `[]` significam "todos os anos".


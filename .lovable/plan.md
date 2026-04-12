

## Plano: Resolver nomes nos RuleCards do EligibilityRulesEditor

### Problema
O `RuleCard` exibe valores brutos (UUIDs para regiões, IDs internos para tipo de uso/combustível/tipo de placa) em vez de nomes legíveis. Também falta o case `tipo_placa` no switch de descrição.

### Solução
Mover os hooks de dados (regiões, tipos de uso, combustíveis, tipos de placa) para o componente pai `EligibilityRulesEditor` e passá-los como lookup maps ao `RuleCard`, que resolverá os valores para nomes.

### Alterações em `src/components/admin/planos/EligibilityRulesEditor.tsx`

**1. Buscar dados de lookup no `EligibilityRulesEditor` (nível pai)**
- Adicionar chamadas a `useRegioes()`, `useConfiguracaoJson('tipos_uso')`, `useCombustiveis()`, `useConfiguracaoJson('tipos_placa')` no componente principal
- Construir maps `Record<string, string>` (id/value → nome/label)
- Passar o objeto de lookups como prop ao `RuleCard`

**2. Atualizar `RuleCard` para resolver nomes**
- Receber prop `lookups` com os maps
- `regiao`: mapear cada UUID via `lookups.regioes[id]` → nome completo
- `tipo_uso`: mapear via `lookups.tiposUso[value]` → label
- `combustivel`: mapear via `lookups.combustiveis[value]` → label
- `tipo_placa`: adicionar case no switch, mapear via `lookups.tiposPlaca[value]` → label

**3. Adicionar case `tipo_placa` no switch de descrição**

### Resultado
- Região mostrará "Rio de Janeiro - Capital e Metropolitana" em vez do UUID
- Combustível mostrará "Diesel" em vez de "diesel"
- Tipo de Placa mostrará o nome configurado
- Tipo de Uso mostrará o label correto


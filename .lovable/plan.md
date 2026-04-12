
## Plano: Corrigir edição de regras de elegibilidade em benefícios

### Problema raiz
O `AddRuleDialog` usa chaves de config diferentes do que está salvo no banco:
- **regiao**: dialog usa `config.regioes`, banco usa `config.values`
- **tipo_uso**: dialog usa `config.tipos`, banco usa `config.values`
- **combustivel**: dialog usa `config.combustiveis`, banco usa `config.values`

Quando o dialog abre para edição, os checkboxes aparecem vazios porque as chaves não batem. E ao salvar, grava com chaves erradas.

### Solução
Padronizar o `AddRuleDialog` para usar `values` como chave universal para todas as regras baseadas em array, alinhando com o formato do `EligibilityConfigSection`.

### Alterações em `src/components/admin/planos/EligibilityRulesEditor.tsx`

**1. Seção Região (linhas 377-392)**
- Trocar `config.regioes` → `config.values`
- Usar `r.id` (UUID) ao invés de `r.codigo` para consistência com o formato novo

**2. Seção Tipo de Uso (linhas 404-419)**
- Trocar `config.tipos` → `config.values`

**3. Seção Combustível (linhas 421-436)**
- Trocar `config.combustiveis` → `config.values`

**4. RuleCard display (linhas 146-183)**
- Atualizar resolução de texto descritivo para ler de `config.values` (com fallback para chaves legadas)

### Resultado
- Clicar em uma regra existente de benefício (ou cobertura/plano) abrirá o dialog com os valores preenchidos corretamente
- Salvar gravará no formato correto (`values`)
- Todas as regras ficam consistentes com o `EligibilityConfigSection`

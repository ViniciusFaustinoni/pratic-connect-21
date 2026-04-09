

## Plano: Exibir regras e variacao FIPE na lista de coberturas/beneficios do plano

### Problema
Na tela de gestao (LinhasPlanos), ao expandir um plano, as coberturas e beneficios mostram apenas nome e valor fixo. Nao exibem:
1. Regras de elegibilidade (tipo_uso, regiao, combustivel, etc.)
2. Valor variavel por FIPE quando a cobertura/beneficio tem regra `fipe_range` ativa

### Alteracao

**`src/components/gestao-comercial/LinhasPlanos.tsx`**

1. **Carregar regras de elegibilidade** — No hook `useLinhasComPlanos`, apos carregar coberturas e beneficios, buscar todas as regras da tabela `entity_eligibility_rules` para os entity_ids de coberturas e beneficios vinculados. Criar um mapa `rulesMap: Map<string, EligibilityRule[]>`.

2. **Propagar dados para a lista** — Cada item em `coberturas_list` e `beneficios_list` recebe um campo `rules: EligibilityRule[]` com suas regras.

3. **Renderizar badges de regras** — Na lista expandida de cada cobertura/beneficio (linhas 430-442 e 453-465):
   - Apos o nome, exibir badges compactos para cada regra ativa:
     - `tipo_uso: include [aplicativo]` → Badge "APP"
     - `tipo_uso: include [passeio]` → Badge "Passeio"
     - `regiao: include [...]` → Badge "Regiao: SP, RJ"
     - `combustivel: include [diesel]` → Badge "Diesel"
     - `tipo_placa: include [mercosul]` → Badge "Mercosul"
   - Badges com cores distintas por tipo de regra

4. **Exibir valor variavel por FIPE** — Se o item tem regra `fipe_range` ativa:
   - Em vez de exibir "R$ 2,50", exibir badge "Variavel por FIPE" (amber)
   - Ou exibir o range: "R$ X ~ R$ Y" baseado nos valores min/max das faixas

### Detalhes tecnicos
- Query adicional no hook: `supabase.from('entity_eligibility_rules').select('*').in('entity_id', [...cobIds, ...benIds]).eq('is_active', true)`
- Mapeamento de `rule_type` + `rule_mode` + `rule_config.values` para labels legíveis
- Reutilizar o pattern ja existente em `PlanoFormSheet` (linha 288-290) para badge "Variavel por FIPE"

### Resultado
- Lista de coberturas mostra visualmente quais regras cada item possui (APP, regiao, combustivel, etc.)
- Valores variaveis por FIPE sao indicados com badge em vez de valor fixo incorreto
- Gestores identificam rapidamente a configuracao de cada item sem precisar abrir o modal de edicao

### Arquivo
- `src/components/gestao-comercial/LinhasPlanos.tsx`


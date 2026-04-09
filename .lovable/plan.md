

## Plano: Duplicar Beneficios por Plano + Corrigir Combustiveis Diesel + Corrigir Ano Especial

### Contexto
Coberturas ja foram isoladas (cada plano tem as suas proprias). Beneficios ainda sao compartilhados: 18 registros na tabela `benefits` servem 198 vinculos em `planos_beneficios`. Alterar regra de um beneficio afeta todos os planos que o usam.

### Parte 1 — Migrar beneficios para exclusivos por plano

**Logica (migration SQL):**
Para cada registro em `planos_beneficios`, clonar o `benefit` original criando um novo registro em `benefits` com:
- `name`: mesmo nome (sem "(copia)" — sao registros de producao)
- `slug`: sufixo unico (`-{plano_id_curto}`)
- Todos os campos copiados (preco_sugerido, carencia_dias, carencia_ativa, etc.)
- Atualizar `planos_beneficios.benefit_id` para apontar ao novo registro
- Copiar regras de `entity_eligibility_rules` do beneficio original para o novo ID
- Copiar exclusoes de `benefit_category_exclusions` do original para o novo ID

**Resultado:** Cada plano tera seus proprios beneficios exclusivos. Os 18 registros originais ficam orfaos (sem vinculos) e podem ser removidos depois.

### Parte 2 — Atualizar `useDuplicatePlan` para clonar beneficios

Hoje o `useDuplicatePlan` (linha 332-346 de `usePlansAdmin.ts`) apenas copia o `benefit_id` existente. Precisa clonar o registro em `benefits` da mesma forma que ja faz com coberturas:
1. Buscar dados do beneficio original
2. Inserir copia com slug unico
3. Copiar `entity_eligibility_rules` do beneficio original
4. Copiar `benefit_category_exclusions`
5. Vincular o novo benefit_id ao plano duplicado

### Parte 3 — Corrigir combustiveis errados nos planos Diesel

Na migration, apos duplicar beneficios, corrigir as regras de combustivel das coberturas de planos Diesel que estao marcadas como `flex`/`gasolina`:
- Buscar coberturas vinculadas a planos cujo nome contem "Diesel"
- Para cada uma, verificar se a regra `combustivel` contem `flex` ou `gasolina` (sem `diesel`)
- Atualizar `rule_config.values` para `["diesel"]`

### Parte 4 — Corrigir ano invertido da Linha Especial

A linha ESPECIAL (id `16820bb0-814a-4fa1-ae02-bf4ad7285e64`) tem `ano_min: 2000, ano_max: 1994` (invertido). Corrigir para `ano_min: 1994, ano_max: null` (sem limite superior, ou o valor correto conforme o manual).

### Parte 5 — Gerar relatorio atualizado

Executar script que consulta o banco apos as correcoes e gera novo relatorio markdown em `/mnt/documents/` comparando estado atual vs manual.

### Arquivos alterados
1. **Nova migration SQL** — duplica beneficios, corrige combustiveis diesel, corrige ano Especial
2. **`src/hooks/usePlansAdmin.ts`** (funcao `useDuplicatePlan`, linhas 332-346) — clonar beneficios ao duplicar plano (mesmo padrao das coberturas)
3. **Script de relatorio** (execucao unica) — gera `/mnt/documents/relatorio_regras_v2.md`

### Nao alterado
- Tabelas do banco (schema) — nenhuma nova tabela ou coluna
- Motor de cotacao — ja suporta beneficios com regras individuais
- UI de edicao de plano — ja funciona com beneficios individuais via `PlanBeneficiosList`


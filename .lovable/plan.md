
## Plano: Alinhar motor de cotacao do agente IA com o motor do frontend

### Problemas encontrados

O agente IA (`agente-consultor-ia`) tem sua propria implementacao simplificada do motor de elegibilidade (`checkRulesSimple`, linhas 1466-1513) que **diverge significativamente** do motor real do frontend (`checkRuleAgainstVehicle` + `checkAllRules` em `useEntityEligibilityRules.ts`). Isso causa planos incorretos na cotacao gerada pela IA.

#### Divergencias criticas:

| Aspecto | Frontend (`checkRuleAgainstVehicle`) | Agente (`checkRulesSimple`) |
|---|---|---|
| **rule_mode (include/exclude)** | Respeita `rule_mode` — inverte logica para `exclude` | **Ignora completamente** — trata tudo como whitelist |
| **regiao** | Compara por UUID (`regiaoId`) E por slug | Compara apenas por `regiaoId` via `regioes_permitidas` |
| **tipo_uso** | Usa `cfg.tipos \|\| cfg.values` | Usa `cfg.tipos_permitidos` (chave errada) |
| **combustivel** | Usa `cfg.combustiveis \|\| cfg.values` | Usa `cfg.combustiveis_permitidos` (chave errada) |
| **fipe_range** | Usa `cfg.min` / `cfg.max` + rule_mode | Usa `cfg.fipe_min` / `cfg.fipe_max` (chaves erradas) |
| **ano_range** | Usa `cfg.min` / `cfg.max` + rule_mode | Usa `cfg.ano_min` / `cfg.ano_max` (chaves erradas) |
| **marca_modelo** | Logica completa com `findModelEligibility`, status aceito/limitado/negado | **Ignorado** (retorna true sempre) |
| **tipo_placa** | Avalia com logica include/exclude | **Nao existe** |
| **categoria_veiculo** | Avalia com logica include/exclude | **Nao existe** |
| **fipe_range com faixas** | Coberturas/beneficios usam `faixas[]` com `de/ate/valor` | Funciona (mesmo formato) |
| **Filtragem de coberturas/beneficios** | Remove individualmente os inelegiveis e recalcula preco | Nao filtra — inclui todos no preco |
| **Sobrescrita plano→componente** | Regras do plano sobrescrevem tipos iguais nos componentes | Nao implementado |

#### Consequencias:
1. **Planos incorretos**: Planos que deviam ser bloqueados aparecem (ex: regras de regiao/uso ignoradas por chaves erradas)
2. **Precos errados**: Coberturas/beneficios inelegiveis nao sao removidos, inflando o valor
3. **Planos faltando**: Regras `include` podem bloquear planos que deveriam passar (pois rule_mode e ignorado)

### Correcao

**Arquivo unico: `supabase/functions/agente-consultor-ia/index.ts`**

1. **Substituir `checkRulesSimple` por `checkRuleAgainstVehicle` + `checkAllRules`** — portar a logica completa do frontend, incluindo:
   - Suporte a `rule_mode` (include/exclude)
   - Chaves corretas: `cfg.tipos`, `cfg.values`, `cfg.regioes`, `cfg.combustiveis`, `cfg.min`, `cfg.max`
   - Suporte a `marca_modelo` com `findModelEligibility`
   - Suporte a `tipo_placa` e `categoria_veiculo`

2. **Adicionar filtragem individual de coberturas/beneficios** no `executarCalculoCotacao`:
   - Antes de somar valores, filtrar coberturas e beneficios por suas regras individuais
   - Implementar sobrescrita de tipos do plano sobre componentes
   - Descartar plano se todas as coberturas core forem removidas

3. **Corrigir `vehicleCtx`** para incluir `tipoPlaca` quando aplicavel

4. **Adicionar valor adicional (5.50) apenas apos calculo base** — ja esta correto, manter

### Resultado esperado
- O agente IA gera cotacoes com os mesmos planos e valores que o formulario do vendedor
- Regras de elegibilidade sao respeitadas identicamente em ambos os motores
- Coberturas/beneficios inelegiveis sao removidos antes do calculo de preco

### Deploy
Redesployar `agente-consultor-ia` apos as alteracoes.

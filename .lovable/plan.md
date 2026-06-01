# Diagnóstico — match "família × variante" e proposta "mais específico ganha"

**Não implementa nada.** Relatório para sua decisão.

## 1. Confirmação da causa raiz no caso Corolla XEI 2014

Linha Especial (`16820bb0-…`) tem, na mesma regra, duas entradas TOYOTA:
- `COROLLA` — `ano_min=2002, ano_max=2004, status=aceito`
- `COROLLA FIELDER` — `ano_min=2002, ano_max=NULL, status=limitado`

O motor (`useEntityEligibilityRules.ts:181-218`) itera o array `modelos[]` e retorna a **primeira entry** que satisfaz match + ano + combustível. Para o veículo `"COROLLA XEI"` ano 2014:

1. Entry `COROLLA`: casa por substring (`"COROLLA XEI".includes("COROLLA")`), mas ano 2014 > 2004 → `continue`.
2. Entry `COROLLA FIELDER`: casa pelo teste **first-token** (linha 198: `ctxModeloFirstToken === entryModeloFirstToken`, ambos `"COROLLA"`); ano 2014 ≥ 2002, sem `ano_max` → retorna `status=limitado`.

É exatamente sua hipótese. Não é bug de ano — é o test de first-token (e de `entryModelo.includes(ctxModelo)`) fazendo o XEI ser tratado como Fielder.

## 2. Catálogo: pares família × variante com regras divergentes

Query nas entries ativas em que um modelo é substring de outro **dentro da mesma regra** e o ano/status diferem (= casos onde "qual ganha?" muda o resultado):

| Marca | Família | Variante | Família (ano/status) | Variante (ano/status) |
|---|---|---|---|---|
| TOYOTA | COROLLA | COROLLA FIELDER | 2002–2004, aceito | 2002–∞, **limitado** |
| VOLKSWAGEN | GOL | GOLF | 2002–2004, aceito | 2002–2007, aceito (outra entry: 2008–∞, aceito) |
| VOLKSWAGEN | FOX | CROSSFOX | 2005–2026, aceito | 2005–∞, aceito |
| VOLKSWAGEN | FOX | SPACEFOX | 2005–2026, aceito | 2005–∞, aceito |
| FIAT | PALIO | PALIO WEEKEND | 2006–∞, aceito | 2005–∞, aceito |
| CITROËN | C3 | C3 PICASSO | 2005–2019 / 2006–2019, aceito | 2005–∞, aceito |
| PEUGEOT | 307 | 307 SEDAN | 2002–∞, aceito | 2002–∞, **limitado** |

Outros pares **família + variante existem no catálogo mas hoje têm regras idênticas** (não disparam comportamento divergente, só causariam bug se alguém editar uma e esquecer a outra): VECTRA/VECTRA GT, C4/C4 LOUNGE/PICASSO/CACTUS, SIENA/GRAND SIENA, PAJERO/PAJERO DAKAR/FULL/TR4, 207/207 ESCAPADE/QUIKSILVER/SEDAN/SW, 307/307 SW, 407/407 W, MEGANE/MEGANE SEDAN.

**Casos divergentes graves hoje:** Corolla (XEI/Altis/GLi recebem `limitado` indevidamente), Peugeot 307 não-Sedan (recebe `limitado` se cair na entry SEDAN), Gol (G5/G6 anos novos podem cair indevidamente na entry "GOLF 2008+").

## 3. Validação da regra "mais específico ganha"

Definindo *especificidade* como **nº de tokens da entry que aparecem no nome do veículo** (com desempate por nº de tokens da entry, maior = mais específico):

| Veículo | Candidatos no catálogo Especial | Mais específico | OK? |
|---|---|---|---|
| COROLLA XEI 2014 | COROLLA (1 tok comum), COROLLA FIELDER (1 tok comum) | **COROLLA** (entry tem 1 tok vs Fielder tem 2 mas só 1 bate) | ✅ |
| COROLLA FIELDER XEI | COROLLA, COROLLA FIELDER (2 tok) | **COROLLA FIELDER** | ✅ |
| GOL 1.0 MI 2010 | GOL, GOLF | **GOL** (GOLF não está nos tokens do veículo) | ✅ |
| GOLF GTI 2010 | GOL? GOLF? | **GOLF** (GOLF é token exato do veículo) | ✅ |
| PALIO WEEKEND 2010 | PALIO, PALIO WEEKEND | **PALIO WEEKEND** | ✅ |
| FOX PRIME 2015 | FOX, CROSSFOX, SPACEFOX | **FOX** (CROSSFOX/SPACEFOX não são tokens) | ✅ |
| CROSSFOX 2015 | FOX (substring), CROSSFOX (token exato) | **CROSSFOX** | ✅ |
| 307 SEDAN 2010 | 307, 307 SEDAN | **307 SEDAN** | ✅ |
| 307 HATCH 2010 | 307, 307 SEDAN | **307** (SEDAN não é token do veículo) | ✅ |
| C3 PICASSO 2015 | C3, C3 PICASSO | **C3 PICASSO** | ✅ |

A regra "mais específico ganha" — **definida como nº de tokens da entry que aparecem no veículo** — cobre todos os pares ambíguos encontrados no catálogo.

**Sub-caso a alinhar com você:** GOL × GOLF. Hoje o motor casa "GOL" dentro de "GOLF" por substring pura (linha 196). Pelo critério de **tokens**, o veículo "GOLF GTI" tem tokens `["GOLF","GTI"]` — `GOL` **não é token exato**, então não casaria pela proposta. Isso elimina o falso match GOL→GOLF sem precisar mexer no cadastro. Confirmar que é o comportamento desejado.

**Combinações onde dois cadastros legítimos casariam igualmente:** não encontrei nenhuma no catálogo atual. Se aparecer no futuro (mesma quantidade de tokens batendo), proponho desempate por **ordem do array** (preservando intenção do operador) + log de alerta para o painel da Diretoria revisar.

## 4. Veículo sem nenhum cadastro casando

Comportamento atual em `useEntityEligibilityRules.ts:267-280`:
- `findModelEligibility` devolve `null`.
- `checkRuleAgainstVehicle` então retorna `!isInclude` — ou seja: **whitelist** (rule_mode=include) **bloqueia**; **blacklist** (exclude) **libera**.

Para a linha Especial (whitelist por desenho), um "COROLLA GR" sem cadastro seria **silenciosamente rejeitado** — não há fallback nem mensagem específica. O usuário só vê o plano sumir. Esse comportamento se mantém na proposta — não é alterado por este diagnóstico.

## 5. Proposta de mudança no `findModelEligibility`

**Local:** `src/hooks/useEntityEligibilityRules.ts`, linhas 174–219.

**Mudança:**
1. Tokenizar `ctx.modelo` e `entry.modelo` por `/[\s/]+/`, removendo strings vazias.
2. Definir `match` quando **todos os tokens de `entry.modelo`** estão presentes nos tokens de `ctx.modelo` (igualdade exata por token, não substring). Wildcards `TODOS/QUALQUER/ALL/""` continuam casando tudo.
3. Em vez de retornar a primeira entry que satisfaz match+ano+combustível, **percorrer todas** as entries, computar `score = nº de tokens da entry que casam` e:
   - Filtrar candidatos que também satisfazem ano e combustível.
   - Devolver o de **maior score**; empate → maior `entry.modelo.length` (mais palavras); empate persistente → primeira do array (com `console.warn` para auditoria).
4. Marca continua bidirecional (atende `"VOLKSWAGEN"` vs `"VW"` se houver).

**O que isso quebra dos 5 testes atuais (linhas 195–200):**
- `ctxModelo.includes(entryModelo)` (substring) — **removido**.
- `entryModelo.includes(ctxModelo)` — **removido**.
- `entryModeloFirstToken === ctxModeloFirstToken` — **removido** (era o culpado do caso Corolla).
- `ctxModelo.includes(entryModeloFirstToken)` — **substituído** pelo match por tokens.
- `entryModelo.includes(ctxModeloFirstToken)` — **removido**.

**Consequências para o catálogo atual:**
- Entries com nome de família (`COROLLA`, `GOL`, `FOX`) continuam casando todas as variantes da família — porque `"COROLLA"` é token exato de `"COROLLA XEI"`, `"COROLLA ALTIS"`, etc.
- Entries com nome de variante (`COROLLA FIELDER`, `PALIO WEEKEND`) **só casam** veículos cujo nome contenha esses dois tokens — é o que se quer.
- Nenhum cadastro existente precisa ser editado.

**Side-effect a confirmar:** o resolver `src/lib/veiculo/resolverTipoPorElegibilidade.ts` (linha 73) já exclui `marca_modelo`, então não é afetado. `checkRuleAgainstVehicle` no formato legado (linhas 282–292) continua usando a mesma normalização — proponho aplicar a mesma lógica de tokens lá também, por consistência.

## Próximo passo

Aguardando sua aprovação para:
1. Confirmar critério de tokens (todos os tokens da entry devem ser tokens exatos do veículo).
2. Confirmar desempate: score → length(modelo) → ordem do array + warn.
3. Confirmar que GOL/GOLF deve passar a se separar pela tokenização (não casar mais por substring).

Sem essas confirmações eu não toco no código.
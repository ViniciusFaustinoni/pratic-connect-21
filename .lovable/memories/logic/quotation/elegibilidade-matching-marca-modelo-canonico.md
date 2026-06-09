---
name: Matching marca/modelo na elegibilidade — canônico
description: Tokenização robusta + fallback compacto + telemetria de silêncio em findModelEligibility / checkRuleAgainstVehicle
type: feature
---

`src/hooks/useEntityEligibilityRules.ts > findModelEligibility/tokenizeModelo`.

## Tokenização canônica
- Separador = **qualquer caractere não-alfanumérico** (`/[^A-Z0-9]+/i`). Cobre hífen, espaço, ponto, barra, parênteses, vírgula, underscore, `&`.
- Aplicada a `removeDiacritics(s.toUpperCase())`.

## Conjunto expandido do contexto (`buildCtxTokenSet`)
- Para cada par de tokens adjacentes (e trincas, quartetos…) com concatenação ≤ 8 chars, adiciona a concatenação ao set.
- Permite casar cadastro compacto (`CRV`, `HB20`, `C3`) com FIPE solto (`CR-V`, `HB 20`, `C 3 PICASSO`).
- Comparação continua **por token** (nunca substring), preservando `208 ≠ 2008` e `GOL ≠ GOLF`.

## Fallback compacto da entry
- Se `entryTokens` (>1 token) não casam todos no ctx set, ainda tenta `concat(entryTokens)` (≤8 chars) ∈ ctx set.
- Permite o caminho inverso: cadastro `HR-V` (multi-token) × FIPE `HRV` (single token).

## Telemetria de silêncio
- Quando uma regra `marca_modelo` tem entries para a marca do veículo mas nenhum candidato sai, loga `console.warn('[elegibilidade] modelo nao casou', { marca, modelo, entries })`. Hoje silêncio = bug invisível — sem isso, novos T-CROSS passam batido.

## Auditoria histórica (09/06/26)
Após o fix, das 271 entries `marca_modelo` ativas no banco, apenas **6 órfãs** (erros reais de cadastro, não bug do motor):
- CHEVROLET VOYAGE (Voyage é VW)
- MITSUBISHI LANCE (typo de LANCER)
- PEUGEOT 307 SEDAN / 407 W / PICANTO (sufixo inexistente / typo / marca errada)
- VOLKSWAGEN SPACE CROSS (catálogo usa SPACECROSS sem espaço)

Relatório em `/mnt/documents/auditoria-elegibilidade-modelos.csv`. Lista deve ser corrigida manualmente no painel — agente não toca em `entity_eligibility_rules`.

## Testes
`src/hooks/__tests__/useEntityEligibilityRules.test.ts` cobre: T-CROSS, HR-V/HRV, CR-V/CRV, C3/C 3, HB20/HB 20, 208≠2008, GOL≠GOLF, pontuação 1.6/1.0, wildcards, score por especificidade, filtro de ano. Regressão da classe inteira fica travada.

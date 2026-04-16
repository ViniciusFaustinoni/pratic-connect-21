
## Problema

Cotação rápida no dashboard mostra "Nenhum plano disponível para faixa R$ 20.882" para uma **Honda Titan 160** (moto, uso APP/Uber). Deveria aparecer Advanced e Advanced+ da linha de motos.

Também há mensagem "Categoria APP: cota de participação será 8% (mínimo R$ 3.000)" — mas a regra para **motos APP** segundo o usuário é **10% mínimo R$ 1.500** (regra de carros, não motos).

## Investigação necessária (vou fazer durante exploração)

1. Conferir no banco se existem planos Advanced/Advanced+ ativos na linha **Motos** com faixa FIPE cobrindo R$ 20.882, e se há `entity_eligibility_rules` que filtrem por marca/modelo Honda Titan ou por categoria APP.
2. Conferir o componente `CotacaoRapida` (dashboard) — entender como ele consulta planos, se passa `tipo_veiculo=moto` e `categoria=app` corretamente, e se respeita a hierarquia de elegibilidade unificada.
3. Conferir a regra "Categoria APP: 8% mínimo R$ 3.000" — onde está definida e se é específica para carros (Uber) ou se está sendo aplicada erroneamente para motos.
4. Confirmar regra de cota de participação para motos APP (10% mínimo R$ 1.500 conforme `mem://business/rules/consultant-manual-v12`).

## Plano de correção (a confirmar após investigação)

### Hipótese principal: filtro de elegibilidade ou categoria APP excluindo motos

**A.** Se planos motos Advanced/Advanced+ existem mas não cobrem faixa 18-21k → ajustar `entity_eligibility_rules` (sem código).

**B.** Se a `CotacaoRapida` está aplicando regra APP de carro para motos → corrigir o componente para:
- Detectar `tipo_veiculo === 'moto'` antes de aplicar a mensagem/cálculo de participação
- Para motos APP: exibir "Cota 10% do FIPE, mínimo R$ 1.500" (e não 8%/R$ 3.000)
- Para carros APP: manter 8%/R$ 3.000

**C.** Se o filtro por categoria está excluindo motos (ex: `categoria_app` só aceita carros) → ajustar a query de planos para incluir motos elegíveis.

### Arquivos prováveis a tocar

- `src/components/dashboard/CotacaoRapida.tsx` (ou similar)
- Hook de cálculo de cota de participação
- Possível ajuste em `entity_eligibility_rules` via migração se faltar regra para Motos APP

## Verificação pós-correção

Logar como `admin@teste.com / 123456789`, no dashboard usar Cotação Rápida com:
- Tipo: Moto
- Categoria: APP/Uber
- FIPE: R$ 20.882
- Esperar: Advanced (R$ 218,70) + Advanced+ (R$ 238,70), mensagem de participação "10% mínimo R$ 1.500", e nota de rastreador obrigatório.

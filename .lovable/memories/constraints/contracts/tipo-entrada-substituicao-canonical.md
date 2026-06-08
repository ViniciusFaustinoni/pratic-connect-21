---
name: tipo-entrada substituicao canonical
description: 'substituicao_placa' é canônico em contratos/cotações; 'substituicao' é alias legado; LEITORES devem normalizar — comparar com literal cru quebra o fluxo
type: constraint
---

## Regra

- Canônico em `cotacoes.tipo_entrada` e `contratos.tipo_entrada`: **`'substituicao_placa'`**.
- Alias legado: `'substituicao'` → normalizado para `'substituicao_placa'` por `normalizarTipoEntrada()` antes de QUALQUER escrita (ver `src/lib/cotacoes/tipoEntrada.ts` e `supabase/functions/_shared/tipo-entrada.ts`).
- O banco **só armazena `'substituicao_placa'`**. O alias `'substituicao'` praticamente não existe em produção.

## Para LEITORES (o que mata silenciosamente)

Comparar `tipo_entrada === 'substituicao'` cru é bug — sempre dá `false`. Toda leitura nova DEVE:

1. Usar `normalizarTipoEntrada(valor) === 'substituicao_placa'`, **ou**
2. Comparar explicitamente `valor === 'substituicao_placa' || valor === 'substituicao'` (defesa em profundidade), **e**
3. Considerar também `dados_extras.solicitacao_substituicao_id` quando precisar reconhecer substituições legadas.

## Caso de falha que motivou a regra

**LTP7C50 / COT-20260606-142420151-266** (PATRICK · 07/06/2026). O link público (`src/pages/public/CotacaoContratacao.tsx:173`) comparava `dadosExtras?.tipo_entrada === 'substituicao'` cru. Como o banco grava `'substituicao_placa'`, `isSubstituicao` ficou permanentemente `false`. Resultado: cliente nunca viu o seletor mesmo-local/locais-separados nem o `AgendamentoSubstituicaoSeparado`; com FIPE > 30k, o ramo "adesão acima do mínimo" abriu autovistoria enxuta opcional; o cliente fez a autovistoria; a cotação foi promovida para `aguardando_aprovacao_cadastro` sem **nunca** materializar `substituicoes_veiculo`, sem retirada do antigo, sem instalação física do novo, e sem disparar `criar-substituicao-agendamentos-separados` / `enviar-termo-cancelamento-substituicao` / `efetivar-substituicao`.

## Guard backend canônico

`supabase/functions/finalizar-autovistoria-cotacao/index.ts` rejeita `409 { code: 'autovistoria_nao_permitida_em_substituicao' }` quando a cotação é `substituicao_placa` (ou alias / `dados_extras.solicitacao_substituicao_id`). Defesa em profundidade contra regressões de front.

## Onde já está aplicado corretamente

- `src/pages/public/CotacaoContratacao.tsx` (após o hotfix 07/06/2026).
- `supabase/functions/autentique-create/index.ts` e `autentique-create-by-token/index.ts` (já aceitavam ambos os literais via `||`).
- `src/components/contratos/ContratoWizard.tsx` (normaliza antes de comparar).

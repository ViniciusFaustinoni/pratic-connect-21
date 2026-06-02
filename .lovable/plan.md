## Objetivo
Fazer o modal “Placa já pertence a outro associado” aparecer só uma vez por placa após o usuário clicar em **Ignorar e Prosseguir**, mantendo a lógica atual de validação e auditoria.

## Causa raiz encontrada
Hoje o clique em **Ignorar e Prosseguir** faz duas coisas em sequência:
1. grava o bypass da placa no estado (`setBypassPlacaOutroAssoc`)
2. relança `buscarPorPlaca()` via `setTimeout(..., 100)`

O problema é que essa nova execução pode acontecer antes de a função passar a enxergar o estado atualizado do bypass. Resultado: a checagem roda de novo com valor antigo e reabre o mesmo modal repetidas vezes.

## Plano
1. Ajustar o reprocessamento pós-bypass para não depender de estado assíncrono/stale no mesmo ciclo.
2. Garantir que a placa ignorada seja consumida imediatamente na próxima busca, sem reexibir o modal local para a mesma placa naquela interação.
3. Preservar o restante do fluxo atual:
   - continuar registrando a decisão “Ignorar e Prosseguir”
   - continuar permitindo Troca de Titularidade
   - não mexer na lógica de validação de placa duplicada, SGA, FIPE ou criação da cotação
4. Validar o comportamento com o cenário da imagem:
   - placa vinculada a outro associado
   - clicar em Ignorar e Prosseguir
   - seguir a busca/registro sem reabrir o mesmo modal em cascata

## Detalhes técnicos
- Arquivo principal: `src/components/cotacoes/CotacaoFormDialog.tsx`
- Ponto crítico: callback do `onIgnorarEProsseguir` do `PlacaOutroAssociadoModal` e a função `buscarPorPlaca()`
- Direção da correção: usar um mecanismo síncrono/imutável para o bypass imediato da execução seguinte (em vez de depender do timing do `setState` + `setTimeout`)

## Resultado esperado
Após ignorar o aviso uma vez, o fluxo segue normalmente e o mesmo modal não volta a aparecer em loop para aquela mesma placa durante a ação em andamento.
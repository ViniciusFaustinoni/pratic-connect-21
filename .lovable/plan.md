## Problema

No fluxo de Substituição de Placa, o operador já informa a placa do **novo veículo** no card inicial (`OutrasEntradasMenu`), o sistema valida no SGA e cria a `solicitacoes_substituicao_placa`. Quando o modal de Cotação Rápida abre em seguida (badge "Substituição de Placa · RVW1A14"), o campo de placa aparece vazio e o operador precisa digitar tudo de novo.

Causa raiz: a placa nova é coletada e validada localmente em `OutrasEntradasMenu`, mas **nunca é persistida** — a tabela `solicitacoes_substituicao_placa` só guarda os dados do veículo antigo. Logo, nem o `ModalDetalhesSubstituicao` nem `Cotacoes.tsx` têm de onde ler a placa nova para repassar ao `CotacaoFormDialog`.

## Mudança

Persistir a placa nova na solicitação e propagá-la até o `CotacaoFormDialog`, que já trava o campo placa (`disabled` em `!!origemSubstituicao`) — só precisa receber o valor inicial.

### 1. Banco (migration)
- `ALTER TABLE public.solicitacoes_substituicao_placa ADD COLUMN veiculo_novo_placa text;`
- Sem backfill: solicitações antigas seguem sem o valor (campo opcional).

### 2. Edge `criar-solicitacao-substituicao`
- Aceitar `placa_nova` no body (validar regex placa Mercosul/antiga).
- Gravar em `veiculo_novo_placa` no INSERT.

### 3. `OutrasEntradasMenu.tsx`
- Enviar `placa_nova: placaNovaLimpa` na invocação da edge (linha ~398).

### 4. `ModalDetalhesSubstituicao.tsx`
- Incluir `veiculo_novo_placa` nos `URLSearchParams` montados em `handleCriarCotacao` quando presente.

### 5. `src/pages/vendas/Cotacoes.tsx`
- Ler `veiculo_novo_placa` do `searchParams` e guardar em `substituicaoCtx.veiculoNovoPlaca`.
- Passar adiante em `origemSubstituicao` e em `cotacaoBase.veiculo_placa` (substituir o atual `null`).

### 6. `CotacaoFormDialog.tsx`
- Estender `origemSubstituicao` com `veiculoNovoPlaca?: string`.
- No mount/`useEffect` de abertura, quando houver `origemSubstituicao?.veiculoNovoPlaca`, fazer `setPlaca(formatado)` antes do render do input. O input já está `disabled={!!origemSubstituicao}` (linha 2823) — apenas precisa do valor inicial.
- Disparar a auto-busca FIPE existente (`autoBuscaPlacaRef`) com essa placa para já popular marca/modelo/ano.

### 7. Hook `useSolicitacaoSubstituicao`
- Garantir que o `select` retorna a nova coluna (`*` ou adicionar `veiculo_novo_placa`).

## Fora de escopo
- Backfill de solicitações antigas.
- Edição da placa nova dentro do modal de cotação (continua travada, como hoje).
- Mudanças no fluxo de Troca de Titularidade.

## Validação
1. Iniciar nova Substituição em `/vendas/cotacoes`, informar placa nova (ex.: `ABC1D23`) e prosseguir.
2. Abrir Detalhes da Substituição → "Criar Cotação".
3. Confirmar que o modal de Cotação Rápida abre com `ABC1D23` já preenchido, travado, e que o botão de busca FIPE funciona com ela.

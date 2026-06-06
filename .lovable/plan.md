# Cobrança via linha digitável SGA no StepElegibilidade

Hoje a tela só permite uma saída quando há débito: marcar "assumir responsabilidade + justificativa". Vamos adicionar uma **segunda saída paralela**: o consultor pode optar por **cobrar agora**, puxando a linha digitável dos boletos do SGA para o associado pagar antes de seguir.

## Escopo

Mudança **apenas de UI/presentation** em `src/components/substituicao/StepElegibilidade.tsx`. Reuso integral do hook `useBoletosSgaPorAssociado` (já existe e é usado em Troca). Nenhuma migration, nenhum edge novo, nenhuma alteração no fluxo canônico nem em `SubstituicaoVeiculoPage`/`useSubstituicaoVeiculo`.

## Comportamento

Quando `adimplente=false`, o bloco âmbar atual ganha duas abas/duas ações lado a lado:

**Opção A — Assumir responsabilidade** (já existe, inalterado)
- Checkbox + justificativa ≥10 chars → libera `canProceed` → cria análise pendente no Relacionamento como hoje.

**Opção B — Cobrar agora (novo)**
- Botão "Buscar boletos no SGA" dispara `useBoletosSgaPorAssociado(codigoHinova, cpf)`.
- Lista os boletos em aberto (vencidos + a vencer dentro de `diasFuturo`), respeitando a memória `sga-boletos-campos-canonicos-e-lookahead` (campos `valor_boleto`/`situacao_boleto`, ignorar BAIXADO com sentinela).
- Para cada boleto exibe: vencimento, valor, situação (Vencido/A vencer), e:
  - Linha digitável com botão **Copiar** (clipboard).
  - Botão **Copiar link do boleto** quando `link_boleto` existir.
- Mensagem-guia: "Encaminhe a linha digitável ao associado. Após o pagamento ser baixado no SGA, recarregue para destravar a substituição."
- Botão **Recarregar status** que invalida a query de elegibilidade (`useVerificarElegibilidade`) + a do SGA. Se vier `adimplente=true`, o bloco âmbar desaparece e segue normalmente.

As duas opções são **mutuamente independentes** — o consultor escolhe uma. Se assumir responsabilidade, não precisa cobrar; se cobrar e o pagamento baixar, não precisa assumir.

## Detalhes técnicos

- Hook reusado: `useBoletosSgaPorAssociado(codigoHinova, cpf)`. Para obter `codigo_hinova` e CPF do associado, ler de `associados` via `useQuery` simples (`select codigo_hinova, cpf where id = associadoId`) — padrão já usado no projeto.
- Recarregar = `queryClient.invalidateQueries({ queryKey: ['sga-boletos-por-associado', ...] })` + invalidar `['substituicao-elegibilidade', associadoId]`.
- Empty states: "Nenhum boleto em aberto retornado pelo SGA" (orienta a recarregar elegibilidade) e erro transitório (mostra retry).
- Layout: duas sub-seções no bloco âmbar com separador sutil; nada de tabs novas para não inflar a tela.
- Sem nova memória nem migration.

## Fora de escopo

- Disparar cobrança WhatsApp/email automaticamente (só copy/paste manual nesta iteração).
- Quitação direta via Asaas/gateway.
- Mudar regras de elegibilidade ou o caminho canônico da substituição.

## Critério de aceite

Em `RJN2A96` (PATRICK, R$ 218,70): consultor vê no bloco âmbar tanto "Assumir responsabilidade" quanto "Cobrar agora"; ao clicar em "Buscar boletos no SGA", a linha digitável do boleto de R$ 218,70 aparece com botão Copiar; ao pagar e clicar "Recarregar status", `adimplente` vira `true` e o `canProceed` libera sem precisar de justificativa.

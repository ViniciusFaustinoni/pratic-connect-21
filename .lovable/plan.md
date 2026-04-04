

# Remover Carência de Vidros e Faróis Duplicada do Card "Tipo de Entrada"

## Diagnóstico

O componente `OrigemCadastroCard.tsx` (card "Tipo de Entrada") tem uma seção **hardcoded** de "Carência — Vidros e Faróis" (linhas 744-780) que exibe informações de carência diretamente neste card. Essa informação já é exibida corretamente na seção dedicada de Carências (`AssociadoSituacaoCard`), que lista **todos** os itens do plano com seus respectivos prazos.

Não faz sentido manter essa exibição duplicada e em destaque no card de Tipo de Entrada.

## Alteração

### `src/components/associados/detalhe/OrigemCadastroCard.tsx`

- Remover o bloco de "Carência — Vidros e Faróis" (linhas 744-780) do card de Tipo de Entrada
- Se houver outro bloco similar de "Carência Vidros e Faróis (reativação)" (linhas ~559-563), remover também, pois a seção de carências já cobre esse caso

## Impacto
- 1 arquivo alterado
- ~40 linhas removidas
- A informação continua disponível na seção dedicada de Carências


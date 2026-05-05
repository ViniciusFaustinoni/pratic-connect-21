## Objetivo

Hoje, no fluxo de troca de titularidade, quando o sistema mostra os boletos pendentes do titular antigo (com linha digitável + link do boleto), só rechecamos o pagamento via cron diário (00:00) ou pelo botão "Re-checar SGA" da fila interna `Relacionamento — Débitos Pendentes`.

O usuário do fluxo público / consultor não tem como confirmar imediatamente que pagou. Precisamos de um botão **"Verificar pagamento agora"** abaixo das linhas digitáveis (em cada boleto e/ou no rodapé do card) que consulte o SGA na hora.

## Onde mexer

### 1. `src/components/cotacao/DebitosCard.tsx` (UI)

Adicionar na barra de ações de cada boleto, ao lado de "Copiar linha" / "Boleto", um botão **"Verificar pagamento"** que:

- Chama um hook/edge function que reconsulta o SGA pelo CPF.
- Enquanto carrega: ícone com spinner e botão desabilitado.
- Resultado:
  - Pago → toast verde "Boleto quitado", remove a linha do card e dispara um `onPagamentoConfirmado` opcional (callback novo da prop), para o pai recarregar débitos / liberar o fluxo.
  - Ainda em aberto → toast neutro "Pagamento ainda não identificado no SGA. Tente novamente em alguns minutos."
  - Erro → toast destrutivo.

Adicionar também um botão único **"Verificar todos"** no rodapé do card (mais discreto), para reverificar tudo de uma vez.

Adicionar nova prop opcional ao `DebitosCardProps`:
- `cpf?: string` — CPF do associado dono dos débitos (para fazer o recheck via SGA).
- `onAtualizado?: () => void` — callback chamado quando o SGA mostra que pelo menos um boleto foi quitado.

Comportamento client-side: como a fonte de verdade é o SGA e o `useVerificarDebitosAssociado` já lê de lá, a forma mais simples é, ao clicar:
1. Invalidar a query do `useBuscaSGA` para o CPF (queryKey já existente em `useBuscaSGA`).
2. Aguardar o refetch.
3. Comparar a lista nova com a antiga; se o `nosso_numero` clicado sumiu da lista de abertos → pago.
4. Disparar `onAtualizado()` para o pai esconder o card se tudo zerou.

### 2. Componentes que renderizam `DebitosCard`

Passar o CPF e um callback de invalidação:

- `src/components/cotacao/EtapaDadosAssociado.tsx` — passar `cpf={cpfDigits}` e `onAtualizado={() => qc.invalidateQueries(['busca-sga'])}` (chave já existente do hook).
- `src/components/cotacao/DialogTipoOperacao.tsx` — idem.
- `src/components/vendas/OutrasEntradasMenu.tsx` — idem.

### 3. Edge function (já existe — só conferir e, se faltar, expor)

`sga-buscar-associado-completo` é o que o `useBuscaSGA` consome. O recheck por boleto pode ser apenas reconsulta do CPF inteiro (não há endpoint individual por boleto no SGA). O custo é baixo e a UX é "verifiquei agora".

Não precisa criar nova edge function. Apenas garantir `staleTime: 0` na re-query e usar `refetch()` retornado por `useBuscaSGA`.

### 4. Mensagem auxiliar

Substituir/adicionar o texto atual:
> "É necessário quitar todos os boletos antes de prosseguir com a contratação."

Por:
> "Após pagar, clique em **Verificar pagamento** para liberar a contratação imediatamente — sem precisar esperar até o próximo dia."

### 5. Já existe? — confirmação

Verifiquei: o botão atual de recheck do SGA só existe na fila interna `pages/cobranca/RelacionamentoTrocas.tsx` (botão "Re-checar SGA" por linha de associado), e o polling automático só existe na cobrança ASAAS (`EtapaPagamentoCotacao`). **Não existe** botão de verificar pagamento abaixo das linhas digitáveis dos boletos do SGA mostrados no `DebitosCard`. Vamos criar.

## Detalhes técnicos

- `useBuscaSGA` retorna o objeto `useQuery` completo (incluindo `refetch`); o `useVerificarDebitosAssociado` repassa via `...sga`. Logo, no `DebitosCard` podemos receber o `refetch` opcional e chamar `await refetch()` no clique. Para evitar acoplamento, vamos preferir invalidar a queryKey via `useQueryClient()` dentro do próprio `DebitosCard` — mais simples e isolado.
- Para identificar se o boleto específico foi quitado, comparar o `nosso_numero` antes/depois do refetch. Como o componente é re-renderizado pelo pai, basta detectar que o boleto sumiu/permaneceu via callback de comparação.
- Loading por linha: `useState<string | null>(verificandoKey)`.

## Critérios de aceite

- No `DebitosCard`, abaixo de cada boleto (junto a "Copiar linha" / "Boleto") aparece o botão **"Verificar pagamento"**.
- Há também um botão **"Verificar todos"** no rodapé do card.
- Ao clicar: refetch do SGA, toast de sucesso/info/erro, atualização imediata da lista; se zerou tudo, o pai libera o fluxo (não precisa esperar a meia-noite).
- Funciona nos três pontos onde o `DebitosCard` aparece (cotação direta, dialog de tipo de operação, menu de outras entradas / migração).

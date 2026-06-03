## Por que não foi feito

A rodada anterior implementou o tratamento de erro estruturado apenas no **painel interno** (toast + modal global `CorrigirEmailDialog`). O **link público** é outra árvore de componentes (usa `publicSupabase` e não tem o `CorrigirEmailProvider` montado), e o catch da etapa de assinatura (`EtapaAssinaturaContrato.tsx:366-372` e `EtapaAssinaturaSubstituicao.tsx`) joga fora o `code`/`motivo` que vem do edge e mostra "Erro ao enviar para assinatura digital". Resultado: o associado vê erro genérico, sem reason e sem caminho de saída.

O backend já está pronto — `_shared/erroEstruturado.ts` devolve `code: EMAIL_INVALIDO` + `motivo` + `valor_atual`, e tanto `autentique-create` quanto `contrato-gerar` já lançam isso. Falta só consumir no link público.

## O que vou fazer

### 1. Parser standalone de erro estruturado (link público)
Criar `src/components/cotacao-publica/lib/parseErroAutentique.ts` (novo). Função pura que recebe o `error`/`data` devolvido por `publicSupabase.functions.invoke` e extrai `{ code, motivo, valor_atual }` a partir de `error.context?.response` (FunctionsHttpError), `data.error`, ou fallback `error.message`. Sem dependência do `CorrigirEmailProvider`.

### 2. Tratamento de `EMAIL_INVALIDO` em `EtapaAssinaturaContrato.tsx`

No catch de `verificarOuGerarContrato` (linhas 366-372):
- Parsear o erro com o helper acima.
- Se `code === 'EMAIL_INVALIDO'`:
  - `setEmailLocal(valor_atual || clienteEmail)` (pré-preenche o input que já existe na UI `coletar_email`)
  - `setErro(motivo)` (frase real do edge: "E-mail inválido…")
  - `setEtapaInterna('coletar_email')` (reutiliza a tela já renderizada em linha 660)
  - Reset `initRef.current = false` para re-disparar `verificarOuGerarContrato()` após o salvar
- Se outro `code` (ex.: `CREDITOS_INSUFICIENTES`, `DOCUMENTO_INVALIDO`): mostrar `motivo` legível na tela `erro` em vez do texto genérico atual.
- Tela `coletar_email` ganha um alerta vermelho discreto acima do input quando `erro` está presente, com a frase do `motivo`.

### 3. Salvamento + retry
O handler que já existe na tela `coletar_email` (atualiza `cotacoes.email_solicitante`, `contratos.cliente_email`, `associados.email`) é reaproveitado integralmente. Após salvar com sucesso: `setErro(null)`, `setEtapaInterna('verificando')`, `initRef.current = false`, dispara `verificarOuGerarContrato()` de novo.

### 4. Mesma lógica em `EtapaAssinaturaSubstituicao.tsx`
A assinatura do termo de substituição usa o mesmo edge `autentique-create`. Replicar os 3 passos acima para não deixar gap. (Não inclui termo de cancelamento — esse é fluxo separado.)

### 5. Fora de escopo (não muda)
- Painel interno (`toastErroEdge` + `CorrigirEmailDialog`) — já está OK.
- Edges (`autentique-create`, `contrato-gerar`) — já devolvem erro estruturado correto.
- `EtapaAssinaturaCancelamento` (termo de cancelamento) — fluxo paralelo, não é o que o usuário descreveu.
- Nenhuma mudança em DB/policies/RLS.

## Validação

1. Gerar cotação com e-mail propositalmente inválido → abrir link público → tela de assinatura agora mostra "E-mail inválido: foo@bar" + input pré-preenchido + botão Salvar → ao salvar, contrato segue para Autentique sem operador interno.
2. Simular `CREDITOS_INSUFICIENTES` no edge → link público mostra a frase real em vez de "Erro ao enviar para assinatura digital".
3. Substituição: mesmo teste no `EtapaAssinaturaSubstituicao`.
4. Painel interno: comportamento atual (modal global) inalterado.

## Arquivos a alterar
- `src/components/cotacao-publica/lib/parseErroAutentique.ts` (novo, ~30 linhas)
- `src/components/cotacao-publica/EtapaAssinaturaContrato.tsx` (catch + tela `coletar_email` + tela `erro`)
- `src/components/cotacao-publica/EtapaAssinaturaSubstituicao.tsx` (mesmo padrão)

Sem migrations, sem novos edges, sem mexer no painel interno.
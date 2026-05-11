## Objetivo

Na **Troca de Titularidade**, parar de consultar/exibir/bloquear pelo financeiro do antigo titular. O antigo associado **não precisa mais estar adimplente** — basta existir no sistema (espelho local + SGA) para que o veículo seja transferido.

## Comportamento atual (a remover)

- **Modal "Nova troca de titularidade"** consulta `sga-sync-financeiro-veiculo` por veículo, mostra badge ADIMPLENTE/INADIMPLENTE e lista boletos abertos.
- **Modal de detalhes da solicitação** mostra o card `RelatorioFinanceiroAntigo` (saldo SGA do antigo) e exibe alerta "bloqueado por débito" no aprovador.
- **Edge `aprovar-troca-cadastro`** trava a aprovação com `409 DEBITO_PENDENTE_ANTIGO` quando há linha em `relacionamento_debitos_pendentes` (status='aberto').
- **Edge `autentique-webhook`** insere registros em `relacionamento_debitos_pendentes` ao detectar termo assinado com saldo no SGA.
- **Cron `cron-recheck-debitos-troca`** revarre essa tabela diariamente para liberar quando quitam.

## Comportamento desejado

- Modal de criação **só usa o SGA para listar veículos do antigo titular** (existência). Sem badge de situação financeira, sem boletos.
- Modal de detalhes **não exibe mais** card de financeiro nem alerta de débito.
- `aprovar-troca-cadastro` **não trava por débito** — só continua exigindo termo assinado.
- Webhook do Autentique **deixa de inserir** em `relacionamento_debitos_pendentes` no fluxo de troca.
- Cron `cron-recheck-debitos-troca` deixa de ter efeito sobre a troca (pode ficar dormente; tabela permanece para auditoria de registros legados).

## Mudanças

### Frontend

1. **`src/components/associados/TrocaTitularidadeDialog.tsx`**
   - Remover `useQueries` de `sga-sync-financeiro-veiculo` e o mapa `situacaoPorId`.
   - Remover sufixo "— ADIMPLENTE/INADIMPLENTE" no `<select>` de veículos.
   - Remover bloco de badge de situação financeira, `cobrancasQuery` e a lista de boletos pendentes.
   - Manter `useBoletosSgaPorAssociado` apenas para enumerar veículos (a UI já usa `v.placa/marca/modelo`; ignoramos `boletos_abertos`/`saldo_devedor`).
   - Manter o fallback local `useTrocaTitularidadeFallbackLocal`.

2. **`src/components/troca-titularidade/ModalDetalhesTroca.tsx`**
   - Remover query `troca-debito-antigo` (`relacionamento_debitos_pendentes`) e variável `debitoPendente`.
   - Remover o `<Alert>` "Saldo de R$ … no SGA. A aprovação será liberada após quitação".
   - Remover o render de `<RelatorioFinanceiroAntigo />`.
   - Remover `bloqueadoPorDebito` do botão "Aprovar Cadastro" (passa a depender só do termo assinado).

3. **`src/components/troca-titularidade/RelatorioFinanceiroAntigo.tsx`**
   - Deletar arquivo (sem outros consumidores depois do passo 2).

### Backend (edge functions)

4. **`supabase/functions/aprovar-troca-cadastro/index.ts`**
   - Remover o passo 3 (consulta a `relacionamento_debitos_pendentes` e o early-return 409 `DEBITO_PENDENTE_ANTIGO`).
   - Atualizar o cabeçalho de comentários do arquivo.

5. **`supabase/functions/autentique-webhook/index.ts`** (linhas ~370-404)
   - Remover o bloco que consulta `sga-buscar-associado-completo` e insere em `relacionamento_debitos_pendentes` quando o termo de troca é assinado.

### Banco / cron

6. **`cron-recheck-debitos-troca`** — manter o código (idempotente), mas como nenhuma nova linha será criada, o efeito prático cessa. Sem migration; tabela `relacionamento_debitos_pendentes` é preservada para auditoria histórica e para a página de cobrança `/cobranca/relacionamento-trocas` continuar exibindo os legados.

### Memória

7. Atualizar `mem://logic/operations/troca-titularidade-desvinculo-logico` adicionando 1 linha:
   "Antigo titular não precisa estar adimplente — checagem financeira removida do fluxo de troca (criação, detalhes e aprovação Cadastro)."

## Fora de escopo

- `RelacionamentoTrocas.tsx` (cobrança) e `TrocaTitularidadeBadge` continuam lendo a tabela apenas para mostrar registros legados; sem alteração.
- Nenhum DROP/migration na tabela `relacionamento_debitos_pendentes`.
- Demais checagens financeiras de outros fluxos (substituição, cancelamento, etc.) permanecem inalteradas.

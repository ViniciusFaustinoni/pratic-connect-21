

## Mudar janela de sync financeiro Hinova: 5 anos → 5 meses passados

### Contexto
Hoje, ao sincronizar boletos de um veículo via Hinova, a edge function `sga-sync-financeiro-veiculo` chama `listarBoletosVeiculo` sem opções, e o default de `_shared/hinova-client.ts` é uma janela de **5 anos para trás** até hoje. Isso faz cada job pesar mais (mais boletos retornados, mais upserts em `cobrancas`) e ocupa mais a janela horária da Hinova — o que está agravando os 260+ jobs travados em "restrição de horário".

### Mudança
Reduzir a janela para **5 meses anteriores → hoje**, alinhando com o horizonte real de cobrança/recuperação que a operação usa hoje.

### Implementação (1 arquivo)

**`supabase/functions/sga-sync-financeiro-veiculo/index.ts`**
- Nas duas chamadas de `listarBoletosVeiculo(session, codigoAssociado, codigoVeiculo)` (linhas ~262 e ~284), passar uma janela explícita de 5 meses:
  ```ts
  const hoje = new Date();
  const inicio = new Date(hoje);
  inicio.setMonth(inicio.getMonth() - 5);
  const janela = {
    dataInicial: fmtBR(inicio),
    dataFinal: fmtBR(hoje),
  };
  // ...
  boletos = await listarBoletosVeiculo(session, codigoAssociado, codigoVeiculo, janela);
  ```
- Adicionar helper local `fmtBR(d)` (formato `dd/mm/aaaa`, mesmo padrão do `hinova-client`).
- Atualizar o comentário do topo do arquivo: `v3: janela de 5 meses passados`.

**`supabase/functions/_shared/hinova-client.ts`** — sem mudança no default (mantém os 5 anos para callers que não passarem `opts`, evitando regressão em outros lugares). A redução fica restrita ao caller principal de sync financeiro.

### O que NÃO muda
- Nenhuma alteração no banco de dados.
- Nenhuma alteração no comportamento de retry, idempotência (`nosso_numero`), reconciliação por CPF, ou na fila de jobs.
- Boletos antigos (anteriores a 5 meses) já presentes na tabela `cobrancas` permanecem inalterados — não são apagados; apenas deixam de ser **reatualizados** pela sync.

### Trade-offs
- **Ganho**: jobs ~5–10× mais leves, menos pressão na janela horária Hinova, menor risco de bater rate-limit.
- **Perda**: status de boletos com vencimento > 5 meses para trás não é mais reconciliado automaticamente. Para casos pontuais, a sync individual por veículo continua funcionando (e pode ser estendida sob demanda).

### Pós-deploy
- Re-deploy automático de `sga-sync-financeiro-veiculo`.
- Clicar em **"Reagendar erros (janela horária / 401)"** no modal de sync para reenfileirar os 260+ jobs travados — eles voltarão a rodar com a janela menor.


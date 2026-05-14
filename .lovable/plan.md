## Diagnóstico dos uploads de hoje (14/05)

Foram 4 uploads do arquivo `SGA - RELATORIO DE BOLETOS`. Nenhum deles atualizou a tabela canônica `cobrancas` ainda. Detalhes:

| Hora  | Lote (id curto) | Header diz | Persistido | Com match | Status no banco |
|-------|-----------------|-----------:|-----------:|----------:|-----------------|
| 13:23 | 8d077125…      | 35.135     | **13.753** |  11.370   | `processando` (travou) |
| 13:34 | 593722ac…      | 35.135     | **21.374** |  17.118   | `processando` (travou) |
| 13:35 | 068e8308…      | 1.000      |    1.000\* |     —     | `ativo`        |
| 13:36 | 7c31cb05…      | 1.000      |    1.000\* |     —     | `ativo`        |

\* Os 2 últimos foram cortados pelo limite de 1.000 linhas — provavelmente uma tentativa abortada ou um arquivo pequeno de teste.

**Por que nada apareceu em `cobrancas`:**
1. Os 2 lotes grandes ficaram em `processando` — o navegador não chegou a enviar o último chunk (`is_last_chunk=true`), então a finalização do lote e a reconciliação nunca dispararam.
2. Os 2 lotes pequenos finalizaram (`ativo`), mas foram salvos **antes** do deploy da reconciliação automática (que acabei de subir). A tabela `cobranca_reconciliacao_log` está zerada — nenhuma baixa/atualização/criação rodou.
3. O painel `/financeiro/cobrancas` mostra "Total 0" porque o filtro **CSV SGA (lote)** está selecionado, e os boletos importados ficam em `cobranca_csv_boletos` (não em `cobrancas`) — só caem em `cobrancas` depois da reconciliação.

## O que sugiro fazer agora

### 1. Rodar a reconciliação retroativa nos 2 lotes finalizados
Invocar `reconciliar-csv-cobrancas` para `068e8308` e `7c31cb05`. Isso vai:
- Marcar como `pago` (com proteção de 24h) cobranças em aberto que sumiram desses CSVs.
- Atualizar vencimento/valor das que continuam.
- Criar as novas (origem `sga_hinova`).

### 2. Decidir o que fazer com os 2 lotes travados em `processando`
Opções:
- **A — Promover para `ativo` e reconciliar com o que já foi gravado** (rápido, mas a baixa de "ausentes" usaria uma listagem incompleta — risco de marcar como pagas cobranças que na verdade continuam abertas, só que não chegaram a ser gravadas).
- **B — Marcar os 2 lotes travados como `cancelado` e refazer só os uploads grandes** (recomendado — evita falso pago).

### 3. Salvaguarda contra travamento
Adicionar no `ImportarCobrancaCsv.tsx`/`SalvarNoSistemaCard` retry automático por chunk (3 tentativas com backoff) e um botão **"Retomar lote em processamento"** na tela do Lote ativo, que continua de onde parou — para que arquivos grandes (35k linhas) não fiquem órfãos quando a aba é fechada no meio.

### Confirmação que preciso
1. Posso rodar a reconciliação retroativa só nos 2 lotes ativos pequenos (`068e8308`, `7c31cb05`)?
2. Para os 2 lotes travados, prefere **A** (promover e reconciliar parcial — risco de falso pago) ou **B** (cancelar e te pedir para refazer o upload grande)?
3. Implemento já a salvaguarda de retomada de lote?

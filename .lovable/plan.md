## Objetivo
Impedir que o mesmo boleto (mesma `linha_digitavel`) seja gravado mais de uma vez em `cobranca_csv_boletos`, mesmo que o CSV traga linhas repetidas ou que arquivos diferentes contenham o mesmo boleto.

## Como funciona hoje
- A edge `importar-cobrancas-csv` faz `INSERT` direto em `cobranca_csv_boletos`.
- A tabela tem índice comum em `linha_digitavel`, mas **não** tem restrição de unicidade — então repetições passam.

## Mudanças

### 1. Banco (migration)
- Limpar duplicados existentes mantendo a ocorrência mais antiga por `linha_digitavel` (preserva histórico de status/recuperação).
- Criar índice único: `CREATE UNIQUE INDEX cobranca_csv_boletos_linha_uq ON cobranca_csv_boletos(linha_digitavel);`

### 2. Edge function `importar-cobrancas-csv`
- Antes do insert, deduplicar dentro do chunk por `linha_digitavel` (último vence — mantém placa/valor mais recente do CSV).
- Trocar `.insert(rows)` por `.upsert(rows, { onConflict: 'linha_digitavel', ignoreDuplicates: true })` — boletos já existentes no banco são silenciosamente ignorados.
- Contar `duplicados_ignorados` (diferença entre linhas enviadas e linhas efetivamente persistidas) e devolver no JSON de resposta, junto com `ignorados_sem_linha_digitavel` que já existe.

### 3. UI `ImportarCobrancaCsv.tsx`
- Adicionar `duplicadosIgnorados` ao estado `resumo` e exibir no grid de resumo (passa de 4 para 5 colunas, ou agrupa "Ignoradas" em um só bloco com tooltip).
- Toast final mostra "X duplicadas ignoradas" quando >0.

## Comportamento resultante
- Reimportar o mesmo arquivo: zero novos registros, contador de duplicadas = total.
- Arquivo novo com alguns boletos já existentes: só os novos entram, os repetidos aparecem no resumo como ignorados.
- Lote continua sendo criado normalmente para auditoria, mesmo que todos os boletos sejam duplicados.
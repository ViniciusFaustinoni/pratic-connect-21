# Aumentar limite do CSV de Inadimplentes

## Contexto

Em `src/components/financeiro/ImportarCobrancaCsv.tsx` (Régua › Emissão de Cobranças › Importar CSV) há um bloqueio fixo de **5 MB** no `onDrop` (linha 122) e o texto da dropzone diz "Apenas .csv — máx 5 MB" (linha 271). Arquivos maiores são rejeitados com toast "Arquivo maior que 5 MB."

O parsing é client-side (`f.text()` → `parseCsvInadimplentes`), tudo em memória do browser. CSVs de inadimplência do SGA com muitos boletos podem facilmente passar de 5 MB.

## Mudanças (escopo cirúrgico, só presentation)

Arquivo único: `src/components/financeiro/ImportarCobrancaCsv.tsx`

1. Substituir o limite hard-coded `5 * 1024 * 1024` por uma constante `MAX_CSV_BYTES = 50 * 1024 * 1024` (50 MB) no topo do arquivo.
2. Atualizar a mensagem do toast para usar a constante: `Arquivo maior que ${MAX_CSV_MB} MB.`
3. Atualizar o texto auxiliar da dropzone (linha 271) para `Apenas .csv — máx 50 MB`.
4. Adicionar feedback visual durante o parse (já existe `setEtapa('preview')` após o parse; opcional: setar um estado `parsing` para mostrar `Loader2` na dropzone enquanto `f.text()`/`parseCsvInadimplentes` rodam, já que arquivos grandes podem demorar 1-3s).

Sem alterações em hooks, edge functions, parser ou backend — o parser e o disparo (chunks de 50 destinatários para `disparar-cobranca-csv-meta`) já lidam com volumes grandes.

## Pergunta

Qual limite você quer? Sugestão padrão **50 MB** (cobre lotes do SGA com ~100k linhas). Se preferir outro valor (20 MB, 100 MB, sem limite), me diga antes de implementar.

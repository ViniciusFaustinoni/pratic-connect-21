## Objetivo

Na tela **Financeiro › Cobranças › Régua › Emissão de Cobranças › Importar CSV (SGA)**, permitir 3 formas de entrada da listagem de inadimplentes:

1. **Arrastar/selecionar arquivo** — `.csv` (já existe) **+ `.xlsx` (novo)**
2. **Colar CSV** direto em uma área de texto (novo)

Tudo continua passando pelo mesmo parser e pelo template Meta `cobranca_inadimplencia_pratic`.

## Layout aceito

```
Nome,matricula,placas,telefone celular,telefone,Data Vencimento,Codigo de Barras
```

> O parser atual (`parseCsvInadimplentes.ts`) **já trata esse layout** — a coluna "Data Vencimento Original" não é obrigatória. Só preciso ajustar o texto da Alert na UI, que ainda menciona ela.

## Mudanças (apenas frontend)

**Arquivo: `src/components/financeiro/ImportarCobrancaCsv.tsx`**

1. Adicionar `Tabs` na etapa `upload` com 2 abas:
   - **Arquivo** (CSV ou XLSX) — dropzone existente, com `accept` ampliado para `.xlsx`
   - **Colar CSV** — `Textarea` grande + botão "Processar"

2. Para XLSX: usar `xlsx` (já em `package.json`) para ler a primeira planilha e converter em CSV via `XLSX.utils.sheet_to_csv()`, depois passar pro mesmo `parseCsvInadimplentes()`. Criar helper interno `lerArquivoComoTextoCsv(file)` que detecta extensão.

3. Para colar: extrair `onProcessarTexto(texto)` que reaproveita o restante do fluxo (parse → preview → reconciliação).

4. Atualizar a `Alert` para listar as colunas corretas (sem "Data Vencimento Original") e mencionar que aceita CSV, XLSX ou colar.

## Não muda

- Parser `parseCsvInadimplentes.ts` (já compatível)
- Edge function `disparar-cobranca-csv-meta` (recebe os mesmos `destinatarios`)
- Template Meta, regras de reconciliação, lote, recuperados — intactos

## Observação

O exemplo XLSX anexado tem uma linha onde a coluna `placas` contém `KVV2E05|22314` (placa + valor de boleto colados) — o parser atual já guarda isso como `placa`. Posso adicionar uma normalização opcional que separa `|` se desejar — sinalize se for o caso.

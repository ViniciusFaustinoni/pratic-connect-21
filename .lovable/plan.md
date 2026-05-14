## Objetivo

Na tela `/financeiro/cobrancas/regua → Emissão de Cobranças → Importar CSV`, adicionar:

1. Botão **"Baixar template (.xlsx)"** que gera um modelo já pronto para preenchimento.
2. Suporte a **2 novas colunas opcionais** no parser e na persistência:
   - `valor` (R$ do boleto — ainda funciona junto da extração automática pela linha digitável; quando vier preenchido, o CSV manda)
   - `link` (URL da fatura/2ª via Hinova)

---

## Mudanças

### 1. Template XLSX
- Novo arquivo `src/lib/cobranca/templateCobrancas.ts` que gera o workbook via `xlsx` (já presente no projeto) com:
  - Cabeçalho na ordem aceita pelo parser: `Nome, Matrícula, CPF, Placas, Telefone Celular, Telefone, Data Vencimento, Codigo de Barras, Valor, Link, Tipo, Status`
  - 1 linha de exemplo preenchida (associado fictício, vencimento, boleto, valor R$ 189,90, link `https://hinova.../fatura/...`)
  - Aba secundária `Instruções` com regras (mínimo: Nome+Matrícula; demais opcionais; valor sobrescreve a extração automática; link é exibido no disparo Meta).
- Função `baixarTemplateCobrancasXlsx()` que monta o blob e dispara o download como `template-cobrancas.xlsx`.

### 2. Botão na UI
- Em `src/components/financeiro/ImportarCobrancaCsv.tsx`, ao lado dos botões "Arquivo / Colar CSV", adicionar `<Button variant="outline" onClick={baixarTemplateCobrancasXlsx}>` com ícone `Download` e label "Baixar template (.xlsx)".
- Atualizar o texto-guia do card (`Aceita CSV, XLSX...`) listando as duas novas colunas.

### 3. Parser
- Em `src/lib/cobranca/parseCsvInadimplentes.ts`:
  - Adicionar alias `link: ['link', 'link fatura', 'url fatura', 'url boleto', '2via', 'segunda via']`.
  - Adicionar campo `link?: string` em `BoletoCsv`.
  - Ao montar o boleto da linha, ler `getCol(cols, 'link')` (sanitizar: tem que começar com `http`).
  - O alias `valor` já existe; manter a regra: se vier valor no CSV usa esse, senão tenta extrair da linha digitável.

### 4. Persistência (banco + edge)
- Migration: `ALTER TABLE cobranca_csv_boletos ADD COLUMN link_fatura text;` (nullable, sem default).
- Edge `supabase/functions/importar-cobrancas-csv/index.ts`: incluir `link_fatura: boleto.link ?? null` no insert em lote.

### 5. Disparo Meta (lote ativo)
- `src/components/financeiro/LoteAtivoCobrancas.tsx`: quando agrupar por matrícula, pegar o primeiro `link_fatura` não-nulo entre os boletos do associado e enviar como variável `{{link}}` no payload do template (sem alterar nome do template — só passa o parâmetro extra; se o template ainda não consumir, a variável fica disponível).

---

## Detalhes técnicos

- Lib XLSX: usar `xlsx` (`import * as XLSX from 'xlsx'`) que já é usado no parser para ler `.xlsx`. Para escrita: `XLSX.utils.aoa_to_sheet`, `XLSX.utils.book_new`, `XLSX.writeFile` (ou `write` + Blob para SPA).
- Sanitização `link`: descarta valores não-URL para não poluir mensagens.
- Sem mudança em RLS (`cobranca_csv_boletos` já tem políticas; coluna nova herda).

---

## Arquivos tocados

- `src/lib/cobranca/templateCobrancas.ts` (novo)
- `src/lib/cobranca/parseCsvInadimplentes.ts` (alias + campo `link`)
- `src/components/financeiro/ImportarCobrancaCsv.tsx` (botão + texto)
- `src/components/financeiro/LoteAtivoCobrancas.tsx` (variável `{{link}}` no envio)
- `supabase/functions/importar-cobrancas-csv/index.ts` (persistir `link_fatura`)
- nova migration `add link_fatura to cobranca_csv_boletos`

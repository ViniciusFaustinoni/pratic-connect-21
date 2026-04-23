

## Aceitar Nota Fiscal / CRV (ATPV-e) para veículos 0KM sem bloquear por placa

### Diagnóstico

Já está **tudo implementado** no pipeline para aceitar `nota_fiscal_veiculo` e `atpv_e` (CRV digital) no lugar do CRLV:

- **Backend OCR** (`supabase/functions/document-ocr/index.ts`) detecta os 3 tipos, extrai chassi/placa/Renavam/motor/comprador/valor.
- **UI pública** (`EtapaDadosPessoaisDocumentos.tsx`, linha 136) já considera `temCrlv = crlv || nota_fiscal_veiculo || atpv_e` para liberar o avanço.
- **Mapeamento de campos** já popula `veiculo_chassi`, `numero_motor`, `valor_nota_fiscal`, ano_fab/modelo etc. para os 3 tipos.
- **Lista exibida ao usuário** já diz "CRLV, Nota Fiscal ou ATPV-e (CRV Digital)".
- **Banco** aceita `tipo = 'nota_fiscal_veiculo'` no INSERT.

**O problema real, descoberto durante a investigação:** a validação de placa em `UnifiedDocumentUploader.tsx` linha 203-224 quebra um caso 0KM legítimo:

> Quando a cotação foi feita como **0KM** (placa armazenada é o placeholder técnico `0KM…`, criado por `placa-utils.ts`), o cliente pode enviar:
> - **Nota Fiscal** (sem placa) → OK, hoje já passa porque o `if` só roda se `tipo_detectado === 'crlv'`.
> - **CRV / ATPV-e** com placa real recém-emitida (ex.: `KRQ9C56` da imagem) → também passa hoje, pelo mesmo motivo.
> - **CRLV** de veículo já emplacado vinculado a essa "cotação 0KM" → o `if` dispara, compara `KRQ9C56` vs `0KMA1B2C` e **bloqueia indevidamente**.

E há a contraparte:
- Cotação com placa real + cliente envia ATPV-e/Nota Fiscal de **outro veículo** → como a validação só roda para `crlv`, **não há checagem nenhuma** e o documento errado entra no contrato silenciosamente.

### O que vai mudar

**1. `src/components/contratos/UnifiedDocumentUploader.tsx` — corrigir validação de placa (linhas 201-224)**

Substituir o `if` atual por lógica que cobre 4 cenários:

```text
A) tipo é doc do veículo (crlv | atpv_e | nota_fiscal_veiculo)
   ├── cotação é 0KM (isPlacaPlaceholder(placaEsperada) === true)
   │     └── NÃO compara placa. Aceita o documento. (caso da NF, do CRV recém-emitido,
   │         e até de um CRLV cuja placa "nova" o sistema ainda não conhece.)
   │         Loga: "[Uploader] Veículo 0KM: validação de placa ignorada".
   │
   └── cotação tem placa real
         ├── doc traz placa (CRLV, normalmente ATPV-e, às vezes NF) →
         │     usar compararPlacasComDetalhe (já existe). Se divergir, bloquear.
         │
         └── doc NÃO traz placa (NF de 0km típica) →
               aceitar, mas logar warning leve "[Uploader] NF sem placa,
               validação por placa não aplicável" (sem toast).
```

**2. (Opcional, mesma alteração) Mensagem do banner amarelo "documentos esperados"**

Já está correta na linha 74: `"CRLV, Nota Fiscal ou ATPV-e (CRV Digital)"`. Sem mudança.

**3. Documentar regra na memória do projeto**

Adicionar `mem://logic/operations/documento-veiculo-equivalencia` resumindo: "Para 0KM, NF e ATPV-e/CRV substituem CRLV; validação de placa é ignorada quando `isPlacaPlaceholder(placa) === true`."

### O que NÃO muda

- Edge `document-ocr` (já detecta NF e ATPV-e corretamente).
- Mapeamento de campos em `EtapaDadosPessoaisDocumentos.tsx` (já popula chassi/motor/valor).
- Tabelas/RLS/contratos_documentos.
- Comportamento para placa real vs CRLV com placa divergente (continua bloqueando, com saneamento OCR).

### Arquivos editados

- `src/components/contratos/UnifiedDocumentUploader.tsx` — substituir bloco de validação (linhas 201-224) por lógica que: (a) ignora comparação para qualquer doc do veículo quando `placaEsperada` é placeholder 0KM; (b) estende a comparação para `atpv_e`/`nota_fiscal_veiculo` quando ambos os lados têm placa real; (c) só faz log silencioso quando NF não trouxer placa.
- `mem://logic/operations/documento-veiculo-equivalencia.md` — nova regra. Atualizar `mem://index.md` listando-a em "Memories".

### Riscos

- Aceitar documento errado para 0KM: como a cotação 0KM por definição não tem placa para conferir, o sistema confia em chassi/marca/modelo extraídos do doc — operacional já faz revisão manual no estágio `em_analise` (memória `aprovacao-manual-documentos-vistoria`). Sem regressão.
- ATPV-e da venda de veículo usado (caso da imagem `KRQ9C56`) sendo enviado quando o cliente comprou um seminovo já com placa: continua sendo validado contra a placa da cotação quando a cotação tiver placa real. Sem perda de checagem.


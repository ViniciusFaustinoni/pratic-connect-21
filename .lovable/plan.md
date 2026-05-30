## Diagnóstico

O CRLV anexado tem `PLACA KOU6D37` (confirmado no texto do PDF), mas o OCR está retornando `KOU6D17` — o dígito **3** foi lido como **1** na posição 5 (Mercosul: 6º caractere).

Hoje o `document-ocr` tem três defesas de saneamento de placa:

1. **Swaps visuais (`DIGIT_SWAPS`)** em `supabase/functions/document-ocr/index.ts` (linhas 180-188): cobrem 6↔8, 0↔8, 5↔6, 1↔7, 0↔9, 3↔8, 2↔7 — **NÃO cobre 1↔3**, que é exatamente a confusão deste caso (e bem comum em CRLVs com fonte serifada apertada).
2. **Cross-check com texto nativo do PDF** (linhas 2411-2431): só funciona quando `extractedPdfText` está populado e a regex acha a placa correta lá. Para este CRLV-e o texto deveria existir, mas se o PDF cair no caminho de rasterização (unpdf falhou / score baixo) a defesa some.
3. **Cross-check com banco por CPF** (linhas 2433-2498): só dispara se a placa correta já existir em `veiculos.placa` ou `cotacoes.placa` do CPF — em fluxo de nova cotação isso normalmente já está populado (a placa cotada está em `cotacoes.placa`), MAS depende de `KOU6D37` estar nos `placasParaTestar`, e isso só acontece se algum swap a gere a partir de `KOU6D17`. Sem o swap 1↔3, ela nunca entra na lista e o banco nunca é consultado com ela.

Conclusão: a causa raiz é a ausência do par `1↔3` (e alguns vizinhos visuais frequentes) em `DIGIT_SWAPS`. Reforço secundário: o endpoint aceita `dadosEsperados` no body mas nunca usa a `placa` esperada da cotação como âncora de cross-check direto — então mesmo quando o front sabe que a placa cotada é `KOU6D37`, essa informação não chega ao saneador.

## Mudança proposta

Escopo cirúrgico em **um único arquivo**: `supabase/functions/document-ocr/index.ts`.

### 1. Ampliar `DIGIT_SWAPS` com pares visuais que faltam

Adicionar pares simétricos para confusões reais já observadas em CRLVs:

```ts
['1', '3'], ['3', '1'],   // caso KOU6D37 → KOU6D17
['3', '5'], ['5', '3'],   // serifa apertada
['3', '9'], ['9', '3'],   // base curva ambígua
['1', '4'], ['4', '1'],   // traço vertical
['4', '7'], ['7', '4'],   // topo serrilhado
```

Mantém o limite "1 swap por candidato" já garantido pelo `gerarCandidatosPlaca`, então o conjunto continua pequeno (<40 itens).

### 2. Usar `dadosEsperados.placa` como cross-check direto

Dentro do bloco `if (v.field === 'placa')` (linha 2411), antes do cross-check com banco, adicionar:

- Se `dadosEsperados?.placa` existir e for válida pelo `validatePlaca`, gerar `candidatosOCR` a partir da placa lida e:
  - Se a placa esperada estiver entre eles, adotar imediatamente (`d.placa = placaEsperada`) e logar `[OCR] Placa confirmada via dadosEsperados`.
  - Caso contrário, deixar os demais cross-checks (PDF nativo, banco) seguirem normalmente.

Isso fecha o caso mesmo quando:
- O PDF não tem texto nativo extraível (escaneado).
- O CPF ainda não tem registro em `veiculos`/`cotacoes` (cotações muito novas com índice fora de sincronia).

### 3. Não mexer em `useDocumentoOCR.ts` por enquanto

O hook já encaminha o body inteiro via `supabase.functions.invoke`. Os consumidores que enviam OCR de CRLV em contexto de cotação já passam `cpfEsperado`; aqueles que ainda não passam `dadosEsperados.placa` continuarão funcionando — só não vão se beneficiar do cross-check direto. Fica como follow-up opcional adicionar `dadosEsperados: { placa: cotacao.placa }` nos call-sites de upload de CRLV (não é necessário pra fechar este bug, basta a Camada 1).

### 4. Verificação

- Reprocessar manualmente o CRLV anexado via UI de Cadastro → confirmar que `placa` retorna `KOU6D37` e não dispara mais o aviso "placa do CRLV não corresponde".
- Checar logs da edge `document-ocr` por mensagem `[OCR] Placa confirmada via banco (CPF ...)` ou `[OCR] Placa cross-check OCR↔PDF` para confirmar qual camada resolveu.

## Fora de escopo

- Reescrever o prompt do Gemini.
- Alterar o fluxo de comparação de placa do front (`placasEquivalentes` em `src/lib/placa-utils.ts`) — esse já tolera as confusões letra↔dígito; o que falta é só letra do OCR vir correta.
- Bloqueio/banner novo na UI: o banner atual já é o comportamento esperado quando o saneamento falha.

## Arquivos tocados

- `supabase/functions/document-ocr/index.ts` (constante `DIGIT_SWAPS` + bloco de cross-check de placa).

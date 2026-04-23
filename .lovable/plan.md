

## OCR confunde letras e dígitos na validação de placa (CRLV)

### Diagnóstico (caso da imagem)

- Placa da cotação: `LQV3623` (formato **antigo** — 4 dígitos no final).
- Placa lida pelo OCR no CRLV: `LQV3G23`.
- O CRLV real anexado mostra `LQV3623` correto. O OCR confundiu **6 → G** na 5ª posição.
- O sistema bloqueou o upload com "A placa do CRLV (LQV3G23) não corresponde à placa da cotação (LQV3623)".

A causa está em `src/components/contratos/UnifiedDocumentUploader.tsx` (linhas 200-254). A função `normalizePlaca` ali assume **apenas o padrão Mercosul** (posição 4 = letra, posições 3/5/6 = dígitos). Resultado: para placa antiga, a 5ª posição é dígito, mas a normalização tenta converter para letra (mantém `G`) e o `!=` dispara.

O backend (`document-ocr/index.ts`) já tem funções corretas: `gerarCandidatosPlaca`, `normalizePlacaMercosul`, regex para placa antiga e Mercosul. **A correção é só replicar essa lógica resiliente no front, antes da comparação.**

Confusões comuns OCR a tratar nas duas direções:
- Letra → Dígito: O→0, Q→0, D→0, I→1, L→1, Z→2, S→5, G→6, T→7, B→8
- Dígito → Letra: 0→O, 1→I, 2→Z, 5→S, 6→G, 8→B

### O que vai mudar

**1. Comparação resiliente de placa por geração de candidatos** (`src/components/contratos/UnifiedDocumentUploader.tsx`, linhas 200-254)

Trocar a normalização atual (que assume só Mercosul) por uma função `placasEquivalentes(placaOCR, placaEsperada)` que:

a. Limpa ambas (uppercase, sem hífen/espaço) e exige 7 caracteres.
b. Detecta o **formato esperado** (antigo `^[A-Z]{3}[0-9]{4}$` vs Mercosul `^[A-Z]{3}[0-9][A-Z][0-9]{2}$`) a partir da `placaEsperada` (que é a referência confiável vinda da cotação).
c. Sanea a placa do OCR usando o **mapa correto para o formato detectado**:
   - **Antigo**: posições 0,1,2 → letras; posições 3,4,5,6 → dígitos. Aplica `LETTER_TO_DIGIT` nas 4 últimas posições.
   - **Mercosul**: posições 0,1,2,4 → letras; posições 3,5,6 → dígitos. Aplica os dois mapas conforme posição.
d. Compara saneada com esperada. Se igual → ok.
e. Fallback extra: se ainda diferente, gera candidatos cruzados (testa também o outro formato) só para evitar falso negativo quando o OCR errar mais de uma posição.

**2. Mensagem de erro mais útil**

Quando ainda assim divergir após o saneamento, manter o bloqueio mas trocar o texto para:

> "A placa do CRLV (`{placa_lida}`) não corresponde à placa da cotação (`{placa_esperada}`). Verifique se o CRLV é do veículo correto. Se a placa do documento estiver realmente correta, ajuste-a no cadastro."

E logar no console o par `(placaOCR, placaSaneada, placaEsperada, formatoDetectado)` para facilitar diagnósticos futuros.

**3. Validação equivalente em outros pontos** (varredura)

Aplicar a mesma função utilitária em:
- `src/pages/cadastro/SolicitacoesMigracao.tsx` linha 403 (`placaOk`), que hoje compara só com `toUpperCase()` e nem trata confusões — vai marcar OK falso ou divergente falso.
- Extrair a função para `src/lib/placa-utils.ts` (já existe, hoje só com `formatPlacaExibicao`/`isPlacaPlaceholder`) como `placasEquivalentes(a, b)` exportada, reusando em ambos os lugares.

**4. Backend: nenhum ajuste necessário**

O prompt em `document-ocr/index.ts` já instrui Gemini sobre os dois formatos e a regra "as 4 últimas posições da placa antiga são sempre dígitos" (linhas 273-278). Mantém-se. Esta correção é defesa em profundidade no consumidor do resultado.

### O que NÃO muda

- Edge function `document-ocr` e seu prompt.
- Lógica de upload, RLS, bucket, OCR em si.
- Outros campos extraídos (chassi, renavam, nome).
- Comportamento quando a placa lida e a esperada são realmente diferentes (continua bloqueando).

### Arquivos editados

- `src/lib/placa-utils.ts` — adicionar `placasEquivalentes(a, b)` com detecção de formato e saneamento bidirecional.
- `src/components/contratos/UnifiedDocumentUploader.tsx` (linhas 200-254) — substituir `normalizePlaca` local por `placasEquivalentes`; melhorar mensagem de erro e log.
- `src/pages/cadastro/SolicitacoesMigracao.tsx` (linha 403) — usar `placasEquivalentes` no lugar do `===` direto.

### Riscos

- Aceitar como equivalente um par que de fato é diferente (falso positivo) — mitigado porque a detecção de formato usa a placa esperada (confiável) como âncora e a saneamento só substitui caracteres conhecidamente ambíguos. Em caso real de placa errada (ex.: `LQV3623` vs `MNO1234`), nenhum saneamento aproxima, segue bloqueando.
- Placa antiga "ABC1G34" onde G está numa posição válida de letra — não existe esse caso (posição 4 do antigo é sempre dígito, por definição).


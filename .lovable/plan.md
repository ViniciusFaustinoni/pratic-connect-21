## Problema

No link público (cotação), mesmo quando o OCR lê o documento e preenche os campos importantes (ex.: comprovante de residência com nome + CEP), o componente `OcrDadosEditor` exibe a badge vermelha **"Não foi possível ler"** e o texto **"Não conseguimos ler o documento automaticamente. Preencha os campos manualmente abaixo."**

Isso acontece porque o componente confia em `legivel === false` ou `sugestao === 'reprovar'` vindos do edge `document-ocr` — que marca como falha sempre que campos secundários (validade, número, etc.) não puderam ser lidos, mesmo com confiança ≥ 70% e dados essenciais OK.

Resultado: o associado vê erro vermelho num documento que foi lido com sucesso, gerando confusão.

## Solução (apenas UI / presentation)

Apenas no `src/components/ocr/OcrDadosEditor.tsx`, recalcular o estado "OCR falhou" levando em conta o que efetivamente foi extraído:

1. Considerar o OCR como **bem-sucedido** quando **todos os campos `important: true` do schema** estiverem preenchidos em `dados` (não vazios após trim), independentemente de `legivel`/`sugestao`.
2. Só tratar como `ocrFalhou` (badge vermelha + banner + auto-edição) quando faltar algum campo importante OU quando não houver nenhum dado extraído.
3. Quando o OCR retornou `legivel=false`/`sugestao=reprovar` mas os campos importantes estão todos preenchidos:
   - Esconder a badge "Não foi possível ler" e o banner em vermelho.
   - Mostrar a badge "Revise os dados" (amarela) — sinalizando que vale conferir, sem alarmar.
   - Não forçar modo edição automático (deixar usuário abrir se quiser ajustar).
4. Manter o comportamento atual quando realmente não há dados (schema com importantes vazios) ou quando `forceEdit=true`.

## Escopo

- Único arquivo alterado: `src/components/ocr/OcrDadosEditor.tsx`.
- Sem mudanças no edge `document-ocr`, no schema de campos, nem nos fluxos que consomem o componente.
- Sem mudança de tokens de design ou layout — apenas a lógica que decide qual badge/banner mostrar.

## Aceite

- Comprovante de residência (screenshot) com nome + CEP preenchidos e 70% confiança: cabeçalho mostra **"70% confiança"** + **"Revise os dados"** (amarela), sem texto vermelho de erro, sem auto-abrir edição.
- Documento sem CEP nem nome (campos importantes vazios): continua mostrando **"Não foi possível ler"** + banner vermelho + modo edição aberto, como hoje.
- Documento lido com `sugestao='aprovar'`: continua mostrando **"Lido com sucesso"** (verde).
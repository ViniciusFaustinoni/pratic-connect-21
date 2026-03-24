
# Revisão completa do OCR — causas prováveis do erro e plano de correção

## O que a investigação mostrou

- O PDF enviado é legível e tem texto estruturado. O parser conseguiu extrair:
  - nome completo
  - RG
  - registro
  - datas
  - CPF como `124.936.497-37`
- Nos logs da edge function `document-ocr`, a IA retornou outro CPF para CNH: `126.936.697-37`, também inválido por dígito verificador.
- Depois disso, o retry específico de CPF falhou ao parsear a resposta:
  - log: `Falha ao parsear resultado do retry de CPF: ```json {"cpf": "`
- Ou seja: o problema não está só no upload. Ele acontece dentro da leitura/estruturação da resposta do OCR.

## Principais erros que podem levar a esse problema

### 1. PDF está sendo tratado como imagem, não como PDF textual
Arquivo: `supabase/functions/document-ocr/index.ts`

Hoje a função:
- baixa o PDF
- converte para base64
- envia como `image_url` com `data:application/pdf;base64,...`

Isso é frágil para PDFs digitais como CNH-e. Para esse tipo de documento, o caminho mais confiável costuma ser:
1. tentar extração nativa de texto
2. só cair para OCR visual se o texto vier ruim

Impacto:
- regressão em documentos que antes funcionavam
- leitura inconsistente de CPF, especialmente em CNH digital/PDF

### 2. O modelo principal é `google/gemini-3-flash-preview`
Arquivo: `supabase/functions/document-ocr/index.ts`

Uso de modelo preview em fluxo crítico de OCR aumenta risco de:
- resposta truncada
- JSON malformado
- instabilidade entre documentos iguais

Evidência:
- o retry do CPF voltou truncado no meio do JSON

### 3. O retry de CPF é frágil demais no parse
Arquivo: `supabase/functions/document-ocr/index.ts`

No fluxo principal existe tentativa de reparar JSON truncado.
No retry de CPF não existe esse mesmo tratamento: ele faz `JSON.parse` direto.

Impacto:
- mesmo quando o modelo “quase” responde corretamente, o sistema marca como erro/ilegível
- o log atual bate exatamente com esse cenário

### 4. Falta estratégia específica para PDF textual vs PDF escaneado
Hoje a função usa praticamente a mesma estratégia para tudo.
Isso mistura 2 problemas diferentes:
- PDF com texto embutido
- PDF escaneado/imagem

Impacto:
- documentos bons entram no caminho mais fraco
- custo maior de IA e mais chance de erro

### 5. A função recebe contexto útil, mas ignora parte dele
Frontend envia `tipoEsperado` em alguns fluxos, mas a função prioriza “detectar automaticamente”.
Para documentos conhecidos (ex.: CNH), isso reduz precisão desnecessariamente.

Impacto:
- a IA pode gastar contexto detectando tipo em vez de focar no campo crítico
- piora extração de campos como CPF

### 6. A estrutura de resposta depende de JSON livre, sem schema forte
Hoje o OCR espera texto JSON no `message.content`.
Sem tool calling/schema estrito para o OCR, o sistema fica exposto a:
- markdown
- placeholders
- resposta parcial
- chaves faltando

Impacto:
- qualquer pequena variação do modelo quebra o parse

### 7. O problema pode ser mais forte em CPF de CNH do que em outros docs
Os logs mostram:
- CRLV: extração boa
- comprovante: extração boa
- CNH: erro no CPF

Isso indica que o gargalo atual está concentrado em:
- PDF de CNH
- campo CPF
- retry corretivo

## Diagnóstico mais provável

A causa raiz mais provável é esta combinação:

1. PDFs digitais estão indo para um fluxo “visual” inadequado
2. o modelo preview está mais instável
3. o retry de CPF não tolera resposta truncada
4. o sistema não separa extração nativa de texto e OCR visual

Resultado:
- a CNH é parcialmente lida
- o CPF sai errado
- o retry também falha
- o documento acaba como inválido/ilegível

## Melhor plano para resolver de forma durável

### Etapa 1 — corrigir a arquitetura do OCR para PDFs
Em `supabase/functions/document-ocr/index.ts`:

- criar fluxo em 2 etapas para PDF:
  1. tentativa de extração nativa de texto
  2. fallback para OCR visual só se a qualidade do texto for ruim

Para o seu caso, esse é o ajuste mais importante.

### Etapa 2 — remover dependência do modelo preview no OCR
- trocar o `google/gemini-3-flash-preview` por modelo estável
- manter um único padrão de modelo por tipo de tarefa

Objetivo:
- reduzir truncamento
- estabilizar respostas entre execuções

### Etapa 3 — endurecer o retry de CPF
- aplicar no retry a mesma rotina de reparo de JSON truncado já usada no fluxo principal
- aceitar resposta em schema fechado/tool calling quando possível
- se o retry vier parcial, ainda tentar recuperar `"cpf"` por regex antes de desistir

### Etapa 4 — usar `tipoEsperado` quando ele existir
- se o frontend já sabe que o documento é CNH, a função deve usar isso para reduzir ambiguidade
- manter autodetecção apenas quando o tipo realmente for desconhecido

### Etapa 5 — separar “falha de leitura” de “falha de parse”
Hoje ambas acabam parecendo “erro de OCR”.
O ideal é retornar estados diferentes:
- arquivo baixado com sucesso, mas IA respondeu truncado
- texto extraído, mas CPF inválido
- documento ilegível
- tipo incompatível

Isso acelera muito a manutenção.

### Etapa 6 — criar casos de teste com documentos reais
Casos mínimos:
- CNH PDF digital
- CNH imagem/foto
- CRLV PDF
- comprovante PDF
- PDF escaneado ruim

Assim dá para validar regressão sempre que o modelo/prompt mudar.

## Prioridade sugerida

### Prioridade alta
- PDF textual primeiro, OCR visual como fallback
- sair do modelo preview
- robustecer parse do retry de CPF

### Prioridade média
- usar `tipoEsperado`
- melhorar códigos de erro e observabilidade

### Prioridade baixa
- refinar prompts e limpeza de campos secundários

## Arquivos que devem entrar no ajuste

- `supabase/functions/document-ocr/index.ts` — principal correção
- `src/components/contratos/UnifiedDocumentUploader.tsx` — opcional, para enviar `tipoEsperado` quando aplicável
- `src/hooks/useDocumentoOCR.ts` — opcional, para alinhar contrato da chamada
- `src/hooks/useContratoDocumentos.ts` — verificar consistência do `tipoEsperado`

## Conclusão objetiva

O OCR não parece “quebrado por completo”; ele está instável em um ponto bem específico:
- CNH em PDF
- extração de CPF
- resposta truncada/malformada do modelo

A correção mais importante não é só mexer no prompt. É mudar a estratégia:
- texto nativo para PDF
- OCR visual só como fallback
- parse resiliente no retry
- abandonar modelo preview no fluxo crítico

Esse é o caminho com maior chance de fazer o sistema voltar ao nível de confiabilidade que ele tinha antes.

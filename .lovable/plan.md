

## Plano: Corrigir extração da categoria da CNH no OCR

### Problema
A CNH-e (digital) tem um campo "9 CAT HAB" com a categoria real (ex: **B**), mas também possui uma **grade/tabela de categorias** (ACC, A, B, C, D, BE, CE, DE...) onde cada linha é um cabeçalho de categoria. O modelo de IA confunde os cabeçalhos da grade com a categoria real, extraindo "D" em vez de "B".

### Solução
Adicionar instrução explícita no prompt do OCR (`supabase/functions/document-ocr/index.ts`) para orientar o modelo a:
1. Ler a categoria do campo **"9 CAT HAB"** (texto ao lado do CPF e nº registro), e **não** da grade/tabela de categorias
2. A grade de categorias lista todas as categorias possíveis com datas de habilitação — ignorar como fonte da categoria principal
3. Categorias válidas: A, B, C, D, E, AB, AC, AD, AE, ACC

### Alteração

**`supabase/functions/document-ocr/index.ts`** — linha 74, expandir a seção CNH do prompt:

```
categoria
- CATEGORIA: leia do campo "9 CAT HAB" que fica ao lado do CPF e nº registro (frente da CNH).
  NÃO extraia da grade/tabela de categorias (verso/rodapé) que lista ACC, A, B, C, D etc com datas.
  A grade é apenas um detalhamento — a categoria principal está no campo "9 CAT HAB".
- Categorias válidas: A, B, C, D, E, AB, AC, AD, AE, ACC
```

### Escopo
- 1 arquivo: `supabase/functions/document-ocr/index.ts`
- Redeploy da Edge Function `document-ocr`


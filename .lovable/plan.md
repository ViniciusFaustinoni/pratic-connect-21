## Causa raiz

Olhando a CNH-e do teste lado a lado com o que veio extraído:

- Campo **"9 CAT HAB"** (a categoria de habilitação real, embaixo, ao lado do nº registro `07064650202`) = **`B`**
- Campo **"ACC"** (caixinha no topo, ao lado da validade `18/01/2033`) = **`D`** — isso **NÃO é categoria**, é a observação de Atividade Remunerada / código de exercício de atividade. Aparece como uma letra solta grande, visualmente quase idêntica ao campo CAT HAB.

A IA (Claude Sonnet) está confundindo as duas caixas porque:
1. As duas mostram **uma única letra grande** dentro de um retângulo.
2. As duas ficam **muito próximas** verticalmente no layout do SENATRAN.
3. O rótulo "ACC" é pequeno e fica em cima da caixa; o rótulo "9 CAT HAB" idem. Sem leitura espacial precisa, o modelo escolhe o errado.

O prompt atual (`document-ocr/index.ts` linha 405) **já diz** "leia EXCLUSIVAMENTE do campo 9 CAT HAB", mas isso não basta — falta dizer explicitamente o que é o campo ACC e que ele **não deve** ser confundido com categoria. Também falta uma camada de validação cruzada usando a **grade de categorias habilitadas** (verso/rodapé), que tem uma data de validade ao lado da categoria principal — no nosso caso, `B → 18/01/2033` bate exatamente com a validade da CNH, confirmando que B é a correta.

O regex de fallback nativo (linha 834) está correto, mas só roda quando o PDF tem texto extraível. CNH-e SENATRAN é PDF-imagem (rasterizada), então só o caminho IA é executado e o erro passa.

## Solução

Duas camadas defensivas no `supabase/functions/document-ocr/index.ts`:

### 1. Reforçar o prompt da CNH (linha 405)

Trocar a instrução atual por uma que descreve explicitamente o campo ACC como armadilha:

```
- CATEGORIA: leia EXCLUSIVAMENTE do campo rotulado "9 CAT HAB" 
  (fica EMBAIXO, ao lado do "Nº REGISTRO" de 11 dígitos).
  
  ARMADILHA — NÃO LEIA DESTES OUTROS CAMPOS:
  • Campo "ACC" (caixa pequena no TOPO, ao lado da VALIDADE): contém uma 
    letra solta (frequentemente D/E) que indica Atividade Remunerada / 
    código de exercício — NÃO é categoria de habilitação.
  • Grade/tabela de categorias no verso (ACC, A, A1, B, B1, C, C1, D, D1, 
    BE, CE, DE, C1E, D1E com datas ao lado): é apenas o detalhamento das 
    categorias habilitadas, não a categoria principal.
  
  VALIDAÇÃO CRUZADA: a categoria do campo "9 CAT HAB" SEMPRE aparece 
  também na grade do verso com uma data de validade ao lado — essa data 
  bate (ou é próxima) da validade principal da CNH. Use isso para confirmar.
  
  Categorias válidas: ACC, A, A1, B, B1, C, C1, D, D1, E, AB, AC, AD, AE, 
  BE, CE, DE, C1E, D1E.
```

### 2. Validação programática pós-IA

Logo após receber `dados.categoria` da IA, aplicar uma checagem em `extractCnhFields` e no merge final:

- Se `categoria` veio como `D` ou `E` mas a IA também extraiu uma data na grade que mostra `B → <validade>` (ou outra categoria com data igual à validade da CNH), **sobrescrever** com a categoria que tem a data batendo.
- Adicionar `categoria` à lista de campos suspeitos quando o valor for `D`/`E` mas o `numero_registro` não combina com o padrão de motorista profissional (heurística leve, só para sinalizar baixa confiança).

Isso é uma rede de segurança — o reforço do prompt deve resolver 95% dos casos sozinho.

### 3. Atualizar o regex nativo (linha 834) para cobrir todas as categorias

O regex atual `/CAT[\.\s]*HAB[^\w]*([A-E]{1,2}|ACC)/i` deixa de fora `A1`, `B1`, `C1`, `D1`, `C1E`, `D1E`. Trocar por:

```ts
const catMatch = text.match(/CAT[\.\s]*HAB[^\w]*(ACC|A1|A|B1|B|C1E|C1|CE|C|D1E|D1|DE|D|E|AB|AC|AD|AE|BE)/i);
```

(ordem por especificidade para casar `C1E` antes de `C1` antes de `C`).

## Teste de validação

Após as mudanças, reprocessar a mesma CNH-e (Marcus Vinicius — `CNH-e.pdf_1-8.pdf`) e confirmar:

- `categoria === "B"` (não mais `D`)
- `confianca >= 0.9`
- Nenhum outro campo regrediu (nome, CPF, validade, nº registro continuam corretos)

Se passar, o fix está completo. Se a IA ainda errar mesmo com o prompt reforçado, ativamos a camada (2) de validação cruzada via data da grade.

## Arquivo alterado

- `supabase/functions/document-ocr/index.ts` (prompt CNH + regex nativo + validação opcional pós-IA)

Nenhuma migração de banco, nenhuma mudança de UI.

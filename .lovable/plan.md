

# Corrigir erro de parse no document-ocr (JSON truncado)

## Problema Raiz

A IA retorna respostas JSON que sao **truncadas** porque `max_tokens: 2500` nao e suficiente para respostas complexas, especialmente quando incluem `validacao_titularidade` com nomes longos. O JSON cortado no meio falha no `JSON.parse()`, gerando erro 500 que aparece como "Edge Function returned a non-2xx status code".

Exemplo do log: a resposta do CRLV foi cortada no meio da frase `"observacao": "Titular do documento (MARIA ELIZABETE FAUSTINONI) diverge do associado` - sem fechar aspas, chaves ou colchetes.

## Solucao (2 partes)

### 1. Aumentar max_tokens e usar modelo mais rapido

Alterar de `max_tokens: 2500` para `max_tokens: 4000` para evitar truncamento. Tambem considerar usar `google/gemini-2.5-flash` que e mais rapido e gera respostas mais concisas (o prompt ja e bem detalhado e nao precisa do Pro para OCR).

### 2. Implementar recuperacao de JSON truncado

Quando o `JSON.parse` falhar, tentar "reparar" o JSON truncado antes de retornar erro 500. Isso garante que mesmo com truncamento parcial, os dados ja extraidos sejam aproveitados.

Logica de reparo:
- Contar chaves/colchetes abertos e fechar os pendentes
- Truncar strings nao finalizadas
- Se ainda falhar, tentar extrair campos individuais via regex como fallback

### Arquivo a alterar

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/document-ocr/index.ts` | Aumentar max_tokens para 4000, adicionar funcao de reparo de JSON truncado antes do fallback de erro |

## Detalhes Tecnicos

### Funcao de reparo de JSON truncado

```text
function tryRepairTruncatedJSON(raw: string): object | null {
  // Remover markdown backticks
  let s = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  // Truncar string nao fechada no final
  // Ex: ..."observacao": "Titular diverge  (cortado aqui)
  // -> remover a ultima string incompleta e fechar
  
  // Contar { vs } e [ vs ]
  // Adicionar fechamentos faltantes
  
  // Tentar JSON.parse novamente
  
  // Se falhar, retornar null (ai sim retorna erro 500)
}
```

### Na secao de parse (linhas 404-424)

```text
Antes:
  result = JSON.parse(cleanContent);
} catch {
  return Response 500

Depois:
  result = JSON.parse(cleanContent);
} catch {
  // Tentar reparar JSON truncado
  const repaired = tryRepairTruncatedJSON(content);
  if (repaired) {
    console.warn('[OCR] JSON reparado apos truncamento');
    result = repaired;
  } else {
    return Response 500
  }
}
```


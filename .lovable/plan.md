

## Plano: Corrigir bug "Body is unusable" no fallback da edge function

### Problema
Na edge function `rastreador-posicao`, o body do request é consumido na linha 427 (`await req.json()`). Quando ocorre um erro e o código entra no bloco catch (linha 643), ele tenta `req.clone().json()` na linha 657, mas o body já foi consumido, gerando `TypeError: Body is unusable`. Isso impede que o fallback para a última posição conhecida funcione.

### Solução
Salvar o `rastreador_id` em uma variável no escopo externo ao try/catch, eliminando a necessidade de re-ler o request body no bloco catch.

### Detalhes técnicos

**Arquivo:** `supabase/functions/rastreador-posicao/index.ts`

1. Declarar `let rastreadorIdForFallback: string | null = null;` antes do try/catch (antes da linha 421)
2. Após a linha 427 (`const { rastreador_id } = await req.json();`), atribuir `rastreadorIdForFallback = rastreador_id;`
3. No bloco catch (linha 657), substituir `const body = await req.clone().json().catch(() => ({}));` por usar diretamente `rastreadorIdForFallback`
4. Remover a verificação `if (body.rastreador_id)` e usar `if (rastreadorIdForFallback)` diretamente

Mudança mínima, sem alteração de lógica - apenas corrige o acesso ao body já consumido.


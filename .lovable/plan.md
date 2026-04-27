# Correção: Edge Function `deslogar-todos-usuarios`

## Diagnóstico

O erro de CORS no preflight (`OPTIONS sem HTTP ok status`) indica que a edge function **não está respondendo** — não é problema de header. Confirmações:

- O código já trata `OPTIONS` corretamente e devolve `corsHeaders`.
- Não há **nenhum log** registrado para a função (`deslogar-todos-usuarios`) na Supabase, ou seja, o boot está falhando antes de qualquer requisição ser processada.
- A causa mais provável é a importação via `https://esm.sh/@supabase/supabase-js@2.45.0`, que costuma quebrar o deploy do edge-runtime (drift de redirects/integrity hashes do esm.sh).

## Correção

Trocar o import do `createClient` para o specifier `npm:`, que é estável no edge-runtime:

```ts
// antes
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// depois
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';
```

Nenhuma outra mudança é necessária — os `corsHeaders`, o handler de `OPTIONS` e as respostas já estão corretos.

## Validação

1. Após o deploy automático, abrir `Configurações > Usuários e Acessos`, clicar em **Deslogar todos os usuários** e confirmar.
2. Verificar nos logs da função o registro da execução e a inserção em `logs_auditoria`.



## Corrigir 401 da Hinova na sincronização financeira individual

### Causa raiz

Há **duas implementações divergentes** de leitura/decriptação das credenciais Hinova armazenadas em `integracoes_credenciais`:

| Função | Como deriva a chave de decriptação |
|---|---|
| `sga-hinova-sync` (que **funciona** ao cadastrar associado/veículo) | Usa **somente** `SUPABASE_SERVICE_ROLE_KEY` (mesmo segredo usado no `integracoes-credenciais` que **encripta**) |
| `_shared/hinova-client.ts → getHinovaCreds` (usado pela sync financeira) | `INTEGRACOES_ENCRYPTION_KEY` **se existir**, senão cai para `SUPABASE_SERVICE_ROLE_KEY` |

A função pública `integracoes-credenciais` salva o registro **sempre** encriptado com `SUPABASE_SERVICE_ROLE_KEY`. Se `INTEGRACOES_ENCRYPTION_KEY` estiver definido com qualquer outro valor, `getHinovaCreds` deriva uma chave diferente, a decriptação silenciosa falha (catch + `console.warn` no shared) e retorna `null` — ou pior: decripta um JSON corrompido com `usuario`/`senha` lixo, resultando em **401 "Login ou senha inválido"** na Hinova. Esse é exatamente o erro visto no log da última execução.

`sga-hinova-sync` não cai nessa armadilha porque é hardcoded em `SUPABASE_SERVICE_ROLE_KEY`, igual ao salvador.

### Correção

**1. Alinhar `_shared/hinova-client.ts` à fonte de verdade do encriptador**

Trocar a ordem de preferência da chave em `getHinovaCreds` para:

```ts
const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
```

(remover o `INTEGRACOES_ENCRYPTION_KEY`). Justificativa: o `integracoes-credenciais` **nunca** usa `INTEGRACOES_ENCRYPTION_KEY` — é morto. Manter a opção é só fonte de bug futuro.

**2. Falhar alto, não silenciar**

No `getHinovaCreds`, quando o registro do banco existir como `configurado=true` mas a decriptação lançar, **propagar o erro** com mensagem clara (`'Falha ao decriptar credenciais Hinova — verifique INTEGRACOES_ENCRYPTION_KEY/SERVICE_ROLE_KEY'`) em vez de devolver `null`. Hoje o `console.warn` engole o problema e o caller só vê "Credenciais Hinova não configuradas", o que não orienta o diagnóstico.

**3. Validar campos obrigatórios após decriptação**

Após `JSON.parse`, exigir `token`, `usuario`, `senha` não-vazios. Se algum vier vazio (ex.: registro antigo migrado), lançar `Error('Credenciais Hinova incompletas no banco — refaça o cadastro em Configurações > Integrações')` em vez de tentar autenticar com string vazia (que gera o 401 enganoso).

**4. Logar resposta da Hinova em caso de 401**

Em `autenticarHinova`, quando `r.status === 401`, gravar uma linha em `sga_sync_logs` com `action='autenticar'`, `status='error'` e `error_message` contendo o `mensagem` retornado pela Hinova. Hoje só vai pro `console.error`. Sem isso a UI mostra "0 boletos importados" e ninguém percebe.

**5. Propagar erro ao frontend**

No `sga-sync-financeiro-veiculo`, quando `autenticarHinova` lançar, devolver `json(200, { success: false, error: '<mensagem da Hinova>' })` em vez do genérico atual. O hook `useSGASync` já tem `onError` ligado ao toast — só precisa receber a mensagem.

### Critérios de aceitação

1. Botão "Atualizar agora" no modal de detalhes do veículo executa a sincronização com sucesso (mesmas credenciais que `sga-hinova-sync` já usa para cadastro de associado).
2. `sga_sync_logs` recebe registro `action='autenticar'` em todas as execuções da sync financeira (sucesso e falha).
3. Em caso de 401 da Hinova, o toast no frontend mostra a mensagem real ("Login ou senha inválido", etc.) em vez de "0 boletos importados".
4. `cron-sga-sync-financeiro-diario` (que reusa o mesmo `getHinovaCreds`) também volta a funcionar sem qualquer mudança nele — herda a correção pelo shared client.

### Fora de escopo

- Trocar credenciais reais da Hinova (não é necessário — a evidência é que estão corretas no banco; o bug é o caminho de leitura).
- Refatorar `sga-hinova-sync` para usar o shared client (separado, não bloqueia esta correção).
- Remover `INTEGRACOES_ENCRYPTION_KEY` de outros lugares (faz parte de outra varredura).




## Situacao Atual — O Que os Logs Revelam

Os logs do `sga_sync_logs` mostram que a sincronizacao do Marcus Vinicius **autentica com sucesso** mas **trava na etapa do associado**:

```text
1. autenticar → OK (token_usuario retornado)
2. cadastrar_associado → ERRO 406: "Já existe um associado com o CPF 12493649737"
3. Recovery por CPF (4 endpoints) → NENHUM retorna codigo_associado
4. Resultado: "CPF já cadastrado mas código não recuperado" → sync aborta
```

O veiculo **nunca chega a ser registrado** porque a funcao nao consegue resolver o `codigo_associado` existente no Hinova.

A raiz: os 4 endpoints de busca por CPF (`GET /associado/buscar/{cpf}/cpf`, `POST /associado/consultar`, etc.) nao retornam dados uteis — ou a resposta nao e JSON, ou o campo `codigo_associado` nao esta no formato esperado. A funcao descarta silenciosamente e aborta.

---

## Plano de Correcao (2 partes)

### Parte 1: Diagnostico — logging completo nas buscas

Em `sga-hinova-sync/index.ts`, na secao de busca por CPF (passo 4.5, linhas ~604-683) e na recovery pos-duplicata (linhas ~814-836):

- Logar TODAS as respostas (status, headers, body ate 500 chars) independente do content-type
- Gravar um `sga_sync_logs` entry com action `busca_cpf_diagnostico` para cada tentativa, mesmo quando falha
- Isso permitira ver exatamente o que a API Hinova retorna e ajustar o parser

### Parte 2: Fallback robusto — extrair codigo da resposta de erro

A resposta de erro do `cadastrar` e:
```json
{"error":["Já existe um associado com o CPF 12493649737 cadastrado no sistema"],"mensagem":"Não aceitável"}
```

Adicionar mais uma estrategia de recovery:
- Tentar `GET /associado/consultar/cpf/{cpf}` (outro formato de URL)
- Tentar `GET /associado/{cpf}` (busca direta)  
- Tentar `POST /associado/pesquisar` com body `{"cpf": "12493649737"}`
- Parsear respostas mesmo com status 404/406 — Hinova pode retornar dados em status nao-200
- Em ULTIMO CASO: logar erro claro com instrucoes para o operador inserir o `codigo_hinova` manualmente no banco (campo `associados.codigo_hinova`)

### Parte 3: Como testar

Apos o deploy:
1. Na tela de associados, localizar Marcus Vinicius
2. Clicar em "Ativar no SGA" (ou "Tentar Novamente" se estiver em erro)
3. Verificar os logs na tabela `sga_sync_logs` — agora mostrarao exatamente o que cada endpoint retornou
4. Com base nas respostas reais, ajustar o parser para o formato correto da API Hinova

**Arquivo modificado:** `supabase/functions/sga-hinova-sync/index.ts`


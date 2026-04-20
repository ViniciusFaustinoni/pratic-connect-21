

## Erro ao gerar contrato — causa raiz identificada

### Diagnóstico
Edge Function `contrato-gerar` falha no INSERT em `public.contratos` com:
```
22001 — value too long for type character varying(100)
```
A cotação `COT-20260420-131917085-582` (Cleber / Chevrolet Montana) tem **`cliente_complemento` com 121 caracteres** ("Casa Referencia: Entrar na rua do bar floresta próxima a ponte Cachoeira Grande, virar na próxima à direita, final da rua"), enquanto a coluna `contratos.cliente_complemento` é `VARCHAR(100)`.

Outros campos VARCHAR(100) na mesma tabela com risco de estourar em outras cotações: `cliente_bairro`, `cliente_cidade`, `cliente_complemento`, `cliente_profissao`, `veiculo_marca`, `veiculo_modelo`, `veiculo_financeira`. Em `cotacoes`, vários desses campos são `text` (sem limite) — o limite mais curto na tabela `contratos` é o gargalo.

### Solução

**1. Migration — relaxar limites em `contratos`** (única forma definitiva, evita perder dado de endereço inserido pelo cliente):

```sql
ALTER TABLE public.contratos
  ALTER COLUMN cliente_complemento  TYPE varchar(255),
  ALTER COLUMN cliente_bairro       TYPE varchar(150),
  ALTER COLUMN cliente_cidade       TYPE varchar(150),
  ALTER COLUMN cliente_profissao    TYPE varchar(150),
  ALTER COLUMN veiculo_marca        TYPE varchar(150),
  ALTER COLUMN veiculo_modelo       TYPE varchar(255),
  ALTER COLUMN veiculo_financeira   TYPE varchar(150);
```

Sem perda de dado, sem reescrita de tabela pesada (PostgreSQL faz `ALTER TYPE varchar(N)→varchar(M>N)` apenas validando metadado).

**2. Defesa em profundidade — sanitizar no edge function** `supabase/functions/contrato-gerar/index.ts` (~linha 803). Antes do INSERT, truncar com segurança qualquer campo string preservando o que couber, p. ex.:

```ts
const cap = (v: string | null | undefined, n: number) =>
  v == null ? v : (v.length > n ? v.slice(0, n) : v);
```
e aplicar em `cliente_complemento`, `cliente_bairro`, `cliente_cidade`, `cliente_profissao`, `veiculo_marca`, `veiculo_modelo` usando os novos limites. Garante que cotações antigas/futuras nunca quebrem mesmo se o cliente colar texto enorme.

**3. Reprocessar a cotação travada do Cleber**
Após deploy, o usuário clica em "Tentar Novamente" — o fluxo é idempotente (já tem checagem de contrato existente nas linhas 224-235). Não precisa intervenção manual no banco.

### Arquivos alterados
- `supabase/migrations/<timestamp>_aumentar_limites_varchar_contratos.sql` (novo)
- `supabase/functions/contrato-gerar/index.ts` — adicionar helper `cap()` e envolver os 7 campos no objeto do INSERT (linhas ~830-866).

### Validação
1. Abrir o link público da cotação `COT-20260420-131917085-582` → clicar **Tentar Novamente** na etapa Contrato → contrato gerado com sucesso, segue para Autentique.
2. Conferir nos logs `contrato-gerar` ausência do erro `22001`.
3. Verificar no banco que `contratos.cliente_complemento` foi gravado com os 121 caracteres completos.


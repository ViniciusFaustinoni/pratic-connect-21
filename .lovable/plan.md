
# Corrigir Exibicao da Cota de Coparticipacao

## Problema

A Edge Function `validar-link-evento` busca os dados do plano usando nomes de colunas **inexistentes**:

| Coluna buscada (errada) | Coluna real na tabela `planos` |
|---|---|
| `percentual_cota_participacao` | `cota_participacao` |
| `cota_participacao_minima` | `cota_minima` |

Como as colunas nao existem, o Supabase retorna `null` silenciosamente, e o fallback `|| 0` faz o percentual e a cota minima aparecerem como **0%** e **R$ 0,00** na tela de pagamento, mesmo que o plano tenha 6% e R$ 1.200,00 configurados.

O valor final (R$ 750,00) esta correto porque foi calculado pela `aprovar-sinistro` (que usa os nomes corretos) e esta salvo no sinistro. O problema e apenas na **exibicao** dos detalhes do calculo.

## Solucao

### Arquivo: `supabase/functions/validar-link-evento/index.ts`

Corrigir os nomes das colunas no select do plano (linha ~87):

```text
// ANTES:
.select("nome, percentual_cota_participacao, cota_participacao_minima")

// DEPOIS:
.select("nome, cota_participacao, cota_minima")
```

E ajustar as referencias logo abaixo (linhas ~93-94):

```text
// ANTES:
percentual = plano.percentual_cota_participacao || 0;
cotaMinima = plano.cota_participacao_minima || 0;

// DEPOIS:
percentual = plano.cota_participacao || 0;
cotaMinima = plano.cota_minima || 0;
```

### Deploy

Redeployar a Edge Function `validar-link-evento`.

## Resultado Esperado

A tela de pagamento passara a exibir corretamente:
- Percentual do plano: **6%** (em vez de 0%)
- Cota minima: **R$ 1.200,00** (em vez de R$ 0,00)
- Valor da cota: **R$ 750,00** (ja estava correto - nao muda)

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/validar-link-evento/index.ts` | Corrigir nomes de 2 colunas no select e nas referencias |

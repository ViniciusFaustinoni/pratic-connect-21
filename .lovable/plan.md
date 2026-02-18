
# Corrigir duplicacao de faturas de cota de coparticipacao

## Causa raiz

A tabela `asaas_cobrancas` tem um CHECK constraint no campo `tipo` que so aceita: `'mensalidade', 'adesao', 'servico', 'multa', 'outro'`. Porem, o codigo de **4 Edge Functions** tenta inserir com `tipo: 'cota_participacao'`, que nao esta na lista permitida.

O que acontece:

```text
Termo assinado (webhook Autentique)
  |
  v
Cria cobranca PIX no Asaas --> SUCESSO (cobra o associado)
  |
  v
Salva na tabela asaas_cobrancas com tipo='cota_participacao' --> ERRO (check constraint)
  |
  v
cobranca_cota_id permanece NULL no sinistro
  |
  v
Proxima verificacao ve que nao tem cobranca local --> cria OUTRA no Asaas
  |
  v
Loop de duplicacao
```

Os logs do Postgres confirmam 3 erros consecutivos de `asaas_cobrancas_tipo_check` nos ultimos minutos.

## Solucao

### 1. Alterar o CHECK constraint (migration SQL)

Adicionar `'cota_participacao'` a lista de valores permitidos no campo `tipo`:

```text
ALTER TABLE asaas_cobrancas DROP CONSTRAINT asaas_cobrancas_tipo_check;
ALTER TABLE asaas_cobrancas ADD CONSTRAINT asaas_cobrancas_tipo_check
  CHECK (tipo IN ('mensalidade', 'adesao', 'servico', 'multa', 'outro', 'cota_participacao'));
```

### 2. Adicionar protecao contra duplicatas nas Edge Functions

Em cada funcao que cria cobranca de cota, adicionar verificacao antes de chamar o Asaas:

- **`autentique-webhook/index.ts`** (~linha 600): verificar se ja existe cobranca Asaas para o sinistro antes de criar nova
- **`processar-termo-evento/index.ts`** (~linhas 260 e 400): mesma verificacao
- **`retroativo-pagamento-termo/index.ts`** (~linha 100): ja tem filtro parcial (`cobranca_cota_id IS NULL`), mas adicionar verificacao por `asaas_cobrancas` tambem

A verificacao sera:

```text
Buscar em asaas_cobrancas WHERE associado_id = X AND tipo = 'cota_participacao' AND referencia = protocolo AND status != 'CANCELLED'
Se encontrou --> pular criacao, usar a existente
```

### 3. Corrigir sinistro SIN-20260217-0008 (dados existentes)

Verificar no Asaas quais cobranças duplicadas foram criadas e:
- Cancelar as duplicadas no Asaas
- Inserir o registro correto na tabela `asaas_cobrancas` (agora que o constraint permite)
- Atualizar `cobranca_cota_id` no sinistro

## Arquivos alterados

1. **Migration SQL** -- alterar CHECK constraint
2. **`supabase/functions/autentique-webhook/index.ts`** -- verificacao anti-duplicata
3. **`supabase/functions/processar-termo-evento/index.ts`** -- verificacao anti-duplicata
4. **`supabase/functions/retroativo-pagamento-termo/index.ts`** -- verificacao anti-duplicata

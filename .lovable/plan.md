
# Edge Function processar-pos-retirada + Migrations

## Passo 1 — Migration: Novas colunas em associados

Adicionar 6 colunas na tabela `associados` (que ja tem `motivo_cancelamento` e `data_cancelamento`):

```sql
ALTER TABLE associados 
ADD COLUMN IF NOT EXISTS pode_reativar boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS tipo_saida varchar(50),
ADD COLUMN IF NOT EXISTS data_efetiva_saida timestamptz,
ADD COLUMN IF NOT EXISTS cancelado_por uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS boleto_final_gerado boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS asaas_recorrencia_cancelada boolean DEFAULT false;
```

## Passo 2 — Migration: Novas colunas em associados_historico

A tabela ja possui `metadata` e `created_at`. Adicionar as 4 colunas restantes:

```sql
ALTER TABLE associados_historico
ADD COLUMN IF NOT EXISTS acao varchar(50),
ADD COLUMN IF NOT EXISTS status_anterior varchar(50),
ADD COLUMN IF NOT EXISTS status_novo varchar(50),
ADD COLUMN IF NOT EXISTS motivo text,
ADD COLUMN IF NOT EXISTS executado_por uuid REFERENCES auth.users(id);
```

## Passo 3 — Edge Function: processar-pos-retirada

Criar `supabase/functions/processar-pos-retirada/index.ts` seguindo o mesmo padrao do `concluir-retirada`.

Recebe: `servico_id`, `associado_id`, `motivo_retirada`, `executado_por`.

Logica (switch em `motivo_retirada`):

```text
cancelamento_voluntario:
  -> status = cancelado, tipo_saida = cancelamento_voluntario, pode_reativar = true
  -> Inativa veiculo
  -> Registra historico

inadimplencia:
  -> status = cancelado, tipo_saida = inadimplencia, pode_reativar = true
  -> Inativa veiculo
  -> Registra historico

exclusao_diretoria:
  -> status = cancelado, tipo_saida = exclusao_diretoria, pode_reativar = false
  -> Inativa veiculo
  -> Registra historico

substituicao_veiculo:
  -> NAO muda status (associado continua ativo)
  -> NAO inativa veiculo
  -> Registra historico com acao = substituicao

busca_apreensao:
  -> status = bloqueado, tipo_saida = busca_apreensao, pode_reativar = false
  -> Inativa veiculo
  -> Registra historico
```

Validacoes antes do switch:
- Servico deve existir e estar concluido
- Associado deve existir
- pendencia_rastreador deve ser false

Em todos os casos (exceto substituicao), executa:
```sql
UPDATE veiculos SET ativo = false, status = 'cancelado' WHERE associado_id = X AND ativo = true
```

## Passo 4 — Registrar no config.toml

Adicionar `[functions.processar-pos-retirada]` com `verify_jwt = false`.

## Passo 5 — Deploy

Fazer deploy da edge function.

## Detalhes tecnicos

### Validacao de pre-condicoes

A funcao verifica 3 condicoes antes de processar:
1. Servico existe e status = 'concluida' (nao 'concluido' — verificar valor real no banco)
2. Associado existe
3. pendencia_rastreador = false

### Historico

Cada caminho insere em `associados_historico` com:
- associado_id, tipo = 'status_alterado', descricao, dados_anteriores, dados_novos (campos existentes)
- acao, status_anterior, status_novo, motivo, executado_por (campos novos)

### Retorno

Retorna JSON com `success`, `acao`, `proximo_passo` indicando o que o sistema/usuario deve fazer em seguida (ex: cancelar recorrencia ASAAS, notificar formalmente, iniciar fluxo de substituicao).

### Arquivos afetados

1. Migration SQL (2 ALTER TABLEs)
2. `supabase/functions/processar-pos-retirada/index.ts` (novo)
3. `supabase/config.toml` (adicionar entrada)

### O que NAO sera alterado

- `supabase/functions/concluir-retirada/index.ts` — permanece intacto
- Nenhum componente frontend sera modificado
- Nenhuma tabela existente tera colunas removidas ou renomeadas

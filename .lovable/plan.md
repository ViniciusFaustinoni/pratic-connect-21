## Causa raiz

A `efetivar-troca-titularidade` faz tudo que precisa do veículo/contrato (transfere `veiculos.associado_id`, cancela `contratos` antigo, cria contrato novo, sincroniza SGA), mas **nunca toca em `associados.status` do antigo proprietário**. Resultado: mesmo após a troca, o registro do antigo continua `status='ativo'` e aparece com o badge "Associado Ativo" nas listas.

Confirmado em prod para KOU6D37:
- Veículo ainda aponta para Marcos (`6ab4887f…`) — porque a troca está em `liberada_para_assinatura`, contrato novo `assinado` mas ainda não houve vistoria que dispare a efetivação.
- Marcos tem outro veículo (QOO5C17 / `em_analise`). Ou seja: **não pode** marcar inativo cego — só se ele não tiver mais nenhum vínculo ativo após a troca.

## Correção (raiz)

### 1. Edge `efetivar-troca-titularidade` — desativação condicional do antigo

Logo após a etapa 8 (cancelar contrato anterior) e antes do retorno final, adicionar bloco:

```text
- Buscar contratos do antigo titular (solicitacao.associado_id) com status IN ('ativo','assinado','pendente').
- Buscar veiculos do antigo titular com status NOT IN ('cancelado','vendido','transferido').
- Se ambos zerados → UPDATE associados SET status='inativo', inativado_em=now(),
  motivo_inativacao='Troca de titularidade — sem vínculos ativos restantes' WHERE id=solicitacao.associado_id.
- Registrar em associados_historico (tipo='inativado_troca_titularidade').
- Caso ainda haja vínculos, log informativo (mantém ativo) e segue o fluxo.
```

Nada mais muda na função; a Cenário A (pré-vistoria) e Cenário B (pós-vistoria) compartilham esse bloco porque ambos chegam ao mesmo ponto após cancelar o contrato.

### 2. Migração — função `fn_inativar_associado_se_orfao` + backfill

Função reutilizável (idempotente) que aplica a mesma lógica via SQL — útil tanto para o backfill agora quanto como utilitário para qualquer outro fluxo (cancelamento, exclusão, troca):

```sql
CREATE OR REPLACE FUNCTION public.fn_inativar_associado_se_orfao(_associado_id uuid, _motivo text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_contratos int; v_veiculos int;
BEGIN
  SELECT count(*) INTO v_contratos FROM contratos
   WHERE associado_id=_associado_id AND status IN ('ativo','assinado','pendente');
  SELECT count(*) INTO v_veiculos FROM veiculos
   WHERE associado_id=_associado_id AND status NOT IN ('cancelado','vendido','transferido');
  IF v_contratos=0 AND v_veiculos=0 THEN
    UPDATE associados SET status='inativo', updated_at=now() WHERE id=_associado_id AND status<>'inativo';
    INSERT INTO associados_historico(associado_id, tipo, descricao)
      VALUES (_associado_id, 'inativado_orfao', _motivo);
    RETURN true;
  END IF;
  RETURN false;
END $$;
```

**Backfill** (executar uma vez): para todo `associado_antigo_id` de trocas com `efetivada_em IS NOT NULL`, chamar `fn_inativar_associado_se_orfao(...)`.

### 3. Validação pós-deploy

1. Disparar a próxima troca real até a vistoria — ao concluir, conferir que o antigo vira `inativo` (se sem outros vínculos) ou permanece `ativo` (se ainda tem outros veículos), com log explicando.
2. Para Marcos (KOU6D37): a troca ainda está em `liberada_para_assinatura`, então ele continuará `ativo` (correto — tem QOO5C17 em análise). Quando concluir, se QOO5C17 não estiver ativo, a função vai inativá-lo automaticamente.
3. Conferir em `associados_historico` o registro `inativado_orfao`.

## Arquivos afetados

- `supabase/functions/efetivar-troca-titularidade/index.ts` — bloco de inativação condicional do antigo.
- Nova migração SQL — função `fn_inativar_associado_se_orfao` + backfill aplicado às trocas já efetivadas.

Sem alterações de UI: o badge "Associado Ativo" já reflete `associados.status` corretamente; basta a fonte parar de ser `'ativo'` quando não houver mais vínculos.

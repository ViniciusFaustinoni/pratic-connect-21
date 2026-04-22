

## Corrigir erro `invalid input value for enum status_servico: "concluido"` na atribuição de serviços

### Causa raiz

O trigger `trg_troca_vistoria_concluida` (função `tg_troca_vistoria_concluida`) foi criado no fluxo de Troca de Titularidade comparando o status com o literal **`'concluido'`** (masculino). O enum real `status_servico` usa **`'concluida'`** (feminino) — não existe `concluido`. Como o trigger é `AFTER UPDATE OF status`, ele dispara em **qualquer** alteração de status (incluindo a atribuição manual `status='agendada'`), e o Postgres falha ao tentar comparar `NEW.status` com um literal inexistente no enum.

Resultado: nenhuma atribuição manual funciona — nem rota, nem outros updates de status — desde a criação desse trigger.

### Correção

**1. Migration SQL** corrigindo a função do trigger:

```sql
CREATE OR REPLACE FUNCTION public.tg_troca_vistoria_concluida()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'concluida'::status_servico
     AND (OLD.status IS DISTINCT FROM 'concluida'::status_servico) THEN
    UPDATE public.solicitacoes_troca_titularidade
       SET status = 'liberada_para_assinatura',
           updated_at = now()
     WHERE servico_vistoria_id = NEW.id
       AND status = 'aguardando_vistoria';
  END IF;
  RETURN NEW;
END;
$$;
```

Trocas: `'concluido'` → `'concluida'::status_servico` (cast explícito evita reincidência futura).

**2. Auditoria de outros triggers** — varrer no banco quaisquer outras funções/triggers que comparem `status_servico` com `'concluido'` (masculino) e corrigir na mesma migration. Suspeitos já mapeados ficam OK; vamos rodar uma busca completa por `'concluido'` em `pg_proc` filtrando funções que tocam `servicos` para garantir que essa é a única ocorrência.

### Critérios de aceitação

1. Atribuir um serviço a um técnico no painel `/monitoramento/vistorias-instalacoes-mon` (aba Atribuição Manual) **não** mais retorna o erro de enum.
2. O fluxo de Troca de Titularidade continua funcionando: ao concluir a vistoria associada (`status='concluida'`), a `solicitacoes_troca_titularidade` correspondente passa para `liberada_para_assinatura`.
3. Nenhuma outra função do schema referencia o literal inválido `'concluido'` no contexto de `status_servico`.

### Fora de escopo

- Refatorar a aba de Atribuição Manual (não há bug no frontend).
- Mexer em outros triggers de `servicos` (sem evidência de problema).


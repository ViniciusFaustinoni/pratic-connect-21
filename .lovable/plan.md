## Problema

Ao clicar em "Gerar Link" no modal "Atribuir a Prestador Externo", a edge function `gerar-link-prestador` falha com:

```
Could not find the 'atribuido_por' column of 'instalacao_prestador_links' in the schema cache
```

A função tenta gravar `valor` e `atribuido_por` na tabela `instalacao_prestador_links`, mas essas colunas não existem no schema. Por isso a UI exibe "Erro ao atribuir a prestador: Edge Function returned a non-2xx status code".

## Solução

Adicionar as duas colunas ausentes na tabela `instalacao_prestador_links` para que o registro do link guarde o valor combinado e quem fez a atribuição (auditoria + base para o cálculo de comissões/repasse ao prestador).

### Migration

```sql
ALTER TABLE public.instalacao_prestador_links
  ADD COLUMN IF NOT EXISTS valor numeric(12,2),
  ADD COLUMN IF NOT EXISTS atribuido_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_instalacao_prestador_links_atribuido_por
  ON public.instalacao_prestador_links(atribuido_por);
```

- `valor` (numeric 12,2): valor R$ acordado com o prestador (já enviado pelo modal).
- `atribuido_por` (uuid → profiles.id): quem realizou a atribuição.
- Sem alteração de RLS, sem dados existentes afetados (colunas nullable).

## Resultado esperado

Após a migration, ao informar valor e clicar em "Gerar Link", o link é gerado com sucesso, registra o valor e o usuário responsável, e o toast de erro deixa de aparecer.